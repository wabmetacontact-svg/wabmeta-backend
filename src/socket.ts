// src/socket.ts - FINAL FIXED VERSION

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { initializeCampaignSocket } from './modules/campaigns/campaigns.socket';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
  email?: string;
}

let io: Server;
let webhookListenersAttached = false;

export const initializeSocket = (server: HttpServer) => {
  console.log('🔌 Starting Socket.IO...');

  const allowedOrigins = [
    'https://wabmeta.com',
    'https://www.wabmeta.com',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Organization-Id',
        'x-organization-id',
        'Accept',
        'Origin',
      ],
    },
    transports: ['websocket', 'polling'],
    path: '/socket.io/',

    // ✅ Render free tier ke liye optimized timeouts
    pingTimeout: 120000,   // 2 minutes
    pingInterval: 30000,   // 30 seconds
    connectTimeout: 45000,
    maxHttpBufferSize: 1e6,

    perMessageDeflate: {
      threshold: 1024,
    },
  });

  let connectionCount = 0;
  const MAX_CONNECTIONS = 5000;

  // ✅ Auth middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    const orgFromAuth = socket.handshake.auth?.organizationId;

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as any;
        socket.userId = decoded.userId || decoded.id;
        socket.organizationId =
          decoded.organizationId || orgFromAuth;
        socket.email = decoded.email;
      } catch (e) {
        console.warn('⚠️ Invalid socket token - allowing as guest');
        // ✅ Guest connections allow karo (org join manually karenge)
        socket.organizationId = orgFromAuth;
      }
    } else {
      socket.organizationId = orgFromAuth;
    }

    next();
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    connectionCount++;

    if (connectionCount > MAX_CONNECTIONS) {
      console.error('🚨 Max connections reached!');
      socket.disconnect(true);
      connectionCount--;
      return;
    }

    console.log(
      `🔌 Connected: ${socket.id} | User: ${socket.userId || 'guest'} | Org: ${socket.organizationId || 'none'} | Total: ${connectionCount}`
    );

    // ✅ Auto-join org room
    if (socket.organizationId) {
      socket.join(`org:${socket.organizationId}`);
      console.log(`📂 Auto-joined org room: org:${socket.organizationId}`);
    }

    // ✅ Manual org join (frontend se)
    socket.on('org:join', (orgId: string) => {
      if (orgId && typeof orgId === 'string') {
        socket.organizationId = orgId;
        socket.join(`org:${orgId}`);
        console.log(`📂 Manually joined org: org:${orgId}`);
      }
    });

    // ✅ Conversation rooms
    socket.on('join:conversation', (conversationId: string) => {
      if (conversationId && typeof conversationId === 'string') {
        socket.join(`conversation:${conversationId}`);
        console.log(`📂 Joined conversation: ${conversationId}`);
      }
    });

    socket.on('leave:conversation', (conversationId: string) => {
      if (conversationId && typeof conversationId === 'string') {
        socket.leave(`conversation:${conversationId}`);
        console.log(`📤 Left conversation: ${conversationId}`);
      }
    });

    // ✅ Campaign rooms
    socket.on('campaign:join', (id: string) => {
      if (id) socket.join(`campaign:${id}`);
    });

    socket.on('campaign:leave', (id: string) => {
      if (id) socket.leave(`campaign:${id}`);
    });

    // ✅ Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { time: Date.now() });
    });

    socket.on('disconnect', (reason) => {
      connectionCount--;
      console.log(
        `🔌 Disconnected: ${socket.id} | Reason: ${reason} | Total: ${connectionCount}`
      );
    });

    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error.message);
    });
  });

  // Campaign socket initialize
  initializeCampaignSocket(io);

  // ✅ Wire webhook events ONCE
  if (!webhookListenersAttached) {
    wireWebhookEvents();
    webhookListenersAttached = true;
  }

  console.log('✅ Socket.IO ready');
  return io;
};

// ============================================
// ✅ WEBHOOK EVENTS WIRING - FIXED
// ============================================
function wireWebhookEvents() {
  import('./modules/webhooks/webhook.service')
    .then(({ webhookEvents }) => {
      if (!webhookEvents) {
        console.warn('⚠️ webhookEvents not found');
        return;
      }

      // ✅ Remove ALL old listeners first
      webhookEvents.removeAllListeners('newMessage');
      webhookEvents.removeAllListeners('conversationUpdated');
      webhookEvents.removeAllListeners('messageStatus');
      webhookEvents.removeAllListeners('accountUpdated');

      // ============================================
      // ✅ NEW MESSAGE - CRITICAL FIX
      // ============================================
      webhookEvents.on('newMessage', (data: any) => {
        if (!io || !data?.organizationId) return;

        const orgId = data.organizationId;
        const conversationId = data.conversationId;
        const message = data.message;

        if (!message) return;

        const messageId =
          message.id ||
          message.waMessageId ||
          message.wamId;

        console.log(`📡 Socket emit message:new | Org: ${orgId} | Conv: ${conversationId} | Dir: ${message.direction} | ID: ${messageId}`);

        // ✅ CRITICAL: OUTBOUND messages ko ONLY conversation room mein emit karo
        // Frontend ke jo user us conversation mein hai, use NAHI milega dobara
        // (uske paas already optimistic message hai)
        // 
        // INBOUND messages ko org room + conversation room DONO mein emit karo
        // taaki:
        //   1. Jo conversation open hai - use naya message mile
        //   2. Jo conversation list mein hai - unread count update ho

        if (message.direction === 'INBOUND') {
          // ✅ INBOUND: Org room + Conversation room dono
          io.to(`org:${orgId}`)
            .to(`conversation:${conversationId}`)
            .emit('message:new', {
              organizationId: orgId,
              conversationId,
              message: {
                ...message,
                // Ensure timestamps are strings
                createdAt: message.createdAt instanceof Date
                  ? message.createdAt.toISOString()
                  : message.createdAt || new Date().toISOString(),
                timestamp: message.timestamp instanceof Date
                  ? message.timestamp.toISOString()
                  : message.timestamp || message.createdAt || new Date().toISOString(),
              },
              conversation: data.conversation || null,
            });

          console.log(`✅ INBOUND message emitted to org + conversation rooms`);

        } else if (message.direction === 'OUTBOUND') {
          // ✅ OUTBOUND: SIRF status update emit karo
          // Message already frontend pe optimistically add ho chuka hai
          // Hume bas real waMessageId aur status batana hai

          const waMessageId = message.waMessageId || message.wamId;
          const tempId = message.tempId ||
            (message.metadata as any)?.tempId ||
            data.tempId;

          if (waMessageId || tempId) {
            io.to(`org:${orgId}`)
              .to(`conversation:${conversationId}`)
              .emit('message:status', {
                organizationId: orgId,
                conversationId,
                messageId: message.id,
                waMessageId,
                wamId: waMessageId,
                status: 'SENT',
                tempId,
                timestamp: message.sentAt instanceof Date
                  ? message.sentAt.toISOString()
                  : message.sentAt || new Date().toISOString(),
              });

            console.log(`✅ OUTBOUND status emitted: tempId=${tempId} -> waMessageId=${waMessageId}`);
          }
        }
      });

      // ============================================
      // ✅ CONVERSATION UPDATE
      // ============================================
      webhookEvents.on('conversationUpdated', (data: any) => {
        if (!io || !data?.organizationId) return;

        const orgId = data.organizationId;
        const conversation = data.conversation;

        if (!conversation?.id) return;

        console.log(`📡 Socket emit conversation:updated | ${conversation.id}`);

        io.to(`org:${orgId}`).emit('conversation:updated', {
          organizationId: orgId,
          conversation: {
            ...conversation,
            lastMessageAt: conversation.lastMessageAt instanceof Date
              ? conversation.lastMessageAt.toISOString()
              : conversation.lastMessageAt,
            windowExpiresAt: conversation.windowExpiresAt instanceof Date
              ? conversation.windowExpiresAt.toISOString()
              : conversation.windowExpiresAt,
          },
        });
      });

      // ============================================
      // ✅ MESSAGE STATUS
      // ============================================
      webhookEvents.on('messageStatus', (data: any) => {
        if (!io || !data?.organizationId) return;

        const orgId = data.organizationId;
        const conversationId = data.conversationId;

        console.log(`📡 Socket emit message:status | ${data.waMessageId} -> ${data.status}`);

        // ✅ Emit to both org + conversation room
        let target = io.to(`org:${orgId}`);
        if (conversationId) {
          target = target.to(`conversation:${conversationId}`);
        }

        target.emit('message:status', {
          organizationId: orgId,
          conversationId,
          messageId: data.messageId,
          waMessageId: data.waMessageId,
          wamId: data.wamId,
          status: data.status,
          tempId: data.tempId,
          clientMsgId: data.clientMsgId,
          failureReason: data.failureReason,
          timestamp: data.timestamp instanceof Date
            ? data.timestamp.toISOString()
            : data.timestamp || new Date().toISOString(),
        });
      });

      // ============================================
      // ✅ ACCOUNT UPDATED
      // ============================================
      webhookEvents.on('accountUpdated', (data: any) => {
        if (!io || !data?.organizationId) return;
        io.to(`org:${data.organizationId}`).emit('account:updated', data);
      });

      console.log('✅ Webhook events wired successfully');
    })
    .catch((e) => {
      console.error('❌ Failed to wire webhook events:', e.message);
    });
}

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

export const closeSocketIO = async () => {
  if (io) {
    await new Promise<void>((resolve) => {
      io.close(() => {
        console.log('✅ Socket.IO closed');
        resolve();
      });
    });
  }
};

export default { initializeSocket, getIO, closeSocketIO };