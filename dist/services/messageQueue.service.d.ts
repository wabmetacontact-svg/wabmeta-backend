import { EventEmitter } from 'events';
/**
 * Stub: Get queue statistics (no queue = all zeros)
 */
export declare const getQueueStats: () => Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    total: number;
    pending: number;
    processing: number;
    sent: number;
}>;
/**
 * Stub: Message Queue Worker compatibility object
 */
export declare const messageQueueWorker: EventEmitter<any> & {
    isRunning: boolean;
    start: () => Promise<void>;
    stop: () => Promise<void>;
    addToQueue: () => Promise<null>;
    getQueueStats: () => Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        total: number;
        pending: number;
        processing: number;
        sent: number;
    }>;
    retryFailedMessages: (_campaignId?: string) => Promise<number>;
    clearFailedMessages: () => Promise<number>;
    getHealthStatus: () => Promise<{
        status: string;
        healthy: boolean;
        message: string;
        stats: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
            total: number;
            pending: number;
            processing: number;
            sent: number;
        };
        timestamp: Date;
    }>;
    whatsappQueue: null;
};
export declare const addToWhatsAppQueue: () => Promise<null>;
export declare const addMessage: () => Promise<null>;
declare const _default: null;
export default _default;
//# sourceMappingURL=messageQueue.service.d.ts.map