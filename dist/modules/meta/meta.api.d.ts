import { TokenExchangeResponse, DebugTokenResponse, SharedWABAInfo, PhoneNumberInfo } from './meta.types';
declare class MetaApiClient {
    private client;
    private graphVersion;
    constructor();
    /**
     * Exchange authorization code for access token.
     * @param code - The authorization code from FB.login or OAuth redirect
     * @param skipRedirectUri - Set TRUE for FB.login/Embedded Signup flow.
     *   FB.login codes must be exchanged WITHOUT a redirect_uri.
     *   Only OAuth redirect flow (state-token based) needs redirect_uri.
     */
    exchangeCodeForToken(code: string, skipRedirectUri?: boolean): Promise<TokenExchangeResponse>;
    getLongLivedToken(shortLivedToken: string): Promise<TokenExchangeResponse>;
    debugToken(accessToken: string): Promise<DebugTokenResponse>;
    validateToken(accessToken: string): Promise<boolean>;
    getSharedWABAs(accessToken: string): Promise<SharedWABAInfo[]>;
    getWABADetails(wabaId: string, accessToken: string): Promise<SharedWABAInfo>;
    getPhoneNumbers(wabaId: string, accessToken: string): Promise<PhoneNumberInfo[]>;
    getPhoneNumberDetails(phoneNumberId: string, accessToken: string): Promise<{
        id: string;
        verifiedName: string;
        displayPhoneNumber: string;
        qualityRating: string;
        codeVerificationStatus?: string;
        nameStatus?: string;
    }>;
    registerPhoneNumber(phoneNumberId: string, accessToken: string): Promise<boolean>;
    /**
     * ✅ Extract WhatsApp profile from incoming webhook
     * This is the MOST RELIABLE method to get real names
     * Called when processing incoming messages
     */
    extractProfileFromWebhook(webhookData: any): {
        waId: string;
        profileName: string;
        phone: string;
    } | null;
    /**
     * ✅ Get WhatsApp contact profile
     * Uses the Contacts API to check if number exists and get profile
     */
    getContactProfile(phoneNumberId: string, accessToken: string, phone: string): Promise<{
        exists: boolean;
        waId?: string;
        profileName?: string;
        status?: string;
    }>;
    /**
     * ✅ Batch check multiple contacts
     * Check up to 50 contacts at once
     */
    batchCheckContacts(phoneNumberId: string, accessToken: string, phones: string[]): Promise<Array<{
        input: string;
        waId?: string;
        status: 'valid' | 'invalid';
    }>>;
    /**
     * ✅ Get contact profile from message send response
     */
    extractContactFromMessageResponse(messageResponse: any): {
        waId: string;
        input: string;
    } | null;
    /**
     * ⚠️ Get profile picture URL
     * NOTE: This typically requires special permissions and may not work
     */
    getProfilePictureUrl(phoneNumberId: string, accessToken: string, waId: string): Promise<string | null>;
    checkContact(phoneNumberId: string, accessToken: string, phone: string): Promise<{
        contacts: Array<{
            input: string;
            wa_id: string;
            status: string;
        }>;
    }>;
    subscribeToWebhooks(wabaId: string, accessToken: string): Promise<boolean>;
    unsubscribeFromWebhooks(wabaId: string, accessToken: string): Promise<boolean>;
    getBusinessProfile(phoneNumberId: string, accessToken: string): Promise<any>;
    updateBusinessProfile(phoneNumberId: string, accessToken: string, profile: {
        about?: string;
        address?: string;
        description?: string;
        email?: string;
        websites?: string[];
        vertical?: string;
    }): Promise<boolean>;
    sendMessage(phoneNumberId: string, accessToken: string, to: string, message: any): Promise<{
        messageId: string;
        contacts?: any[];
    }>;
    getPhoneNumberInfo(phoneNumberId: string, accessToken: string): Promise<any>;
    /**
     * ✅ Enhanced send message with contact extraction
     */
    sendMessageWithContactInfo(phoneNumberId: string, accessToken: string, to: string, message: any): Promise<{
        messageId: string;
        contact?: {
            waId: string;
            input: string;
        };
    }>;
    markMessageAsRead(phoneNumberId: string, accessToken: string, messageId: string, typing?: boolean): Promise<boolean>;
    getTemplates(wabaId: string, accessToken: string): Promise<any[]>;
    getTemplate(templateId: string, accessToken: string): Promise<any>;
    createTemplate(wabaId: string, accessToken: string, template: {
        name: string;
        category: string;
        language: string;
        components: any[];
        allow_category_change?: boolean;
    }): Promise<{
        id: string;
        status: string;
    }>;
    deleteTemplate(wabaId: string, accessToken: string, templateName: string): Promise<boolean>;
    uploadMedia(phoneNumberId: string, accessToken: string, file: Buffer, mimeType: string, filename: string, wabaId?: string): Promise<{
        id: string;
    }>;
    getMediaUrl(mediaId: string, accessToken: string): Promise<string>;
    downloadMedia(mediaUrl: string, accessToken: string): Promise<Buffer>;
    getAnalytics(wabaId: string, accessToken: string, params: {
        start: number;
        end: number;
        granularity: 'HALF_HOUR' | 'DAILY' | 'MONTHLY';
        metrics?: string[];
    }): Promise<any>;
    private handleError;
    enableCalling(phoneNumberId: string, accessToken: string, options?: {
        callingEnabled: boolean;
        inboundCallsEnabled?: boolean;
        callbackEnabled?: boolean;
        restrictToCountries?: string[];
        callHoursEnabled?: boolean;
        timezone?: string;
        weeklyHours?: Array<{
            day: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
            openTime: string;
            closeTime: string;
        }>;
        holidaySchedule?: Array<{
            date: string;
            startTime: string;
            endTime: string;
        }>;
    }): Promise<{
        success: boolean;
        data?: any;
    }>;
    getCallingSettings(phoneNumberId: string, accessToken: string): Promise<{
        callingEnabled: boolean;
        inboundCallsEnabled: boolean;
        callbackEnabled: boolean;
        callHoursEnabled: boolean;
    }>;
    initiateCall(phoneNumberId: string, accessToken: string, to: string, options?: {
        callbackData?: string;
        bodyText?: string;
        buttonText?: string;
        businessPhoneNumber?: string;
    }): Promise<{
        messageId: string;
        status: string;
    }>;
    requestCallPermission(phoneNumberId: string, accessToken: string, to: string): Promise<{
        permitted: boolean;
        permissionId?: string;
    }>;
    subscribeToCallsWebhook(wabaId: string, accessToken: string): Promise<boolean>;
    getCallLogs(phoneNumberId: string, accessToken: string, limit?: number): Promise<Array<{
        callId: string;
        direction: 'inbound' | 'outbound';
        status: string;
        duration?: number;
        startTime: string;
        endTime?: string;
        from: string;
        to: string;
    }>>;
    isTokenValid(accessToken: string): Promise<boolean>;
    getTokenExpiry(accessToken: string): Promise<Date | null>;
    getGraphVersion(): string;
}
export declare const metaApi: MetaApiClient;
export default metaApi;
//# sourceMappingURL=meta.api.d.ts.map