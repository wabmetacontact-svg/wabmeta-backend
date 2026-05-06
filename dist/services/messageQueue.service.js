"use strict";
// src/services/messageQueue.service.ts - STUB (Bull queue removed)
// Campaigns use direct Meta API sending (campaigns.service.ts → processCampaignContacts)
// This file only exports stubs for backward compatibility with routes/server
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMessage = exports.addToWhatsAppQueue = exports.messageQueueWorker = exports.getQueueStats = void 0;
const events_1 = require("events");
// ============================================
// STUB: No Bull queue, no Redis dependency
// ============================================
/**
 * Stub: Get queue statistics (no queue = all zeros)
 */
const getQueueStats = async () => ({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    total: 0,
    pending: 0,
    processing: 0,
    sent: 0,
});
exports.getQueueStats = getQueueStats;
/**
 * Stub: Message Queue Worker compatibility object
 */
exports.messageQueueWorker = Object.assign(new events_1.EventEmitter(), {
    isRunning: false,
    start: async () => {
        console.log('ℹ️  Message queue disabled (using direct sending)');
    },
    stop: async () => {
        // No-op
    },
    addToQueue: async () => {
        console.warn('⚠️ Bull queue removed. Use direct Meta API sending instead.');
        return null;
    },
    getQueueStats: exports.getQueueStats,
    retryFailedMessages: async (_campaignId) => {
        console.log('ℹ️  No queue to retry. Use campaign retry-failed endpoint instead.');
        return 0;
    },
    clearFailedMessages: async () => {
        console.log('ℹ️  No queue to clear.');
        return 0;
    },
    getHealthStatus: async () => ({
        status: 'DISABLED',
        healthy: true,
        message: 'Bull queue removed. Campaigns send directly via Meta API.',
        stats: await (0, exports.getQueueStats)(),
        timestamp: new Date(),
    }),
    whatsappQueue: null,
});
exports.addToWhatsAppQueue = exports.messageQueueWorker.addToQueue;
exports.addMessage = exports.messageQueueWorker.addToQueue;
exports.default = null;
//# sourceMappingURL=messageQueue.service.js.map