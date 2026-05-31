"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webpushService = void 0;
// @ts-ignore
const web_push_1 = __importDefault(require("web-push"));
const database_1 = __importDefault(require("../../config/database"));
const logger_1 = __importDefault(require("../../utils/logger"));
// Configure Web Push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@wabmeta.com';
if (vapidPublicKey && vapidPrivateKey) {
    web_push_1.default.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    logger_1.default.info('✅ Web Push VAPID details configured successfully.');
}
else {
    logger_1.default.warn('⚠️ Web Push VAPID keys are missing. Push notifications will not work.');
}
exports.webpushService = {
    /**
     * Save a new push subscription for a user
     */
    async saveSubscription(userId, subscription) {
        if (!subscription || !subscription.endpoint) {
            throw new Error('Invalid subscription object');
        }
        // Upsert the subscription using the endpoint as unique key
        const sub = await database_1.default.pushSubscription.upsert({
            where: { endpoint: subscription.endpoint },
            update: {
                userId,
                p256dh: subscription.keys?.p256dh || '',
                auth: subscription.keys?.auth || '',
            },
            create: {
                userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys?.p256dh || '',
                auth: subscription.keys?.auth || '',
            },
        });
        return sub;
    },
    /**
     * Remove a push subscription
     */
    async removeSubscription(endpoint) {
        try {
            await database_1.default.pushSubscription.delete({
                where: { endpoint },
            });
        }
        catch (error) {
            logger_1.default.warn(`Failed to delete subscription ${endpoint}: ${error}`);
        }
    },
    /**
     * Send a push notification to all stored subscriptions of a user
     */
    async sendNotificationToUser(userId, payload) {
        if (!vapidPublicKey || !vapidPrivateKey) {
            logger_1.default.warn('Skipping push notification because VAPID keys are missing');
            return;
        }
        try {
            // Find all subscriptions for this user
            const subscriptions = await database_1.default.pushSubscription.findMany({
                where: { userId },
            });
            if (!subscriptions || subscriptions.length === 0) {
                return;
            }
            const stringifiedPayload = JSON.stringify({
                title: payload.title,
                body: payload.body,
                icon: payload.icon || '/logo-192.png',
                url: payload.url || '/dashboard/inbox',
            });
            // Send to all endpoints, collect promises
            const sendPromises = subscriptions.map(async (sub) => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                };
                try {
                    await web_push_1.default.sendNotification(pushSubscription, stringifiedPayload);
                }
                catch (error) {
                    // If the subscription is gone or unauthorized (410, 404), delete it from our DB
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        logger_1.default.info(`Push subscription expired for user ${userId}, removing...`);
                        await this.removeSubscription(sub.endpoint);
                    }
                    else {
                        logger_1.default.error(`Error sending push notification to user ${userId}:`, error);
                    }
                }
            });
            await Promise.all(sendPromises);
        }
        catch (error) {
            logger_1.default.error('Failed to send push notification to user:', error);
        }
    },
};
//# sourceMappingURL=webpush.service.js.map