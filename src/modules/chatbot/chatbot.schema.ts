// src/modules/chatbot/chatbot.schema.ts

import { z } from 'zod';
import { ChatbotStatus } from '@prisma/client';

// ============================================
// FLOW DATA SCHEMAS
// ============================================

const nodeDataSchema = z.object({
  label: z.string(),
  triggerType: z.enum(['keyword', 'first_message', 'all_messages', 'button_click']).optional(),
  keywords: z.array(z.string()).optional(),
  messageType: z.enum(['text', 'image', 'video', 'document', 'buttons', 'list']).optional(),
  text: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  buttons: z.array(z.object({
    id: z.string(),
    title: z.string().max(20),
  })).max(3).optional(),
  listSections: z.array(z.object({
    title: z.string().max(24).optional(),
    rows: z.array(z.object({
      id: z.string(),
      title: z.string().max(24),
      description: z.string().max(72).optional(),
    })).max(10),
  })).max(10).optional(),
  listButtonText: z.string().max(20).optional(),
  questionText: z.string().optional(),
  variableName: z.string().optional(),
  validationType: z.enum(['text', 'number', 'email', 'phone', 'date', 'options']).optional(),
  options: z.array(z.string()).optional(),
  errorMessage: z.string().optional(),
  conditionType: z.enum(['variable', 'contact_field', 'tag', 'time']).optional(),
  conditionVariable: z.string().optional(),
  conditionOperator: z.enum(['equals', 'not_equals', 'contains', 'starts_with', 'ends_with', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']).optional(),
  conditionValue: z.string().optional(),
  actionType: z.enum(['subscribe', 'unsubscribe', 'add_tag', 'remove_tag', 'update_contact', 'notify_agent']).optional(),
  actionValue: z.string().optional(),
  delayDuration: z.number().min(1).max(86400).optional(), // max 24 hours
  apiUrl: z.string().url().optional(),
  apiMethod: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
  apiHeaders: z.record(z.string()).optional(),
  apiBody: z.string().optional(),
  apiResponseVariable: z.string().optional(),
  assignTo: z.enum(['user', 'team', 'round_robin']).optional(),
  assignUserId: z.string().optional(),
  tagAction: z.enum(['add', 'remove']).optional(),
  tagNames: z.array(z.string()).optional(),
}).passthrough();

const flowNodeSchema = z.object({
  id: z.string(),
  // ✅ All node types used by the chatbot engine
  type: z.enum([
    'start', 'message', 'button', 'list', 'ai',
    'condition', 'delay', 'action', 'end',
    // Legacy/alternate names (backward compat)
    'trigger', 'question', 'assign', 'tag', 'api',
  ]),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: nodeDataSchema,
}).passthrough();

const flowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  label: z.string().optional(),
  data: z.object({
    condition: z.string().optional(),
    buttonId: z.string().optional(),
    optionValue: z.string().optional(),
  }).optional(),
});

const flowDataSchema = z.object({
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowEdgeSchema),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }).optional(),
}).passthrough();

// ============================================
// REQUEST SCHEMAS
// ============================================

export const createChatbotSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long').trim(),
    description: z.string().max(500).optional(),
    triggerKeywords: z.array(z.string().max(50)).max(20).optional().default([]),
    isDefault: z.boolean().optional().default(false),
    welcomeMessage: z.string().max(1000).optional(),
    fallbackMessage: z.string().max(1000).optional(),
    flowData: flowDataSchema.optional(),
  }),
});

export const updateChatbotSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chatbot ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).trim().optional(),
    description: z.string().max(500).optional().nullable(),
    triggerKeywords: z.array(z.string().max(50)).max(20).optional(),
    isDefault: z.boolean().optional(),
    welcomeMessage: z.string().max(1000).optional().nullable(),
    fallbackMessage: z.string().max(1000).optional().nullable(),
    flowData: flowDataSchema.optional(),
    status: z.nativeEnum(ChatbotStatus).optional(),
  }),
});

export const getChatbotsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    search: z.string().optional(),
    status: z.nativeEnum(ChatbotStatus).optional(),
    sortBy: z.enum(['createdAt', 'name', 'status']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const getChatbotByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chatbot ID is required'),
  }),
});

export const deleteChatbotSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chatbot ID is required'),
  }),
});

export const duplicateChatbotSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chatbot ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).trim(),
  }),
});

export const activateChatbotSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chatbot ID is required'),
  }),
});

export const testChatbotSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chatbot ID is required'),
  }),
  body: z.object({
    message: z.string().min(1, 'Message is required'),
    contactPhone: z.string().optional(),
    sessionData: z.record(z.any()).optional(),
  }),
});

export const saveFlowSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chatbot ID is required'),
  }),
  body: z.object({
    flowData: flowDataSchema,
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateChatbotSchema = z.infer<typeof createChatbotSchema>;
export type UpdateChatbotSchema = z.infer<typeof updateChatbotSchema>;
export type GetChatbotsSchema = z.infer<typeof getChatbotsSchema>;
export type TestChatbotSchema = z.infer<typeof testChatbotSchema>;
export type SaveFlowSchema = z.infer<typeof saveFlowSchema>;