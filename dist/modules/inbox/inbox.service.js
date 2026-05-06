"use strict";
// src/modules/inbox/inbox.service.ts - COMPLETE FIXED
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboxService = exports.InboxService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const redis_1 = require("../../config/redis");
class AppError extends Error {
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}
class InboxService {
    /**
     * Get conversations with flexible query support
     */
    async getConversations(organizationId, query = {}) {
        const redis = (0, redis_1.getRedis)();
        // ✅ Cache key
        const cacheKey = `conversations:${organizationId}:${JSON.stringify(query)}`;
        // ✅ Try cache first
        if (redis) {
            const cached = await redis.get(cacheKey);
            if (cached) {
                console.log('📦 Cache HIT:', cacheKey);
                return JSON.parse(cached);
            }
        }
        // ✅ Fetch from database
        const result = await this.fetchConversationsFromDB(organizationId, query);
        // ✅ Store in cache (5 minutes TTL)
        if (redis) {
            await redis.setex(cacheKey, 300, JSON.stringify(result));
            console.log('📦 Cache SET:', cacheKey);
        }
        return result;
    }
    /**
     * Clear conversation cache for an organization
     */
    async clearCache(organizationId) {
        const redis = (0, redis_1.getRedis)();
        if (!redis)
            return;
        try {
            // Find all keys starting with conversations:organizationId
            const pattern = `conversations:${organizationId}:*`;
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
                console.log(`🧹 Cache cleared for org ${organizationId}: ${keys.length} keys`);
            }
        }
        catch (err) {
            console.error('❌ Failed to clear inbox cache:', err);
        }
    }
    /**
     * Internal method to fetch conversations from DB
     */
    async fetchConversationsFromDB(organizationId, query = {}) {
        const { page = 1, limit = 50, search, isArchived, isRead, assignedTo, labels, sortBy = 'lastMessageAt', sortOrder = 'desc', } = query;
        const where = {
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
            database_1.default.conversation.findMany({
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
            database_1.default.conversation.count({ where }),
        ]);
        const transformed = conversations.map((conv) => ({
            ...conv,
            contact: {
                ...conv.contact,
                name: conv.contact.whatsappProfileName ||
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
    async getConversationById(organizationId, conversationId) {
        const conversation = await database_1.default.conversation.findFirst({
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
    async getMessages(organizationId, conversationId, query = {}) {
        // Verify conversation belongs to organization
        await this.getConversationById(organizationId, conversationId);
        const { page = 1, limit = 100, before, after } = query;
        const where = {
            conversationId,
        };
        if (before) {
            where.createdAt = { lt: new Date(before) };
        }
        if (after) {
            where.createdAt = { ...where.createdAt, gt: new Date(after) };
        }
        const [messages, total] = await Promise.all([
            database_1.default.message.findMany({
                where,
                orderBy: { createdAt: 'desc' }, // Latest first
                skip: (page - 1) * limit,
                take: limit,
            }),
            database_1.default.message.count({ where }),
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
    async markAsRead(organizationId, conversationId) {
        await this.getConversationById(organizationId, conversationId);
        const conversation = await database_1.default.conversation.update({
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
    async archiveConversation(organizationId, conversationId, isArchived) {
        await this.getConversationById(organizationId, conversationId);
        const conversation = await database_1.default.conversation.update({
            where: { id: conversationId },
            data: { isArchived },
        });
        return conversation;
    }
    /**
     * Assign conversation to user
     */
    async assignConversation(organizationId, conversationId, userId) {
        await this.getConversationById(organizationId, conversationId);
        const conversation = await database_1.default.conversation.update({
            where: { id: conversationId },
            data: { assignedTo: userId },
        });
        return conversation;
    }
    /**
     * Update conversation labels
     */
    async updateLabels(organizationId, conversationId, labels) {
        await this.getConversationById(organizationId, conversationId);
        const conversation = await database_1.default.conversation.update({
            where: { id: conversationId },
            data: { labels },
        });
        return conversation;
    }
    /**
     * Add labels to conversation
     */
    async addLabels(organizationId, conversationId, newLabels) {
        const conversation = await this.getConversationById(organizationId, conversationId);
        const updatedLabels = [...new Set([...conversation.labels, ...newLabels])];
        return this.updateLabels(organizationId, conversationId, updatedLabels);
    }
    /**
     * Remove label from conversation
     */
    async removeLabel(organizationId, conversationId, label) {
        const conversation = await this.getConversationById(organizationId, conversationId);
        const updatedLabels = conversation.labels.filter((l) => l !== label);
        return this.updateLabels(organizationId, conversationId, updatedLabels);
    }
    /**
     * Get inbox stats
     */
    async getStats(organizationId) {
        const baseWhere = { organizationId };
        const [total, open, unread, archived] = await Promise.all([
            database_1.default.conversation.count({ where: baseWhere }),
            database_1.default.conversation.count({
                where: { ...baseWhere, isWindowOpen: true, isArchived: false },
            }),
            database_1.default.conversation.count({
                where: { ...baseWhere, unreadCount: { gt: 0 } },
            }),
            database_1.default.conversation.count({
                where: { ...baseWhere, isArchived: true },
            }),
        ]);
        return { total, open, unread, archived };
    }
    /**
     * Get all labels
     */
    async getAllLabels(organizationId) {
        const conversations = await database_1.default.conversation.findMany({
            where: { organizationId },
            select: { labels: true },
        });
        const allLabels = conversations.flatMap((c) => c.labels);
        const uniqueLabels = [...new Set(allLabels)];
        return uniqueLabels.map((label) => ({
            label,
            count: allLabels.filter((l) => l === label).length,
        }));
    }
    /**
     * Search messages
     */
    async searchMessages(organizationId, query, page = 1, limit = 20) {
        const where = {
            conversation: {
                organizationId,
            },
            content: {
                contains: query,
                mode: 'insensitive',
            },
        };
        const [messages, total] = await Promise.all([
            database_1.default.message.findMany({
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
            database_1.default.message.count({ where }),
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
    async bulkUpdate(organizationId, conversationIds, updates) {
        const result = await database_1.default.conversation.updateMany({
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
    async deleteConversation(organizationId, conversationId) {
        await this.getConversationById(organizationId, conversationId);
        await database_1.default.conversation.delete({
            where: { id: conversationId },
        });
        return { success: true, message: 'Conversation deleted' };
    }
    /**
     * Update conversation
     */
    async updateConversation(organizationId, conversationId, updates) {
        await this.getConversationById(organizationId, conversationId);
        const conversation = await database_1.default.conversation.update({
            where: { id: conversationId },
            data: updates,
        });
        return conversation;
    }
    /**
     * Get or create conversation
     */
    async getOrCreateConversation(organizationId, contactId) {
        let conversation = await database_1.default.conversation.findUnique({
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
            conversation = await database_1.default.conversation.create({
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
     * Send message
     */
    async sendMessage(organizationId, userId, conversationId, input) {
        const conversation = await this.getConversationById(organizationId, conversationId);
        // Create message in database
        const message = (await database_1.default.message.create({
            data: {
                conversationId,
                whatsappAccountId: conversation.phoneNumberId || 'default',
                direction: 'OUTBOUND',
                type: input.type || 'TEXT',
                content: input.content,
                mediaUrl: input.mediaUrl,
                status: 'PENDING',
            },
        }));
        // Update conversation
        await database_1.default.conversation.update({
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
    async sendTemplateMessage(organizationId, conversationId, templateName, language, params, bodyText) {
        // Store only the body text, not full JSON
        const message = await database_1.default.message.create({
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
    async deleteMessage(organizationId, conversationId, messageId) {
        await this.getConversationById(organizationId, conversationId);
        const msg = await database_1.default.message.findFirst({ where: { id: messageId, conversationId } });
        if (!msg)
            throw new AppError('Message not found', 404);
        await database_1.default.message.delete({ where: { id: messageId } });
        const last = await database_1.default.message.findFirst({ where: { conversationId }, orderBy: { createdAt: 'desc' } });
        await database_1.default.conversation.update({ where: { id: conversationId }, data: {
                lastMessagePreview: last?.content?.substring(0, 100) || '',
                lastMessageAt: last?.createdAt || new Date(),
            } });
        return { success: true, messageId };
    }
    // Edit a message content (outbound TEXT only)
    async editMessage(organizationId, conversationId, messageId, newContent) {
        await this.getConversationById(organizationId, conversationId);
        const msg = await database_1.default.message.findFirst({ where: { id: messageId, conversationId } });
        if (!msg)
            throw new AppError('Message not found', 404);
        if (msg.direction !== 'OUTBOUND')
            throw new AppError('Only outbound messages can be edited', 400);
        if (msg.type !== 'TEXT')
            throw new AppError('Only text messages can be edited', 400);
        return database_1.default.message.update({
            where: { id: messageId },
            data: { content: newContent, metadata: { ...(msg.metadata || {}), edited: true, editedAt: new Date().toISOString() } },
        });
    }
}
exports.InboxService = InboxService;
exports.inboxService = new InboxService();
//# sourceMappingURL=inbox.service.js.map