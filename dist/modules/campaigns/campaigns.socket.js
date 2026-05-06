"use strict";
// src/modules/campaigns/campaigns.socket.ts - COMPLETE
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignSocketService = exports.initializeCampaignSocket = void 0;
let io = null;
/**
 * Initialize campaign socket service with Socket.IO instance
 */
const initializeCampaignSocket = (socketServer) => {
    io = socketServer;
    io.on('connection', (socket) => {
        socket.on('campaign:join', (campaignId) => {
            console.log(`🔌 [SOCKET] Client joining campaign room: ${campaignId}`);
            socket.join(`campaign:${campaignId}`);
        });
        socket.on('campaign:leave', (campaignId) => {
            console.log(`🔌 [SOCKET] Client leaving campaign room: ${campaignId}`);
            socket.leave(`campaign:${campaignId}`);
        });
        socket.on('org:join', (organizationId) => {
            console.log(`🔌 [SOCKET] Client joining organization room: ${organizationId}`);
            socket.join(`org:${organizationId}`);
            socket.join(`org:${organizationId}:campaigns`);
        });
    });
    console.log('✅ Campaign Socket Service initialized');
};
exports.initializeCampaignSocket = initializeCampaignSocket;
/**
 * Campaign Socket Service Class
 */
class CampaignSocketService {
    /**
     * Emit campaign status update
     */
    emitCampaignUpdate(organizationId, campaignId, data) {
        if (!io) {
            console.warn('⚠️ Socket.IO not initialized - cannot emit campaign:update');
            return;
        }
        const payload = {
            campaignId,
            organizationId,
            ...data,
            timestamp: new Date().toISOString(),
        };
        // Emit to multiple rooms for redundancy
        io.to(`org:${organizationId}`).emit('campaign:update', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:update', payload);
        io.to(`org:${organizationId}:campaigns`).emit('campaign:update', payload);
        console.log(`📡 [SOCKET] campaign:update → org:${organizationId}`, {
            campaignId,
            status: data.status,
            message: data.message,
        });
    }
    /**
     * Emit campaign progress updates
     */
    emitCampaignProgress(organizationId, campaignId, data) {
        if (!io) {
            console.warn('⚠️ Socket.IO not initialized - cannot emit campaign:progress');
            return;
        }
        const total = Math.max(data.total, 1);
        // ✅ CRITICAL: Cap all values to never exceed total
        const sent = Math.min(data.sent, total);
        const failed = Math.min(data.failed, total - sent);
        const delivered = Math.min(data.delivered || 0, sent);
        const read = Math.min(data.read || 0, delivered);
        const percentage = Math.min(100, Math.round(((sent + failed) / total) * 100));
        const payload = {
            campaignId,
            organizationId,
            sent,
            failed,
            delivered,
            read,
            total,
            percentage,
            status: data.status,
            timestamp: new Date().toISOString(),
        };
        io.to(`org:${organizationId}`).emit('campaign:progress', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:progress', payload);
        io.to(`org:${organizationId}:campaigns`).emit('campaign:progress', payload);
        // Only log every 10% to reduce noise
        if (percentage % 10 === 0) {
            console.log(`📊 [SOCKET] campaign:progress → ${percentage}% (${sent}+${failed}/${total})`);
        }
    }
    /**
     * Emit individual contact status update
     */
    emitContactStatus(organizationId, campaignId, data) {
        if (!io) {
            console.warn('⚠️ Socket.IO not initialized - cannot emit campaign:contact');
            return;
        }
        const payload = {
            campaignId,
            organizationId,
            ...data,
            timestamp: new Date().toISOString(),
        };
        io.to(`org:${organizationId}`).emit('campaign:contact', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:contact', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:contact:status', payload);
        if (data.status === 'FAILED') {
            console.warn(`❌ [SOCKET] Contact failed: ${data.phone} - ${data.error || 'Unknown error'}`);
        }
    }
    /**
     * Emit campaign completion event
     */
    emitCampaignCompleted(organizationId, campaignId, stats) {
        if (!io) {
            console.warn('⚠️ Socket.IO not initialized - cannot emit campaign:completed');
            return;
        }
        const payload = {
            campaignId,
            organizationId,
            ...stats,
            timestamp: new Date().toISOString(),
        };
        io.to(`org:${organizationId}`).emit('campaign:completed', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:completed', payload);
        io.to(`org:${organizationId}:campaigns`).emit('campaign:completed', payload);
        console.log(`🎉 [SOCKET] Campaign completed: ${campaignId}`, {
            sent: stats.sentCount,
            failed: stats.failedCount,
            total: stats.totalRecipients,
        });
    }
    /**
     * Emit campaign error
     */
    emitCampaignError(organizationId, campaignId, error) {
        if (!io)
            return;
        io.to(`org:${organizationId}`).emit('campaign:error', {
            campaignId,
            ...error,
            timestamp: new Date().toISOString(),
        });
        console.error(`❌ Campaign ${campaignId} error:`, error.message);
    }
    /**
     * Emit CSV upload progress
     */
    emitCsvUploadProgress(userId, data) {
        if (!io)
            return;
        io.to(`user:${userId}`).emit('csv:upload:progress', {
            ...data,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Emit contact validation results
     */
    emitContactValidation(userId, data) {
        if (!io)
            return;
        io.to(`user:${userId}`).emit('csv:validation:batch', {
            ...data,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Check if socket is initialized
     */
    isInitialized() {
        return io !== null;
    }
    /**
     * Get Socket.IO instance (for advanced usage)
     */
    getIO() {
        return io;
    }
}
exports.campaignSocketService = new CampaignSocketService();
exports.default = exports.campaignSocketService;
//# sourceMappingURL=campaigns.socket.js.map