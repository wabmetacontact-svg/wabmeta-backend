import { EventEmitter } from 'events';
export declare const webhookEvents: EventEmitter<any>;
export declare class WebhookService {
    private accountCache;
    private readonly CACHE_TTL;
    private extractValue;
    private extractProfile;
    private isIndianNumber;
    private mapMessageType;
    private buildContentAndMedia;
    private findOrCreateContact;
    private handleInstagramEvent;
    handleWebhook(payload: any): Promise<{
        status: string;
        reason?: string;
        profileName?: string;
        error?: string;
    }>;
    private handleTemplateUpdate;
    private processIncomingMessage;
    private runAutomations;
    private processStatusUpdate;
    private updateChatMessageStatus;
    private retryUpdateChatMessageStatusInBackground;
    private updateCampaignContactStatus;
    verifyWebhook(mode: string, token: string, challenge: string): string | null;
    logWebhook(payload: any, status: string, error?: string): Promise<void>;
    expireConversationWindows(): Promise<void>;
    resetDailyMessageLimits(): Promise<void>;
    private handleHistorySync;
    private handleSmbStateSync;
    private handleSmbMessageEchoes;
    private handleCallWebhook;
}
export declare const webhookService: WebhookService;
export default webhookService;
//# sourceMappingURL=webhook.service.d.ts.map