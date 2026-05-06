"use strict";
// src/modules/chatbot/chatbot.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveFlowSchema = exports.testChatbotSchema = exports.activateChatbotSchema = exports.duplicateChatbotSchema = exports.deleteChatbotSchema = exports.getChatbotByIdSchema = exports.getChatbotsSchema = exports.updateChatbotSchema = exports.createChatbotSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
// ============================================
// FLOW DATA SCHEMAS
// ============================================
const nodeDataSchema = zod_1.z.object({
    label: zod_1.z.string(),
    triggerType: zod_1.z.enum(['keyword', 'first_message', 'all_messages', 'button_click']).optional(),
    keywords: zod_1.z.array(zod_1.z.string()).optional(),
    messageType: zod_1.z.enum(['text', 'image', 'video', 'document', 'buttons', 'list']).optional(),
    text: zod_1.z.string().optional(),
    mediaUrl: zod_1.z.string().url().optional(),
    buttons: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        title: zod_1.z.string().max(20),
    })).max(3).optional(),
    listSections: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string().max(24).optional(),
        rows: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            title: zod_1.z.string().max(24),
            description: zod_1.z.string().max(72).optional(),
        })).max(10),
    })).max(10).optional(),
    listButtonText: zod_1.z.string().max(20).optional(),
    questionText: zod_1.z.string().optional(),
    variableName: zod_1.z.string().optional(),
    validationType: zod_1.z.enum(['text', 'number', 'email', 'phone', 'date', 'options']).optional(),
    options: zod_1.z.array(zod_1.z.string()).optional(),
    errorMessage: zod_1.z.string().optional(),
    conditionType: zod_1.z.enum(['variable', 'contact_field', 'tag', 'time']).optional(),
    conditionVariable: zod_1.z.string().optional(),
    conditionOperator: zod_1.z.enum(['equals', 'not_equals', 'contains', 'starts_with', 'ends_with', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']).optional(),
    conditionValue: zod_1.z.string().optional(),
    actionType: zod_1.z.enum(['subscribe', 'unsubscribe', 'add_tag', 'remove_tag', 'update_contact', 'notify_agent']).optional(),
    actionValue: zod_1.z.string().optional(),
    delayDuration: zod_1.z.number().min(1).max(86400).optional(), // max 24 hours
    apiUrl: zod_1.z.string().url().optional(),
    apiMethod: zod_1.z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
    apiHeaders: zod_1.z.record(zod_1.z.string()).optional(),
    apiBody: zod_1.z.string().optional(),
    apiResponseVariable: zod_1.z.string().optional(),
    assignTo: zod_1.z.enum(['user', 'team', 'round_robin']).optional(),
    assignUserId: zod_1.z.string().optional(),
    tagAction: zod_1.z.enum(['add', 'remove']).optional(),
    tagNames: zod_1.z.array(zod_1.z.string()).optional(),
}).passthrough();
const flowNodeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    // ✅ All node types used by the chatbot engine
    type: zod_1.z.enum([
        'start', 'message', 'button', 'list', 'ai',
        'condition', 'delay', 'action', 'end',
        // Legacy/alternate names (backward compat)
        'trigger', 'question', 'assign', 'tag', 'api',
    ]),
    position: zod_1.z.object({
        x: zod_1.z.number(),
        y: zod_1.z.number(),
    }),
    data: nodeDataSchema,
}).passthrough();
const flowEdgeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    source: zod_1.z.string(),
    target: zod_1.z.string(),
    sourceHandle: zod_1.z.string().optional(),
    targetHandle: zod_1.z.string().optional(),
    label: zod_1.z.string().optional(),
    data: zod_1.z.object({
        condition: zod_1.z.string().optional(),
        buttonId: zod_1.z.string().optional(),
        optionValue: zod_1.z.string().optional(),
    }).optional(),
});
const flowDataSchema = zod_1.z.object({
    nodes: zod_1.z.array(flowNodeSchema),
    edges: zod_1.z.array(flowEdgeSchema),
    viewport: zod_1.z.object({
        x: zod_1.z.number(),
        y: zod_1.z.number(),
        zoom: zod_1.z.number(),
    }).optional(),
}).passthrough();
// ============================================
// REQUEST SCHEMAS
// ============================================
exports.createChatbotSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Name is required').max(100, 'Name is too long').trim(),
        description: zod_1.z.string().max(500).optional(),
        triggerKeywords: zod_1.z.array(zod_1.z.string().max(50)).max(20).optional().default([]),
        isDefault: zod_1.z.boolean().optional().default(false),
        welcomeMessage: zod_1.z.string().max(1000).optional(),
        fallbackMessage: zod_1.z.string().max(1000).optional(),
        flowData: flowDataSchema.optional(),
    }),
});
exports.updateChatbotSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Chatbot ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).max(100).trim().optional(),
        description: zod_1.z.string().max(500).optional().nullable(),
        triggerKeywords: zod_1.z.array(zod_1.z.string().max(50)).max(20).optional(),
        isDefault: zod_1.z.boolean().optional(),
        welcomeMessage: zod_1.z.string().max(1000).optional().nullable(),
        fallbackMessage: zod_1.z.string().max(1000).optional().nullable(),
        flowData: flowDataSchema.optional(),
        status: zod_1.z.nativeEnum(client_1.ChatbotStatus).optional(),
    }),
});
exports.getChatbotsSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
        search: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(client_1.ChatbotStatus).optional(),
        sortBy: zod_1.z.enum(['createdAt', 'name', 'status']).optional().default('createdAt'),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
    }),
});
exports.getChatbotByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Chatbot ID is required'),
    }),
});
exports.deleteChatbotSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Chatbot ID is required'),
    }),
});
exports.duplicateChatbotSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Chatbot ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).max(100).trim(),
    }),
});
exports.activateChatbotSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Chatbot ID is required'),
    }),
});
exports.testChatbotSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Chatbot ID is required'),
    }),
    body: zod_1.z.object({
        message: zod_1.z.string().min(1, 'Message is required'),
        contactPhone: zod_1.z.string().optional(),
        sessionData: zod_1.z.record(zod_1.z.any()).optional(),
    }),
});
exports.saveFlowSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Chatbot ID is required'),
    }),
    body: zod_1.z.object({
        flowData: flowDataSchema,
    }),
});
//# sourceMappingURL=chatbot.schema.js.map