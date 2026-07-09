import { WhatsAppAccount } from '@prisma/client';
import { ConnectionProgress } from './meta.types';
export declare class MetaService {
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
    completeConnection(codeOrToken: string, organizationId: string, userId: string, connectionType?: 'CLOUD_API' | 'WHATSAPP_BUSINESS_APP', onProgress?: (progress: ConnectionProgress) => void, embeddedSignup?: boolean, sessionWabaId?: string, sessionPhoneNumberId?: string): Promise<{
        success: boolean;
        account?: any;
        error?: string;
    }>;
    getAccounts(organizationId: string): Promise<any[]>;
    getAccount(accountId: string, organizationId: string): Promise<any>;
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
        qualityRating: string;
        verifiedName: string;
        displayPhoneNumber: string;
        status: string | undefined;
        codeVerificationStatus: string | undefined;
        nameStatus: string | undefined;
        messagingLimit: string | undefined;
        reason?: undefined;
        action?: undefined;
    } | {
        healthy: boolean;
        reason: any;
        action: string;
        qualityRating?: undefined;
        verifiedName?: undefined;
        displayPhoneNumber?: undefined;
        status?: undefined;
        codeVerificationStatus?: undefined;
        nameStatus?: undefined;
        messagingLimit?: undefined;
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