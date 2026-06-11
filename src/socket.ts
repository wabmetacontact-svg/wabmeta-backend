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
    pingTimeout: 120000,
    pingInterval: 30000,
    connectTimeout: 45000,
    maxHttpBufferSize: 1e6,
    perMessageDeflate: {
      threshold: 1024,
    },
  });

  let connectionCount = 0;
  const MAX_CONNECTIONS = 5000;

  // ✅ Auth middleware - same as before
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    const orgFromAuth = socket.handshake.auth?.organizationId;

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as any;
        socket.userId = decoded.userId || decoded.id;
        socket.organizationId = decoded.organizationId || orgFromAuth;
        socket.email = decoded.email;
      } catch (e) {
        console.warn('⚠️ Invalid socket token - allowing as guest');
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

    // ✅ NEW: Auto-join user-specific room for force logout
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      console.log(`👤 Auto-joined user room: user:${socket.userId}`);
    }

    // ✅ Manual org join
    socket.on('org:join', (orgId: string) => {
      if (orgId && typeof orgId === 'string') {
        socket.organizationId = orgId;
        socket.join(`org:${orgId}`);
        console.log(`📂 Manually joined org: org:${orgId}`);
      }
    });

    // ✅ NEW: Manual user room join (agar userId token me na ho)
    socket.on('user:join', (userId: string) => {
      if (userId && typeof userId === 'string') {
        socket.userId = userId;
        socket.join(`user:${userId}`);
        console.log(`👤 Manually joined user room: user:${userId}`);
      }
    });

    // ✅ Conversation rooms
    socket.on('join:conversation', (conversationId: string) => {
      if (conversationId && typeof conversationId === 'string') {
        socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on('leave:conversation', (conversationId: string) => {
      if (conversationId && typeof conversationId === 'string') {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // ✅ Campaign rooms
    socket.on('campaign:join', (id: string) => {
      if (id) socket.join(`campaign:${id}`);
    });

    socket.on('campaign:leave', (id: string) => {
      if (id) socket.leave(`campaign:${id}`);
    });

    // ✅ Ping/pong
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

  initializeCampaignSocket(io);

  if (!webhookListenersAttached) {
    wireWebhookEvents();
    webhookListenersAttached = true;
  }

  console.log('✅ Socket.IO ready');
  return io;
};

// ============================================
// WEBHOOK EVENTS - same as before
// ============================================
function wireWebhookEvents() {
  import('./modules/webhooks/webhook.service')
    .then(({ webhookEvents }) => {
      if (!webhookEvents) {
        console.warn('⚠️ webhookEvents not found');
        return;
      }

      webhookEvents.removeAllListeners('newMessage');
      webhookEvents.removeAllListeners('conversationUpdated');
      webhookEvents.removeAllListeners('messageStatus');
      webhookEvents.removeAllListeners('accountUpdated');

      webhookEvents.on('newMessage', (data: any) => {
        if (!io || !data?.organizationId) return;

        const orgId = data.organizationId;
        const conversationId = data.conversationId;
        const message = data.message;

        if (!message) return;

        const normalizedMessage = {
          ...message,
          createdAt: message.createdAt instanceof Date
            ? message.createdAt.toISOString()
            : message.createdAt || new Date().toISOString(),
          timestamp: message.timestamp instanceof Date
            ? message.timestamp.toISOString()
            : message.timestamp || message.createdAt || new Date().toISOString(),
        };

        if (message.direction === 'INBOUND') {
          io.to(`org:${orgId}`)
            .to(`conversation:${conversationId}`)
            .emit('message:new', {
              organizationId: orgId,
              conversationId,
              message: normalizedMessage,
              conversation: data.conversation || null,
            });
        } else if (message.direction === 'OUTBOUND') {
          io.to(`org:${orgId}`)
            .to(`conversation:${conversationId}`)
            .emit('message:new', {
              organizationId: orgId,
              conversationId,
              message: normalizedMessage,
              conversation: data.conversation || null,
            });

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
          }
        }
      });

      webhookEvents.on('conversationUpdated', (data: any) => {
        if (!io || !data?.organizationId) return;

        io.to(`org:${data.organizationId}`).emit('conversation:updated', {
          organizationId: data.organizationId,
          conversation: {
            ...data.conversation,
            lastMessageAt: data.conversation?.lastMessageAt instanceof Date
              ? data.conversation.lastMessageAt.toISOString()
              : data.conversation?.lastMessageAt,
          },
        });
      });

      webhookEvents.on('messageStatus', (data: any) => {
        if (!io || !data?.organizationId) return;

        let target = io.to(`org:${data.organizationId}`);
        if (data.conversationId) {
          target = target.to(`conversation:${data.conversationId}`);
        }

        target.emit('message:status', {
          organizationId: data.organizationId,
          conversationId: data.conversationId,
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

// ============================================
// ✅ Force logout helper - PROFESSIONAL MESSAGES
// ============================================
export const emitForceLogout = (
  userId: string,
  reason: string = 'security_update'
) => {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized, cannot emit force_logout');
    return;
  }

  console.log(`🔒 Force logout emit → user:${userId} | reason: ${reason}`);

  // ✅ Professional messages - no admin reference
  const messages: Record<string, { title: string; message: string }> = {
    password_changed: {
      title: 'Session Expired',
      message:
        'For your security, your session has ended. Please sign in again to continue.',
    },
    account_suspended: {
      title: 'Session Ended',
      message: 'Your session has been ended. Please sign in to continue.',
    },
    security_update: {
      title: 'Session Expired',
      message: 'Your session has expired. Please sign in to continue.',
    },
  };

  const messageData = messages[reason] || messages.security_update;

  io.to(`user:${userId}`).emit('force_logout', {
    reason: 'security_update', // ✅ Frontend ko hamesha generic reason bhejo
    title: messageData.title,
    message: messageData.message,
    timestamp: new Date().toISOString(),
  });
};

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

export default { initializeSocket, getIO, closeSocketIO, emitForceLogout };