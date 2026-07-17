"use strict";
// src/modules/templates/templates.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToMetaSchema = exports.getTemplatesQuerySchema = exports.syncTemplatesSchema = exports.previewTemplateSchema = exports.submitTemplateSchema = exports.duplicateTemplateSchema = exports.deleteTemplateSchema = exports.getTemplateByIdSchema = exports.updateTemplateSchema = exports.createTemplateSchema = void 0;
const zod_1 = require("zod");
// ============================================
// CREATE TEMPLATE
// ============================================
exports.createTemplateSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1, 'Template name is required')
            .max(512, 'Template name too long')
            .regex(/^[a-z0-9_]+$/, 'Template name must be lowercase with underscores only'),
        language: zod_1.z.string().min(1).default('en'),
        category: zod_1.z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).default('MARKETING'),
        headerType: zod_1.z.string().optional().nullable(),
        headerContent: zod_1.z.string().max(1024).optional().nullable(),
        bodyText: zod_1.z
            .string()
            .min(1, 'Body text is required')
            .max(1024, 'Body text too long'),
        footerText: zod_1.z.string().max(60).optional().nullable(),
        buttons: zod_1.z.array(zod_1.z.object({
            type: zod_1.z.string(),
            text: zod_1.z.string(),
            url: zod_1.z.string().optional(),
            phoneNumber: zod_1.z.string().optional(),
        })).max(3).optional(),
        variables: zod_1.z.array(zod_1.z.object({
            index: zod_1.z.number(),
            type: zod_1.z.string(),
            example: zod_1.z.any().optional(),
        })).optional(),
        whatsappAccountId: zod_1.z.string().optional(),
    }),
});
// ============================================
// UPDATE TEMPLATE
// ============================================
exports.updateTemplateSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1)
            .max(512)
            .regex(/^[a-z0-9_]+$/)
            .optional(),
        language: zod_1.z.string().min(1).optional(),
        category: zod_1.z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).optional(),
        headerType: zod_1.z.string().optional().nullable(),
        headerContent: zod_1.z.string().max(1024).optional().nullable(),
        bodyText: zod_1.z.string().min(1).max(1024).optional(),
        footerText: zod_1.z.string().max(60).optional().nullable(),
        buttons: zod_1.z.array(zod_1.z.object({
            type: zod_1.z.string(),
            text: zod_1.z.string(),
            url: zod_1.z.string().optional(),
            phoneNumber: zod_1.z.string().optional(),
        })).max(3).optional(),
        variables: zod_1.z.array(zod_1.z.object({
            index: zod_1.z.number(),
            type: zod_1.z.string(),
            example: zod_1.z.any().optional(),
        })).optional(),
    }),
});
// ============================================
// GET TEMPLATE BY ID
// ============================================
exports.getTemplateByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
});
// ============================================
// DELETE TEMPLATE
// ============================================
exports.deleteTemplateSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
});
// ============================================
// DUPLICATE TEMPLATE
// ============================================
exports.duplicateTemplateSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1, 'New template name is required')
            .max(512)
            .regex(/^[a-z0-9_]+$/, 'Template name must be lowercase with underscores only'),
        whatsappAccountId: zod_1.z.string().optional(),
    }),
});
// ============================================
// SUBMIT TEMPLATE
// ============================================
exports.submitTemplateSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
    body: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().optional(),
    }).optional(),
});
// ============================================
// PREVIEW TEMPLATE
// ============================================
exports.previewTemplateSchema = zod_1.z.object({
    body: zod_1.z.object({
        bodyText: zod_1.z.string().min(1, 'Body text is required'),
        variables: zod_1.z.record(zod_1.z.string()).optional(),
        headerType: zod_1.z.string().optional(),
        headerContent: zod_1.z.string().optional(),
        footerText: zod_1.z.string().optional(),
        buttons: zod_1.z.array(zod_1.z.object({
            type: zod_1.z.string(),
            text: zod_1.z.string(),
        })).optional(),
    }),
});
// ============================================
// SYNC TEMPLATES
// ============================================
exports.syncTemplatesSchema = zod_1.z.object({
    body: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().optional(),
    }).optional(),
});
// ============================================
// GET TEMPLATES QUERY (Optional - for validation)
// ============================================
exports.getTemplatesQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 1),
        limit: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 20),
        search: zod_1.z.string().optional(),
        status: zod_1.z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
        category: zod_1.z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).optional(),
        language: zod_1.z.string().optional(),
        sortBy: zod_1.z.string().optional(),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional(),
        whatsappAccountId: zod_1.z.string().optional(),
    }).optional(),
});
// ============================================
// UPLOAD TO META
// ============================================
exports.uploadToMetaSchema = zod_1.z.object({
    body: zod_1.z.object({
        cloudinaryUrl: zod_1.z.string().url('Invalid cloudinaryUrl'),
        mimeType: zod_1.z.string().optional(),
        filename: zod_1.z.string().optional(),
        whatsappAccountId: zod_1.z.string().optional(),
    }),
});
//# sourceMappingURL=templates.schema.js.map