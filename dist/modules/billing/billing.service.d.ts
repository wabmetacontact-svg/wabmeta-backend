declare class BillingService {
    private getPlanBySlug;
    checkPlanLimit(organizationId: string, limitType: 'contacts' | 'campaigns' | 'messages' | 'teamMembers' | 'templates' | 'chatbots' | 'automations'): Promise<{
        allowed: boolean;
        used: number;
        limit: number;
        remaining: number;
        message?: string;
    }>;
    checkSubscriptionValidity(organizationId: string): Promise<{
        isValid: boolean;
        isExpired: boolean;
        daysRemaining: number;
        expiresAt?: Date;
        planName?: string;
        message?: string;
    }>;
    checkWalletEligibility(organizationId: string): Promise<{
        eligible: boolean;
        reason: string;
    } | {
        eligible: boolean;
        reason?: undefined;
    }>;
    getSubscription(organizationId: string): Promise<{
        plan: {
            maxContacts: number;
            maxMessages: number;
            maxCampaigns: number;
            maxCampaignsPerMonth: number;
            maxTeamMembers: number;
            maxWhatsAppAccounts: number;
            maxTemplates: number;
            maxChatbots: number;
            maxAutomations: number;
            validityDays: number;
            id: string;
            name: string;
            type: string;
            slug: string;
            monthlyPrice: number;
            yearlyPrice: number;
        };
        status: string;
        billingCycle: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        messagesUsed: number;
        contactsUsed: number;
    } | {
        plan: {
            name: string;
            type: import(".prisma/client").$Enums.PlanType;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
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
        };
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        createdAt: Date;
        updatedAt: Date;
        messagesUsed: number;
        planId: string;
        billingCycle: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        contactsUsed: number;
        paymentMethod: string | null;
        lastPaymentAt: Date | null;
        nextPaymentAt: Date | null;
        cancelledAt: Date | null;
    }>;
    getPlans(): Promise<{
        features: string[];
        isActive: boolean;
        isRecommended: boolean;
        popular: boolean;
        maxContacts: number;
        maxMessages: number;
        maxCampaigns: number;
        maxCampaignsPerMonth: number;
        maxTeamMembers: number;
        maxWhatsAppAccounts: number;
        maxTemplates: number;
        maxChatbots: number;
        maxAutomations: number;
        validityDays: number;
        id: string;
        name: string;
        type: string;
        slug: string;
        monthlyPrice: number;
        yearlyPrice: number;
    }[] | {
        popular: boolean;
        monthlyPrice: number;
        yearlyPrice: number;
        features: import("@prisma/client/runtime/library").JsonArray;
        name: string;
        type: import(".prisma/client").$Enums.PlanType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        slug: string;
        description: string | null;
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
    }[]>;
    private getDefaultPlans;
    getUsage(organizationId: string): Promise<{
        messages: {
            used: number;
            limit: number;
            percentage: number;
        };
        contacts: {
            used: number;
            limit: number;
            percentage: number;
        };
        campaigns: {
            used: number;
            limit: number;
            percentage: number;
        };
        storage: {
            used: number;
            limit: number;
            percentage: number;
        };
    }>;
    createRazorpayOrder(params: {
        organizationId: string;
        userId: string;
        planKey: string;
        billingCycle: 'monthly' | 'yearly';
    }): Promise<{
        id: any;
        amount: any;
        currency: any;
        planId: string;
        planName: string;
        validityDays: number;
        receipt: any;
    }>;
    verifyRazorpayPayment(params: {
        organizationId: string;
        userId: string;
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
    }): Promise<{
        subscription: {
            organizationId: string;
            id: string;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            createdAt: Date;
            updatedAt: Date;
            messagesUsed: number;
            planId: string;
            billingCycle: string;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            contactsUsed: number;
            paymentMethod: string | null;
            lastPaymentAt: Date | null;
            nextPaymentAt: Date | null;
            cancelledAt: Date | null;
        };
        plan: {
            name: string;
            type: import(".prisma/client").$Enums.PlanType;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
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
        };
        validUntil: Date;
        message: string;
    }>;
    upgradePlan(params: {
        organizationId: string;
        planType: string;
        billingCycle?: string;
    }): Promise<{
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        createdAt: Date;
        updatedAt: Date;
        messagesUsed: number;
        planId: string;
        billingCycle: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        contactsUsed: number;
        paymentMethod: string | null;
        lastPaymentAt: Date | null;
        nextPaymentAt: Date | null;
        cancelledAt: Date | null;
    }>;
    cancelSubscription(organizationId: string, reason?: string): Promise<{
        message: string;
        subscription: {
            organizationId: string;
            id: string;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            createdAt: Date;
            updatedAt: Date;
            messagesUsed: number;
            planId: string;
            billingCycle: string;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            contactsUsed: number;
            paymentMethod: string | null;
            lastPaymentAt: Date | null;
            nextPaymentAt: Date | null;
            cancelledAt: Date | null;
        };
    }>;
    resumeSubscription(organizationId: string): Promise<{
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        createdAt: Date;
        updatedAt: Date;
        messagesUsed: number;
        planId: string;
        billingCycle: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        contactsUsed: number;
        paymentMethod: string | null;
        lastPaymentAt: Date | null;
        nextPaymentAt: Date | null;
        cancelledAt: Date | null;
    }>;
    getInvoices(organizationId: string, limit?: number, offset?: number): Promise<any[]>;
    getInvoice(invoiceId: string, organizationId: string): Promise<any>;
    generateInvoicePDF(invoiceId: string, organizationId: string): Promise<Buffer>;
    checkSubscriptionStatus(organizationId: string): Promise<{
        isActive: boolean;
        message: string;
        subscription?: undefined;
        daysRemaining?: undefined;
    } | {
        isActive: boolean;
        subscription: {
            plan: {
                name: string;
                type: import(".prisma/client").$Enums.PlanType;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
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
            };
        } & {
            organizationId: string;
            id: string;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            createdAt: Date;
            updatedAt: Date;
            messagesUsed: number;
            planId: string;
            billingCycle: string;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            contactsUsed: number;
            paymentMethod: string | null;
            lastPaymentAt: Date | null;
            nextPaymentAt: Date | null;
            cancelledAt: Date | null;
        };
        daysRemaining: number;
        message?: undefined;
    }>;
}
export declare const billingService: BillingService;
export default billingService;
//# sourceMappingURL=billing.service.d.ts.map