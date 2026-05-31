import { Prisma } from '@prisma/client';
export declare class InboxService {
    /**
     * Get conversations with flexible query support
     */
    getConversations(organizationId: string, query?: any): Promise<any>;
    /**
     * Clear conversation cache for an organization
     */
    clearCache(organizationId: string): Promise<void>;
    /**
     * Internal method to fetch conversations from DB
     */
    private fetchConversationsFromDB;
    /**
     * Get single conversation
     */
    getConversationById(organizationId: string, conversationId: string): Promise<{
        contact: {
            email: string | null;
            organizationId: string;
            tags: string[];
            id: string;
            status: import(".prisma/client").$Enums.ContactStatus;
            createdAt: Date;
            updatedAt: Date;
            firstName: string | null;
            lastName: string | null;
            phone: string;
            avatar: string | null;
            lastMessageAt: Date | null;
            countryCode: string;
            whatsappProfileName: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            messageCount: number;
            source: string | null;
        };
    } & {
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        isPinned: boolean;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Get messages for conversation
     */
    getMessages(organizationId: string, conversationId: string, query?: any): Promise<{
        messages: {
            timestamp: Date;
            type: import(".prisma/client").$Enums.MessageType;
            waMessageId: string | null;
            id: string;
            whatsappAccountId: string | null;
            status: import(".prisma/client").$Enums.MessageStatus;
            createdAt: Date;
            updatedAt: Date;
            templateName: string | null;
            conversationId: string;
            wamId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            content: string | null;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            templateId: string | null;
            templateParams: Prisma.JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            metadata: Prisma.JsonValue | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            fileName: string | null;
            mediaId: string | null;
            whatsappMessageId: string | null;
        }[];
        meta: {
            page: any;
            limit: any;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * Mark conversation as read
     */
    markAsRead(organizationId: string, conversationId: string): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        isPinned: boolean;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Archive/Unarchive conversation
     */
    archiveConversation(organizationId: string, conversationId: string, isArchived: boolean): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        isPinned: boolean;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Assign conversation to user
     */
    assignConversation(organizationId: string, conversationId: string, userId: string | null): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        isPinned: boolean;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Update conversation labels
     */
    updateLabels(organizationId: string, conversationId: string, labels: string[]): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        isPinned: boolean;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Add labels to conversation
     */
    addLabels(organizationId: string, conversationId: string, newLabels: string[]): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        isPinned: boolean;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Remove label from conversation
     */
    removeLabel(organizationId: string, conversationId: string, label: string): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        isPinned: boolean;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Get inbox stats
     */
    getStats(organizationId: string): Promise<{
        total: number;
        open: number;
        unread: number;
        archived: number;
    }>;
    /**
     * Get all labels
     */
    getAllLabels(organizationId: string): Promise<{
        label: string | {
            name: string;
            organizationId: string;
            id: string;
            whatsappAccountId: string | null;
            wabaId: string | null;
            metaTemplateId: string | null;
            language: string;
            category: import(".prisma/client").$Enums.TemplateCategory;
            headerType: string | null;
            headerContent: string | null;
            bodyText: string;
            footerText: string | null;
            buttons: Prisma.JsonValue;
            variables: Prisma.JsonValue;
            status: import(".prisma/client").$Enums.TemplateStatus;
            rejectionReason: string | null;
            qualityScore: string | null;
            createdAt: Date;
            updatedAt: Date;
            headerMediaId: string | null;
            headerMediaUploadedAt: Date | null;
            headerMediaLastVerified: Date | null;
        } | {
            userId: string;
            organizationId: string;
            id: string;
            updatedAt: Date;
            role: import(".prisma/client").$Enums.UserRole;
            invitedAt: Date;
            joinedAt: Date | null;
        } | {
            email: string | null;
            organizationId: string;
            tags: string[];
            id: string;
            status: import(".prisma/client").$Enums.ContactStatus;
            createdAt: Date;
            updatedAt: Date;
            firstName: string | null;
            lastName: string | null;
            phone: string;
            avatar: string | null;
            lastMessageAt: Date | null;
            countryCode: string;
            whatsappProfileName: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            messageCount: number;
            source: string | null;
        } | {
            name: string;
            organizationId: string;
            id: string;
            status: import(".prisma/client").$Enums.ChatbotStatus;
            createdAt: Date;
            updatedAt: Date;
            isDefault: boolean;
            description: string | null;
            flowData: Prisma.JsonValue;
            triggerKeywords: string[];
            welcomeMessage: string | null;
            fallbackMessage: string | null;
            createdById: string;
        } | {
            organizationId: string;
            id: string;
            wabaId: string;
            status: import(".prisma/client").$Enums.WhatsAppAccountStatus;
            createdAt: Date;
            updatedAt: Date;
            phoneNumber: string;
            phoneNumberId: string;
            accessToken: string | null;
            displayName: string;
            qualityRating: string | null;
            tokenExpiresAt: Date | null;
            webhookSecret: string | null;
            codeVerificationStatus: string | null;
            nameStatus: string | null;
            verifiedName: string | null;
            messagingLimit: string | null;
            dailyMessageLimit: number;
            dailyMessagesUsed: number;
            lastLimitReset: Date;
            businessProfile: Prisma.JsonValue | null;
            isDefault: boolean;
            isActive: boolean;
            customLabels: string[];
            connectionType: string;
        } | {
            organizationId: string;
            id: string;
            status: import(".prisma/client").$Enums.LeadStatus;
            createdAt: Date;
            updatedAt: Date;
            value: Prisma.Decimal | null;
            source: string | null;
            currency: string;
            contactId: string | null;
            title: string;
            pipelineId: string | null;
            stageId: string | null;
            priority: import(".prisma/client").$Enums.LeadPriority;
            assignedToId: string | null;
            expectedCloseDate: Date | null;
            actualCloseDate: Date | null;
            lastActivityAt: Date | null;
        } | {
            organizationId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            phoneNumberId: string | null;
            lastMessageAt: Date | null;
            contactId: string;
            lastMessagePreview: string | null;
            lastCustomerMessageAt: Date | null;
            windowExpiresAt: Date | null;
            isWindowOpen: boolean;
            lastBotMessageAt: Date | null;
            isArchived: boolean;
            isRead: boolean;
            unreadCount: number;
            isPinned: boolean;
            assignedTo: string | null;
            labels: string[];
        } | {
            userId: string | null;
            organizationId: string | null;
            id: string;
            createdAt: Date;
            userAgent: string | null;
            ipAddress: string | null;
            action: import(".prisma/client").$Enums.ActivityAction | null;
            metadata: Prisma.JsonValue;
            entity: string | null;
            entityId: string | null;
        } | {
            name: string;
            organizationId: string;
            key: string;
            expiresAt: Date | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            secret: string;
            permissions: string[];
            rateLimit: number;
            lastUsedAt: Date | null;
            usageCount: number;
        } | {
            name: string;
            organizationId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            description: string | null;
            trigger: import(".prisma/client").$Enums.AutomationTrigger;
            triggerConfig: Prisma.JsonValue;
            actions: Prisma.JsonValue;
            executionCount: number;
            lastExecutedAt: Date | null;
            targetGroupIds: string[];
            excludeExisting: boolean;
        } | {
            name: string;
            organizationId: string;
            scheduledAt: Date | null;
            id: string;
            whatsappAccountId: string;
            status: import(".prisma/client").$Enums.CampaignStatus;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            createdById: string;
            templateId: string;
            contactGroupId: string | null;
            audienceFilter: Prisma.JsonValue | null;
            startedAt: Date | null;
            completedAt: Date | null;
            totalContacts: number;
            sentCount: number;
            deliveredCount: number;
            readCount: number;
            failedCount: number;
        } | {
            name: string;
            organizationId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            color: string | null;
        } | {
            type: string;
            userId: string;
            organizationId: string | null;
            read: boolean;
            id: string;
            createdAt: Date;
            description: string;
            readAt: Date | null;
            metadata: Prisma.JsonValue;
            title: string;
            actionUrl: string | null;
        } | {
            organizationId: string;
            expiresAt: Date;
            id: string;
            createdAt: Date;
            state: string;
        } | {
            organizationId: string;
            id: string;
            status: import(".prisma/client").$Enums.PaymentStatus;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            billingCycle: string | null;
            planId: string | null;
            amount: number;
            currency: string;
            razorpayOrderId: string | null;
            razorpayPaymentId: string | null;
            failedAt: Date | null;
            notes: Prisma.JsonValue | null;
            subscriptionId: string | null;
            razorpaySignature: string | null;
            planName: string | null;
            receipt: string | null;
            paidAt: Date | null;
        } | {
            name: string;
            organizationId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isDefault: boolean;
            isActive: boolean;
            description: string | null;
        } | {
            organizationId: string;
            url: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            secret: string | null;
            events: string[];
            lastTriggeredAt: Date | null;
            successCount: number;
            failureCount: number;
        } | {
            organizationId: string | null;
            payload: Prisma.JsonValue;
            id: string;
            status: import(".prisma/client").$Enums.WebhookStatus;
            createdAt: Date;
            source: string;
            errorMessage: string | null;
            eventType: string;
            processedAt: Date | null;
            responseTime: number | null;
        } | {
            userId: string;
            organizationId: string;
            id: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            reason: string;
            additionalInfo: string | null;
            reviewedBy: string | null;
            reviewNote: string | null;
            reviewedAt: Date | null;
            planVerified: boolean;
            requestedAt: Date;
        };
        count: number;
    }[]>;
    /**
     * Create custom label
     */
    createCustomLabel(organizationId: string, label: string): Promise<{
        label: string;
    }>;
    /**
     * Delete custom label
     */
    deleteCustomLabel(organizationId: string, label: string): Promise<{
        success: boolean;
    }>;
    /**
     * Search messages
     */
    searchMessages(organizationId: string, query: string, page?: number, limit?: number): Promise<{
        messages: ({
            conversation: {
                contact: {
                    email: string | null;
                    organizationId: string;
                    tags: string[];
                    id: string;
                    status: import(".prisma/client").$Enums.ContactStatus;
                    createdAt: Date;
                    updatedAt: Date;
                    firstName: string | null;
                    lastName: string | null;
                    phone: string;
                    avatar: string | null;
                    lastMessageAt: Date | null;
                    countryCode: string;
                    whatsappProfileName: string | null;
                    whatsappProfileFetched: boolean;
                    lastProfileFetchAt: Date | null;
                    profileFetchAttempts: number;
                    customFields: Prisma.JsonValue;
                    messageCount: number;
                    source: string | null;
                };
            } & {
                organizationId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                phoneNumberId: string | null;
                lastMessageAt: Date | null;
                contactId: string;
                lastMessagePreview: string | null;
                lastCustomerMessageAt: Date | null;
                windowExpiresAt: Date | null;
                isWindowOpen: boolean;
                lastBotMessageAt: Date | null;
                isArchived: boolean;
                isRead: boolean;
                unreadCount: number;
                isPinned: boolean;
                assignedTo: string | null;
                labels: string[];
            };
        } & {
            type: import(".prisma/client").$Enums.MessageType;
            waMessageId: string | null;
            id: string;
            whatsappAccountId: string | null;
            status: import(".prisma/client").$Enums.MessageStatus;
            createdAt: Date;
            updatedAt: Date;
            templateName: string | null;
            conversationId: string;
            wamId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            content: string | null;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            templateId: string | null;
            templateParams: Prisma.JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            metadata: Prisma.JsonValue | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            fileName: string | null;
            mediaId: string | null;
            timestamp: Date;
            whatsappMessageId: string | null;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * Bulk update conversations
     */
    bulkUpdate(organizationId: string, conversationIds: string[], updates: Partial<Prisma.ConversationUpdateInput>): Promise<{
        updated: number;
    }>;
    /**
     * Delete conversation
     */
    deleteConversation(organizationId: string, conversationId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Update conversation
     */
    updateConversation(organizationId: string, conversationId: string, updates: Partial<Prisma.ConversationUpdateInput>): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        isPinned: boolean;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Get or create conversation
     */
    getOrCreateConversation(organizationId: string, contactId: string): Promise<{
        contact: {
            email: string | null;
            organizationId: string;
            tags: string[];
            id: string;
            status: import(".prisma/client").$Enums.ContactStatus;
            createdAt: Date;
            updatedAt: Date;
            firstName: string | null;
            lastName: string | null;
            phone: string;
            avatar: string | null;
            lastMessageAt: Date | null;
            countryCode: string;
            whatsappProfileName: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            messageCount: number;
            source: string | null;
        };
    } & {
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phoneNumberId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        lastMessagePreview: string | null;
        lastCustomerMessageAt: Date | null;
        windowExpiresAt: Date | null;
        isWindowOpen: boolean;
        lastBotMessageAt: Date | null;
        isArchived: boolean;
        isRead: boolean;
        unreadCount: number;
        isPinned: boolean;
        assignedTo: string | null;
        labels: string[];
    }>;
    /**
     * Helper to check Free Demo chat limit
     */
    private checkFreeDemoLimit;
    /**
     * Send message
     */
    sendMessage(organizationId: string, userId: string, conversationId: string, input: any): Promise<any>;
    /**
     * Send template message
     */
    sendTemplateMessage(organizationId: string, conversationId: string, templateName: string, language: string, params: any[], bodyText: string): Promise<{
        type: import(".prisma/client").$Enums.MessageType;
        waMessageId: string | null;
        id: string;
        whatsappAccountId: string | null;
        status: import(".prisma/client").$Enums.MessageStatus;
        createdAt: Date;
        updatedAt: Date;
        templateName: string | null;
        conversationId: string;
        wamId: string | null;
        direction: import(".prisma/client").$Enums.MessageDirection;
        content: string | null;
        mediaUrl: string | null;
        mediaType: string | null;
        mediaMimeType: string | null;
        templateId: string | null;
        templateParams: Prisma.JsonValue | null;
        sentAt: Date | null;
        deliveredAt: Date | null;
        readAt: Date | null;
        failedAt: Date | null;
        failureReason: string | null;
        replyToMessageId: string | null;
        metadata: Prisma.JsonValue | null;
        retryCount: number;
        statusUpdatedAt: Date | null;
        fileName: string | null;
        mediaId: string | null;
        timestamp: Date;
        whatsappMessageId: string | null;
    }>;
    deleteMessage(organizationId: string, conversationId: string, messageId: string): Promise<{
        success: boolean;
        messageId: string;
    }>;
    editMessage(organizationId: string, conversationId: string, messageId: string, newContent: string): Promise<{
        type: import(".prisma/client").$Enums.MessageType;
        waMessageId: string | null;
        id: string;
        whatsappAccountId: string | null;
        status: import(".prisma/client").$Enums.MessageStatus;
        createdAt: Date;
        updatedAt: Date;
        templateName: string | null;
        conversationId: string;
        wamId: string | null;
        direction: import(".prisma/client").$Enums.MessageDirection;
        content: string | null;
        mediaUrl: string | null;
        mediaType: string | null;
        mediaMimeType: string | null;
        templateId: string | null;
        templateParams: Prisma.JsonValue | null;
        sentAt: Date | null;
        deliveredAt: Date | null;
        readAt: Date | null;
        failedAt: Date | null;
        failureReason: string | null;
        replyToMessageId: string | null;
        metadata: Prisma.JsonValue | null;
        retryCount: number;
        statusUpdatedAt: Date | null;
        fileName: string | null;
        mediaId: string | null;
        timestamp: Date;
        whatsappMessageId: string | null;
    }>;
}
export declare const inboxService: InboxService;
//# sourceMappingURL=inbox.service.d.ts.map