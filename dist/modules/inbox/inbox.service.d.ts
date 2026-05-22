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
            status: import(".prisma/client").$Enums.ContactStatus;
            id: string;
            firstName: string | null;
            lastName: string | null;
            phone: string;
            avatar: string | null;
            createdAt: Date;
            updatedAt: Date;
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
            status: import(".prisma/client").$Enums.MessageStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            whatsappAccountId: string | null;
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
        label: string;
        count: number;
    }[]>;
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
                    status: import(".prisma/client").$Enums.ContactStatus;
                    id: string;
                    firstName: string | null;
                    lastName: string | null;
                    phone: string;
                    avatar: string | null;
                    createdAt: Date;
                    updatedAt: Date;
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
            status: import(".prisma/client").$Enums.MessageStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            whatsappAccountId: string | null;
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
            status: import(".prisma/client").$Enums.ContactStatus;
            id: string;
            firstName: string | null;
            lastName: string | null;
            phone: string;
            avatar: string | null;
            createdAt: Date;
            updatedAt: Date;
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
     * Send message
     */
    sendMessage(organizationId: string, userId: string, conversationId: string, input: any): Promise<any>;
    /**
     * Send template message
     */
    sendTemplateMessage(organizationId: string, conversationId: string, templateName: string, language: string, params: any[], bodyText: string): Promise<{
        type: import(".prisma/client").$Enums.MessageType;
        waMessageId: string | null;
        status: import(".prisma/client").$Enums.MessageStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        whatsappAccountId: string | null;
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
        status: import(".prisma/client").$Enums.MessageStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        whatsappAccountId: string | null;
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