"use strict";
// src/modules/campaigns/campaigns.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.duplicateCampaignSchema = exports.retryCampaignSchema = exports.cancelCampaignSchema = exports.resumeCampaignSchema = exports.pauseCampaignSchema = exports.startCampaignSchema = exports.getCampaignContactsSchema = exports.deleteCampaignSchema = exports.getCampaignByIdSchema = exports.getCampaignsSchema = exports.updateCampaignSchema = exports.createCampaignSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
// ============================================
// VALIDATORS
// ============================================
const audienceFilterSchema = zod_1.z.object({
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    status: zod_1.z.array(zod_1.z.string()).optional(),
    createdAfter: zod_1.z.string().datetime().optional(),
    createdBefore: zod_1.z.string().datetime().optional(),
    hasMessaged: zod_1.z.boolean().optional(),
}).optional();
const variableMappingSchema = zod_1.z.record(zod_1.z.object({
    type: zod_1.z.enum(['field', 'static']),
    value: zod_1.z.string().min(1),
})).optional();
// ============================================
// REQUEST SCHEMAS
// ============================================
exports.createCampaignSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1, 'Campaign name is required')
            .max(100, 'Name is too long')
            .trim(),
        description: zod_1.z.string().max(500, 'Description is too long').optional(),
        templateId: zod_1.z.string().min(1, 'Template ID is required'),
        whatsappAccountId: zod_1.z.string().min(1, 'WhatsApp account ID is required'),
        // Audience - at least one must be provided
        contactGroupId: zod_1.z.string().optional(),
        contactIds: zod_1.z.array(zod_1.z.string()).optional(),
        csvContacts: zod_1.z.array(zod_1.z.object({
            phone: zod_1.z.string(),
            customData: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
        })).optional(),
        audienceFilter: audienceFilterSchema,
        // Scheduling
        scheduledAt: zod_1.z.string().datetime().optional(),
        // Variable mapping
        variableMapping: variableMappingSchema,
    }).refine((data) => data.contactGroupId || (data.contactIds && data.contactIds.length > 0) || data.audienceFilter || (data.csvContacts && data.csvContacts.length > 0), { message: 'At least one audience selection method is required (contactGroupId, contactIds, audienceFilter, or csvContacts)' }),
});
exports.updateCampaignSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Campaign ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).max(100).trim().optional(),
        description: zod_1.z.string().max(500).optional().nullable(),
        templateId: zod_1.z.string().optional(),
        contactGroupId: zod_1.z.string().optional().nullable(),
        contactIds: zod_1.z.array(zod_1.z.string()).optional(),
        audienceFilter: audienceFilterSchema,
        scheduledAt: zod_1.z.string().datetime().optional().nullable(),
        variableMapping: variableMappingSchema,
    }),
});
exports.getCampaignsSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
        search: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(client_1.CampaignStatus).optional(),
        sortBy: zod_1.z.enum(['createdAt', 'name', 'scheduledAt', 'sentCount']).optional().default('createdAt'),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
    }),
});
exports.getCampaignByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Campaign ID is required'),
    }),
});
exports.deleteCampaignSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Campaign ID is required'),
    }),
});
exports.getCampaignContactsSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Campaign ID is required'),
    }),
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
        status: zod_1.z.nativeEnum(client_1.MessageStatus).optional(),
    }),
});
exports.startCampaignSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Campaign ID is required'),
    }),
});
exports.pauseCampaignSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Campaign ID is required'),
    }),
});
exports.resumeCampaignSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Campaign ID is required'),
    }),
});
exports.cancelCampaignSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Campaign ID is required'),
    }),
});
exports.retryCampaignSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Campaign ID is required'),
    }),
    body: zod_1.z.object({
        retryFailed: zod_1.z.boolean().optional().default(true),
        retryPending: zod_1.z.boolean().optional().default(false),
    }),
});
exports.duplicateCampaignSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Campaign ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).max(100).trim(),
    }),
});
//# sourceMappingURL=campaigns.schema.js.map