"use strict";
// src/modules/inbox/inbox.service.ts - COMPLETE FIXED
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
            }
            catch (e) {
                console.warn('Redis get error:', e);
            }
        }
        const result = await this.fetchConversationsFromDB(organizationId, query);
        if (redis) {
            try {
                await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
            }
            catch (e) {
                console.warn('Redis set error:', e);
            }
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
        const { page = 1, limit = 50, search, isArchived, isRead, assignedTo, labels, channel, sortBy = 'lastMessageAt', sortOrder = 'desc', } = query;
        const where = {
            organizationId,
        };
        // Unified-inbox channel filter (WHATSAPP | INSTAGRAM | TELEGRAM). Omit for "All".
        if (channel && ['WHATSAPP', 'INSTAGRAM', 'TELEGRAM'].includes(String(channel).toUpperCase())) {
            where.channel = String(channel).toUpperCase();
        }
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
        // Conversations list Redis mein cached hai. Pehle ye clear nahi hota tha,
        // isliye chat kholne ke baad bhi list (aur pull-to-refresh) purana
        // unreadCount hi dikhati rehti thi jab tak cache expire na ho.
        this.clearCache(organizationId).catch((e) => console.error('markAsRead cache clear error:', e?.message));
        // Clients ko batao ki badge clear ho gaya - warna list screen aur
        // dusre devices par unread badge laga rehta hai.
        Promise.resolve().then(() => __importStar(require('../webhooks/webhook.service'))).then(({ webhookEvents }) => {
            webhookEvents.emit('conversationUpdated', {
                organizationId,
                conversation: {
                    id: conversation.id,
                    unreadCount: 0,
                    isRead: true,
                },
            });
        })
            .catch((e) => console.error('markAsRead socket emit error:', e?.message));
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
        // A conversation can only be assigned to a member of the same organization.
        if (userId) {
            const member = await database_1.default.organizationMember.findFirst({
                where: { organizationId, userId },
                select: { userId: true },
            });
            if (!member)
                throw new AppError('That user is not a member of this organization', 400);
        }
        const conversation = await database_1.default.conversation.update({
            where: { id: conversationId },
            data: { assignedTo: userId || null },
        });
        this.clearCache(organizationId).catch(() => { });
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
     * Add labels to conversation (Now replaces to keep only 1 label)
     */
    async addLabels(organizationId, conversationId, newLabels) {
        // Only keep the most recently added label
        const updatedLabels = newLabels.length > 0 ? [newLabels[newLabels.length - 1]] : [];
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
     * Human handoff: pause/resume channel automation for one conversation.
     * Channel-agnostic — org-scoped so a caller can't touch another tenant.
     */
    async setAutomationPaused(organizationId, conversationId, paused) {
        const result = await database_1.default.conversation.updateMany({
            where: { id: conversationId, organizationId },
            data: { automationPaused: paused },
        });
        if (result.count === 0) {
            throw new AppError('Conversation not found', 404);
        }
        this.clearCache(organizationId).catch(() => { });
        return database_1.default.conversation.findFirst({ where: { id: conversationId, organizationId } });
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
        const [org, conversations] = await Promise.all([
            database_1.default.organization.findUnique({
                where: { id: organizationId },
                select: { customLabels: true },
            }),
            database_1.default.conversation.findMany({
                where: { organizationId },
                select: { labels: true },
            })
        ]);
        const allLabels = conversations.flatMap((c) => c.labels);
        // Parse customLabels from JSON
        const customLabelsObj = Array.isArray(org?.customLabels) ? org?.customLabels : [];
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
    async createCustomLabel(organizationId, label, color) {
        const org = await database_1.default.organization.findUnique({
            where: { id: organizationId },
            select: { customLabels: true },
        });
        const currentLabels = Array.isArray(org?.customLabels) ? org?.customLabels : [];
        // Check if label already exists
        if (!currentLabels.some(l => l.label === label)) {
            const newLabelObj = { label, color: color || '#10B981' }; // Default color if not provided
            await database_1.default.organization.update({
                where: { id: organizationId },
                data: { customLabels: [...currentLabels, newLabelObj] },
            });
            return newLabelObj;
        }
        return currentLabels.find(l => l.label === label);
    }
    /**
     * Delete custom label
     */
    async deleteCustomLabel(organizationId, label) {
        const org = await database_1.default.organization.findUnique({
            where: { id: organizationId },
            select: { customLabels: true },
        });
        const currentLabels = Array.isArray(org?.customLabels) ? org?.customLabels : [];
        if (currentLabels.some(l => l.label === label)) {
            await database_1.default.organization.update({
                where: { id: organizationId },
                data: { customLabels: currentLabels.filter(l => l.label !== label) },
            });
        }
        return { success: true };
    }
    /**
     * Search messages
     */
    async searchMessages(organizationId, query, page = 1, limit = 20, channel) {
        // An empty query would otherwise match every message in the org.
        if (!query || !query.trim()) {
            return { messages: [], meta: { page, limit, total: 0, totalPages: 0 } };
        }
        const convWhere = { organizationId };
        if (channel && ['WHATSAPP', 'INSTAGRAM', 'TELEGRAM'].includes(channel)) {
            convWhere.channel = channel;
        }
        const where = {
            conversation: convWhere,
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
     * Draft an AI reply suggestion for the agent, from the recent conversation
     * history. Human-in-the-loop: the agent reviews/edits before sending.
     */
    async suggestReply(organizationId, conversationId, instruction) {
        const conversation = await database_1.default.conversation.findFirst({
            where: { id: conversationId, organizationId },
            include: { contact: true, organization: { select: { name: true } } },
        });
        if (!conversation)
            throw new AppError('Conversation not found', 404);
        const recent = await database_1.default.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { direction: true, content: true, type: true },
        });
        const ordered = recent.reverse().filter((m) => m.content && m.content.trim());
        if (ordered.length === 0) {
            throw new AppError('No conversation history to draft a reply from', 400);
        }
        // INBOUND (customer) → user; OUTBOUND (us) → model.
        const history = ordered.map((m) => ({
            role: (m.direction === 'INBOUND' ? 'user' : 'model'),
            content: m.content,
        }));
        // The reply responds to the latest customer message; if the last turn was
        // ours, still draft a helpful follow-up.
        const lastInbound = [...ordered].reverse().find((m) => m.direction === 'INBOUND');
        const userMessage = lastInbound?.content || ordered[ordered.length - 1].content || '';
        const businessName = conversation.organization?.name || 'our business';
        const contactName = [conversation.contact?.firstName, conversation.contact?.lastName].filter(Boolean).join(' ').trim() ||
            conversation.contact?.whatsappProfileName || 'the customer';
        const systemPrompt = [
            `You are a helpful, professional customer-support agent for ${businessName}.`,
            `You are drafting a reply to ${contactName} over ${conversation.channel} for a human agent to review.`,
            `Write only the reply message text — no preamble, no quotes, no labels.`,
            `Be concise, warm and clear. Reply in the same language the customer used.`,
            instruction ? `Extra instruction from the agent: ${instruction}` : '',
        ].filter(Boolean).join(' ');
        const { aiService } = await Promise.resolve().then(() => __importStar(require('../chatbot/ai.service')));
        const suggestion = await aiService.generateResponse(systemPrompt, userMessage, history.slice(0, -1));
        return { suggestion: (suggestion || '').trim() };
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
     * Delete all conversations for organization
     */
    async deleteAllConversations(organizationId) {
        const result = await database_1.default.conversation.deleteMany({
            where: { organizationId },
        });
        return { success: true, count: result.count, message: 'All conversations deleted' };
    }
    /**
     * Bulk delete conversations
     */
    async bulkDelete(organizationId, conversationIds) {
        const result = await database_1.default.conversation.deleteMany({
            where: {
                id: { in: conversationIds },
                organizationId,
            },
        });
        return { success: true, count: result.count, message: `${result.count} conversations deleted` };
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
                organizationId_contactId_channel: {
                    organizationId,
                    contactId,
                    channel: 'WHATSAPP',
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
                    // Nayi conversation business ki taraf se ban rahi hai - customer ne
                    // abhi kuch bheja hi nahi, to 24h window khula nahi hai
                    isWindowOpen: false,
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
    async checkFreeDemoLimit(organizationId, conversationId) {
        const org = await database_1.default.organization.findUnique({
            where: { id: organizationId },
            select: { planType: true },
        });
        if (org?.planType === 'FREE_DEMO') {
            const existingOutbound = await database_1.default.message.findFirst({
                where: { conversationId, direction: 'OUTBOUND' },
            });
            if (!existingOutbound) {
                // Find how many distinct conversations have outbound messages
                const activeConversations = await database_1.default.message.groupBy({
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
    async sendMessage(organizationId, userId, conversationId, input) {
        const conversation = await this.getConversationById(organizationId, conversationId);
        // Enforce 10 contacts limit for free demo
        await this.checkFreeDemoLimit(organizationId, conversationId);
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
        // Enforce 10 contacts limit for free demo
        await this.checkFreeDemoLimit(organizationId, conversationId);
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