// src/modules/inbox/inbox.service.ts - COMPLETE FIXED

import { PrismaClient, Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { getRedis } from '../../config/redis';

class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class InboxService {
  /**
   * Get conversations with flexible query support
   */
  async getConversations(organizationId: string, query: any = {}) {
    const redis = getRedis();

    // ✅ Cache TTL 30 sec - realtime feel ke liye short TTL
    const CACHE_TTL = 30;

    const cacheKey = `conversations:${organizationId}:${JSON.stringify(query)}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log('📦 Cache HIT:', cacheKey.substring(0, 50));
          return JSON.parse(cached);
        }
      } catch (e) {
        console.warn('Redis get error:', e);
      }
    }

    const result = await this.fetchConversationsFromDB(organizationId, query);

    if (redis) {
      try {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
      } catch (e) {
        console.warn('Redis set error:', e);
      }
    }

    return result;
  }

  /**
   * Clear conversation cache for an organization
   */
  async clearCache(organizationId: string) {
    const redis = getRedis();
    if (!redis) return;

    try {
      // Find all keys starting with conversations:organizationId
      const pattern = `conversations:${organizationId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`🧹 Cache cleared for org ${organizationId}: ${keys.length} keys`);
      }
    } catch (err) {
      console.error('❌ Failed to clear inbox cache:', err);
    }
  }

  /**
   * Internal method to fetch conversations from DB
   */
  private async fetchConversationsFromDB(organizationId: string, query: any = {}) {
    const {
      page = 1,
      limit = 50,
      search,
      isArchived,
      isRead,
      assignedTo,
      labels,
      sortBy = 'lastMessageAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.ConversationWhereInput = {
      organizationId,
    };

    if (isArchived !== undefined && isArchived !== null && isArchived !== '') {
      where.isArchived = isArchived === true || isArchived === 'true';
    }

    if (isRead !== undefined && isRead !== null && isRead !== '') {
      where.isRead = isRead === true || isRead === 'true';
    }

    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    if (labels && labels.length > 0) {
      where.labels = { hasSome: Array.isArray(labels) ? labels : [labels] };
    }

    if (search && search.trim()) {
      where.OR = [
        {
          contact: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' } },
              { whatsappProfileName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        { lastMessagePreview: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              tags: true,
              whatsappProfileName: true,
            },
          },
        },
        orderBy: [
          { isPinned: 'desc' },
          { [sortBy]: sortOrder },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    const transformed = conversations.map((conv) => ({
      ...conv,
      contact: {
        ...conv.contact,
        name:
          conv.contact.whatsappProfileName ||
          (conv.contact.firstName
            ? `${conv.contact.firstName} ${conv.contact.lastName || ''}`.trim()
            : conv.contact.phone),
      },
    }));

    return {
      conversations: transformed,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single conversation
   */
  async getConversationById(organizationId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
      include: {
        contact: true,
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    return conversation;
  }

  /**
   * Get messages for conversation
   */
  async getMessages(organizationId: string, conversationId: string, query: any = {}) {
    // Verify conversation belongs to organization
    await this.getConversationById(organizationId, conversationId);

    const { page = 1, limit = 100, before, after } = query;

    const where: Prisma.MessageWhereInput = {
      conversationId,
    };

    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    if (after) {
      where.createdAt = { ...(where.createdAt as any), gt: new Date(after) };
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' }, // Latest first
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    // ✅ Reverse back to chronological order for the UI (Bottom = Newest)
    // ✅ Ensure timestamp is always populated for frontend
    const chronologicalMessages = [...messages].reverse().map(m => ({
      ...m,
      timestamp: m.timestamp || m.createdAt
    }));

    return {
      messages: chronologicalMessages,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(organizationId: string, conversationId: string) {
    await this.getConversationById(organizationId, conversationId);

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        unreadCount: 0,
        isRead: true,
      },
    });

    return conversation;
  }

  /**
   * Archive/Unarchive conversation
   */
  async archiveConversation(
    organizationId: string,
    conversationId: string,
    isArchived: boolean
  ) {
    await this.getConversationById(organizationId, conversationId);

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { isArchived },
    });

    return conversation;
  }

  /**
   * Assign conversation to user
   */
  async assignConversation(
    organizationId: string,
    conversationId: string,
    userId: string | null
  ) {
    await this.getConversationById(organizationId, conversationId);

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedTo: userId },
    });

    return conversation;
  }

  /**
   * Update conversation labels
   */
  async updateLabels(organizationId: string, conversationId: string, labels: string[]) {
    await this.getConversationById(organizationId, conversationId);

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { labels },
    });

    return conversation;
  }

  /**
   * Add labels to conversation (Now replaces to keep only 1 label)
   */
  async addLabels(organizationId: string, conversationId: string, newLabels: string[]) {
    // Only keep the most recently added label
    const updatedLabels = newLabels.length > 0 ? [newLabels[newLabels.length - 1]] : [];
    return this.updateLabels(organizationId, conversationId, updatedLabels);
  }

  /**
   * Remove label from conversation
   */
  async removeLabel(organizationId: string, conversationId: string, label: string) {
    const conversation = await this.getConversationById(organizationId, conversationId);
    const updatedLabels = conversation.labels.filter((l) => l !== label);

    return this.updateLabels(organizationId, conversationId, updatedLabels);
  }

  /**
   * Get inbox stats
   */
  async getStats(organizationId: string) {
    const baseWhere: Prisma.ConversationWhereInput = { organizationId };

    const [total, open, unread, archived] = await Promise.all([
      prisma.conversation.count({ where: baseWhere }),
      prisma.conversation.count({
        where: { ...baseWhere, isWindowOpen: true, isArchived: false },
      }),
      prisma.conversation.count({
        where: { ...baseWhere, unreadCount: { gt: 0 } },
      }),
      prisma.conversation.count({
        where: { ...baseWhere, isArchived: true },
      }),
    ]);

    return { total, open, unread, archived };
  }

  /**
   * Get all labels
   */
  async getAllLabels(organizationId: string) {
    const [org, conversations] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { customLabels: true },
      }),
      prisma.conversation.findMany({
        where: { organizationId },
        select: { labels: true },
      })
    ]);

    const allLabels = conversations.flatMap((c) => c.labels);
    // Parse customLabels from JSON
    const customLabelsObj: Array<{ label: string; color: string }> = Array.isArray(org?.customLabels) ? (org?.customLabels as any) : [];
    const customLabelNames = customLabelsObj.map(l => l.label);

    const uniqueLabels = [...new Set([...allLabels, ...customLabelNames])];

    // Build the result
    return uniqueLabels.map((label) => {
      const customObj = customLabelsObj.find(c => c.label === label);
      return {
        label,
        color: customObj?.color, // Optional: will be undefined for default labels
        count: allLabels.filter((l) => l === label).length,
      };
    });
  }

  /**
   * Create custom label
   */
  async createCustomLabel(organizationId: string, label: string, color?: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { customLabels: true },
    });
    const currentLabels: Array<{ label: string; color: string }> = Array.isArray(org?.customLabels) ? (org?.customLabels as any) : [];
    
    // Check if label already exists
    if (!currentLabels.some(l => l.label === label)) {
      const newLabelObj = { label, color: color || '#10B981' }; // Default color if not provided
      await prisma.organization.update({
        where: { id: organizationId },
        data: { customLabels: [...currentLabels, newLabelObj] as any },
      });
      return newLabelObj;
    }
    return currentLabels.find(l => l.label === label);
  }

  /**
   * Delete custom label
   */
  async deleteCustomLabel(organizationId: string, label: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { customLabels: true },
    });
    const currentLabels: Array<{ label: string; color: string }> = Array.isArray(org?.customLabels) ? (org?.customLabels as any) : [];
    
    if (currentLabels.some(l => l.label === label)) {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { customLabels: currentLabels.filter(l => l.label !== label) as any },
      });
    }
    return { success: true };
  }

  /**
   * Search messages
   */
  async searchMessages(
    organizationId: string,
    query: string,
    page: number = 1,
    limit: number = 20
  ) {
    const where: Prisma.MessageWhereInput = {
      conversation: {
        organizationId,
      },
      content: {
        contains: query,
        mode: 'insensitive',
      },
    };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          conversation: {
            include: {
              contact: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    return {
      messages,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Bulk update conversations
   */
  async bulkUpdate(
    organizationId: string,
    conversationIds: string[],
    updates: Partial<Prisma.ConversationUpdateInput>
  ) {
    const result = await prisma.conversation.updateMany({
      where: {
        id: { in: conversationIds },
        organizationId,
      },
      data: updates,
    });

    return { updated: result.count };
  }

  /**
   * Delete conversation
   */
  async deleteConversation(organizationId: string, conversationId: string) {
    await this.getConversationById(organizationId, conversationId);

    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    return { success: true, message: 'Conversation deleted' };
  }

  /**
   * Update conversation
   */
  async updateConversation(
    organizationId: string,
    conversationId: string,
    updates: Partial<Prisma.ConversationUpdateInput>
  ) {
    await this.getConversationById(organizationId, conversationId);

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: updates,
    });

    return conversation;
  }

  /**
   * Get or create conversation
   */
  async getOrCreateConversation(organizationId: string, contactId: string) {
    let conversation = await prisma.conversation.findUnique({
      where: {
        organizationId_contactId: {
          organizationId,
          contactId,
        },
      },
      include: {
        contact: true,
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organization: { connect: { id: organizationId } },
          contact: { connect: { id: contactId } },
          isWindowOpen: true,
          unreadCount: 0,
        },
        include: {
          contact: true,
        },
      });
    }

    return conversation;
  }

  /**
   * Helper to check Free Demo chat limit
   */
  private async checkFreeDemoLimit(organizationId: string, conversationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { planType: true },
    });

    if (org?.planType === 'FREE_DEMO') {
      const existingOutbound = await prisma.message.findFirst({
        where: { conversationId, direction: 'OUTBOUND' },
      });

      if (!existingOutbound) {
        // Find how many distinct conversations have outbound messages
        const activeConversations = await prisma.message.groupBy({
          by: ['conversationId'],
          where: {
            conversation: { organizationId },
            direction: 'OUTBOUND',
          },
        });

        if (activeConversations.length >= 10) {
          throw new AppError('TRIAL_CHAT_LIMIT_REACHED', 403);
        }
      }
    }
  }

  /**
   * Send message
   */
  async sendMessage(
    organizationId: string,
    userId: string,
    conversationId: string,
    input: any
  ) {
    const conversation = await this.getConversationById(organizationId, conversationId);

    // Enforce 10 contacts limit for free demo
    await this.checkFreeDemoLimit(organizationId, conversationId);

    // Create message in database
    const message = (await prisma.message.create({
      data: {
        conversationId,
        whatsappAccountId: conversation.phoneNumberId || 'default',
        direction: 'OUTBOUND',
        type: input.type || 'TEXT',
        content: input.content,
        mediaUrl: input.mediaUrl,
        status: 'PENDING',
      },
    })) as any;

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: input.content?.substring(0, 100),
      },
    });

    return message;
  }

  /**
   * Send template message
   */
  async sendTemplateMessage(
    organizationId: string,
    conversationId: string,
    templateName: string,
    language: string,
    params: any[],
    bodyText: string
  ) {
    // Enforce 10 contacts limit for free demo
    await this.checkFreeDemoLimit(organizationId, conversationId);

    // Store only the body text, not full JSON
    const message = await prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        type: 'TEMPLATE',
        content: bodyText, // ✅ Store readable text only
        status: 'PENDING',
        timestamp: new Date(),
      },
    });

    return message;
  }

  // Delete a single message (local DB only)
  async deleteMessage(organizationId: string, conversationId: string, messageId: string) {
    await this.getConversationById(organizationId, conversationId);
    const msg = await prisma.message.findFirst({ where: { id: messageId, conversationId } });
    if (!msg) throw new AppError('Message not found', 404);
    await prisma.message.delete({ where: { id: messageId } });
    const last = await prisma.message.findFirst({ where: { conversationId }, orderBy: { createdAt: 'desc' } });
    await prisma.conversation.update({ where: { id: conversationId }, data: {
      lastMessagePreview: last?.content?.substring(0, 100) || '',
      lastMessageAt: last?.createdAt || new Date(),
    }});
    return { success: true, messageId };
  }

  // Edit a message content (outbound TEXT only)
  async editMessage(organizationId: string, conversationId: string, messageId: string, newContent: string) {
    await this.getConversationById(organizationId, conversationId);
    const msg = await prisma.message.findFirst({ where: { id: messageId, conversationId } });
    if (!msg) throw new AppError('Message not found', 404);
    if (msg.direction !== 'OUTBOUND') throw new AppError('Only outbound messages can be edited', 400);
    if (msg.type !== 'TEXT') throw new AppError('Only text messages can be edited', 400);
    return prisma.message.update({
      where: { id: messageId },
      data: { content: newContent, metadata: { ...(msg.metadata as any || {}), edited: true, editedAt: new Date().toISOString() } },
    });
  }
}

export const inboxService = new InboxService();