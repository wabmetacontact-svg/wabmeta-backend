import { EventEmitter } from 'events';
export declare const webhookEvents: EventEmitter<any>;
export declare class WebhookService {
    private refundQueue;
    private refundProcessing;
    private emergencyLoggedCampaigns;
    private accountCache;
    private readonly CACHE_TTL;
    private phoneNumberUUIDCache;
    private extractValue;
    private extractProfile;
    private isIndianNumber;
    private mapMessageType;
    private buildContentAndMedia;
    private findOrCreateContact;
    private resolvePhoneNumberUUID;
    private findOrCreateConversation;
    private handleInstagramEvent;
    handleWebhook(payload: any): Promise<{
        status: string;
        reason?: string;
        profileName?: string;
        error?: string;
    }>;
    private handleTemplateStatusUpdate;
    /**
     * message_template_category_update — Meta moved a template to a different
     * category. Billing charges per stored category, so this must be persisted or
     * the org is charged at the wrong rate indefinitely.
     */
    private handleTemplateCategoryUpdate;
    private handleTemplateUpdate;
    private processIncomingMessage;
    private runAutomations;
    private processStatusUpdate;
    private updateChatMessageStatus;
    private retryUpdateChatMessageStatusInBackground;
    private updateCampaignContactStatus;
    private processRefundQueue;
    private processRefundWithRetry;
    private storeFailedRefund;
    private shouldRefundFailure;
    verifyWebhook(mode: string, token: string, challenge: string): string | null;
    logWebhook(payload: any, status: string, error?: string): Promise<void>;
    expireConversationWindows(): Promise<void>;
    resetDailyMessageLimits(): Promise<void>;
    private handleHistorySync;
    private handleSmbStateSync;
    private handleSmbMessageEchoes;
    private handleCallWebhook;
    private backupInboundMediaAsync;
}
export declare const webhookService: WebhookService;
export default webhookService;
//# sourceMappingURL=webhook.service.d.ts.map