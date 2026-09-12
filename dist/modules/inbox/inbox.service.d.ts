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
            organizationId: string;
            phone: string;
            email: string | null;
            id: string;
            status: import(".prisma/client").$Enums.ContactStatus;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            countryCode: string;
            telegramUserId: string | null;
            telegramUsername: string | null;
            instagramUserId: string | null;
            instagramUsername: string | null;
            firstName: string | null;
            lastName: string | null;
            avatar: string | null;
            whatsappProfileName: string | null;
            whatsappAbout: string | null;
            whatsappProfilePicUrl: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            tags: string[];
            lastMessageAt: Date | null;
            messageCount: number;
            source: string | null;
            deletedBy: string | null;
        };
    } & {
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
        telegramChatId: string | null;
        instagramAccountId: string | null;
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
        automationPaused: boolean;
    }>;
    /**
     * Get messages for conversation
     */
    getMessages(organizationId: string, conversationId: string, query?: any): Promise<{
        messages: {
            timestamp: Date;
            id: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            createdAt: Date;
            updatedAt: Date;
            metadata: Prisma.JsonValue | null;
            templateId: string | null;
            whatsappAccountId: string | null;
            channel: import(".prisma/client").$Enums.Channel;
            conversationId: string;
            type: import(".prisma/client").$Enums.MessageType;
            readAt: Date | null;
            failedAt: Date | null;
            mediaUrl: string | null;
            mediaType: string | null;
            waMessageId: string | null;
            templateName: string | null;
            content: string | null;
            wamId: string | null;
            telegramMessageId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            mediaMimeType: string | null;
            templateParams: Prisma.JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
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
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
        telegramChatId: string | null;
        instagramAccountId: string | null;
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
        automationPaused: boolean;
    }>;
    /**
     * Archive/Unarchive conversation
     */
    archiveConversation(organizationId: string, conversationId: string, isArchived: boolean): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
        telegramChatId: string | null;
        instagramAccountId: string | null;
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
        automationPaused: boolean;
    }>;
    /**
     * Assign conversation to user
     */
    assignConversation(organizationId: string, conversationId: string, userId: string | null): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
        telegramChatId: string | null;
        instagramAccountId: string | null;
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
        automationPaused: boolean;
    }>;
    /**
     * Update conversation labels
     */
    updateLabels(organizationId: string, conversationId: string, labels: string[]): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
        telegramChatId: string | null;
        instagramAccountId: string | null;
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
        automationPaused: boolean;
    }>;
    /**
     * Add labels to conversation (Now replaces to keep only 1 label)
     */
    addLabels(organizationId: string, conversationId: string, newLabels: string[]): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
        telegramChatId: string | null;
        instagramAccountId: string | null;
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
        automationPaused: boolean;
    }>;
    /**
     * Remove label from conversation
     */
    removeLabel(organizationId: string, conversationId: string, label: string): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
        telegramChatId: string | null;
        instagramAccountId: string | null;
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
        automationPaused: boolean;
    }>;
    /**
     * Human handoff: pause/resume channel automation for one conversation.
     * Channel-agnostic — org-scoped so a caller can't touch another tenant.
     */
    setAutomationPaused(organizationId: string, conversationId: string, paused: boolean): Promise<{
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
        telegramChatId: string | null;
        instagramAccountId: string | null;
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
        automationPaused: boolean;
    } | null>;
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
        label: string;
        color: string | undefined;
        count: number;
    }[]>;
    /**
     * Create custom label
     */
    createCustomLabel(organizationId: string, label: string, color?: string): Promise<{
        label: string;
        color: string;
    } | undefined>;
    /**
     * Delete custom label
     */
    deleteCustomLabel(organizationId: string, label: string): Promise<{
        success: boolean;
    }>;
    /**
     * Search messages
     */
    searchMessages(organizationId: string, query: string, page?: number, limit?: number, channel?: 'WHATSAPP' | 'INSTAGRAM' | 'TELEGRAM'): Promise<{
        messages: ({
            conversation: {
                contact: {
                    organizationId: string;
                    phone: string;
                    email: string | null;
                    id: string;
                    status: import(".prisma/client").$Enums.ContactStatus;
                    createdAt: Date;
                    updatedAt: Date;
                    deletedAt: Date | null;
                    countryCode: string;
                    telegramUserId: string | null;
                    telegramUsername: string | null;
                    instagramUserId: string | null;
                    instagramUsername: string | null;
                    firstName: string | null;
                    lastName: string | null;
                    avatar: string | null;
                    whatsappProfileName: string | null;
                    whatsappAbout: string | null;
                    whatsappProfilePicUrl: string | null;
                    whatsappProfileFetched: boolean;
                    lastProfileFetchAt: Date | null;
                    profileFetchAttempts: number;
                    customFields: Prisma.JsonValue;
                    tags: string[];
                    lastMessageAt: Date | null;
                    messageCount: number;
                    source: string | null;
                    deletedBy: string | null;
                };
            } & {
                organizationId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                channel: import(".prisma/client").$Enums.Channel;
                telegramBotId: string | null;
                lastMessageAt: Date | null;
                contactId: string;
                phoneNumberId: string | null;
                telegramChatId: string | null;
                instagramAccountId: string | null;
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
                automationPaused: boolean;
            };
        } & {
            id: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            createdAt: Date;
            updatedAt: Date;
            metadata: Prisma.JsonValue | null;
            templateId: string | null;
            whatsappAccountId: string | null;
            channel: import(".prisma/client").$Enums.Channel;
            conversationId: string;
            type: import(".prisma/client").$Enums.MessageType;
            readAt: Date | null;
            failedAt: Date | null;
            mediaUrl: string | null;
            mediaType: string | null;
            waMessageId: string | null;
            templateName: string | null;
            content: string | null;
            wamId: string | null;
            telegramMessageId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            mediaMimeType: string | null;
            templateParams: Prisma.JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
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
     * Draft an AI reply suggestion for the agent, from the recent conversation
     * history. Human-in-the-loop: the agent reviews/edits before sending.
     */
    suggestReply(organizationId: string, conversationId: string, instruction?: string): Promise<{
        suggestion: string;
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
     * Delete all conversations for organization
     */
    deleteAllConversations(organizationId: string): Promise<{
        success: boolean;
        count: number;
        message: string;
    }>;
    /**
     * Bulk delete conversations
     */
    bulkDelete(organizationId: string, conversationIds: string[]): Promise<{
        success: boolean;
        count: number;
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
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
        telegramChatId: string | null;
        instagramAccountId: string | null;
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
        automationPaused: boolean;
    }>;
    /**
     * Get or create conversation
     */
    getOrCreateConversation(organizationId: string, contactId: string): Promise<{
        contact: {
            organizationId: string;
            phone: string;
            email: string | null;
            id: string;
            status: import(".prisma/client").$Enums.ContactStatus;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            countryCode: string;
            telegramUserId: string | null;
            telegramUsername: string | null;
            instagramUserId: string | null;
            instagramUsername: string | null;
            firstName: string | null;
            lastName: string | null;
            avatar: string | null;
            whatsappProfileName: string | null;
            whatsappAbout: string | null;
            whatsappProfilePicUrl: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            tags: string[];
            lastMessageAt: Date | null;
            messageCount: number;
            source: string | null;
            deletedBy: string | null;
        };
    } & {
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        lastMessageAt: Date | null;
        contactId: string;
        phoneNumberId: string | null;
        telegramChatId: string | null;
        instagramAccountId: string | null;
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
        automationPaused: boolean;
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
        id: string;
        status: import(".prisma/client").$Enums.MessageStatus;
        createdAt: Date;
        updatedAt: Date;
        metadata: Prisma.JsonValue | null;
        templateId: string | null;
        whatsappAccountId: string | null;
        channel: import(".prisma/client").$Enums.Channel;
        conversationId: string;
        type: import(".prisma/client").$Enums.MessageType;
        readAt: Date | null;
        failedAt: Date | null;
        mediaUrl: string | null;
        mediaType: string | null;
        waMessageId: string | null;
        templateName: string | null;
        content: string | null;
        wamId: string | null;
        telegramMessageId: string | null;
        direction: import(".prisma/client").$Enums.MessageDirection;
        mediaMimeType: string | null;
        templateParams: Prisma.JsonValue | null;
        sentAt: Date | null;
        deliveredAt: Date | null;
        failureReason: string | null;
        replyToMessageId: string | null;
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
        id: string;
        status: import(".prisma/client").$Enums.MessageStatus;
        createdAt: Date;
        updatedAt: Date;
        metadata: Prisma.JsonValue | null;
        templateId: string | null;
        whatsappAccountId: string | null;
        channel: import(".prisma/client").$Enums.Channel;
        conversationId: string;
        type: import(".prisma/client").$Enums.MessageType;
        readAt: Date | null;
        failedAt: Date | null;
        mediaUrl: string | null;
        mediaType: string | null;
        waMessageId: string | null;
        templateName: string | null;
        content: string | null;
        wamId: string | null;
        telegramMessageId: string | null;
        direction: import(".prisma/client").$Enums.MessageDirection;
        mediaMimeType: string | null;
        templateParams: Prisma.JsonValue | null;
        sentAt: Date | null;
        deliveredAt: Date | null;
        failureReason: string | null;
        replyToMessageId: string | null;
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