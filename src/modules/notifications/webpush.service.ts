import webpush from 'web-push';
import prisma from '../../config/prisma';
import logger from '../../utils/logger';

// Configure Web Push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@wabmeta.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
  logger.info('✅ Web Push VAPID details configured successfully.');
} else {
  logger.warn('⚠️ Web Push VAPID keys are missing. Push notifications will not work.');
}

export const webpushService = {
  /**
   * Save a new push subscription for a user
   */
  async saveSubscription(userId: string, subscription: any) {
    if (!subscription || !subscription.endpoint) {
      throw new Error('Invalid subscription object');
    }

    // Upsert the subscription using the endpoint as unique key
    const sub = await prisma.pushSubscription.upsert({
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
  async removeSubscription(endpoint: string) {
    try {
      await prisma.pushSubscription.delete({
        where: { endpoint },
      });
    } catch (error) {
      logger.warn(`Failed to delete subscription ${endpoint}: ${error}`);
    }
  },

  /**
   * Send a push notification to all stored subscriptions of a user
   */
  async sendNotificationToUser(userId: string, payload: { title: string; body: string; icon?: string; url?: string }) {
    if (!vapidPublicKey || !vapidPrivateKey) {
      logger.warn('Skipping push notification because VAPID keys are missing');
      return;
    }

    try {
      // Find all subscriptions for this user
      const subscriptions = await prisma.pushSubscription.findMany({
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
          await webpush.sendNotification(pushSubscription, stringifiedPayload);
        } catch (error: any) {
          // If the subscription is gone or unauthorized (410, 404), delete it from our DB
          if (error.statusCode === 410 || error.statusCode === 404) {
            logger.info(`Push subscription expired for user ${userId}, removing...`);
            await this.removeSubscription(sub.endpoint);
          } else {
            logger.error(`Error sending push notification to user ${userId}:`, error);
          }
        }
      });

      await Promise.all(sendPromises);
    } catch (error) {
      logger.error('Failed to send push notification to user:', error);
    }
  },
};
