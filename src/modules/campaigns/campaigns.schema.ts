// src/modules/campaigns/campaigns.schema.ts

import { z } from 'zod';
import { CampaignStatus, MessageStatus } from '@prisma/client';

// ============================================
// VALIDATORS
// ============================================

const audienceFilterSchema = z.object({
  tags: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  hasMessaged: z.boolean().optional(),
}).optional();

const variableMappingSchema = z.record(
  z.object({
    type: z.enum(['field', 'static']),
    value: z.string().min(1),
  })
).optional();

// ============================================
// REQUEST SCHEMAS
// ============================================

export const createCampaignSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Campaign name is required')
      .max(100, 'Name is too long')
      .trim(),
    description: z.string().max(500, 'Description is too long').optional(),
    templateId: z.string().min(1, 'Template ID is required'),
    whatsappAccountId: z.string().min(1, 'WhatsApp account ID is required'),
    // Audience - at least one must be provided
    contactGroupId: z.string().optional(),
    contactIds: z.array(z.string()).optional(),
    csvContacts: z.array(z.object({
      phone: z.string(),
      customData: z.record(z.string(), z.any()).optional()
    })).optional(),
    audienceFilter: audienceFilterSchema,
    // Scheduling
    scheduledAt: z.string().datetime().optional(),
    // Variable mapping
    variableMapping: variableMappingSchema,
  }).refine(
    (data) => data.contactGroupId || (data.contactIds && data.contactIds.length > 0) || data.audienceFilter || (data.csvContacts && data.csvContacts.length > 0),
    { message: 'At least one audience selection method is required (contactGroupId, contactIds, audienceFilter, or csvContacts)' }
  ),
});

export const updateCampaignSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Campaign ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).trim().optional(),
    description: z.string().max(500).optional().nullable(),
    templateId: z.string().optional(),
    contactGroupId: z.string().optional().nullable(),
    contactIds: z.array(z.string()).optional(),
    audienceFilter: audienceFilterSchema,
    scheduledAt: z.string().datetime().optional().nullable(),
    variableMapping: variableMappingSchema,
  }),
});

export const getCampaignsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    search: z.string().optional(),
    status: z.nativeEnum(CampaignStatus).optional(),
    sortBy: z.enum(['createdAt', 'name', 'scheduledAt', 'sentCount']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const getCampaignByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Campaign ID is required'),
  }),
});

export const deleteCampaignSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Campaign ID is required'),
  }),
});

export const getCampaignContactsSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Campaign ID is required'),
  }),
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
    status: z.nativeEnum(MessageStatus).optional(),
  }),
});

export const startCampaignSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Campaign ID is required'),
  }),
});

export const pauseCampaignSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Campaign ID is required'),
  }),
});

export const resumeCampaignSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Campaign ID is required'),
  }),
});

export const cancelCampaignSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Campaign ID is required'),
  }),
});

export const retryCampaignSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Campaign ID is required'),
  }),
  body: z.object({
    retryFailed: z.boolean().optional().default(true),
    retryPending: z.boolean().optional().default(false),
  }),
});

export const duplicateCampaignSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Campaign ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).trim(),
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateCampaignSchema = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignSchema = z.infer<typeof updateCampaignSchema>;
export type GetCampaignsSchema = z.infer<typeof getCampaignsSchema>;
export type GetCampaignContactsSchema = z.infer<typeof getCampaignContactsSchema>;
export type RetryCampaignSchema = z.infer<typeof retryCampaignSchema>;
export type DuplicateCampaignSchema = z.infer<typeof duplicateCampaignSchema>;