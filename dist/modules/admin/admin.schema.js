"use strict";
// src/modules/admin/admin.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSystemSettingsSchema = exports.getActivityLogsSchema = exports.updatePlanSchema = exports.createPlanSchema = exports.updateSubscriptionSchema = exports.deleteOrganizationSchema = exports.updateOrganizationSchema = exports.getOrganizationByIdSchema = exports.getOrganizationsSchema = exports.deleteUserSchema = exports.updateUserPasswordSchema = exports.updateUserStatusSchema = exports.updateUserSchema = exports.getUserByIdSchema = exports.getUsersSchema = exports.updateAdminSchema = exports.createAdminSchema = exports.adminLoginSchema = void 0;
const zod_1 = require("zod");
// ============================================
// COMMON VALIDATORS
// ============================================
const idParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'ID is required'),
    }),
});
const paginationSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().optional().transform((val) => (val ? Number(val) : 1)),
        limit: zod_1.z.string().optional().transform((val) => (val ? Number(val) : 20)),
        sortBy: zod_1.z.string().optional(),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional(),
    }),
});
// ============================================
// ADMIN AUTH SCHEMAS
// ============================================
exports.adminLoginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email address'),
        password: zod_1.z.string().min(1, 'Password is required'),
    }),
});
exports.createAdminSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email address'),
        password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
        name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
        role: zod_1.z.enum(['admin', 'super_admin']).optional().default('admin'),
    }),
});
exports.updateAdminSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Admin ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).optional(),
        role: zod_1.z.enum(['admin', 'super_admin']).optional(),
        isActive: zod_1.z.boolean().optional(),
        password: zod_1.z.string().min(8).optional(),
    }),
});
// ============================================
// USER MANAGEMENT SCHEMAS
// ============================================
exports.getUsersSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().optional(),
        limit: zod_1.z.string().optional(),
        search: zod_1.z.string().optional(),
        status: zod_1.z.string().optional(),
        sortBy: zod_1.z.string().optional(),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional(),
    }),
});
exports.getUserByIdSchema = idParamSchema;
exports.updateUserSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'User ID is required'),
    }),
    body: zod_1.z.object({
        firstName: zod_1.z.string().min(1).optional(),
        lastName: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).optional(),
        emailVerified: zod_1.z.boolean().optional(),
    }),
});
exports.updateUserStatusSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'User ID is required'),
    }),
    body: zod_1.z.object({
        status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'], {
            required_error: 'Status is required',
        }),
    }),
});
exports.updateUserPasswordSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'User ID is required'),
    }),
    body: zod_1.z.object({
        password: zod_1.z.string().min(4, 'Password must be at least 4 characters'),
    }),
});
exports.deleteUserSchema = idParamSchema;
// ============================================
// ORGANIZATION MANAGEMENT SCHEMAS
// ============================================
exports.getOrganizationsSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().optional(),
        limit: zod_1.z.string().optional(),
        search: zod_1.z.string().optional(),
        planType: zod_1.z.string().optional(),
        sortBy: zod_1.z.string().optional(),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional(),
    }),
});
exports.getOrganizationByIdSchema = idParamSchema;
exports.updateOrganizationSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Organization ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).optional(),
        website: zod_1.z.string().url().optional().nullable(),
        industry: zod_1.z.string().optional(),
        timezone: zod_1.z.string().optional(),
        planType: zod_1.z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
    }),
});
exports.deleteOrganizationSchema = idParamSchema;
exports.updateSubscriptionSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Organization ID is required'),
    }),
    body: zod_1.z.object({
        planId: zod_1.z.string().optional(),
        status: zod_1.z.enum(['ACTIVE', 'CANCELLED', 'EXPIRED', 'PAST_DUE']).optional(),
        billingCycle: zod_1.z.enum(['monthly', 'yearly']).optional(),
    }),
});
// ============================================
// PLAN MANAGEMENT SCHEMAS
// ============================================
exports.createPlanSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2, 'Plan name is required'),
        type: zod_1.z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']),
        slug: zod_1.z.string().min(2, 'Slug is required'),
        description: zod_1.z.string().optional(),
        monthlyPrice: zod_1.z.number().min(0),
        yearlyPrice: zod_1.z.number().min(0),
        maxContacts: zod_1.z.number().int().min(0),
        maxMessages: zod_1.z.number().int().min(0),
        maxTeamMembers: zod_1.z.number().int().min(0),
        maxCampaigns: zod_1.z.number().int().min(0),
        maxChatbots: zod_1.z.number().int().min(0),
        maxTemplates: zod_1.z.number().int().min(0),
        maxWhatsAppAccounts: zod_1.z.number().int().min(0),
        maxMessagesPerMonth: zod_1.z.number().int().min(0),
        maxCampaignsPerMonth: zod_1.z.number().int().min(0),
        maxAutomations: zod_1.z.number().int().min(0),
        maxApiCalls: zod_1.z.number().int().min(0),
        features: zod_1.z.array(zod_1.z.string()).optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
exports.updatePlanSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Plan ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).optional(),
        description: zod_1.z.string().optional(),
        monthlyPrice: zod_1.z.number().min(0).optional(),
        yearlyPrice: zod_1.z.number().min(0).optional(),
        maxContacts: zod_1.z.number().int().min(0).optional(),
        maxMessages: zod_1.z.number().int().min(0).optional(),
        maxTeamMembers: zod_1.z.number().int().min(0).optional(),
        maxCampaigns: zod_1.z.number().int().min(0).optional(),
        maxChatbots: zod_1.z.number().int().min(0).optional(),
        maxTemplates: zod_1.z.number().int().min(0).optional(),
        maxWhatsAppAccounts: zod_1.z.number().int().min(0).optional(),
        maxMessagesPerMonth: zod_1.z.number().int().min(0).optional(),
        maxCampaignsPerMonth: zod_1.z.number().int().min(0).optional(),
        maxAutomations: zod_1.z.number().int().min(0).optional(),
        maxApiCalls: zod_1.z.number().int().min(0).optional(),
        features: zod_1.z.array(zod_1.z.string()).optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
// ============================================
// ACTIVITY LOGS SCHEMA
// ============================================
exports.getActivityLogsSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().optional(),
        limit: zod_1.z.string().optional(),
        action: zod_1.z.string().optional(),
        userId: zod_1.z.string().optional(),
        organizationId: zod_1.z.string().optional(),
        startDate: zod_1.z.string().optional(),
        endDate: zod_1.z.string().optional(),
    }),
});
// ============================================
// SYSTEM SETTINGS SCHEMA
// ============================================
exports.updateSystemSettingsSchema = zod_1.z.object({
    body: zod_1.z.object({
        maintenanceMode: zod_1.z.boolean().optional(),
        allowRegistration: zod_1.z.boolean().optional(),
        maxOrganizationsPerUser: zod_1.z.number().int().min(1).optional(),
        defaultPlanType: zod_1.z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
        smtpEnabled: zod_1.z.boolean().optional(),
    }),
});
//# sourceMappingURL=admin.schema.js.map