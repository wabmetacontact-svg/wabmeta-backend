interface LoginInput {
    email: string;
    password: string;
}
interface GetUsersInput {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
}
interface GetOrganizationsInput {
    page: number;
    limit: number;
    search?: string;
    planType?: string;
    sortBy?: string;
    sortOrder?: string;
}
interface GetActivityLogsInput {
    page: number;
    limit: number;
    action?: string;
    userId?: string;
    organizationId?: string;
    startDate?: string;
    endDate?: string;
}
export declare class AdminService {
    login(input: LoginInput): Promise<{
        token: string;
        admin: {
            id: string;
            email: string;
            name: string;
            role: string;
        };
    }>;
    getAdminById(id: string): Promise<{
        name: string;
        email: string;
        id: string;
        createdAt: Date;
        isActive: boolean;
        lastLoginAt: Date | null;
        role: string;
    } | null>;
    getDashboardStats(): Promise<{
        users: {
            total: number;
            active: number;
            pending: number;
            suspended: number;
            newThisMonth: number;
            todayUsers: number;
        };
        organizations: {
            total: number;
            byPlan: Record<string, number>;
            newThisMonth: number;
        };
        messages: {
            totalSent: number;
            todaySent: number;
            thisMonthSent: number;
        };
        revenue: {
            totalRevenue: number;
            monthlyRevenue: number;
            todayRevenue: number;
            mrr: number;
            arr: number;
        };
        whatsapp: {
            connectedAccounts: number;
            cloudApiConnected: number;
            businessAppConnected: number;
            totalContacts: number;
            totalCampaigns: number;
        };
        wallet: {
            totalActiveWallets: number;
            pendingRequests: number;
            totalBalanceHeld: number;
        };
    }>;
    getUsers(input: GetUsersInput): Promise<{
        users: {
            organizations: {
                id: string;
                name: string;
                role: import(".prisma/client").$Enums.UserRole;
            }[];
            memberships: undefined;
            email: string;
            id: string;
            status: import(".prisma/client").$Enums.UserStatus;
            createdAt: Date;
            password: string | null;
            firstName: string;
            lastName: string | null;
            phone: string | null;
            avatar: string | null;
            emailVerified: boolean;
            lastLoginAt: Date | null;
        }[];
        total: number;
    }>;
    getUserById(id: string): Promise<{
        organizations: {
            role: import(".prisma/client").$Enums.UserRole;
            name: string;
            id: string;
            slug: string;
            planType: import(".prisma/client").$Enums.PlanType;
        }[];
        _count: {
            activityLogs: number;
            notifications: number;
            refreshTokens: number;
        };
        ownedOrganizations: {
            name: string;
            id: string;
            slug: string;
            planType: import(".prisma/client").$Enums.PlanType;
        }[];
        memberships: ({
            organization: {
                name: string;
                id: string;
                slug: string;
                planType: import(".prisma/client").$Enums.PlanType;
            };
        } & {
            userId: string;
            organizationId: string;
            id: string;
            updatedAt: Date;
            role: import(".prisma/client").$Enums.UserRole;
            invitedAt: Date;
            joinedAt: Date | null;
        })[];
        email: string;
        tokenVersion: number;
        id: string;
        status: import(".prisma/client").$Enums.UserStatus;
        createdAt: Date;
        updatedAt: Date;
        googleId: string | null;
        password: string | null;
        firstName: string;
        lastName: string | null;
        phone: string | null;
        avatar: string | null;
        emailVerified: boolean;
        emailVerifyToken: string | null;
        emailVerifyExpires: Date | null;
        passwordResetToken: string | null;
        passwordResetExpires: Date | null;
        otpSecret: string | null;
        otpEnabled: boolean;
        lastLoginAt: Date | null;
        lastLoginIp: string | null;
    }>;
    updateUserPassword(id: string, data: any): Promise<{
        id: string;
        email: string;
        message: string;
    }>;
    updateUser(id: string, data: any): Promise<{
        email: string;
        id: string;
        status: import(".prisma/client").$Enums.UserStatus;
        firstName: string;
        lastName: string | null;
        phone: string | null;
        emailVerified: boolean;
    }>;
    updateUserStatus(id: string, status: string): Promise<{
        email: string;
        id: string;
        status: import(".prisma/client").$Enums.UserStatus;
        firstName: string;
        lastName: string | null;
    }>;
    suspendUser(id: string): Promise<{
        email: string;
        id: string;
        status: import(".prisma/client").$Enums.UserStatus;
        firstName: string;
        lastName: string | null;
    }>;
    activateUser(id: string): Promise<{
        email: string;
        id: string;
        status: import(".prisma/client").$Enums.UserStatus;
        firstName: string;
        lastName: string | null;
    }>;
    /**
     * Transfer organization ownership to another user
     */
    transferOrganizationOwnership(organizationId: string, newOwnerId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    deleteUser(userId: string, options?: {
        force?: boolean;
        transferOwnership?: boolean;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    getOrganizations(input: GetOrganizationsInput): Promise<{
        organizations: ({
            subscription: ({
                plan: {
                    name: string;
                    type: import(".prisma/client").$Enums.PlanType;
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
            }) | null;
            _count: {
                contacts: number;
                campaigns: number;
                members: number;
                whatsappAccounts: number;
            };
            owner: {
                email: string;
                id: string;
                firstName: string;
                lastName: string | null;
            };
        } & {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            slug: string;
            planType: import(".prisma/client").$Enums.PlanType;
            logo: string | null;
            website: string | null;
            industry: string | null;
            timezone: string;
            ownerId: string;
            featureCsvUpload: boolean;
            featureOverrideByAdmin: boolean;
            featureSimpleBulkUpload: boolean;
            featureInboxLocked: boolean;
            featureCampaignsLocked: boolean;
            featureChatbotLocked: boolean;
            featureAutomationLocked: boolean;
            featureConnectionLocked: boolean;
            customLabels: import("@prisma/client/runtime/library").JsonValue;
        })[];
        total: number;
    }>;
    getOrganizationById(id: string): Promise<{
        subscription: ({
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
        }) | null;
        _count: {
            contacts: number;
            campaigns: number;
            templates: number;
            chatbots: number;
        };
        owner: {
            email: string;
            id: string;
            firstName: string;
            lastName: string | null;
        };
        members: ({
            user: {
                email: string;
                id: string;
                firstName: string;
                lastName: string | null;
                avatar: string | null;
            };
        } & {
            userId: string;
            organizationId: string;
            id: string;
            updatedAt: Date;
            role: import(".prisma/client").$Enums.UserRole;
            invitedAt: Date;
            joinedAt: Date | null;
        })[];
        whatsappAccounts: {
            phoneNumber: string;
            id: string;
            status: import(".prisma/client").$Enums.WhatsAppAccountStatus;
            displayName: string;
        }[];
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        planType: import(".prisma/client").$Enums.PlanType;
        logo: string | null;
        website: string | null;
        industry: string | null;
        timezone: string;
        ownerId: string;
        featureCsvUpload: boolean;
        featureOverrideByAdmin: boolean;
        featureSimpleBulkUpload: boolean;
        featureInboxLocked: boolean;
        featureCampaignsLocked: boolean;
        featureChatbotLocked: boolean;
        featureAutomationLocked: boolean;
        featureConnectionLocked: boolean;
        customLabels: import("@prisma/client/runtime/library").JsonValue;
    }>;
    updateOrganization(id: string, data: any): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        planType: import(".prisma/client").$Enums.PlanType;
        logo: string | null;
        website: string | null;
        industry: string | null;
        timezone: string;
        ownerId: string;
        featureCsvUpload: boolean;
        featureOverrideByAdmin: boolean;
        featureSimpleBulkUpload: boolean;
        featureInboxLocked: boolean;
        featureCampaignsLocked: boolean;
        featureChatbotLocked: boolean;
        featureAutomationLocked: boolean;
        featureConnectionLocked: boolean;
        customLabels: import("@prisma/client/runtime/library").JsonValue;
    }>;
    deleteOrganization(id: string): Promise<{
        message: string;
    }>;
    updateSubscription(id: string, data: any): Promise<{
        subscription: ({
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
        }) | null;
        _count: {
            contacts: number;
            campaigns: number;
            templates: number;
            chatbots: number;
        };
        owner: {
            email: string;
            id: string;
            firstName: string;
            lastName: string | null;
        };
        members: ({
            user: {
                email: string;
                id: string;
                firstName: string;
                lastName: string | null;
                avatar: string | null;
            };
        } & {
            userId: string;
            organizationId: string;
            id: string;
            updatedAt: Date;
            role: import(".prisma/client").$Enums.UserRole;
            invitedAt: Date;
            joinedAt: Date | null;
        })[];
        whatsappAccounts: {
            phoneNumber: string;
            id: string;
            status: import(".prisma/client").$Enums.WhatsAppAccountStatus;
            displayName: string;
        }[];
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        planType: import(".prisma/client").$Enums.PlanType;
        logo: string | null;
        website: string | null;
        industry: string | null;
        timezone: string;
        ownerId: string;
        featureCsvUpload: boolean;
        featureOverrideByAdmin: boolean;
        featureSimpleBulkUpload: boolean;
        featureInboxLocked: boolean;
        featureCampaignsLocked: boolean;
        featureChatbotLocked: boolean;
        featureAutomationLocked: boolean;
        featureConnectionLocked: boolean;
        customLabels: import("@prisma/client/runtime/library").JsonValue;
    }>;
    getPlans(): Promise<({
        _count: {
            subscriptions: number;
        };
    } & {
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
    })[]>;
    createPlan(data: any): Promise<{
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
    }>;
    updatePlan(id: string, data: any): Promise<{
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
    }>;
    deletePlan(id: string): Promise<{
        message: string;
    }>;
    getAdmins(): Promise<{
        name: string;
        email: string;
        id: string;
        createdAt: Date;
        isActive: boolean;
        lastLoginAt: Date | null;
        role: string;
    }[]>;
    createAdmin(data: any): Promise<{
        name: string;
        email: string;
        id: string;
        createdAt: Date;
        isActive: boolean;
        role: string;
    }>;
    updateAdmin(id: string, data: any): Promise<{
        name: string;
        email: string;
        id: string;
        isActive: boolean;
        role: string;
    }>;
    deleteAdmin(id: string): Promise<{
        message: string;
    }>;
    getActivityLogs(input: GetActivityLogsInput): Promise<{
        logs: ({
            user: {
                email: string;
                id: string;
                firstName: string;
                lastName: string | null;
            } | null;
            organization: {
                name: string;
                id: string;
            } | null;
        } & {
            userId: string | null;
            organizationId: string | null;
            id: string;
            createdAt: Date;
            userAgent: string | null;
            ipAddress: string | null;
            metadata: import("@prisma/client/runtime/library").JsonValue;
            action: import(".prisma/client").$Enums.ActivityAction | null;
            entity: string | null;
            entityId: string | null;
        })[];
        total: number;
    }>;
    getSystemSettings(): {
        maintenanceMode: boolean;
        allowRegistration: boolean;
        maxOrganizationsPerUser: number;
        defaultPlanType: string;
        smtpEnabled: boolean;
    };
    updateSystemSettings(data: any): {
        maintenanceMode: boolean;
        allowRegistration: boolean;
        maxOrganizationsPerUser: number;
        defaultPlanType: string;
        smtpEnabled: boolean;
    };
    getWhatsAppConnectionStats(): Promise<{
        cloudApi: {
            active: number;
            inactive: number;
            total: number;
        };
        businessApp: {
            active: number;
            inactive: number;
            total: number;
        };
        onPremise: {
            active: number;
            inactive: number;
            total: number;
        };
    }>;
    updateWhatsAppConnectionType(accountId: string, connectionType: string): Promise<{
        success: boolean;
        message: string;
        account: {
            phoneNumber: string;
            organizationId: string;
            accessToken: string | null;
            id: string;
            verifiedName: string | null;
            qualityRating: string | null;
            codeVerificationStatus: string | null;
            nameStatus: string | null;
            status: import(".prisma/client").$Enums.WhatsAppAccountStatus;
            phoneNumberId: string;
            wabaId: string;
            displayName: string;
            tokenExpiresAt: Date | null;
            webhookSecret: string | null;
            messagingLimit: string | null;
            dailyMessageLimit: number;
            dailyMessagesUsed: number;
            lastLimitReset: Date;
            businessProfile: import("@prisma/client/runtime/library").JsonValue | null;
            isDefault: boolean;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            connectionType: string;
        };
    }>;
}
export declare const adminService: AdminService;
export {};
//# sourceMappingURL=admin.service.d.ts.map