"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignSocketService = exports.initializeCampaignSocket = void 0;
let io = null;
// ✅ FIX Bug1: Guard against double initialization
const initializeCampaignSocket = (socketServer) => {
    if (io) {
        console.warn('⚠️ Campaign socket already initialized');
        return;
    }
    io = socketServer;
    io.on('connection', (socket) => {
        // Campaign room
        socket.on('campaign:join', (campaignId) => {
            if (campaignId && typeof campaignId === 'string') {
                socket.join(`campaign:${campaignId}`);
            }
        });
        socket.on('campaign:leave', (campaignId) => {
            if (campaignId && typeof campaignId === 'string') {
                socket.leave(`campaign:${campaignId}`);
            }
        });
        // Org room
        socket.on('org:join', (organizationId) => {
            if (organizationId && typeof organizationId === 'string') {
                socket.join(`org:${organizationId}`);
                socket.join(`org:${organizationId}:campaigns`);
            }
        });
    });
    console.log('✅ Campaign Socket initialized');
};
exports.initializeCampaignSocket = initializeCampaignSocket;
// ✅ FIX Bug2: message field optional with default
class CampaignSocketService {
    emit(rooms, event, payload) {
        if (!io)
            return;
        const data = { ...payload, timestamp: new Date().toISOString() };
        rooms.forEach(room => io.to(room).emit(event, data));
    }
    getRooms(organizationId, campaignId) {
        return [
            `org:${organizationId}`,
            `org:${organizationId}:campaigns`,
            `campaign:${campaignId}`,
        ];
    }
    // ✅ FIX Bug2: message is now optional
    emitCampaignUpdate(organizationId, campaignId, data) {
        this.emit(this.getRooms(organizationId, campaignId), 'campaign:update', { campaignId, organizationId, ...data });
    }
    emitCampaignProgress(organizationId, campaignId, data) {
        const total = Math.max(data.total, 1);
        const sent = Math.min(Math.max(0, data.sent), total);
        const failed = Math.min(Math.max(0, data.failed), Math.max(0, total - sent));
        const delivered = Math.min(Math.max(0, data.delivered), sent);
        const read = Math.min(Math.max(0, data.read), delivered);
        const processed = Math.min(sent + failed, total);
        const pct = Math.min(100, Math.round((processed / total) * 100));
        this.emit(this.getRooms(organizationId, campaignId), 'campaign:progress', {
            campaignId, organizationId,
            sent, failed, delivered, read,
            total, percentage: pct,
            status: data.status,
        });
    }
    // ✅ FIX Bug3: Only send what backend actually has
    emitContactStatus(organizationId, campaignId, data) {
        const payload = {
            campaignId,
            organizationId,
            contactId: data.contactId,
            phone: data.phone,
            status: data.status,
            messageId: data.messageId,
            error: data.error,
        };
        if (!io)
            return;
        const ts = new Date().toISOString();
        // Contact updates only to campaign room (not org-wide - too noisy)
        io.to(`campaign:${campaignId}`)
            .emit('campaign:contact', { ...payload, timestamp: ts });
        io.to(`campaign:${campaignId}`)
            .emit('campaign:contact:status', { ...payload, timestamp: ts });
    }
    emitCampaignCompleted(organizationId, campaignId, stats) {
        this.emit(this.getRooms(organizationId, campaignId), 'campaign:completed', { campaignId, organizationId, ...stats });
        console.log(`🎉 Campaign completed: ${campaignId} | ` +
            `sent=${stats.sentCount} failed=${stats.failedCount}`);
    }
    emitCampaignError(organizationId, campaignId, error) {
        this.emit([
            `org:${organizationId}`,
            `campaign:${campaignId}`,
        ], 'campaign:error', { campaignId, organizationId, ...error });
    }
    emitCsvUploadProgress(userId, data) {
        if (!io)
            return;
        io.to(`user:${userId}`)
            .emit('csv:upload:progress', {
            ...data, timestamp: new Date().toISOString(),
        });
    }
    isInitialized() { return io !== null; }
    getIO() { return io; }
}
exports.campaignSocketService = new CampaignSocketService();
exports.default = exports.campaignSocketService;
//# sourceMappingURL=campaigns.socket.js.map