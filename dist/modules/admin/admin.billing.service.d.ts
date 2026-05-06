import { PlanType, SubscriptionStatus } from '@prisma/client';
export declare class AdminBillingService {
    private getPlanBySlugOrType;
    assignPlanToOrganization(params: {
        organizationId: string;
        planSlug: string;
        validityDays?: number;
        customEndDate?: Date;
        adminId: string;
        adminName: string;
        reason?: string;
    }): Promise<{
        subscription: {
            plan: {
                name: string;
                type: import(".prisma/client").$Enums.PlanType;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                slug: string;
                description: string | null;
                monthlyPrice: import("@prisma/client/runtime/library").Decimal;
                yearlyPrice: import("@prisma/client/runtime/library").Decimal;
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
                validityDays: number;
                isRecommended: boolean;
                features: import("@prisma/client/runtime/library").JsonValue;
                isActive: boolean;
            };
        } & {
            organizationId: string;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            billingCycle: string;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            messagesUsed: number;
            contactsUsed: number;
            paymentMethod: string | null;
            lastPaymentAt: Date | null;
            nextPaymentAt: Date | null;
            cancelledAt: Date | null;
            planId: string;
        };
        plan: {
            name: string;
            type: import(".prisma/client").$Enums.PlanType;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            slug: string;
            description: string | null;
            monthlyPrice: import("@prisma/client/runtime/library").Decimal;
            yearlyPrice: import("@prisma/client/runtime/library").Decimal;
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
            validityDays: number;
            isRecommended: boolean;
            features: import("@prisma/client/runtime/library").JsonValue;
            isActive: boolean;
        };
        organization: {
            id: string;
            name: string;
            ownerEmail: string;
        };
        validFrom: Date;
        validUntil: Date;
        message: string;
    }>;
    extendSubscription(params: {
        organizationId: string;
        additionalDays: number;
        adminId: string;
        adminName: string;
        reason?: string;
    }): Promise<{
        subscription: {
            organization: {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                slug: string;
                logo: string | null;
                website: string | null;
                industry: string | null;
                timezone: string;
                planType: import(".prisma/client").$Enums.PlanType;
                featureCsvUpload: boolean;
                featureOverrideByAdmin: boolean;
                featureSimpleBulkUpload: boolean;
                ownerId: string;
            };
            plan: {
                name: string;
                type: import(".prisma/client").$Enums.PlanType;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                slug: string;
                description: string | null;
                monthlyPrice: import("@prisma/client/runtime/library").Decimal;
                yearlyPrice: import("@prisma/client/runtime/library").Decimal;
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
                validityDays: number;
                isRecommended: boolean;
                features: import("@prisma/client/runtime/library").JsonValue;
                isActive: boolean;
            };
        } & {
            organizationId: string;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            billingCycle: string;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            messagesUsed: number;
            contactsUsed: number;
            paymentMethod: string | null;
            lastPaymentAt: Date | null;
            nextPaymentAt: Date | null;
            cancelledAt: Date | null;
            planId: string;
        };
        previousEndDate: Date;
        newEndDate: Date;
        daysAdded: number;
        message: string;
    }>;
    revokeSubscription(params: {
        organizationId: string;
        adminId: string;
        adminName: string;
        reason?: string;
        immediate?: boolean;
    }): Promise<{
        subscription: {
            organization: {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                slug: string;
                logo: string | null;
                website: string | null;
                industry: string | null;
                timezone: string;
                planType: import(".prisma/client").$Enums.PlanType;
                featureCsvUpload: boolean;
                featureOverrideByAdmin: boolean;
                featureSimpleBulkUpload: boolean;
                ownerId: string;
            };
            plan: {
                name: string;
                type: import(".prisma/client").$Enums.PlanType;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                slug: string;
                description: string | null;
                monthlyPrice: import("@prisma/client/runtime/library").Decimal;
                yearlyPrice: import("@prisma/client/runtime/library").Decimal;
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
                validityDays: number;
                isRecommended: boolean;
                features: import("@prisma/client/runtime/library").JsonValue;
                isActive: boolean;
            };
        } & {
            organizationId: string;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            billingCycle: string;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            messagesUsed: number;
            contactsUsed: number;
            paymentMethod: string | null;
            lastPaymentAt: Date | null;
            nextPaymentAt: Date | null;
            cancelledAt: Date | null;
            planId: string;
        };
        message: string;
    }>;
    getAllSubscriptions(params: {
        page?: number;
        limit?: number;
        status?: SubscriptionStatus;
        planType?: PlanType;
        excludePlanType?: PlanType;
        search?: string;
    }): Promise<{
        subscriptions: {
            daysRemaining: number;
            isExpired: boolean;
            isManual: boolean;
            organization: {
                owner: {
                    email: string;
                    firstName: string;
                    lastName: string | null;
                };
            } & {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                slug: string;
                logo: string | null;
                website: string | null;
                industry: string | null;
                timezone: string;
                planType: import(".prisma/client").$Enums.PlanType;
                featureCsvUpload: boolean;
                featureOverrideByAdmin: boolean;
                featureSimpleBulkUpload: boolean;
                ownerId: string;
            };
            plan: {
                name: string;
                type: import(".prisma/client").$Enums.PlanType;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                slug: string;
                description: string | null;
                monthlyPrice: import("@prisma/client/runtime/library").Decimal;
                yearlyPrice: import("@prisma/client/runtime/library").Decimal;
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
                validityDays: number;
                isRecommended: boolean;
                features: import("@prisma/client/runtime/library").JsonValue;
                isActive: boolean;
            };
            organizationId: string;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            billingCycle: string;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            messagesUsed: number;
            contactsUsed: number;
            paymentMethod: string | null;
            lastPaymentAt: Date | null;
            nextPaymentAt: Date | null;
            cancelledAt: Date | null;
            planId: string;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getSubscriptionStats(): Promise<{
        total: number;
        active: number;
        expired: number;
        cancelled: number;
        planBreakdown: {
            planName: string;
            planType: string;
            count: number;
        }[];
        recentActivity: ({
            organization: {
                name: string;
            } | null;
        } & {
            userId: string | null;
            organizationId: string | null;
            id: string;
            createdAt: Date;
            userAgent: string | null;
            ipAddress: string | null;
            action: import(".prisma/client").$Enums.ActivityAction | null;
            metadata: import("@prisma/client/runtime/library").JsonValue;
            entity: string | null;
            entityId: string | null;
        })[];
    }>;
}
export declare const adminBillingService: AdminBillingService;
export default adminBillingService;
//# sourceMappingURL=admin.billing.service.d.ts.map