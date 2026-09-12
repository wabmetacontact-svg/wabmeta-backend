import { WhatsAppAccount } from '@prisma/client';
import { ConnectionProgress } from './meta.types';
export declare class MetaService {
    private tierSyncInFlight;
    private usageCache;
    private readonly USAGE_CACHE_TTL;
    /**
     * Account ka asli messaging limit + last 24h ka usage.
     *
     * Meta ki limit messages par nahi, UNIQUE customers par lagti hai jinse
     * aapne 24 ghante ke rolling window mein conversation start ki. Isliye
     * yahan distinct conversations gine jaate hain, raw message count nahi -
     * warna number hamesha zyada dikhta aur galat hota.
     */
    private getMessagingUsage;
    private sanitizeAccount;
    private detectConnectionType;
    getOAuthUrl(state: string): string;
    getEmbeddedSignupConfig(): {
        appId: string;
        configId: string;
        version: string;
        redirectUri: string;
        features: string[];
    };
    getIntegrationStatus(): {
        configured: boolean;
        appId: string | null;
        hasConfigId: boolean;
        hasRedirectUri: boolean;
        apiVersion: string;
    };
    completeConnection(codeOrToken: string, organizationId: string, userId: string, connectionType?: 'CLOUD_API' | 'WHATSAPP_BUSINESS_APP', onProgress?: (progress: ConnectionProgress) => void, embeddedSignup?: boolean, sessionWabaId?: string, sessionPhoneNumberId?: string, redirectUriOverride?: string): Promise<{
        success: boolean;
        account?: any;
        error?: string;
    }>;
    getAccounts(organizationId: string): Promise<(import("./accountView").SanitizedAccount | null)[]>;
    /**
     * messagingLimit null ho to Meta se sync trigger karo (fire-and-forget).
     * Response ko block nahi karta - ye sirf agli load ke liye data bharta hai.
     */
    private ensureTierSynced;
    getAccount(accountId: string, organizationId: string): Promise<import("./accountView").SanitizedAccount | null>;
    /**
     * ✅ FIX: now delegates to the shared getAccountWithDecryptedToken() helper.
     * This is the SAME helper used by whatsapp.service.ts for message sending,
     * so both agree on account/token state. If a token can't be decrypted, both
     * see the account as unusable (DB is auto-marked DISCONNECTED by the helper).
     */
    getAccountWithToken(accountId: string): Promise<{
        account: WhatsAppAccount;
        accessToken: string;
    } | null>;
    /**
     * Account + decrypted token nikalo, aur verify karo ki wo isi org ka hai.
     * Business profile ke saare operations isse guzarte hain.
     */
    private getOwnedAccount;
    getBusinessProfile(accountId: string, organizationId: string): Promise<any>;
    updateBusinessProfile(accountId: string, organizationId: string, input: {
        about?: string;
        address?: string;
        description?: string;
        email?: string;
        websites?: string[];
        vertical?: string;
    }): Promise<any>;
    updateProfilePicture(accountId: string, organizationId: string, file: Buffer, mimeType: string, fileName?: string): Promise<any>;
    /**
     * Display name change request. Meta review karta hai (name_status
     * PENDING_REVIEW -> APPROVED / DECLINED), aur approve hone ke baad number
     * ko re-register karna padta hai tabhi naam actually badalta hai.
     */
    requestDisplayNameChange(accountId: string, organizationId: string, newDisplayName: string): Promise<{
        requestedName: string;
        nameStatus: string;
        message: string;
    }>;
    disconnectAccount(accountId: string, organizationId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    setDefaultAccount(accountId: string, organizationId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    refreshAccountHealth(accountId: string, organizationId: string): Promise<{
        healthy: boolean;
        qualityRating: any;
        verifiedName: any;
        messagingLimit: any;
        codeVerificationStatus: any;
        reason?: undefined;
        action?: undefined;
    } | {
        healthy: boolean;
        qualityRating: string;
        verifiedName: string;
        messagingLimit: string;
        reason: string;
        codeVerificationStatus?: undefined;
        action?: undefined;
    } | {
        healthy: boolean;
        reason: any;
        action: string;
        qualityRating?: undefined;
        verifiedName?: undefined;
        messagingLimit?: undefined;
        codeVerificationStatus?: undefined;
    }>;
    syncTemplates(accountId: string, organizationId: string): Promise<{
        created: number;
        updated: number;
        removed: number;
        skipped: number;
        total: number;
    }>;
    private syncTemplatesBackground;
    private mapCategory;
    private mapTemplateStatus;
    private extractBodyText;
    private extractHeaderType;
    private extractHeaderContent;
    private extractHeaderHandle;
    private extractFooterText;
    private extractButtons;
    private extractVariables;
}
export declare const metaService: MetaService;
export default metaService;
//# sourceMappingURL=meta.service.d.ts.map