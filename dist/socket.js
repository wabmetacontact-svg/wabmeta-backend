"use strict";
// src/socket.ts - FINAL FIXED VERSION
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeSocketIO = exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
const campaigns_socket_1 = require("./modules/campaigns/campaigns.socket");
let io;
let webhookListenersAttached = false;
const initializeSocket = (server) => {
    console.log('🔌 Starting Socket.IO...');
    const allowedOrigins = [
        'https://wabmeta.com',
        'https://www.wabmeta.com',
        'http://localhost:5173',
        'http://localhost:3000',
    ];
    io = new socket_io_1.Server(server, {
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
        pingTimeout: 120000, // 2 minutes
        pingInterval: 30000, // 30 seconds
        connectTimeout: 45000,
        maxHttpBufferSize: 1e6,
        perMessageDeflate: {
            threshold: 1024,
        },
    });
    let connectionCount = 0;
    const MAX_CONNECTIONS = 5000;
    // ✅ Auth middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(' ')[1];
        const orgFromAuth = socket.handshake.auth?.organizationId;
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
                socket.userId = decoded.userId || decoded.id;
                socket.organizationId =
                    decoded.organizationId || orgFromAuth;
                socket.email = decoded.email;
            }
            catch (e) {
                console.warn('⚠️ Invalid socket token - allowing as guest');
                // ✅ Guest connections allow karo (org join manually karenge)
                socket.organizationId = orgFromAuth;
            }
        }
        else {
            socket.organizationId = orgFromAuth;
        }
        next();
    });
    io.on('connection', (socket) => {
        connectionCount++;
        if (connectionCount > MAX_CONNECTIONS) {
            console.error('🚨 Max connections reached!');
            socket.disconnect(true);
            connectionCount--;
            return;
        }
        console.log(`🔌 Connected: ${socket.id} | User: ${socket.userId || 'guest'} | Org: ${socket.organizationId || 'none'} | Total: ${connectionCount}`);
        // ✅ Auto-join org room
        if (socket.organizationId) {
            socket.join(`org:${socket.organizationId}`);
            console.log(`📂 Auto-joined org room: org:${socket.organizationId}`);
        }
        // ✅ Manual org join (frontend se)
        socket.on('org:join', (orgId) => {
            if (orgId && typeof orgId === 'string') {
                socket.organizationId = orgId;
                socket.join(`org:${orgId}`);
                console.log(`📂 Manually joined org: org:${orgId}`);
            }
        });
        // ✅ Conversation rooms
        socket.on('join:conversation', (conversationId) => {
            if (conversationId && typeof conversationId === 'string') {
                socket.join(`conversation:${conversationId}`);
                console.log(`📂 Joined conversation: ${conversationId}`);
            }
        });
        socket.on('leave:conversation', (conversationId) => {
            if (conversationId && typeof conversationId === 'string') {
                socket.leave(`conversation:${conversationId}`);
                console.log(`📤 Left conversation: ${conversationId}`);
            }
        });
        // ✅ Campaign rooms
        socket.on('campaign:join', (id) => {
            if (id)
                socket.join(`campaign:${id}`);
        });
        socket.on('campaign:leave', (id) => {
            if (id)
                socket.leave(`campaign:${id}`);
        });
        // ✅ Ping/pong for connection health
        socket.on('ping', () => {
            socket.emit('pong', { time: Date.now() });
        });
        socket.on('disconnect', (reason) => {
            connectionCount--;
            console.log(`🔌 Disconnected: ${socket.id} | Reason: ${reason} | Total: ${connectionCount}`);
        });
        socket.on('error', (error) => {
            console.error(`❌ Socket error for ${socket.id}:`, error.message);
        });
    });
    // Campaign socket initialize
    (0, campaigns_socket_1.initializeCampaignSocket)(io);
    // ✅ Wire webhook events ONCE
    if (!webhookListenersAttached) {
        wireWebhookEvents();
        webhookListenersAttached = true;
    }
    console.log('✅ Socket.IO ready');
    return io;
};
exports.initializeSocket = initializeSocket;
// ============================================
// ✅ WEBHOOK EVENTS WIRING - FIXED
// ============================================
function wireWebhookEvents() {
    Promise.resolve().then(() => __importStar(require('./modules/webhooks/webhook.service'))).then(({ webhookEvents }) => {
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
        webhookEvents.on('newMessage', (data) => {
            if (!io || !data?.organizationId)
                return;
            const orgId = data.organizationId;
            const conversationId = data.conversationId;
            const message = data.message;
            if (!message)
                return;
            const messageId = message.id ||
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
            }
            else if (message.direction === 'OUTBOUND') {
                // ✅ OUTBOUND: SIRF status update emit karo
                // Message already frontend pe optimistically add ho chuka hai
                // Hume bas real waMessageId aur status batana hai
                const waMessageId = message.waMessageId || message.wamId;
                const tempId = message.tempId ||
                    message.metadata?.tempId ||
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
        webhookEvents.on('conversationUpdated', (data) => {
            if (!io || !data?.organizationId)
                return;
            const orgId = data.organizationId;
            const conversation = data.conversation;
            if (!conversation?.id)
                return;
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
        webhookEvents.on('messageStatus', (data) => {
            if (!io || !data?.organizationId)
                return;
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
        webhookEvents.on('accountUpdated', (data) => {
            if (!io || !data?.organizationId)
                return;
            io.to(`org:${data.organizationId}`).emit('account:updated', data);
        });
        console.log('✅ Webhook events wired successfully');
    })
        .catch((e) => {
        console.error('❌ Failed to wire webhook events:', e.message);
    });
}
const getIO = () => {
    if (!io)
        throw new Error('Socket.IO not initialized');
    return io;
};
exports.getIO = getIO;
const closeSocketIO = async () => {
    if (io) {
        await new Promise((resolve) => {
            io.close(() => {
                console.log('✅ Socket.IO closed');
                resolve();
            });
        });
    }
};
exports.closeSocketIO = closeSocketIO;
exports.default = { initializeSocket: exports.initializeSocket, getIO: exports.getIO, closeSocketIO: exports.closeSocketIO };
//# sourceMappingURL=socket.js.map