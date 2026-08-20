import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { CreateNotificationInput, NotificationType } from './notifications.types';

const expo = new Expo();

export const notificationsService = {
  /**
   * Create notification in DB + send push
   */
  async create(input: CreateNotificationInput) {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        description: input.description,
        actionUrl: input.actionUrl,
        metadata: input.metadata || {},
      },
    });

    // Send push (non-blocking)
    if (input.sendPush !== false) {
      this.sendPushToUser(input.userId, {
        title: input.title,
        body: input.description,
        data: {
          notificationId: notification.id,
          type: input.type,
          actionUrl: input.actionUrl,
          ...input.metadata,
        },
      }).catch((err) => logger.error('Push send failed:', err));
    }

    return notification;
  },

  /**
   * List notifications for a user
   */
  async list(userId: string, options: {
    filter?: 'all' | 'unread';
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const { filter = 'all', type, page = 1, limit = 50 } = options;

    const where: any = { userId };
    if (filter === 'unread') where.read = false;
    if (type && type !== 'all') where.type = type;

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return { items, total, unreadCount, page, limit };
  },

  /**
   * Mark as read
   */
  async markAsRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });
  },

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  },

  /**
   * Delete one
   */
  async delete(userId: string, notificationId: string) {
    return prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  },

  /**
   * Clear all
   */
  async clearAll(userId: string) {
    return prisma.notification.deleteMany({ where: { userId } });
  },

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, read: false } });
  },

  // ============================================
  // PUSH TOKEN MANAGEMENT
  // ============================================

  async registerPushToken(userId: string, token: string, deviceId?: string, platform?: string) {
    if (!Expo.isExpoPushToken(token)) {
      throw new Error('Invalid Expo push token');
    }

    return prisma.expoPushToken.upsert({
      where: { token },
      update: { userId, deviceId, platform },
      create: { userId, token, deviceId, platform },
    });
  },

  async removePushToken(token: string) {
    try {
      await prisma.expoPushToken.delete({ where: { token } });
    } catch (e) {
      logger.warn(`Failed to delete push token: ${token}`);
    }
  },

  // ============================================
  // SEND PUSH
  // ============================================

  async sendPushToUser(userId: string, payload: {
    title: string;
    body: string;
    data?: Record<string, any>;
  }) {
    const tokens = await prisma.expoPushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t.token))
      .map((t) => ({
        to: t.token,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        priority: 'high',
        channelId: 'default',
      }));

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (err) {
        logger.error('Expo push error:', err);
      }
    }

    // Cleanup invalid tokens
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const badToken = messages[i]?.to as string;
        if (badToken) this.removePushToken(badToken);
      }
    });
  },
};
