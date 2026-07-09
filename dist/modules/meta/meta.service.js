"use strict";
// 📁 src/modules/meta/meta.service.ts - FIXED VERSION
// ✅ FIX 1: registerPhoneNumber now uses generatePhonePin() — a random 6-digit PIN
//    per account, instead of hardcoded '000000' across every customer.
// ✅ FIX 2: getAccountWithToken now delegates to the shared
//    getAccountWithDecryptedToken() helper — same logic used by whatsapp.service.ts,
//    so message sending and connection health checks agree on token state.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaService = exports.MetaService = void 0;
const client_1 = require("@prisma/client");
const meta_api_1 = require("./meta.api"); // ✅ FIX: import generatePhonePin
const config_1 = require("../../config");
const encryption_1 = require("../../utils/encryption");
const tokenDecryption_1 = require("../../utils/tokenDecryption"); // ✅ FIX: shared helper
const templateMediaResolver_1 = require("../../utils/templateMediaResolver");
const uuid_1 = require("uuid");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
class MetaService {
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
    detectConnectionType(metaData) {
        if (!metaData)
            return 'CLOUD_API';
        if (metaData.api_version || metaData.cloud_api || metaData.platformType === 'CLOUD_API') {
            return 'CLOUD_API';
        }
        if (metaData.business_app || metaData.app_based || metaData.platformType === 'WHATSAPP_BUSINESS_APP') {
            return 'BUSINESS_APP';
        }
        if (metaData.on_premise || metaData.self_hosted || metaData.platformType === 'ON_PREMISE') {
            return 'ON_PREMISE';
        }
        return 'CLOUD_API';
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
    // CONNECTION FLOW
    // ============================================
    async completeConnection(codeOrToken, organizationId, userId, connectionType = 'CLOUD_API', onProgress, embeddedSignup = false, sessionWabaId, sessionPhoneNumberId) {
        try {
            console.log('\n🔄 ========== META CONNECTION START ==========');
            console.log('   Organization ID:', organizationId);
            console.log('   Embedded Signup:', embeddedSignup);
            console.log('   Session WABA ID:', sessionWabaId || '(will lookup from token)');
            console.log('   Session Phone ID:', sessionPhoneNumberId || '(will lookup from WABA)');
            // STEP 1: Get Access Token
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
                const tokenResponse = await meta_api_1.metaApi.exchangeCodeForToken(codeOrToken, embeddedSignup);
                accessToken = tokenResponse.accessToken;
                console.log('✅ Short-lived token obtained');
            }
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
            // STEP 2: Debug Token & Get WABA
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
            let wabaId = sessionWabaId || null;
            let businessId = null;
            if (wabaId) {
                console.log('✅ Using WABA ID from session info (most reliable):', wabaId);
            }
            else {
                const granularScopes = debugInfo.data.granular_scopes || [];
                console.log('🔍 Granular scopes:', JSON.stringify(granularScopes));
                for (const scope of granularScopes) {
                    if (scope.scope === 'whatsapp_business_management' && scope.target_ids?.length) {
                        wabaId = scope.target_ids[0];
                        console.log('✅ Found WABA ID from granular scopes:', wabaId);
                        break;
                    }
                    if (scope.scope === 'business_management' && scope.target_ids?.length) {
                        businessId = scope.target_ids[0];
                    }
                }
                if (!wabaId) {
                    console.log('⚠️ WABA not in granular scopes, trying business API fallback...');
                    try {
                        const wabas = await meta_api_1.metaApi.getSharedWABAs(accessToken);
                        if (wabas.length > 0) {
                            wabaId = wabas[0].id;
                            businessId = wabas[0].owner_business_info?.id || businessId;
                            console.log('✅ Found WABA from business API:', wabaId);
                        }
                    }
                    catch (wabaErr) {
                        console.warn('⚠️ Business API fallback failed (expected for Embedded Signup tokens):', wabaErr.message);
                    }
                }
            }
            if (!wabaId) {
                throw new errorHandler_1.AppError('🚫 WhatsApp Setup Incomplete\n' +
                    'Facebook login succeeded but WhatsApp Business Account was not shared.\n' +
                    '✅ Please try again and FULLY complete the wizard:\n' +
                    '1. Click "Get Started"\n' +
                    '2. Create/select a Business Portfolio\n' +
                    '3. Create a WhatsApp Business Account\n' +
                    '4. Add and VERIFY a phone number\n' +
                    '5. Click FINISH and wait for the popup to close', 400);
            }
            let wabaDetails = { id: wabaId, name: 'WhatsApp Business Account' };
            try {
                wabaDetails = await meta_api_1.metaApi.getWABADetails(wabaId, accessToken);
                console.log('✅ WABA Details:', {
                    id: wabaDetails.id,
                    name: wabaDetails.name,
                });
            }
            catch (detailErr) {
                console.warn('⚠️ Could not get full WABA details (non-fatal):', detailErr.message);
                console.log('💡 Continuing with minimal WABA info: id=', wabaId);
            }
            onProgress?.({
                step: 'FETCHING_WABA',
                status: 'completed',
                message: `Found WABA: ${wabaDetails.name}`,
                data: { wabaId, wabaName: wabaDetails.name },
            });
            // STEP 3: Get Phone Numbers
            onProgress?.({
                step: 'FETCHING_PHONE',
                status: 'in_progress',
                message: 'Fetching phone numbers...',
            });
            let phoneNumbers;
            if (sessionPhoneNumberId) {
                console.log('📥 Fetching specific phone by session ID:', sessionPhoneNumberId);
                try {
                    const specificPhone = await meta_api_1.metaApi.getPhoneNumberDetails(sessionPhoneNumberId, accessToken);
                    phoneNumbers = [{
                            id: specificPhone.id,
                            verifiedName: specificPhone.verifiedName,
                            displayPhoneNumber: specificPhone.displayPhoneNumber,
                            qualityRating: specificPhone.qualityRating,
                            codeVerificationStatus: specificPhone.codeVerificationStatus,
                            nameStatus: specificPhone.nameStatus,
                            messagingLimitTier: null,
                            platformType: null,
                            throughput: null,
                            status: null,
                        }];
                    console.log('✅ Got phone from session ID:', specificPhone.displayPhoneNumber);
                }
                catch (phoneErr) {
                    console.warn('⚠️ Could not get phone by session ID, falling back to WABA list:', phoneErr.message);
                    phoneNumbers = await meta_api_1.metaApi.getPhoneNumbers(wabaId, accessToken);
                }
            }
            else {
                phoneNumbers = await meta_api_1.metaApi.getPhoneNumbers(wabaId, accessToken);
            }
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
            const autoDetected = this.detectConnectionType(primaryPhone);
            const finalConnectionType = autoDetected !== 'CLOUD_API' ? autoDetected : connectionType;
            // STEP 4: Subscribe to Webhooks
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
            // STEP 4.5: Register Phone Number for Cloud API
            onProgress?.({
                step: 'REGISTER_PHONE',
                status: 'in_progress',
                message: 'Registering phone number to Cloud API...',
            });
            // ✅ FIX: generate a random, per-account 6-digit PIN instead of hardcoded '000000'.
            // We check if this phoneNumberId already has a persisted PIN (previous reconnection)
            // and reuse it — Meta rejects PIN changes without prior 2FA disable.
            let phonePin;
            try {
                const existingRecord = await database_1.default.whatsAppAccount.findUnique({
                    where: { phoneNumberId: primaryPhone.id },
                    select: { webhookSecret: true },
                });
                // We reuse webhookSecret column to also stash the encrypted PIN with a marker
                // (schema-safe: no new column needed). Marker prefix = "PIN::"
                let reusedPin = null;
                if (existingRecord?.webhookSecret) {
                    try {
                        const decrypted = (0, encryption_1.safeDecryptStrict)(existingRecord.webhookSecret);
                        if (decrypted?.startsWith('PIN::')) {
                            const parts = decrypted.split('::');
                            if (parts[1] && /^\d{6}$/.test(parts[1])) {
                                reusedPin = parts[1];
                            }
                        }
                    }
                    catch {
                        // ignore — treat as no existing PIN
                    }
                }
                phonePin = reusedPin || (0, meta_api_1.generatePhonePin)();
                console.log(`[Meta Service] Using ${reusedPin ? 'existing' : 'new'} PIN for phone ${primaryPhone.id}`);
                await meta_api_1.metaApi.registerPhoneNumber(primaryPhone.id, accessToken, phonePin);
                console.log('✅ Phone number registered successfully');
            }
            catch (registerError) {
                console.warn('⚠️ Phone number registration failed:', registerError.message);
                phonePin = (0, meta_api_1.generatePhonePin)(); // ensure we still have a value to persist below
            }
            onProgress?.({
                step: 'REGISTER_PHONE',
                status: 'completed',
                message: 'Phone number registered',
            });
            // STEP 5: Save to Database
            onProgress?.({
                step: 'SAVING',
                status: 'in_progress',
                message: 'Saving account...',
            });
            const existingConnectedInOrg = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    status: client_1.WhatsAppAccountStatus.CONNECTED,
                    phoneNumberId: { not: primaryPhone.id },
                },
            });
            if (existingConnectedInOrg) {
                throw new errorHandler_1.AppError(`Organization already has a connected WhatsApp account (${existingConnectedInOrg.phoneNumber}). ` +
                    `Please disconnect it first before connecting a new one.`, 400);
            }
            console.log('🔐 Encrypting token...');
            const encryptedToken = (0, encryption_1.encrypt)(accessToken);
            const verifyDecrypt = (0, encryption_1.safeDecryptStrict)(encryptedToken);
            if (verifyDecrypt !== accessToken) {
                throw new errorHandler_1.AppError('Token encryption verification failed', 500);
            }
            console.log('✅ Encryption verified');
            const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
            const cleanPhoneNumber = primaryPhone.displayPhoneNumber.replace(/\D/g, '');
            // ✅ Persist the PIN encrypted alongside the webhook verify token so we can
            // reuse it on future re-registrations. Prefix with "PIN::<pin>::" so we can
            // distinguish it from raw webhook secrets when reading back.
            const webhookVerifyToken = (0, uuid_1.v4)();
            const combinedSecret = `PIN::${phonePin}::WEBHOOK::${webhookVerifyToken}`;
            const encryptedWebhookSecret = (0, encryption_1.encrypt)(combinedSecret);
            let savedAccount;
            try {
                const existingByPhone = await database_1.default.whatsAppAccount.findUnique({
                    where: { phoneNumberId: primaryPhone.id },
                });
                if (existingByPhone) {
                    const isSameOrg = existingByPhone.organizationId === organizationId;
                    console.log(isSameOrg
                        ? '🔄 Reactivating existing account (same org)'
                        : `🔄 Transferring phone to new org (was: ${existingByPhone.organizationId})`);
                    const hasDefault = await database_1.default.whatsAppAccount.findFirst({
                        where: {
                            organizationId,
                            isDefault: true,
                            id: { not: existingByPhone.id },
                        },
                    });
                    savedAccount = await database_1.default.whatsAppAccount.update({
                        where: { id: existingByPhone.id },
                        data: {
                            organizationId,
                            accessToken: encryptedToken,
                            tokenExpiresAt,
                            wabaId,
                            phoneNumber: cleanPhoneNumber,
                            displayName: primaryPhone.verifiedName || primaryPhone.displayPhoneNumber,
                            verifiedName: primaryPhone.verifiedName,
                            qualityRating: primaryPhone.qualityRating,
                            status: client_1.WhatsAppAccountStatus.CONNECTED,
                            connectionType: finalConnectionType,
                            isDefault: existingByPhone.isDefault || !hasDefault,
                            codeVerificationStatus: primaryPhone.codeVerificationStatus,
                            nameStatus: primaryPhone.nameStatus,
                            messagingLimit: primaryPhone.messagingLimitTier,
                            // ✅ persist PIN + webhook secret together (encrypted)
                            webhookSecret: encryptedWebhookSecret,
                        },
                    });
                    console.log('✅ Account updated successfully');
                }
                else {
                    console.log('🔄 Creating new WhatsApp account');
                    const accountCount = await database_1.default.whatsAppAccount.count({ where: { organizationId } });
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
                            connectionType: finalConnectionType,
                            isDefault: accountCount === 0,
                            codeVerificationStatus: primaryPhone.codeVerificationStatus,
                            nameStatus: primaryPhone.nameStatus,
                            messagingLimit: primaryPhone.messagingLimitTier,
                        },
                    });
                    console.log('✅ New account created');
                }
            }
            catch (dbError) {
                if (dbError.code === 'P2002' && dbError.meta?.target?.includes('phoneNumberId')) {
                    console.warn('⚠️ Unique constraint hit despite findUnique miss — doing force update');
                    const forceExisting = await database_1.default.whatsAppAccount.findFirst({
                        where: { phoneNumberId: primaryPhone.id },
                    });
                    if (forceExisting) {
                        savedAccount = await database_1.default.whatsAppAccount.update({
                            where: { id: forceExisting.id },
                            data: {
                                organizationId,
                                accessToken: encryptedToken,
                                tokenExpiresAt,
                                wabaId,
                                phoneNumber: cleanPhoneNumber,
                                displayName: primaryPhone.verifiedName || primaryPhone.displayPhoneNumber,
                                verifiedName: primaryPhone.verifiedName,
                                qualityRating: primaryPhone.qualityRating,
                                status: client_1.WhatsAppAccountStatus.CONNECTED,
                                connectionType: finalConnectionType,
                                isDefault: true,
                                codeVerificationStatus: primaryPhone.codeVerificationStatus,
                                nameStatus: primaryPhone.nameStatus,
                                messagingLimit: primaryPhone.messagingLimitTier,
                                webhookSecret: encryptedWebhookSecret,
                            },
                        });
                        console.log('✅ Force-updated existing account');
                    }
                    else {
                        throw dbError;
                    }
                }
                else {
                    throw dbError;
                }
            }
            // STEP 5.5: MetaConnection & PhoneNumbers
            let savedMetaConnection = null;
            try {
                console.log('🔄 Saving MetaConnection...');
                savedMetaConnection = await database_1.default.metaConnection.upsert({
                    where: { organizationId },
                    update: {
                        accessToken: encryptedToken,
                        wabaId,
                        wabaName: wabaDetails.name,
                        status: 'CONNECTED',
                        lastSyncedAt: new Date(),
                    },
                    create: {
                        organizationId,
                        accessToken: encryptedToken,
                        wabaId,
                        wabaName: wabaDetails.name,
                        status: 'CONNECTED',
                    },
                });
                console.log('✅ MetaConnection saved:', savedMetaConnection.id);
            }
            catch (e) {
                console.warn('⚠️ MetaConnection save failed:', e.message);
            }
            try {
                if (savedMetaConnection) {
                    console.log('🔄 Saving PhoneNumbers...');
                    for (const phone of phoneNumbers) {
                        await database_1.default.phoneNumber.upsert({
                            where: { phoneNumberId: phone.id },
                            update: {
                                phoneNumber: phone.displayPhoneNumber.replace(/\D/g, ''),
                                displayName: phone.verifiedName || phone.displayPhoneNumber,
                                qualityRating: phone.qualityRating,
                                verifiedName: phone.verifiedName,
                                isActive: true,
                            },
                            create: {
                                metaConnectionId: savedMetaConnection.id,
                                phoneNumberId: phone.id,
                                phoneNumber: phone.displayPhoneNumber.replace(/\D/g, ''),
                                displayName: phone.verifiedName || phone.displayPhoneNumber,
                                qualityRating: phone.qualityRating,
                                verifiedName: phone.verifiedName,
                                isActive: true,
                                isPrimary: phone.id === primaryPhone.id,
                            },
                        });
                    }
                    console.log('✅ PhoneNumbers saved');
                }
            }
            catch (e) {
                console.warn('⚠️ PhoneNumber save failed:', e.message);
            }
            onProgress?.({
                step: 'COMPLETED',
                status: 'completed',
                message: 'WhatsApp account connected!',
            });
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
    /**
     * ✅ FIX: now delegates to the shared getAccountWithDecryptedToken() helper.
     * This is the SAME helper used by whatsapp.service.ts for message sending,
     * so both agree on account/token state. If a token can't be decrypted, both
     * see the account as unusable (DB is auto-marked DISCONNECTED by the helper).
     */
    async getAccountWithToken(accountId) {
        return (0, tokenDecryption_1.getAccountWithDecryptedToken)(accountId);
    }
    async disconnectAccount(accountId, organizationId) {
        console.log(`🔌 Disconnecting account: ${accountId}`);
        const account = await database_1.default.whatsAppAccount.findFirst({
            where: {
                id: accountId,
                organizationId,
            },
        });
        if (!account) {
            console.log(`ℹ️  Account not found or already disconnected: ${accountId}`);
            return {
                success: true,
                message: 'Account already disconnected (not found)',
            };
        }
        if (account.status === client_1.WhatsAppAccountStatus.DISCONNECTED && !account.accessToken) {
            console.log(`ℹ️  Account already disconnected: ${accountId}`);
            return {
                success: true,
                message: 'Account already disconnected',
            };
        }
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
    // TEMPLATE SYNC (unchanged)
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
        let metaTemplates = [];
        try {
            metaTemplates = await meta_api_1.metaApi.getTemplates(account.wabaId, accessToken);
            console.log(`📥 Fetched ${metaTemplates.length} templates from Meta`);
        }
        catch (error) {
            console.error(`❌ Template sync API call failed for account ${accountId}:`, error.message);
            const isTokenError = error.message?.includes('token') ||
                error.message?.includes('OAuth') ||
                error.status === 401 ||
                error.status === 403 ||
                error.message?.includes('190') ||
                error.message?.includes('133010') ||
                error.message?.includes('not registered');
            if (isTokenError) {
                console.warn(`⚠️ Deactivating broken account ${accountId} due to template sync API error`);
                await database_1.default.whatsAppAccount.update({
                    where: { id: accountId },
                    data: {
                        status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                        accessToken: null,
                    },
                }).catch((e) => console.error('Failed to disconnect account in template sync error path:', e));
            }
            throw error;
        }
        const existingTemplates = await database_1.default.template.findMany({
            where: {
                whatsappAccountId: accountId,
            },
            select: {
                id: true,
                name: true,
                language: true,
                metaTemplateId: true,
                headerMediaId: true,
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
                const key = `${metaTemplate.name}_${metaTemplate.language}`;
                if (status === 'DRAFT' || status === 'REJECTED') {
                    metaKeys.add(key);
                    skipped++;
                    continue;
                }
                metaKeys.add(key);
                const existing = existingMap.get(key);
                const extractedHeaderHandle = this.extractHeaderHandle(metaTemplate.components);
                const baseTemplateData = {
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
                let dbTemplate;
                if (existing) {
                    const updateData = { ...baseTemplateData };
                    if (existing.headerMediaId) {
                        delete updateData.headerMediaId;
                    }
                    else if (extractedHeaderHandle) {
                        updateData.headerMediaId = extractedHeaderHandle;
                    }
                    dbTemplate = await database_1.default.template.update({
                        where: { id: existing.id },
                        data: updateData,
                    });
                    updated++;
                }
                else {
                    if (extractedHeaderHandle) {
                        baseTemplateData.headerMediaId = extractedHeaderHandle;
                    }
                    dbTemplate = await database_1.default.template.create({ data: baseTemplateData });
                    created++;
                }
                // ✅ Automatically resolve media to Cloudinary if it's a Meta CDN URL
                if (dbTemplate && dbTemplate.headerContent?.includes('scontent.whatsapp')) {
                    await (0, templateMediaResolver_1.resolveTemplateHeaderMedia)(dbTemplate).catch((err) => {
                        console.error(`Failed to resolve template media in syncTemplates:`, err.message);
                    });
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
                    const extractedHandle = this.extractHeaderHandle(template.components);
                    const baseData = {
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
                    let dbTemplate;
                    if (existing) {
                        const updateData = { ...baseData };
                        if (existing.headerMediaId) {
                            delete updateData.headerMediaId;
                        }
                        else if (extractedHandle) {
                            updateData.headerMediaId = extractedHandle;
                        }
                        dbTemplate = await database_1.default.template.update({
                            where: { id: existing.id },
                            data: updateData,
                        });
                    }
                    else {
                        if (extractedHandle)
                            baseData.headerMediaId = extractedHandle;
                        dbTemplate = await database_1.default.template.create({ data: baseData });
                    }
                    // ✅ Automatically resolve media to Cloudinary if it's a Meta CDN URL
                    if (dbTemplate && dbTemplate.headerContent?.includes('scontent.whatsapp')) {
                        await (0, templateMediaResolver_1.resolveTemplateHeaderMedia)(dbTemplate).catch((err) => {
                            console.error(`Failed to resolve template media in syncTemplatesBackground:`, err.message);
                        });
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
            const isTokenError = error.message?.includes('token') ||
                error.message?.includes('OAuth') ||
                error.status === 401 ||
                error.status === 403 ||
                error.message?.includes('190') ||
                error.message?.includes('133010') ||
                error.message?.includes('not registered');
            if (isTokenError) {
                console.warn(`⚠️ Deactivating broken account ${accountId} due to background sync API error`);
                await database_1.default.whatsAppAccount.update({
                    where: { id: accountId },
                    data: {
                        status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                        accessToken: null,
                    },
                }).catch((e) => console.error('Failed to disconnect account in background sync error path:', e));
            }
        }
    }
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
        if (!header)
            return null;
        if (header.text)
            return header.text;
        if (header.example) {
            const ex = header.example;
            return ex.header_url?.[0] || ex.header_handle?.[0] || ex.header_text?.[0] || null;
        }
        return null;
    }
    extractHeaderHandle(components) {
        if (!Array.isArray(components))
            return null;
        const header = components.find((c) => c.type === 'HEADER');
        if (!header || !header.example)
            return null;
        const handle = header.example?.header_handle?.[0];
        if (handle && /^\d+$/.test(handle)) {
            return handle;
        }
        return null;
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
                    matches.forEach((match) => {
                        const index = parseInt(match.replace(/[^\d]/g, ''));
                        variables.push({
                            index,
                            type: 'body',
                            placeholder: match,
                        });
                    });
                }
            }
            else if (component.type === 'HEADER' && (component.text || component.format === 'TEXT')) {
                const text = component.text || '';
                const matches = text.match(/\{\{(\d+)\}\}/g);
                if (matches) {
                    matches.forEach((match) => {
                        const index = parseInt(match.replace(/[^\d]/g, ''));
                        variables.push({
                            index,
                            type: 'header',
                            placeholder: match,
                        });
                    });
                }
            }
            else if (component.type === 'BUTTONS' && Array.isArray(component.buttons)) {
                component.buttons.forEach((btn, btnIndex) => {
                    if (btn.type === 'URL' && btn.url) {
                        const matches = btn.url.match(/\{\{(\d+)\}\}/g);
                        if (matches) {
                            matches.forEach((match) => {
                                const varIndex = parseInt(match.replace(/[^\d]/g, ''));
                                variables.push({
                                    index: varIndex,
                                    type: 'button',
                                    buttonIndex: btnIndex,
                                    placeholder: match,
                                });
                            });
                        }
                    }
                });
            }
        }
        return variables;
    }
}
exports.MetaService = MetaService;
exports.metaService = new MetaService();
exports.default = exports.metaService;
//# sourceMappingURL=meta.service.js.map