import { MessageStatus } from '@prisma/client';
interface SendMessageOptions {
    accountId: string;
    to: string;
    type: 'text' | 'template' | 'image' | 'document' | 'video' | 'audio' | 'interactive' | 'location' | 'contacts' | 'sticker';
    content: any;
    conversationId?: string;
    organizationId?: string;
    tempId?: string;
    clientMsgId?: string;
    mediaUrl?: string;
    skipWindowCheck?: boolean;
}
interface SendTemplateOptions {
    accountId: string;
    to: string;
    templateName: string;
    templateLanguage: string;
    components?: any[];
    conversationId?: string;
    organizationId?: string;
    tempId?: string;
    clientMsgId?: string;
}
interface CampaignSendResult {
    sent: number;
    failed: number;
    errors: string[];
}
interface ContactCheckResult {
    valid: boolean;
    waId?: string;
    status: string;
}
declare class WhatsAppService {
    /**
     * Check if a string looks like a Meta access token
     */
    private looksLikeAccessToken;
    /**
     * Extract plain text content from message payload
     */
    private extractMessageContent;
    /**
     * Get account with safe token decryption
     */
    private getAccountWithToken;
    /**
     * Format phone number for WhatsApp API
     */
    private formatPhoneNumber;
    /**
     * Get or create contact — always stores in canonical E.164 format: +919XXXXXXXXX
     */
    private getOrCreateContact;
    /**
     * Get or create conversation
     */
    private getOrCreateConversation;
    /**
     * Map string type to MessageType enum
     */
    private mapMessageType;
    /**
     * Check if a phone number has WhatsApp
     */
    checkContact(accountId: string, phone: string): Promise<ContactCheckResult>;
    /**
     * Send a text message
     */
    sendTextMessage(accountId: string, to: string, message: string, conversationId?: string, organizationId?: string, tempId?: string, clientMsgId?: string, skipWindowCheck?: boolean): Promise<{
        success: boolean;
        messageId: string;
        message: {
            tempId: string | undefined;
            clientMsgId: string | undefined;
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
            templateParams: import("@prisma/client/runtime/library").JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            fileName: string | null;
            mediaId: string | null;
            timestamp: Date;
            whatsappMessageId: string | null;
        };
    }>;
    private hydrateTemplate;
    /**
     * Send a template message
     */
    sendTemplateMessage(options: SendTemplateOptions): Promise<{
        success: boolean;
        waMessageId: any;
        wamId: any;
        message: any;
    }>;
    /**
     * Send a media message
     */
    sendMediaMessage(accountId: string, to: string, mediaType: 'image' | 'document' | 'video' | 'audio', mediaUrl: string, caption?: string, conversationId?: string, organizationId?: string, tempId?: string, clientMsgId?: string): Promise<{
        success: boolean;
        messageId: string;
        message: {
            tempId: string | undefined;
            clientMsgId: string | undefined;
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
            templateParams: import("@prisma/client/runtime/library").JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            fileName: string | null;
            mediaId: string | null;
            timestamp: Date;
            whatsappMessageId: string | null;
        };
    }>;
    /**
     * Core send message function
     */
    sendMessage(options: SendMessageOptions): Promise<{
        success: boolean;
        messageId: string;
        message: {
            tempId: string | undefined;
            clientMsgId: string | undefined;
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
            templateParams: import("@prisma/client/runtime/library").JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            fileName: string | null;
            mediaId: string | null;
            timestamp: Date;
            whatsappMessageId: string | null;
        };
    }>;
    /**
     * 24h window check — throws if window is expired
     */
    private checkWindowOrThrow;
    /**
     * Send bulk campaign messages - WITH CONTACT CHECK
     */
    sendCampaignMessages(campaignId: string, batchSize?: number, delayMs?: number): Promise<CampaignSendResult>;
    /**
     * Update campaign contact status
     */
    updateContactStatus(campaignId: string, contactId: string, status: MessageStatus, waMessageId?: string, failureReason?: string): Promise<void>;
    /**
     * Check if campaign is complete
     */
    checkCampaignCompletion(campaignId: string): Promise<boolean>;
    /**
     * Build template components with variables
     */
    private buildTemplateComponents;
    private extractVariablesFromText;
    private extractVariables;
    /**
     * Mark message as read
     */
    markAsRead(accountId: string, messageId: string): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    /**
     * Send typing indicator
     */
    sendTypingIndicator(conversationId: string): Promise<{
        success: boolean;
        reason: string;
        error?: undefined;
    } | {
        success: boolean;
        reason?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        reason?: undefined;
    }>;
    getDefaultAccount(organizationId: string): Promise<{
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
        businessProfile: import("@prisma/client/runtime/library").JsonValue | null;
        isDefault: boolean;
        isActive: boolean;
        connectionType: string;
    } | null>;
    validateAccount(accountId: string): Promise<{
        valid: boolean;
        reason?: string;
    }>;
    /**
     * Single account ka quality rating Meta se fetch karke DB update karo
     */
    syncAccountQuality(accountId: string): Promise<{
        success: boolean;
        account?: any;
        error?: string;
    }>;
    /**
     * Organization ke saare accounts sync karo (bulk)
     */
    syncAllAccountsQuality(organizationId: string): Promise<{
        total: number;
        synced: number;
        failed: number;
        results: any[];
    }>;
}
export declare const whatsappService: WhatsAppService;
export default whatsappService;
//# sourceMappingURL=whatsapp.service.d.ts.map