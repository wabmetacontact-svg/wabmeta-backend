"use strict";
// src/modules/campaigns/campaigns.socket.ts - PRODUCTION FIXED
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignSocketService = exports.initializeCampaignSocket = void 0;
let io = null;
const initializeCampaignSocket = (socketServer) => {
    io = socketServer;
    io.on('connection', (socket) => {
        socket.on('campaign:join', (campaignId) => {
            if (campaignId) {
                socket.join(`campaign:${campaignId}`);
                console.log(`🔌 Joined campaign room: ${campaignId}`);
            }
        });
        socket.on('campaign:leave', (campaignId) => {
            if (campaignId) {
                socket.leave(`campaign:${campaignId}`);
            }
        });
        socket.on('org:join', (organizationId) => {
            if (organizationId) {
                socket.join(`org:${organizationId}`);
                socket.join(`org:${organizationId}:campaigns`);
            }
        });
    });
    console.log('✅ Campaign Socket Service initialized');
};
exports.initializeCampaignSocket = initializeCampaignSocket;
class CampaignSocketService {
    emitCampaignUpdate(organizationId, campaignId, data) {
        if (!io)
            return;
        const payload = {
            campaignId,
            organizationId,
            ...data,
            timestamp: new Date().toISOString(),
        };
        io.to(`org:${organizationId}`).emit('campaign:update', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:update', payload);
        io.to(`org:${organizationId}:campaigns`).emit('campaign:update', payload);
    }
    /**
     * ✅ CRITICAL FIX: Progress emit with proper capped values
     * Backend sends CUMULATIVE numbers (sent = actually sent + delivered + read)
     */
    emitCampaignProgress(organizationId, campaignId, data) {
        if (!io)
            return;
        const total = Math.max(data.total, 1);
        const sent = Math.min(Math.max(0, data.sent), total);
        const failed = Math.min(Math.max(0, data.failed), Math.max(0, total - sent));
        const delivered = Math.min(Math.max(0, data.delivered || 0), sent);
        const read = Math.min(Math.max(0, data.read || 0), delivered);
        const processed = Math.min(sent + failed, total);
        const percentage = Math.min(100, Math.round((processed / total) * 100));
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
    }
    emitContactStatus(organizationId, campaignId, data) {
        if (!io)
            return;
        const payload = {
            campaignId,
            organizationId,
            ...data,
            timestamp: new Date().toISOString(),
        };
        io.to(`org:${organizationId}`).emit('campaign:contact', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:contact', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:contact:status', payload);
    }
    emitCampaignCompleted(organizationId, campaignId, stats) {
        if (!io)
            return;
        const payload = {
            campaignId,
            organizationId,
            ...stats,
            timestamp: new Date().toISOString(),
        };
        io.to(`org:${organizationId}`).emit('campaign:completed', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:completed', payload);
        io.to(`org:${organizationId}:campaigns`).emit('campaign:completed', payload);
        console.log(`🎉 Campaign completed: ${campaignId} | sent=${stats.sentCount} failed=${stats.failedCount}`);
    }
    emitCampaignError(organizationId, campaignId, error) {
        if (!io)
            return;
        const payload = {
            campaignId,
            organizationId,
            ...error,
            timestamp: new Date().toISOString(),
        };
        io.to(`org:${organizationId}`).emit('campaign:error', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:error', payload);
    }
    emitCsvUploadProgress(userId, data) {
        if (!io)
            return;
        io.to(`user:${userId}`).emit('csv:upload:progress', { ...data, timestamp: new Date().toISOString() });
    }
    emitContactValidation(userId, data) {
        if (!io)
            return;
        io.to(`user:${userId}`).emit('csv:validation:batch', { ...data, timestamp: new Date().toISOString() });
    }
    isInitialized() {
        return io !== null;
    }
    getIO() {
        return io;
    }
}
exports.campaignSocketService = new CampaignSocketService();
exports.default = exports.campaignSocketService;
//# sourceMappingURL=campaigns.socket.js.map