// src/modules/admin/admin.schema.ts

import { z } from 'zod';

// ============================================
// COMMON VALIDATORS
// ============================================

const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID is required'),
  }),
});

const paginationSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? Number(val) : 1)),
    limit: z.string().optional().transform((val) => (val ? Number(val) : 20)),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

// ============================================
// ADMIN AUTH SCHEMAS
// ============================================

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const createAdminSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    role: z.enum(['admin', 'super_admin']).optional().default('admin'),
  }),
});

export const updateAdminSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Admin ID is required'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    role: z.enum(['admin', 'super_admin']).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).optional(),
  }),
});

// ============================================
// USER MANAGEMENT SCHEMAS
// ============================================

export const getUsersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    status: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const getUserByIdSchema = idParamSchema;

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).optional(),
    emailVerified: z.boolean().optional(),
  }),
});

export const updateUserStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'], {
      required_error: 'Status is required',
    }),
  }),
});

export const updateUserPasswordSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    password: z.string().min(4, 'Password must be at least 4 characters'),
    logoutDevices: z.boolean().optional(),
  }),
});

export const deleteUserSchema = idParamSchema;

// ============================================
// ORGANIZATION MANAGEMENT SCHEMAS
// ============================================

export const getOrganizationsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    planType: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const getOrganizationByIdSchema = idParamSchema;

export const updateOrganizationSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Organization ID is required'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    website: z.string().url().optional().nullable(),
    industry: z.string().optional(),
    timezone: z.string().optional(),
    planType: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
  }),
});

export const deleteOrganizationSchema = idParamSchema;

export const updateSubscriptionSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Organization ID is required'),
  }),
  body: z.object({
    planId: z.string().optional(),
    status: z.enum(['ACTIVE', 'CANCELLED', 'EXPIRED', 'PAST_DUE']).optional(),
    billingCycle: z.enum(['monthly', 'yearly']).optional(),
  }),
});

// ============================================
// PLAN MANAGEMENT SCHEMAS
// ============================================

export const createPlanSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Plan name is required'),
    type: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']),
    slug: z.string().min(2, 'Slug is required'),
    description: z.string().optional(),
    monthlyPrice: z.number().min(0),
    yearlyPrice: z.number().min(0),
    maxContacts: z.number().int().min(0),
    maxMessages: z.number().int().min(0),
    maxTeamMembers: z.number().int().min(0),
    maxCampaigns: z.number().int().min(0),
    maxChatbots: z.number().int().min(0),
    maxTemplates: z.number().int().min(0),
    maxWhatsAppAccounts: z.number().int().min(0),
    maxMessagesPerMonth: z.number().int().min(0),
    maxCampaignsPerMonth: z.number().int().min(0),
    maxAutomations: z.number().int().min(0),
    maxApiCalls: z.number().int().min(0),
    features: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updatePlanSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Plan ID is required'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    monthlyPrice: z.number().min(0).optional(),
    yearlyPrice: z.number().min(0).optional(),
    maxContacts: z.number().int().min(0).optional(),
    maxMessages: z.number().int().min(0).optional(),
    maxTeamMembers: z.number().int().min(0).optional(),
    maxCampaigns: z.number().int().min(0).optional(),
    maxChatbots: z.number().int().min(0).optional(),
    maxTemplates: z.number().int().min(0).optional(),
    maxWhatsAppAccounts: z.number().int().min(0).optional(),
    maxMessagesPerMonth: z.number().int().min(0).optional(),
    maxCampaignsPerMonth: z.number().int().min(0).optional(),
    maxAutomations: z.number().int().min(0).optional(),
    maxApiCalls: z.number().int().min(0).optional(),
    features: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  }),
});

// ============================================
// ACTIVITY LOGS SCHEMA
// ============================================

export const getActivityLogsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    action: z.string().optional(),
    userId: z.string().optional(),
    organizationId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

// ============================================
// SYSTEM SETTINGS SCHEMA
// ============================================

export const updateSystemSettingsSchema = z.object({
  body: z.object({
    maintenanceMode: z.boolean().optional(),
    allowRegistration: z.boolean().optional(),
    maxOrganizationsPerUser: z.number().int().min(1).optional(),
    defaultPlanType: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
    smtpEnabled: z.boolean().optional(),
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type AdminLoginSchema = z.infer<typeof adminLoginSchema>;
export type CreateAdminSchema = z.infer<typeof createAdminSchema>;
export type UpdateAdminSchema = z.infer<typeof updateAdminSchema>;
export type GetUsersSchema = z.infer<typeof getUsersSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;
export type UpdateUserStatusSchema = z.infer<typeof updateUserStatusSchema>;
export type UpdateUserPasswordSchema = z.infer<typeof updateUserPasswordSchema>;
export type GetOrganizationsSchema = z.infer<typeof getOrganizationsSchema>;
export type UpdateOrganizationSchema = z.infer<typeof updateOrganizationSchema>;
export type UpdateSubscriptionSchema = z.infer<typeof updateSubscriptionSchema>;
export type CreatePlanSchema = z.infer<typeof createPlanSchema>;
export type UpdatePlanSchema = z.infer<typeof updatePlanSchema>;
export type GetActivityLogsSchema = z.infer<typeof getActivityLogsSchema>;
export type UpdateSystemSettingsSchema = z.infer<typeof updateSystemSettingsSchema>;