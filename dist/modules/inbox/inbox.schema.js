"use strict";
// src/modules/inbox/inbox.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchMessagesSchema = exports.bulkUpdateConversationsSchema = exports.deleteConversationSchema = exports.addLabelsSchema = exports.assignConversationSchema = exports.archiveConversationSchema = exports.markAsReadSchema = exports.updateConversationSchema = exports.sendMessageSchema = exports.getMessagesSchema = exports.getConversationByIdSchema = exports.getConversationsSchema = void 0;
const zod_1 = require("zod");
// ============================================
// REQUEST SCHEMAS
// ============================================
exports.getConversationsSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
        search: zod_1.z.string().optional(),
        isArchived: zod_1.z.string().transform(v => v === 'true').optional(),
        isRead: zod_1.z.string().transform(v => v === 'true').optional(),
        assignedTo: zod_1.z.string().optional(),
        labels: zod_1.z.string().optional(), // comma-separated
        channel: zod_1.z.enum(['WHATSAPP', 'INSTAGRAM', 'TELEGRAM']).optional(),
        sortBy: zod_1.z.enum(['lastMessageAt', 'createdAt', 'unreadCount']).optional().default('lastMessageAt'),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
    }),
});
exports.getConversationByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Conversation ID is required'),
    }),
});
exports.getMessagesSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Conversation ID is required'),
    }),
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
        before: zod_1.z.string().optional(),
        after: zod_1.z.string().optional(),
    }),
});
exports.sendMessageSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Conversation ID is required'),
    }),
    body: zod_1.z.object({
        type: zod_1.z.enum(['text', 'image', 'video', 'audio', 'document', 'location', 'interactive']),
        content: zod_1.z.string().max(4096).optional(),
        mediaUrl: zod_1.z.string().url().optional(),
        mediaType: zod_1.z.string().optional(),
        filename: zod_1.z.string().optional(),
        replyToMessageId: zod_1.z.string().optional(),
        interactive: zod_1.z.object({
            type: zod_1.z.enum(['button', 'list']),
            buttons: zod_1.z.array(zod_1.z.object({
                id: zod_1.z.string().max(256),
                title: zod_1.z.string().max(20),
            })).max(3).optional(),
            sections: zod_1.z.array(zod_1.z.object({
                title: zod_1.z.string().max(24).optional(),
                rows: zod_1.z.array(zod_1.z.object({
                    id: zod_1.z.string().max(200),
                    title: zod_1.z.string().max(24),
                    description: zod_1.z.string().max(72).optional(),
                })).max(10),
            })).max(10).optional(),
            buttonText: zod_1.z.string().max(20).optional(),
        }).optional(),
    }).refine((data) => {
        if (data.type === 'text')
            return !!data.content;
        if (['image', 'video', 'audio', 'document'].includes(data.type))
            return !!data.mediaUrl;
        if (data.type === 'interactive')
            return !!data.interactive;
        return true;
    }, { message: 'Required fields missing for message type' }),
});
exports.updateConversationSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Conversation ID is required'),
    }),
    body: zod_1.z.object({
        isArchived: zod_1.z.boolean().optional(),
        isRead: zod_1.z.boolean().optional(),
        labels: zod_1.z.array(zod_1.z.string().max(30)).max(10).optional(),
        assignedTo: zod_1.z.string().nullable().optional(),
    }),
});
exports.markAsReadSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Conversation ID is required'),
    }),
});
exports.archiveConversationSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Conversation ID is required'),
    }),
});
exports.assignConversationSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Conversation ID is required'),
    }),
    body: zod_1.z.object({
        userId: zod_1.z.string().nullable(),
    }),
});
exports.addLabelsSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Conversation ID is required'),
    }),
    body: zod_1.z.object({
        labels: zod_1.z.array(zod_1.z.string().max(30)).min(1).max(10),
    }),
});
exports.deleteConversationSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Conversation ID is required'),
    }),
});
exports.bulkUpdateConversationsSchema = zod_1.z.object({
    body: zod_1.z.object({
        conversationIds: zod_1.z.array(zod_1.z.string()).min(1),
        isArchived: zod_1.z.boolean().optional(),
        isRead: zod_1.z.boolean().optional(),
        assignedTo: zod_1.z.string().nullable().optional(),
    }),
});
exports.searchMessagesSchema = zod_1.z.object({
    query: zod_1.z.object({
        q: zod_1.z.string().min(1, 'Search query is required'),
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    }),
});
//# sourceMappingURL=inbox.schema.js.map