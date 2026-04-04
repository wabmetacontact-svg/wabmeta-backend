"use strict";
// 📁 src/modules/meta/meta.service.ts - COMPLETE FIXED VERSION
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaService = exports.MetaService = void 0;
const client_1 = require("@prisma/client");
const meta_api_1 = require("./meta.api");
const config_1 = require("../../config");
const encryption_1 = require("../../utils/encryption");
const uuid_1 = require("uuid");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
class MetaService {
    // ============================================
    // HELPER METHODS
    // ============================================
    sanitizeAccount(account) {
        if (!account)
            return null;
        const { accessToken, webhookSecret, ...safe } = account;
        return {
            ...safe,
            hasAccessToken: !!accessToken,
            hasWebhookSecret: !!webhookSecret,
        };
    }
    // ============================================
    // OAUTH & CONFIGURATION
    // ============================================
    getOAuthUrl(state) {
        const version = config_1.config.meta.graphApiVersion || 'v22.0';
        const baseUrl = `https://www.facebook.com/${version}/dialog/oauth`;
        const params = new URLSearchParams({
            client_id: config_1.config.meta.appId,
            config_id: config_1.config.meta.configId,
            response_type: 'code',
            override_default_response_type: 'true',
            state: state,
            redirect_uri: config_1.config.meta.redirectUri,
            scope: [
                'whatsapp_business_management',
                'whatsapp_business_messaging',
                'business_management',
            ].join(','),
        });
        const url = `${baseUrl}?${params.toString()}`;
        console.log('📱 Generated OAuth URL');
        console.log('   App ID:', config_1.config.meta.appId);
        console.log('   Config ID:', config_1.config.meta.configId);
        return url;
    }
    getEmbeddedSignupConfig() {
        return {
            appId: config_1.config.meta.appId,
            configId: config_1.config.meta.configId,
            version: config_1.config.meta.graphApiVersion || 'v22.0',
            redirectUri: config_1.config.meta.redirectUri,
            features: ['WHATSAPP_EMBEDDED_SIGNUP'],
        };
    }
    getIntegrationStatus() {
        const isConfigured = !!(config_1.config.meta.appId &&
            config_1.config.meta.appSecret &&
            config_1.config.meta.configId &&
            config_1.config.meta.redirectUri);
        return {
            configured: isConfigured,
            appId: config_1.config.meta.appId ? `${config_1.config.meta.appId.substring(0, 8)}...` : null,
            hasConfigId: !!config_1.config.meta.configId,
            hasRedirectUri: !!config_1.config.meta.redirectUri,
            apiVersion: config_1.config.meta.graphApiVersion || 'v22.0',
        };
    }
    // ============================================
    // CONNECTION FLOW - ✅ FIXED RECONNECT LOGIC
    // ============================================
    async completeConnection(codeOrToken, organizationId, userId, onProgress) {
        try {
            console.log('\n🔄 ========== META CONNECTION START ==========');
            console.log('   Organization ID:', organizationId);
            console.log('   User ID:', userId);
            // ============================================
            // STEP 1: Get Access Token
            // ============================================
            onProgress?.({
                step: 'TOKEN_EXCHANGE',
                status: 'in_progress',
                message: 'Exchanging authorization code...',
            });
            let accessToken;
            if ((0, encryption_1.isMetaToken)(codeOrToken)) {
                console.log('✅ Using provided access token');
                accessToken = codeOrToken;
            }
            else {
                console.log('🔄 Exchanging code for token...');
                const tokenResponse = await meta_api_1.metaApi.exchangeCodeForToken(codeOrToken);
                accessToken = tokenResponse.accessToken;
                console.log('✅ Short-lived token obtained');
            }
            // Try to get long-lived token
            try {
                console.log('🔄 Getting long-lived token...');
                const longLivedTokenResponse = await meta_api_1.metaApi.getLongLivedToken(accessToken);
                accessToken = longLivedTokenResponse.accessToken;
                console.log('✅ Long-lived token obtained');
            }
            catch (error) {
                console.log('⚠️ Using short-lived token');
            }
            if (!(0, encryption_1.isMetaToken)(accessToken)) {
                throw new errorHandler_1.AppError('Invalid access token format received', 500);
            }
            console.log('✅ Final token:', (0, encryption_1.maskToken)(accessToken));
            onProgress?.({
                step: 'TOKEN_EXCHANGE',
                status: 'completed',
                message: 'Access token obtained',
            });
            // ============================================
            // STEP 2: Debug Token & Get WABA
            // ============================================
            onProgress?.({
                step: 'FETCHING_WABA',
                status: 'in_progress',
                message: 'Fetching WhatsApp Business Account...',
            });
            const debugInfo = await meta_api_1.metaApi.debugToken(accessToken);
            if (!debugInfo.data.is_valid) {
                throw new errorHandler_1.AppError('Access token is invalid or expired', 401);
            }
            console.log('🔍 Token is valid');
            // Get WABA ID
            let wabaId = null;
            let businessId = null;
            const granularScopes = debugInfo.data.granular_scopes || [];
            for (const scope of granularScopes) {
                if (scope.scope === 'whatsapp_business_management' && scope.target_ids?.length) {
                    wabaId = scope.target_ids[0];
                    console.log('✅ Found WABA ID:', wabaId);
                    break;
                }
                if (scope.scope === 'business_management' && scope.target_ids?.length) {
                    businessId = scope.target_ids[0];
                }
            }
            // Fallback: try business query
            if (!wabaId) {
                console.log('⚠️ WABA not in token, querying business...');
                const wabas = await meta_api_1.metaApi.getSharedWABAs(accessToken);
                if (wabas.length > 0) {
                    wabaId = wabas[0].id;
                    businessId = wabas[0].owner_business_info?.id || businessId;
                    console.log('✅ Found WABA from business:', wabaId);
                }
            }
            if (!wabaId) {
                throw new errorHandler_1.AppError('No WhatsApp Business Account found', 404);
            }
            // Get WABA details
            const wabaDetails = await meta_api_1.metaApi.getWABADetails(wabaId, accessToken);
            console.log('✅ WABA Details:', {
                id: wabaDetails.id,
                name: wabaDetails.name,
            });
            onProgress?.({
                step: 'FETCHING_WABA',
                status: 'completed',
                message: `Found WABA: ${wabaDetails.name}`,
                data: { wabaId, wabaName: wabaDetails.name },
            });
            // ============================================
            // STEP 3: Get Phone Numbers
            // ============================================
            onProgress?.({
                step: 'FETCHING_PHONE',
                status: 'in_progress',
                message: 'Fetching phone numbers...',
            });
            const phoneNumbers = await meta_api_1.metaApi.getPhoneNumbers(wabaId, accessToken);
            if (phoneNumbers.length === 0) {
                throw new errorHandler_1.AppError('No phone numbers found', 404);
            }
            const primaryPhone = phoneNumbers[0];
            console.log('✅ Primary Phone:', primaryPhone.displayPhoneNumber);
            onProgress?.({
                step: 'FETCHING_PHONE',
                status: 'completed',
                message: `Found phone: ${primaryPhone.displayPhoneNumber}`,
            });
            // ============================================
            // STEP 4: Subscribe to Webhooks
            // ============================================
            onProgress?.({
                step: 'SUBSCRIBE_WEBHOOK',
                status: 'in_progress',
                message: 'Setting up webhooks...',
            });
            try {
                await meta_api_1.metaApi.subscribeToWebhooks(wabaId, accessToken);
                console.log('✅ Webhooks subscribed');
            }
            catch (webhookError) {
                console.warn('⚠️ Webhook subscription failed:', webhookError.message);
            }
            onProgress?.({
                step: 'SUBSCRIBE_WEBHOOK',
                status: 'completed',
                message: 'Webhooks configured',
            });
            // ============================================
            // STEP 5: Save to Database - ✅ FIXED LOGIC
            // ============================================
            onProgress?.({
                step: 'SAVING',
                status: 'in_progress',
                message: 'Saving account...',
            });
            // ✅ Check existing by phoneNumberId ONLY
            const existingAccount = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    phoneNumberId: primaryPhone.id,
                },
            });
            console.log('🔐 Encrypting token...');
            const encryptedToken = (0, encryption_1.encrypt)(accessToken);
            // Verify encryption
            const verifyDecrypt = (0, encryption_1.safeDecryptStrict)(encryptedToken);
            if (verifyDecrypt !== accessToken) {
                throw new errorHandler_1.AppError('Token encryption verification failed', 500);
            }
            console.log('✅ Encryption verified');
            const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
            const cleanPhoneNumber = primaryPhone.displayPhoneNumber.replace(/\D/g, '');
            let savedAccount;
            if (existingAccount) {
                // Account exists - check organization
                if (existingAccount.organizationId === organizationId) {
                    // ✅ Same organization - REACTIVATE/UPDATE existing account
                    console.log('🔄 Reactivating existing account for same organization');
                    // Check if there's a default account already
                    const hasDefault = await database_1.default.whatsAppAccount.findFirst({
                        where: {
                            organizationId,
                            isDefault: true,
                            id: { not: existingAccount.id },
                        },
                    });
                    savedAccount = await database_1.default.whatsAppAccount.update({
                        where: { id: existingAccount.id },
                        data: {
                            accessToken: encryptedToken,
                            tokenExpiresAt,
                            wabaId,
                            displayName: primaryPhone.verifiedName || primaryPhone.displayPhoneNumber,
                            verifiedName: primaryPhone.verifiedName,
                            qualityRating: primaryPhone.qualityRating,
                            status: client_1.WhatsAppAccountStatus.CONNECTED,
                            isDefault: existingAccount.isDefault || !hasDefault, // Restore or set as default if no other default
                            codeVerificationStatus: primaryPhone.codeVerificationStatus,
                            nameStatus: primaryPhone.nameStatus,
                            messagingLimit: primaryPhone.messagingLimitTier,
                        },
                    });
                    console.log('✅ Account reactivated successfully');
                }
                else {
                    // ✅ Different organization - Soft disconnect old, CREATE new
                    console.log('🔄 Phone number switching organizations');
                    console.log(`   Old org: ${existingAccount.organizationId}`);
                    console.log(`   New org: ${organizationId}`);
                    // Soft disconnect old account (preserves data for old org)
                    await database_1.default.whatsAppAccount.update({
                        where: { id: existingAccount.id },
                        data: {
                            status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                            accessToken: null,
                            tokenExpiresAt: null,
                            isDefault: false,
                        },
                    });
                    console.log('✅ Old account soft-disconnected (data preserved)');
                    // Check if new org already has accounts
                    const accountCount = await database_1.default.whatsAppAccount.count({
                        where: { organizationId },
                    });
                    const webhookVerifyToken = (0, uuid_1.v4)();
                    const encryptedWebhookSecret = (0, encryption_1.encrypt)(webhookVerifyToken);
                    // Create new account for current organization
                    savedAccount = await database_1.default.whatsAppAccount.create({
                        data: {
                            organizationId,
                            wabaId,
                            phoneNumberId: primaryPhone.id,
                            phoneNumber: cleanPhoneNumber,
                            displayName: primaryPhone.verifiedName || primaryPhone.displayPhoneNumber,
                            verifiedName: primaryPhone.verifiedName,
                            qualityRating: primaryPhone.qualityRating,
                            accessToken: encryptedToken,
                            tokenExpiresAt,
                            webhookSecret: encryptedWebhookSecret,
                            status: client_1.WhatsAppAccountStatus.CONNECTED,
                            isDefault: accountCount === 0,
                            codeVerificationStatus: primaryPhone.codeVerificationStatus,
                            nameStatus: primaryPhone.nameStatus,
                            messagingLimit: primaryPhone.messagingLimitTier,
                        },
                    });
                    console.log('✅ New account created for new organization');
                }
            }
            else {
                // ✅ No existing account - CREATE new
                console.log('🔄 Creating completely new account');
                const accountCount = await database_1.default.whatsAppAccount.count({
                    where: { organizationId },
                });
                const webhookVerifyToken = (0, uuid_1.v4)();
                const encryptedWebhookSecret = (0, encryption_1.encrypt)(webhookVerifyToken);
                savedAccount = await database_1.default.whatsAppAccount.create({
                    data: {
                        organizationId,
                        wabaId,
                        phoneNumberId: primaryPhone.id,
                        phoneNumber: cleanPhoneNumber,
                        displayName: primaryPhone.verifiedName || primaryPhone.displayPhoneNumber,
                        verifiedName: primaryPhone.verifiedName,
                        qualityRating: primaryPhone.qualityRating,
                        accessToken: encryptedToken,
                        tokenExpiresAt,
                        webhookSecret: encryptedWebhookSecret,
                        status: client_1.WhatsAppAccountStatus.CONNECTED,
                        isDefault: accountCount === 0,
                        codeVerificationStatus: primaryPhone.codeVerificationStatus,
                        nameStatus: primaryPhone.nameStatus,
                        messagingLimit: primaryPhone.messagingLimitTier,
                    },
                });
                console.log('✅ New account created');
            }
            onProgress?.({
                step: 'COMPLETED',
                status: 'completed',
                message: 'WhatsApp account connected!',
            });
            // Sync templates in background
            this.syncTemplatesBackground(savedAccount.id, wabaId, accessToken).catch((err) => {
                console.error('Background template sync failed:', err);
            });
            console.log('🔄 ========== META CONNECTION END ==========\n');
            return {
                success: true,
                account: this.sanitizeAccount(savedAccount),
            };
        }
        catch (error) {
            console.error('❌ Meta connection error:', error);
            onProgress?.({
                step: 'COMPLETED',
                status: 'error',
                message: error.message || 'Failed to connect',
            });
            return {
                success: false,
                error: error.message || 'Failed to connect WhatsApp account',
            };
        }
    }
    // ============================================
    // ACCOUNT MANAGEMENT
    // ============================================
    async getAccounts(organizationId) {
        const accounts = await database_1.default.whatsAppAccount.findMany({
            where: { organizationId },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });
        return accounts.map((account) => this.sanitizeAccount(account));
    }
    async getAccount(accountId, organizationId) {
        const account = await database_1.default.whatsAppAccount.findFirst({
            where: {
                id: accountId,
                organizationId,
            },
        });
        if (!account) {
            throw new errorHandler_1.AppError('WhatsApp account not found', 404);
        }
        return this.sanitizeAccount(account);
    }
    async getAccountWithToken(accountId) {
        const account = await database_1.default.whatsAppAccount.findUnique({
            where: { id: accountId },
        });
        if (!account) {
            console.error(`❌ Account not found: ${accountId}`);
            return null;
        }
        if (!account.accessToken) {
            console.error(`❌ No access token for account: ${accountId}`);
            return null;
        }
        console.log(`\n🔐 ========== TOKEN RETRIEVAL ==========`);
        console.log(`   Account ID: ${accountId}`);
        console.log(`   Organization: ${account.organizationId}`);
        console.log(`   Phone: ${account.phoneNumber}`);
        const decryptedToken = (0, encryption_1.safeDecryptStrict)(account.accessToken);
        if (!decryptedToken || !(0, encryption_1.isMetaToken)(decryptedToken)) {
            console.error(`❌ Failed to decrypt token for account: ${accountId}`);
            console.error(`   Possible causes:`);
            console.error(`   1. Token was not encrypted properly`);
            console.error(`   2. ENCRYPTION_KEY changed in .env`);
            console.error(`   3. Database corruption`);
            console.error(`\n   ✅ SOLUTION: Reconnect WhatsApp account`);
            await database_1.default.whatsAppAccount.update({
                where: { id: accountId },
                data: {
                    status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                    accessToken: null,
                },
            });
            return null;
        }
        console.log(`✅ Token decrypted successfully`);
        console.log(`   Token: ${(0, encryption_1.maskToken)(decryptedToken)}`);
        console.log(`🔐 ========== TOKEN RETRIEVAL END ==========\n`);
        return {
            account,
            accessToken: decryptedToken,
        };
    }
    /**
     * ✅ SAFE DISCONNECT - Soft disconnect, preserves data
     * Idempotent: Can be called multiple times safely
     * Handles default account switching automatically
     */
    async disconnectAccount(accountId, organizationId) {
        console.log(`🔌 Disconnecting account: ${accountId}`);
        // Find account (safe - checks organization ownership)
        const account = await database_1.default.whatsAppAccount.findFirst({
            where: {
                id: accountId,
                organizationId,
            },
        });
        // ✅ Idempotent: If already not found, treat as already disconnected
        if (!account) {
            console.log(`ℹ️  Account not found or already disconnected: ${accountId}`);
            return {
                success: true,
                message: 'Account already disconnected (not found)',
            };
        }
        // Check if already disconnected
        if (account.status === client_1.WhatsAppAccountStatus.DISCONNECTED && !account.accessToken) {
            console.log(`ℹ️  Account already disconnected: ${accountId}`);
            return {
                success: true,
                message: 'Account already disconnected',
            };
        }
        // ✅ Soft disconnect: Mark as disconnected, clear token
        // This preserves campaign history, templates, and other relations
        await database_1.default.whatsAppAccount.update({
            where: { id: accountId },
            data: {
                status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                accessToken: null,
                tokenExpiresAt: null,
                isDefault: false,
            },
        });
        console.log(`✅ Account disconnected: ${accountId}`);
        // ✅ If it was default, set another CONNECTED account as default
        if (account.isDefault) {
            const anotherAccount = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    status: client_1.WhatsAppAccountStatus.CONNECTED,
                    id: { not: accountId },
                },
                orderBy: { createdAt: 'asc' },
            });
            if (anotherAccount) {
                await database_1.default.whatsAppAccount.update({
                    where: { id: anotherAccount.id },
                    data: { isDefault: true },
                });
                console.log(`✅ New default account: ${anotherAccount.id}`);
            }
            else {
                console.log(`ℹ️  No other connected accounts found`);
            }
        }
        return {
            success: true,
            message: 'Account disconnected successfully',
        };
    }
    async setDefaultAccount(accountId, organizationId) {
        const account = await database_1.default.whatsAppAccount.findFirst({
            where: {
                id: accountId,
                organizationId,
                status: client_1.WhatsAppAccountStatus.CONNECTED,
            },
        });
        if (!account) {
            throw new errorHandler_1.AppError('Account not found or not connected', 404);
        }
        await database_1.default.whatsAppAccount.updateMany({
            where: { organizationId },
            data: { isDefault: false },
        });
        await database_1.default.whatsAppAccount.update({
            where: { id: accountId },
            data: { isDefault: true },
        });
        console.log(`✅ Default account: ${accountId}`);
        return { success: true, message: 'Default account updated' };
    }
    async refreshAccountHealth(accountId, organizationId) {
        const accountData = await this.getAccountWithToken(accountId);
        if (!accountData) {
            throw new errorHandler_1.AppError('Account not found or access denied', 404);
        }
        if (accountData.account.organizationId !== organizationId) {
            throw new errorHandler_1.AppError('Account does not belong to this organization', 403);
        }
        const { account, accessToken } = accountData;
        try {
            const debugInfo = await meta_api_1.metaApi.debugToken(accessToken);
            if (!debugInfo.data.is_valid) {
                await database_1.default.whatsAppAccount.update({
                    where: { id: accountId },
                    data: {
                        status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                        accessToken: null,
                        tokenExpiresAt: null,
                    },
                });
                return {
                    healthy: false,
                    reason: 'Access token expired',
                    action: 'Please reconnect',
                };
            }
            const phoneNumbers = await meta_api_1.metaApi.getPhoneNumbers(account.wabaId, accessToken);
            const phone = phoneNumbers.find((p) => p.id === account.phoneNumberId);
            if (!phone) {
                await database_1.default.whatsAppAccount.update({
                    where: { id: accountId },
                    data: { status: client_1.WhatsAppAccountStatus.DISCONNECTED },
                });
                return {
                    healthy: false,
                    reason: 'Phone number not found',
                    action: 'Phone may have been removed',
                };
            }
            await database_1.default.whatsAppAccount.update({
                where: { id: accountId },
                data: {
                    qualityRating: phone.qualityRating,
                    displayName: phone.verifiedName || phone.displayPhoneNumber,
                    verifiedName: phone.verifiedName,
                    status: client_1.WhatsAppAccountStatus.CONNECTED,
                    codeVerificationStatus: phone.codeVerificationStatus,
                    nameStatus: phone.nameStatus,
                    messagingLimit: phone.messagingLimitTier,
                },
            });
            console.log(`✅ Health check passed: ${accountId}`);
            return {
                healthy: true,
                qualityRating: phone.qualityRating,
                verifiedName: phone.verifiedName,
                displayPhoneNumber: phone.displayPhoneNumber,
                status: phone.status,
                codeVerificationStatus: phone.codeVerificationStatus,
                nameStatus: phone.nameStatus,
                messagingLimit: phone.messagingLimitTier,
            };
        }
        catch (error) {
            console.error(`❌ Health check failed: ${accountId}`, error);
            await database_1.default.whatsAppAccount.update({
                where: { id: accountId },
                data: {
                    status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                    accessToken: null,
                },
            });
            return {
                healthy: false,
                reason: error.message || 'Health check failed',
                action: 'Please reconnect',
            };
        }
    }
    // ============================================
    // TEMPLATE SYNC
    // ============================================
    async syncTemplates(accountId, organizationId) {
        const result = await this.getAccountWithToken(accountId);
        if (!result) {
            throw new errorHandler_1.AppError('Account not found or token unavailable', 404);
        }
        const { account, accessToken } = result;
        if (account.organizationId !== organizationId) {
            throw new errorHandler_1.AppError('Unauthorized', 403);
        }
        console.log(`🔄 Syncing templates for account ${accountId} (WABA: ${account.wabaId})`);
        const metaTemplates = await meta_api_1.metaApi.getTemplates(account.wabaId, accessToken);
        console.log(`📥 Fetched ${metaTemplates.length} templates from Meta`);
        const existingTemplates = await database_1.default.template.findMany({
            where: {
                whatsappAccountId: accountId,
            },
            select: {
                id: true,
                name: true,
                language: true,
                metaTemplateId: true,
            },
        });
        const existingMap = new Map(existingTemplates.map((t) => [`${t.name}_${t.language}`, t]));
        const metaKeys = new Set();
        let created = 0;
        let updated = 0;
        let skipped = 0;
        for (const metaTemplate of metaTemplates) {
            try {
                const status = this.mapTemplateStatus(metaTemplate.status);
                if (status === 'DRAFT' || status === 'REJECTED') {
                    skipped++;
                    continue;
                }
                const key = `${metaTemplate.name}_${metaTemplate.language}`;
                metaKeys.add(key);
                const existing = existingMap.get(key);
                const templateData = {
                    organizationId,
                    whatsappAccountId: accountId,
                    wabaId: account.wabaId,
                    metaTemplateId: metaTemplate.id,
                    name: metaTemplate.name,
                    language: metaTemplate.language,
                    category: this.mapCategory(metaTemplate.category),
                    status: status,
                    bodyText: this.extractBodyText(metaTemplate.components),
                    headerType: this.extractHeaderType(metaTemplate.components),
                    headerContent: this.extractHeaderContent(metaTemplate.components),
                    footerText: this.extractFooterText(metaTemplate.components),
                    buttons: this.extractButtons(metaTemplate.components),
                    variables: this.extractVariables(metaTemplate.components),
                    qualityScore: metaTemplate.quality_score?.score || null,
                };
                if (existing) {
                    await database_1.default.template.update({
                        where: { id: existing.id },
                        data: templateData,
                    });
                    updated++;
                }
                else {
                    await database_1.default.template.create({ data: templateData });
                    created++;
                }
            }
            catch (err) {
                console.error(`Failed to sync ${metaTemplate.name}:`, err.message);
                skipped++;
            }
        }
        const toRemove = existingTemplates.filter((t) => !metaKeys.has(`${t.name}_${t.language}`));
        let removed = 0;
        if (toRemove.length > 0) {
            const deleteResult = await database_1.default.template.deleteMany({
                where: { id: { in: toRemove.map((t) => t.id) } },
            });
            removed = deleteResult.count;
        }
        console.log(`✅ Sync complete:`);
        console.log(`   Created: ${created}`);
        console.log(`   Updated: ${updated}`);
        console.log(`   Removed: ${removed}`);
        console.log(`   Skipped: ${skipped}`);
        return {
            created,
            updated,
            removed,
            skipped,
            total: metaTemplates.length,
        };
    }
    async syncTemplatesBackground(accountId, wabaId, accessToken) {
        try {
            console.log(`🔄 Background template sync for account ${accountId}...`);
            const templates = await meta_api_1.metaApi.getTemplates(wabaId, accessToken);
            const account = await database_1.default.whatsAppAccount.findUnique({
                where: { id: accountId },
                select: { organizationId: true, id: true },
            });
            if (!account) {
                console.error('Account not found for background sync');
                return;
            }
            let synced = 0;
            for (const template of templates) {
                try {
                    const status = this.mapTemplateStatus(template.status);
                    if (status === 'DRAFT' || status === 'REJECTED')
                        continue;
                    const existing = await database_1.default.template.findFirst({
                        where: {
                            whatsappAccountId: accountId,
                            name: template.name,
                            language: template.language,
                        },
                    });
                    const templateData = {
                        organizationId: account.organizationId,
                        whatsappAccountId: accountId,
                        wabaId: wabaId,
                        metaTemplateId: template.id,
                        name: template.name,
                        language: template.language,
                        category: this.mapCategory(template.category),
                        status: status,
                        bodyText: this.extractBodyText(template.components),
                        headerType: this.extractHeaderType(template.components),
                        headerContent: this.extractHeaderContent(template.components),
                        footerText: this.extractFooterText(template.components),
                        buttons: this.extractButtons(template.components),
                        variables: this.extractVariables(template.components),
                        qualityScore: template.quality_score?.score || null,
                    };
                    if (existing) {
                        await database_1.default.template.update({
                            where: { id: existing.id },
                            data: templateData,
                        });
                    }
                    else {
                        await database_1.default.template.create({ data: templateData });
                    }
                    synced++;
                }
                catch (err) {
                    console.error(`Background sync error for ${template.name}:`, err.message);
                }
            }
            console.log(`✅ Background sync: ${synced}/${templates.length} templates`);
        }
        catch (error) {
            console.error('❌ Background template sync failed:', error);
        }
    }
    // ============================================
    // TEMPLATE HELPERS
    // ============================================
    mapCategory(category) {
        const map = {
            MARKETING: 'MARKETING',
            UTILITY: 'UTILITY',
            AUTHENTICATION: 'AUTHENTICATION',
        };
        return map[category?.toUpperCase()] || 'UTILITY';
    }
    mapTemplateStatus(status) {
        const map = {
            APPROVED: 'APPROVED',
            PENDING: 'PENDING',
            REJECTED: 'REJECTED',
            DRAFT: 'DRAFT',
            IN_APPEAL: 'PENDING',
            PENDING_DELETION: 'REJECTED',
            DELETED: 'REJECTED',
            DISABLED: 'REJECTED',
            PAUSED: 'APPROVED',
            LIMIT_EXCEEDED: 'REJECTED',
        };
        return map[status?.toUpperCase()] || 'PENDING';
    }
    extractBodyText(components) {
        if (!Array.isArray(components))
            return '';
        const body = components.find((c) => c.type === 'BODY');
        return body?.text || '';
    }
    extractHeaderType(components) {
        if (!Array.isArray(components))
            return null;
        const header = components.find((c) => c.type === 'HEADER');
        if (!header)
            return null;
        const format = header.format?.toUpperCase();
        if (['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
            return format;
        }
        return null;
    }
    extractHeaderContent(components) {
        if (!Array.isArray(components))
            return null;
        const header = components.find((c) => c.type === 'HEADER');
        return header?.text || header?.example?.header_text?.[0] || null;
    }
    extractFooterText(components) {
        if (!Array.isArray(components))
            return null;
        const footer = components.find((c) => c.type === 'FOOTER');
        return footer?.text || null;
    }
    extractButtons(components) {
        if (!Array.isArray(components))
            return null;
        const buttonsComponent = components.find((c) => c.type === 'BUTTONS');
        return buttonsComponent?.buttons || null;
    }
    extractVariables(components) {
        if (!Array.isArray(components))
            return [];
        const variables = [];
        for (const component of components) {
            if (component.type === 'BODY' && component.text) {
                const matches = component.text.match(/\{\{(\d+)\}\}/g);
                if (matches) {
                    matches.forEach((match, index) => {
                        variables.push({
                            index: index + 1,
                            type: 'text',
                            placeholder: match,
                        });
                    });
                }
            }
        }
        return variables;
    }
}
exports.MetaService = MetaService;
exports.metaService = new MetaService();
exports.default = exports.metaService;
//# sourceMappingURL=meta.service.js.map