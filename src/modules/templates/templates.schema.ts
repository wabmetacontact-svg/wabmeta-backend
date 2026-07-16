// src/modules/templates/templates.schema.ts

import { z } from 'zod';

// ============================================
// CREATE TEMPLATE
// ============================================
export const createTemplateSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Template name is required')
      .max(512, 'Template name too long')
      .regex(/^[a-z0-9_]+$/, 'Template name must be lowercase with underscores only'),
    language: z.string().min(1).default('en'),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).default('MARKETING'),
    headerType: z.string().optional().nullable(),
    headerContent: z.string().max(1024).optional().nullable(),
    bodyText: z
      .string()
      .min(1, 'Body text is required')
      .max(1024, 'Body text too long'),
    footerText: z.string().max(60).optional().nullable(),
    buttons: z.array(z.object({
      type: z.string(),
      text: z.string(),
      url: z.string().optional(),
      phoneNumber: z.string().optional(),
    })).max(3).optional(),
    variables: z.array(z.object({
      index: z.number(),
      type: z.string(),
      example: z.any().optional(),
    })).optional(),
    whatsappAccountId: z.string().optional(),
  }),
});

// ============================================
// UPDATE TEMPLATE
// ============================================
export const updateTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
  body: z.object({
    name: z
      .string()
      .min(1)
      .max(512)
      .regex(/^[a-z0-9_]+$/)
      .optional(),
    language: z.string().min(1).optional(),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).optional(),
    headerType: z.string().optional().nullable(),
    headerContent: z.string().max(1024).optional().nullable(),
    bodyText: z.string().min(1).max(1024).optional(),
    footerText: z.string().max(60).optional().nullable(),
    buttons: z.array(z.object({
      type: z.string(),
      text: z.string(),
      url: z.string().optional(),
      phoneNumber: z.string().optional(),
    })).max(3).optional(),
    variables: z.array(z.object({
      index: z.number(),
      type: z.string(),
      example: z.any().optional(),
    })).optional(),
  }),
});

// ============================================
// GET TEMPLATE BY ID
// ============================================
export const getTemplateByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
});

// ============================================
// DELETE TEMPLATE
// ============================================
export const deleteTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
});

// ============================================
// DUPLICATE TEMPLATE
// ============================================
export const duplicateTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
  body: z.object({
    name: z
      .string()
      .min(1, 'New template name is required')
      .max(512)
      .regex(/^[a-z0-9_]+$/, 'Template name must be lowercase with underscores only'),
    whatsappAccountId: z.string().optional(),
  }),
});

// ============================================
// SUBMIT TEMPLATE
// ============================================
export const submitTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
  body: z.object({
    whatsappAccountId: z.string().optional(),
  }).optional(),
});

// ============================================
// PREVIEW TEMPLATE
// ============================================
export const previewTemplateSchema = z.object({
  body: z.object({
    bodyText: z.string().min(1, 'Body text is required'),
    variables: z.record(z.string()).optional(),
    headerType: z.string().optional(),
    headerContent: z.string().optional(),
    footerText: z.string().optional(),
    buttons: z.array(z.object({
      type: z.string(),
      text: z.string(),
    })).optional(),
  }),
});

// ============================================
// SYNC TEMPLATES
// ============================================
export const syncTemplatesSchema = z.object({
  body: z.object({
    whatsappAccountId: z.string().optional(),
  }).optional(),
});

// ============================================
// GET TEMPLATES QUERY (Optional - for validation)
// ============================================
export const getTemplatesQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
    search: z.string().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).optional(),
    language: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    whatsappAccountId: z.string().optional(),
  }).optional(),
});

// ============================================
// UPLOAD TO META
// ============================================
export const uploadToMetaSchema = z.object({
  body: z.object({
    cloudinaryUrl: z.string().url('Invalid cloudinaryUrl'),
    mimeType: z.string().optional(),
    filename: z.string().optional(),
    whatsappAccountId: z.string().optional(),
  }),
});