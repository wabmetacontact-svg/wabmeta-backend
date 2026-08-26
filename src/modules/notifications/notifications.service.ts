import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { CreateNotificationInput, NotificationType } from './notifications.types';

const expo = new Expo();

// Ek hi chat par messages ki jhadi lag jaye to har message par push bhejna
// spam hai. Per-conversation ek chhoti khidki rakhte hain.
const NEW_MESSAGE_THROTTLE_MS = 60_000;
const lastMessageNotifiedAt = new Map<string, number>();

function shouldNotifyForConversation(conversationId: string): boolean {
  const now = Date.now();
  const last = lastMessageNotifiedAt.get(conversationId) ?? 0;

  if (now - last < NEW_MESSAGE_THROTTLE_MS) return false;
  lastMessageNotifiedAt.set(conversationId, now);

  // Map ko badhne mat do
  if (lastMessageNotifiedAt.size > 5000) {
    for (const [k, t] of lastMessageNotifiedAt) {
      if (now - t > NEW_MESSAGE_THROTTLE_MS) lastMessageNotifiedAt.delete(k);
    }
  }

  return true;
}

export const notificationsService = {
  /**
   * Create notification in DB + send push
   */
  async create(input: CreateNotificationInput) {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId,
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
  // ORG-WIDE NOTIFICATIONS
  // ============================================

  /**
   * Org ke owner aur saare members ko notification bhejo.
   * Team ke sabhi logon ko inbox/campaign updates milne chahiye, sirf owner ko nahi.
   */
  async notifyOrganization(
    organizationId: string,
    payload: {
      type: NotificationType;
      title: string;
      description: string;
      actionUrl?: string;
      metadata?: Record<string, any>;
      excludeUserId?: string;
    }
  ) {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          ownerId: true,
          members: { select: { userId: true } },
        },
      });

      if (!org) return;

      const userIds = new Set<string>([org.ownerId]);
      org.members.forEach((m) => userIds.add(m.userId));
      if (payload.excludeUserId) userIds.delete(payload.excludeUserId);

      await Promise.all(
        Array.from(userIds).map((userId) =>
          this.create({
            userId,
            organizationId,
            type: payload.type,
            title: payload.title,
            description: payload.description,
            actionUrl: payload.actionUrl,
            metadata: payload.metadata,
          })
        )
      );
    } catch (err) {
      logger.error('notifyOrganization failed:', err);
    }
  },

  /**
   * Naya inbound WhatsApp message aane par. Throttled - ek chat par
   * har minute me ek hi baar.
   */
  async notifyNewMessage(input: {
    organizationId: string;
    conversationId: string;
    contactName: string;
    preview: string;
  }) {
    if (!shouldNotifyForConversation(input.conversationId)) return;

    await this.notifyOrganization(input.organizationId, {
      type: 'message',
      title: input.contactName || 'New message',
      description: input.preview || 'You have a new WhatsApp message',
      // Mobile route - client isko apne hisaab se kholta hai
      actionUrl: `/(app)/inbox/${input.conversationId}`,
      metadata: {
        conversationId: input.conversationId,
        webUrl: '/dashboard/inbox',
      },
    });
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
