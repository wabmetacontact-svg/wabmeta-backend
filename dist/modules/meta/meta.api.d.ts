import { TokenExchangeResponse, DebugTokenResponse, SharedWABAInfo, PhoneNumberInfo } from './meta.types';
/**
 * ✅ NEW: Generate a cryptographically random 6-digit PIN for
 * WhatsApp two-step verification. Each account gets its own PIN.
 */
export declare function generatePhonePin(): string;
declare class MetaApiClient {
    private client;
    private graphVersion;
    constructor();
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
    /**
     * ✅ FIX: Register phone number with a caller-supplied PIN.
     * Previously the PIN was hardcoded to '000000' across every customer, which
     * is a serious security hole — a universal known two-step verification PIN
     * means any adversary who can transfer the number (SIM swap, carrier access)
     * can immediately deregister/re-register on WhatsApp on any customer's account.
     *
     * Caller MUST pass a random, per-account PIN (see generatePhonePin()) and
     * persist it encrypted so it can be reused on future re-registrations.
     */
    registerPhone(phoneNumberId: string, pin: string, accessToken: string): Promise<{
        success: boolean;
        alreadyRegistered?: boolean;
        error?: string;
        requiresAction?: boolean;
    }>;
    extractProfileFromWebhook(webhookData: any): {
        waId: string;
        profileName: string;
        phone: string;
    } | null;
    getContactProfile(phoneNumberId: string, accessToken: string, phone: string): Promise<{
        exists: boolean;
        waId?: string;
        profileName?: string;
        status?: string;
    }>;
    batchCheckContacts(phoneNumberId: string, accessToken: string, phones: string[]): Promise<Array<{
        input: string;
        waId?: string;
        status: 'valid' | 'invalid';
    }>>;
    extractContactFromMessageResponse(messageResponse: any): {
        waId: string;
        input: string;
    } | null;
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
    private withRetry;
    /**
     * ✅ FIX: Timeout errors on POST /messages are NO LONGER retried.
     *
     * A timeout from Meta means: we don't know if the message went through.
     * If it DID go through, retrying will:
     *   - Send the same WhatsApp message to the end-user twice
     *   - Charge the wallet twice (since fire-and-forget deduction runs per API "success")
     *
     * We prefer a failed-send that the caller sees over a silent duplicate.
     * ECONNRESET is also risky on POST for the same reason.
     *
     * Only retry on true "we never sent it" conditions:
     *   - DNS failures (ENOTFOUND)
     *   - HTTP 5xx from Meta (server errored BEFORE processing)
     *   - Meta transient error codes 131000, 131016
     */
    private isRetryable;
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