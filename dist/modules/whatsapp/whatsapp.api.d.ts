export interface AccessTokenResponse {
    access_token: string;
    token_type: string;
    expires_in?: number;
}
export interface SendMessageResponse {
    messages: Array<{
        id: string;
    }>;
    contacts?: Array<{
        input: string;
        wa_id: string;
    }>;
}
export interface TemplateParams {
    header?: any;
    body?: any[];
    buttons?: Array<{
        type?: string;
        text?: string;
        payload?: string;
    }>;
}
export interface MediaParams {
    type: 'image' | 'video' | 'document' | 'audio';
    url?: string;
    id?: string;
    caption?: string;
    filename?: string;
}
declare class WhatsAppAPI {
    private client;
    private clientUnversioned;
    constructor();
    /**
     * Exchange OAuth code for short-lived access token
     */
    exchangeCodeForToken(code: string, redirectUri: string): Promise<AccessTokenResponse>;
    /**
     * Exchange short-lived token for long-lived token (60 days)
     */
    exchangeForLongLivedToken(shortLivedToken: string): Promise<AccessTokenResponse>;
    /**
     * Debug token - check validity, scopes, expiry
     */
    debugToken(inputToken: string): Promise<any>;
    /**
     * Get current user info
     */
    getMe(accessToken: string): Promise<any>;
    /**
     * Get businesses owned by the user
     */
    getUserBusinesses(accessToken: string): Promise<any[]>;
    /**
     * Get WhatsApp Business Accounts owned by a business
     */
    getOwnedWabas(businessId: string, accessToken: string): Promise<any[]>;
    /**
     * Get phone numbers under a WABA
     */
    getWabaPhoneNumbers(wabaId: string, accessToken: string): Promise<any[]>;
    /**
     * Get phone number details
     */
    getPhoneNumberInfo(phoneNumberId: string, accessToken: string): Promise<any>;
    /**
     * Register phone number for WhatsApp
     */
    registerPhoneNumber(phoneNumberId: string, accessToken: string, pin: string): Promise<any>;
    /**
     * Subscribe app to WABA webhooks
     */
    subscribeAppToWaba(wabaId: string, accessToken: string): Promise<any>;
    /**
     * Send template message
     */
    sendTemplateMessage(phoneNumberId: string, to: string, templateName: string, language: string, components?: TemplateParams, accessToken?: string): Promise<{
        waMessageId: string;
    }>;
    /**
     * Send text message
     */
    sendTextMessage(phoneNumberId: string, to: string, message: string, accessToken: string, previewUrl?: boolean): Promise<{
        waMessageId: string;
    }>;
    /**
     * Send media message
     */
    sendMediaMessage(phoneNumberId: string, to: string, media: MediaParams, accessToken: string): Promise<{
        waMessageId: string;
    }>;
    /**
     * Send message (generic) - with Authorization header, not query param
     */
    sendMessage(phoneNumberId: string, accessToken: string, to: string, payload: any): Promise<any>;
    /**
     * Mark message as read
     */
    markAsRead(phoneNumberId: string, messageId: string, accessToken: string, typing?: boolean): Promise<boolean>;
    /**
     * Mark message as read (alias for whatsapp.service.ts compatibility)
     */
    markMessageAsRead(phoneNumberId: string, accessToken: string, messageId: string): Promise<boolean>;
    /**
     * Create message template with specific API version
     */
    createMessageTemplateByVersion(wabaId: string, accessToken: string, payload: any, version?: string): Promise<any>;
    /**
     * Create message template
     */
    createMessageTemplate(wabaId: string, accessToken: string, payload: any): Promise<any>;
    /**
     * List message templates
     */
    listMessageTemplates(wabaId: string, accessToken: string): Promise<any[]>;
    /**
     * Get single template
     */
    getMessageTemplate(templateId: string, accessToken: string): Promise<any>;
    /**
     * Delete message template
     */
    deleteMessageTemplate(wabaId: string, accessToken: string, templateName: string): Promise<any>;
    /**
     * Upload media
     */
    uploadMedia(phoneNumberId: string, accessToken: string, formData: any): Promise<any>;
    /**
     * Get media URL
     */
    getMediaUrl(mediaId: string, accessToken: string): Promise<any>;
    /**
     * Download media
     */
    downloadMedia(mediaUrl: string, accessToken: string): Promise<any>;
    /**
     * Generate app secret proof for secure API calls
     */
    private generateAppSecretProof;
    /**
     * Build template components
     */
    private buildTemplateComponents;
    /**
     * Format error for logging
     */
    private formatError;
    /**
     * Handle and format errors
     */
    private handleError;
}
export declare const whatsappApi: WhatsAppAPI;
export default whatsappApi;
//# sourceMappingURL=whatsapp.api.d.ts.map