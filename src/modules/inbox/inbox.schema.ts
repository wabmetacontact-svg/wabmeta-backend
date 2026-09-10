// src/modules/inbox/inbox.schema.ts

import { z } from 'zod';
import { MessageStatus } from '@prisma/client';

// ============================================
// REQUEST SCHEMAS
// ============================================

export const getConversationsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    search: z.string().optional(),
    isArchived: z.string().transform(v => v === 'true').optional(),
    isRead: z.string().transform(v => v === 'true').optional(),
    assignedTo: z.string().optional(),
    labels: z.string().optional(), // comma-separated
    channel: z.enum(['WHATSAPP', 'INSTAGRAM', 'TELEGRAM']).optional(),
    sortBy: z.enum(['lastMessageAt', 'createdAt', 'unreadCount']).optional().default('lastMessageAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const getConversationByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Conversation ID is required'),
  }),
});

export const getMessagesSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Conversation ID is required'),
  }),
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
    before: z.string().optional(),
    after: z.string().optional(),
  }),
});

export const sendMessageSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Conversation ID is required'),
  }),
  body: z.object({
    type: z.enum(['text', 'image', 'video', 'audio', 'document', 'location', 'interactive']),
    content: z.string().max(4096).optional(),
    mediaUrl: z.string().url().optional(),
    mediaType: z.string().optional(),
    filename: z.string().optional(),
    replyToMessageId: z.string().optional(),
    interactive: z.object({
      type: z.enum(['button', 'list']),
      buttons: z.array(z.object({
        id: z.string().max(256),
        title: z.string().max(20),
      })).max(3).optional(),
      sections: z.array(z.object({
        title: z.string().max(24).optional(),
        rows: z.array(z.object({
          id: z.string().max(200),
          title: z.string().max(24),
          description: z.string().max(72).optional(),
        })).max(10),
      })).max(10).optional(),
      buttonText: z.string().max(20).optional(),
    }).optional(),
  }).refine(
    (data) => {
      if (data.type === 'text') return !!data.content;
      if (['image', 'video', 'audio', 'document'].includes(data.type)) return !!data.mediaUrl;
      if (data.type === 'interactive') return !!data.interactive;
      return true;
    },
    { message: 'Required fields missing for message type' }
  ),
});

export const updateConversationSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Conversation ID is required'),
  }),
  body: z.object({
    isArchived: z.boolean().optional(),
    isRead: z.boolean().optional(),
    labels: z.array(z.string().max(30)).max(10).optional(),
    assignedTo: z.string().nullable().optional(),
  }),
});

export const markAsReadSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Conversation ID is required'),
  }),
});

export const archiveConversationSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Conversation ID is required'),
  }),
});

export const assignConversationSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Conversation ID is required'),
  }),
  body: z.object({
    userId: z.string().nullable(),
  }),
});

export const addLabelsSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Conversation ID is required'),
  }),
  body: z.object({
    labels: z.array(z.string().max(30)).min(1).max(10),
  }),
});

export const deleteConversationSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Conversation ID is required'),
  }),
});

export const bulkUpdateConversationsSchema = z.object({
  body: z.object({
    conversationIds: z.array(z.string()).min(1),
    isArchived: z.boolean().optional(),
    isRead: z.boolean().optional(),
    assignedTo: z.string().nullable().optional(),
  }),
});

export const searchMessagesSchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query is required'),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type GetConversationsSchema = z.infer<typeof getConversationsSchema>;
export type GetMessagesSchema = z.infer<typeof getMessagesSchema>;
export type SendMessageSchema = z.infer<typeof sendMessageSchema>;
export type UpdateConversationSchema = z.infer<typeof updateConversationSchema>;
export type AssignConversationSchema = z.infer<typeof assignConversationSchema>;
export type BulkUpdateConversationsSchema = z.infer<typeof bulkUpdateConversationsSchema>;
export type SearchMessagesSchema = z.infer<typeof searchMessagesSchema>;