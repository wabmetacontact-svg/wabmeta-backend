import { z } from 'zod';
export declare const adminLoginSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
        password: string;
    }, {
        email: string;
        password: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
        password: string;
    };
}, {
    body: {
        email: string;
        password: string;
    };
}>;
export declare const createAdminSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
        name: z.ZodString;
        role: z.ZodDefault<z.ZodOptional<z.ZodEnum<["admin", "super_admin"]>>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        email: string;
        password: string;
        role: "admin" | "super_admin";
    }, {
        name: string;
        email: string;
        password: string;
        role?: "admin" | "super_admin" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        email: string;
        password: string;
        role: "admin" | "super_admin";
    };
}, {
    body: {
        name: string;
        email: string;
        password: string;
        role?: "admin" | "super_admin" | undefined;
    };
}>;
export declare const updateAdminSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        role: z.ZodOptional<z.ZodEnum<["admin", "super_admin"]>>;
        isActive: z.ZodOptional<z.ZodBoolean>;
        password: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        password?: string | undefined;
        role?: "admin" | "super_admin" | undefined;
        isActive?: boolean | undefined;
    }, {
        name?: string | undefined;
        password?: string | undefined;
        role?: "admin" | "super_admin" | undefined;
        isActive?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name?: string | undefined;
        password?: string | undefined;
        role?: "admin" | "super_admin" | undefined;
        isActive?: boolean | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        name?: string | undefined;
        password?: string | undefined;
        role?: "admin" | "super_admin" | undefined;
        isActive?: boolean | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const getUsersSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodString>;
        search: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodString>;
        sortBy: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        search?: string | undefined;
        limit?: string | undefined;
        status?: string | undefined;
        page?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }, {
        search?: string | undefined;
        limit?: string | undefined;
        status?: string | undefined;
        page?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        search?: string | undefined;
        limit?: string | undefined;
        status?: string | undefined;
        page?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    };
}, {
    query: {
        search?: string | undefined;
        limit?: string | undefined;
        status?: string | undefined;
        page?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    };
}>;
export declare const getUserByIdSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
export declare const updateUserSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"]>>;
        emailVerified: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: string | undefined;
        emailVerified?: boolean | undefined;
    }, {
        status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: string | undefined;
        emailVerified?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: string | undefined;
        emailVerified?: boolean | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: string | undefined;
        emailVerified?: boolean | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const updateUserStatusSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        status: z.ZodEnum<["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"]>;
    }, "strip", z.ZodTypeAny, {
        status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
    }, {
        status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
    };
    params: {
        id: string;
    };
}, {
    body: {
        status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
    };
    params: {
        id: string;
    };
}>;
export declare const updateUserPasswordSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        password: z.ZodString;
        logoutDevices: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        password: string;
        logoutDevices?: boolean | undefined;
    }, {
        password: string;
        logoutDevices?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        password: string;
        logoutDevices?: boolean | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        password: string;
        logoutDevices?: boolean | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const deleteUserSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
export declare const getOrganizationsSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodString>;
        search: z.ZodOptional<z.ZodString>;
        planType: z.ZodOptional<z.ZodString>;
        sortBy: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        search?: string | undefined;
        limit?: string | undefined;
        planType?: string | undefined;
        page?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }, {
        search?: string | undefined;
        limit?: string | undefined;
        planType?: string | undefined;
        page?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        search?: string | undefined;
        limit?: string | undefined;
        planType?: string | undefined;
        page?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    };
}, {
    query: {
        search?: string | undefined;
        limit?: string | undefined;
        planType?: string | undefined;
        page?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    };
}>;
export declare const getOrganizationByIdSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
export declare const updateOrganizationSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        website: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        industry: z.ZodOptional<z.ZodString>;
        timezone: z.ZodOptional<z.ZodString>;
        planType: z.ZodOptional<z.ZodEnum<["FREE", "STARTER", "PRO", "ENTERPRISE"]>>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        planType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        website?: string | null | undefined;
        industry?: string | undefined;
        timezone?: string | undefined;
    }, {
        name?: string | undefined;
        planType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        website?: string | null | undefined;
        industry?: string | undefined;
        timezone?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name?: string | undefined;
        planType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        website?: string | null | undefined;
        industry?: string | undefined;
        timezone?: string | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        name?: string | undefined;
        planType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        website?: string | null | undefined;
        industry?: string | undefined;
        timezone?: string | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const deleteOrganizationSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
export declare const updateSubscriptionSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        planId: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["ACTIVE", "CANCELLED", "EXPIRED", "PAST_DUE"]>>;
        billingCycle: z.ZodOptional<z.ZodEnum<["monthly", "yearly"]>>;
    }, "strip", z.ZodTypeAny, {
        status?: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | undefined;
        planId?: string | undefined;
        billingCycle?: "monthly" | "yearly" | undefined;
    }, {
        status?: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | undefined;
        planId?: string | undefined;
        billingCycle?: "monthly" | "yearly" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        status?: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | undefined;
        planId?: string | undefined;
        billingCycle?: "monthly" | "yearly" | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        status?: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | undefined;
        planId?: string | undefined;
        billingCycle?: "monthly" | "yearly" | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const createPlanSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<["FREE", "STARTER", "PRO", "ENTERPRISE"]>;
        slug: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        monthlyPrice: z.ZodNumber;
        yearlyPrice: z.ZodNumber;
        maxContacts: z.ZodNumber;
        maxMessages: z.ZodNumber;
        maxTeamMembers: z.ZodNumber;
        maxCampaigns: z.ZodNumber;
        maxChatbots: z.ZodNumber;
        maxTemplates: z.ZodNumber;
        maxWhatsAppAccounts: z.ZodNumber;
        maxMessagesPerMonth: z.ZodNumber;
        maxCampaignsPerMonth: z.ZodNumber;
        maxAutomations: z.ZodNumber;
        maxApiCalls: z.ZodNumber;
        features: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        isActive: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
        slug: string;
        monthlyPrice: number;
        yearlyPrice: number;
        maxContacts: number;
        maxMessages: number;
        maxTeamMembers: number;
        maxCampaigns: number;
        maxChatbots: number;
        maxTemplates: number;
        maxWhatsAppAccounts: number;
        maxMessagesPerMonth: number;
        maxCampaignsPerMonth: number;
        maxAutomations: number;
        maxApiCalls: number;
        isActive?: boolean | undefined;
        description?: string | undefined;
        features?: string[] | undefined;
    }, {
        name: string;
        type: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
        slug: string;
        monthlyPrice: number;
        yearlyPrice: number;
        maxContacts: number;
        maxMessages: number;
        maxTeamMembers: number;
        maxCampaigns: number;
        maxChatbots: number;
        maxTemplates: number;
        maxWhatsAppAccounts: number;
        maxMessagesPerMonth: number;
        maxCampaignsPerMonth: number;
        maxAutomations: number;
        maxApiCalls: number;
        isActive?: boolean | undefined;
        description?: string | undefined;
        features?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        type: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
        slug: string;
        monthlyPrice: number;
        yearlyPrice: number;
        maxContacts: number;
        maxMessages: number;
        maxTeamMembers: number;
        maxCampaigns: number;
        maxChatbots: number;
        maxTemplates: number;
        maxWhatsAppAccounts: number;
        maxMessagesPerMonth: number;
        maxCampaignsPerMonth: number;
        maxAutomations: number;
        maxApiCalls: number;
        isActive?: boolean | undefined;
        description?: string | undefined;
        features?: string[] | undefined;
    };
}, {
    body: {
        name: string;
        type: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
        slug: string;
        monthlyPrice: number;
        yearlyPrice: number;
        maxContacts: number;
        maxMessages: number;
        maxTeamMembers: number;
        maxCampaigns: number;
        maxChatbots: number;
        maxTemplates: number;
        maxWhatsAppAccounts: number;
        maxMessagesPerMonth: number;
        maxCampaignsPerMonth: number;
        maxAutomations: number;
        maxApiCalls: number;
        isActive?: boolean | undefined;
        description?: string | undefined;
        features?: string[] | undefined;
    };
}>;
export declare const updatePlanSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        monthlyPrice: z.ZodOptional<z.ZodNumber>;
        yearlyPrice: z.ZodOptional<z.ZodNumber>;
        maxContacts: z.ZodOptional<z.ZodNumber>;
        maxMessages: z.ZodOptional<z.ZodNumber>;
        maxTeamMembers: z.ZodOptional<z.ZodNumber>;
        maxCampaigns: z.ZodOptional<z.ZodNumber>;
        maxChatbots: z.ZodOptional<z.ZodNumber>;
        maxTemplates: z.ZodOptional<z.ZodNumber>;
        maxWhatsAppAccounts: z.ZodOptional<z.ZodNumber>;
        maxMessagesPerMonth: z.ZodOptional<z.ZodNumber>;
        maxCampaignsPerMonth: z.ZodOptional<z.ZodNumber>;
        maxAutomations: z.ZodOptional<z.ZodNumber>;
        maxApiCalls: z.ZodOptional<z.ZodNumber>;
        features: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        isActive: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        isActive?: boolean | undefined;
        description?: string | undefined;
        monthlyPrice?: number | undefined;
        yearlyPrice?: number | undefined;
        maxContacts?: number | undefined;
        maxMessages?: number | undefined;
        maxTeamMembers?: number | undefined;
        maxCampaigns?: number | undefined;
        maxChatbots?: number | undefined;
        maxTemplates?: number | undefined;
        maxWhatsAppAccounts?: number | undefined;
        maxMessagesPerMonth?: number | undefined;
        maxCampaignsPerMonth?: number | undefined;
        maxAutomations?: number | undefined;
        maxApiCalls?: number | undefined;
        features?: string[] | undefined;
    }, {
        name?: string | undefined;
        isActive?: boolean | undefined;
        description?: string | undefined;
        monthlyPrice?: number | undefined;
        yearlyPrice?: number | undefined;
        maxContacts?: number | undefined;
        maxMessages?: number | undefined;
        maxTeamMembers?: number | undefined;
        maxCampaigns?: number | undefined;
        maxChatbots?: number | undefined;
        maxTemplates?: number | undefined;
        maxWhatsAppAccounts?: number | undefined;
        maxMessagesPerMonth?: number | undefined;
        maxCampaignsPerMonth?: number | undefined;
        maxAutomations?: number | undefined;
        maxApiCalls?: number | undefined;
        features?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name?: string | undefined;
        isActive?: boolean | undefined;
        description?: string | undefined;
        monthlyPrice?: number | undefined;
        yearlyPrice?: number | undefined;
        maxContacts?: number | undefined;
        maxMessages?: number | undefined;
        maxTeamMembers?: number | undefined;
        maxCampaigns?: number | undefined;
        maxChatbots?: number | undefined;
        maxTemplates?: number | undefined;
        maxWhatsAppAccounts?: number | undefined;
        maxMessagesPerMonth?: number | undefined;
        maxCampaignsPerMonth?: number | undefined;
        maxAutomations?: number | undefined;
        maxApiCalls?: number | undefined;
        features?: string[] | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        name?: string | undefined;
        isActive?: boolean | undefined;
        description?: string | undefined;
        monthlyPrice?: number | undefined;
        yearlyPrice?: number | undefined;
        maxContacts?: number | undefined;
        maxMessages?: number | undefined;
        maxTeamMembers?: number | undefined;
        maxCampaigns?: number | undefined;
        maxChatbots?: number | undefined;
        maxTemplates?: number | undefined;
        maxWhatsAppAccounts?: number | undefined;
        maxMessagesPerMonth?: number | undefined;
        maxCampaignsPerMonth?: number | undefined;
        maxAutomations?: number | undefined;
        maxApiCalls?: number | undefined;
        features?: string[] | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const getActivityLogsSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodString>;
        action: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        organizationId: z.ZodOptional<z.ZodString>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        userId?: string | undefined;
        organizationId?: string | undefined;
        limit?: string | undefined;
        page?: string | undefined;
        action?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
    }, {
        userId?: string | undefined;
        organizationId?: string | undefined;
        limit?: string | undefined;
        page?: string | undefined;
        action?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        userId?: string | undefined;
        organizationId?: string | undefined;
        limit?: string | undefined;
        page?: string | undefined;
        action?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
    };
}, {
    query: {
        userId?: string | undefined;
        organizationId?: string | undefined;
        limit?: string | undefined;
        page?: string | undefined;
        action?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
    };
}>;
export declare const updateSystemSettingsSchema: z.ZodObject<{
    body: z.ZodObject<{
        maintenanceMode: z.ZodOptional<z.ZodBoolean>;
        allowRegistration: z.ZodOptional<z.ZodBoolean>;
        maxOrganizationsPerUser: z.ZodOptional<z.ZodNumber>;
        defaultPlanType: z.ZodOptional<z.ZodEnum<["FREE", "STARTER", "PRO", "ENTERPRISE"]>>;
        smtpEnabled: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        maintenanceMode?: boolean | undefined;
        allowRegistration?: boolean | undefined;
        maxOrganizationsPerUser?: number | undefined;
        defaultPlanType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        smtpEnabled?: boolean | undefined;
    }, {
        maintenanceMode?: boolean | undefined;
        allowRegistration?: boolean | undefined;
        maxOrganizationsPerUser?: number | undefined;
        defaultPlanType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        smtpEnabled?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        maintenanceMode?: boolean | undefined;
        allowRegistration?: boolean | undefined;
        maxOrganizationsPerUser?: number | undefined;
        defaultPlanType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        smtpEnabled?: boolean | undefined;
    };
}, {
    body: {
        maintenanceMode?: boolean | undefined;
        allowRegistration?: boolean | undefined;
        maxOrganizationsPerUser?: number | undefined;
        defaultPlanType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        smtpEnabled?: boolean | undefined;
    };
}>;
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
//# sourceMappingURL=admin.schema.d.ts.map