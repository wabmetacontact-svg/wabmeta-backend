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
    private extractMessageContent;
    /**
     * ✅ FIX: delegates to the shared getAccountWithDecryptedToken() helper.
     * Previously this method had its own logic that would throw an error but
     * leave the account status as CONNECTED — so message sending would fail
     * while the dashboard showed the account as healthy. Now, if a token
     * can't be decrypted, the shared helper marks the account DISCONNECTED
     * and both the UI and the sending code agree.
     */
    private getAccountWithToken;
    private formatPhoneNumber;
    private getOrCreateContact;
    private getOrCreateConversation;
    private mapMessageType;
    /**
     * Pre-check: does the wallet have enough balance to cover ONE template send?
     * Returns true if we should proceed, false to block.
     * Wallets that don't exist / are flagged / are inactive fall through to Meta's
     * own billing — same behavior as deductWalletForTemplate's skip conditions.
     */
    private canAffordSingleTemplateSend;
    checkContact(accountId: string, phone: string): Promise<ContactCheckResult>;
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
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            content: string | null;
            readAt: Date | null;
            wamId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            templateId: string | null;
            templateParams: import("@prisma/client/runtime/library").JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            fileName: string | null;
            mediaId: string | null;
            timestamp: Date;
            whatsappMessageId: string | null;
        };
    }>;
    private hydrateTemplate;
    sendTemplateMessage(options: SendTemplateOptions): Promise<{
        success: boolean;
        waMessageId: any;
        wamId: any;
        message: any;
    }>;
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
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            content: string | null;
            readAt: Date | null;
            wamId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            templateId: string | null;
            templateParams: import("@prisma/client/runtime/library").JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            fileName: string | null;
            mediaId: string | null;
            timestamp: Date;
            whatsappMessageId: string | null;
        };
    }>;
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
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            content: string | null;
            readAt: Date | null;
            wamId: string | null;
            direction: import(".prisma/client").$Enums.MessageDirection;
            mediaUrl: string | null;
            mediaType: string | null;
            mediaMimeType: string | null;
            templateId: string | null;
            templateParams: import("@prisma/client/runtime/library").JsonValue | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            replyToMessageId: string | null;
            retryCount: number;
            statusUpdatedAt: Date | null;
            fileName: string | null;
            mediaId: string | null;
            timestamp: Date;
            whatsappMessageId: string | null;
        };
    }>;
    private checkWindowOrThrow;
    sendCampaignMessages(campaignId: string, batchSize?: number, delayMs?: number): Promise<CampaignSendResult>;
    updateContactStatus(campaignId: string, contactId: string, status: MessageStatus, waMessageId?: string, failureReason?: string): Promise<void>;
    checkCampaignCompletion(campaignId: string): Promise<boolean>;
    private buildTemplateComponents;
    private extractVariablesFromText;
    private extractVariables;
    markAsRead(accountId: string, messageId: string): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
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
        phoneNumber: string;
        organizationId: string;
        id: string;
        wabaId: string;
        status: import(".prisma/client").$Enums.WhatsAppAccountStatus;
        createdAt: Date;
        updatedAt: Date;
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
    syncAccountQuality(accountId: string): Promise<{
        success: boolean;
        account?: any;
        error?: string;
    }>;
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