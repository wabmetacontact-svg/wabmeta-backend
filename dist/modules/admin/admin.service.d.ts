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
        email: string;
        id: string;
        name: string;
        createdAt: Date;
        isActive: boolean;
        role: string;
        lastLoginAt: Date | null;
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
            password: string | null;
            phone: string | null;
            email: string;
            id: string;
            status: import(".prisma/client").$Enums.UserStatus;
            createdAt: Date;
            firstName: string;
            lastName: string | null;
            avatar: string | null;
            emailVerified: boolean;
            lastLoginAt: Date | null;
        }[];
        total: number;
    }>;
    getUserById(id: string): Promise<{
        organizations: {
            role: import(".prisma/client").$Enums.UserRole;
            id: string;
            name: string;
            slug: string;
            planType: import(".prisma/client").$Enums.PlanType;
        }[];
        _count: {
            activityLogs: number;
            notifications: number;
            refreshTokens: number;
        };
        ownedOrganizations: {
            id: string;
            name: string;
            slug: string;
            planType: import(".prisma/client").$Enums.PlanType;
        }[];
        memberships: ({
            organization: {
                id: string;
                name: string;
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
        password: string | null;
        phone: string | null;
        email: string;
        id: string;
        status: import(".prisma/client").$Enums.UserStatus;
        createdAt: Date;
        updatedAt: Date;
        firstName: string;
        lastName: string | null;
        avatar: string | null;
        tokenVersion: number;
        googleId: string | null;
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
        phone: string | null;
        email: string;
        id: string;
        status: import(".prisma/client").$Enums.UserStatus;
        firstName: string;
        lastName: string | null;
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
                planId: string;
                billingCycle: string;
                messagesUsed: number;
                currentPeriodStart: Date;
                currentPeriodEnd: Date;
                contactsUsed: number;
                paymentMethod: string | null;
                lastPaymentAt: Date | null;
                nextPaymentAt: Date | null;
                cancelledAt: Date | null;
            }) | null;
            owner: {
                email: string;
                id: string;
                firstName: string;
                lastName: string | null;
            };
            _count: {
                campaigns: number;
                contacts: number;
                members: number;
                whatsappAccounts: number;
            };
        } & {
            id: string;
            name: string;
            slug: string;
            logo: string | null;
            website: string | null;
            industry: string | null;
            timezone: string;
            ownerId: string;
            planType: import(".prisma/client").$Enums.PlanType;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
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
                id: string;
                name: string;
                slug: string;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                description: string | null;
                type: import(".prisma/client").$Enums.PlanType;
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
            planId: string;
            billingCycle: string;
            messagesUsed: number;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            contactsUsed: number;
            paymentMethod: string | null;
            lastPaymentAt: Date | null;
            nextPaymentAt: Date | null;
            cancelledAt: Date | null;
        }) | null;
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
            id: string;
            status: import(".prisma/client").$Enums.WhatsAppAccountStatus;
            phoneNumber: string;
            displayName: string;
        }[];
        _count: {
            campaigns: number;
            chatbots: number;
            contacts: number;
            templates: number;
        };
    } & {
        id: string;
        name: string;
        slug: string;
        logo: string | null;
        website: string | null;
        industry: string | null;
        timezone: string;
        ownerId: string;
        planType: import(".prisma/client").$Enums.PlanType;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
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
        id: string;
        name: string;
        slug: string;
        logo: string | null;
        website: string | null;
        industry: string | null;
        timezone: string;
        ownerId: string;
        planType: import(".prisma/client").$Enums.PlanType;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
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
                id: string;
                name: string;
                slug: string;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                description: string | null;
                type: import(".prisma/client").$Enums.PlanType;
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
            planId: string;
            billingCycle: string;
            messagesUsed: number;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            contactsUsed: number;
            paymentMethod: string | null;
            lastPaymentAt: Date | null;
            nextPaymentAt: Date | null;
            cancelledAt: Date | null;
        }) | null;
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
            id: string;
            status: import(".prisma/client").$Enums.WhatsAppAccountStatus;
            phoneNumber: string;
            displayName: string;
        }[];
        _count: {
            campaigns: number;
            chatbots: number;
            contacts: number;
            templates: number;
        };
    } & {
        id: string;
        name: string;
        slug: string;
        logo: string | null;
        website: string | null;
        industry: string | null;
        timezone: string;
        ownerId: string;
        planType: import(".prisma/client").$Enums.PlanType;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
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
        id: string;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        description: string | null;
        type: import(".prisma/client").$Enums.PlanType;
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
        id: string;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        description: string | null;
        type: import(".prisma/client").$Enums.PlanType;
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
        id: string;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        description: string | null;
        type: import(".prisma/client").$Enums.PlanType;
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
        email: string;
        id: string;
        name: string;
        createdAt: Date;
        isActive: boolean;
        role: string;
        lastLoginAt: Date | null;
    }[]>;
    createAdmin(data: any): Promise<{
        email: string;
        id: string;
        name: string;
        createdAt: Date;
        isActive: boolean;
        role: string;
    }>;
    updateAdmin(id: string, data: any): Promise<{
        email: string;
        id: string;
        name: string;
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
                id: string;
                name: string;
            } | null;
        } & {
            userId: string | null;
            organizationId: string | null;
            id: string;
            userAgent: string | null;
            createdAt: Date;
            entity: string | null;
            entityId: string | null;
            action: import(".prisma/client").$Enums.ActivityAction | null;
            metadata: import("@prisma/client/runtime/library").JsonValue;
            ipAddress: string | null;
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
            organizationId: string;
            id: string;
            status: import(".prisma/client").$Enums.WhatsAppAccountStatus;
            phoneNumber: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            isDefault: boolean;
            phoneNumberId: string;
            wabaId: string;
            displayName: string;
            qualityRating: string | null;
            accessToken: string | null;
            tokenExpiresAt: Date | null;
            webhookSecret: string | null;
            codeVerificationStatus: string | null;
            nameStatus: string | null;
            healthCanSend: string | null;
            healthBlockedReason: string | null;
            healthStatus: import("@prisma/client/runtime/library").JsonValue | null;
            healthCheckedAt: Date | null;
            qualityRatingOverride: string | null;
            codeVerificationOverride: string | null;
            healthCanSendOverride: string | null;
            messagingLimitOverride: string | null;
            overrideSetBy: string | null;
            overrideSetAt: Date | null;
            verifiedName: string | null;
            messagingLimit: string | null;
            dailyMessageLimit: number;
            dailyMessagesUsed: number;
            lastLimitReset: Date;
            businessProfile: import("@prisma/client/runtime/library").JsonValue | null;
            connectionType: string;
        };
    }>;
}
export declare const adminService: AdminService;
export {};
//# sourceMappingURL=admin.service.d.ts.map