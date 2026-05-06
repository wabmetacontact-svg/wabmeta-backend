"use strict";
// 📁 src/modules/meta/meta.controller.ts - COMPLETE FINAL VERSION
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaController = exports.MetaController = void 0;
const errorHandler_1 = require("../../middleware/errorHandler");
const response_1 = require("../../utils/response");
const database_1 = __importDefault(require("../../config/database"));
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../config");
const templates_service_1 = require("../templates/templates.service");
const meta_api_1 = require("./meta.api");
const encryption_1 = require("../../utils/encryption");
const meta_service_1 = require("./meta.service");
// Helper to safely get organization ID from headers
const getOrgId = (req) => {
    const header = req.headers['x-organization-id'];
    if (!header)
        return '';
    return Array.isArray(header) ? header[0] : header;
};
class MetaController {
    // ============================================
    // GET OAUTH URL (Initiate Connection)
    // ============================================
    async getOAuthUrl(req, res, next) {
        try {
            // Multiple sources for organization ID
            const organizationId = req.query.organizationId ||
                req.body.organizationId ||
                req.user?.organizationId;
            // Detailed logging
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔍 Meta OAuth URL Request');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('Query params:', req.query);
            console.log('Body:', req.body);
            console.log('User:', req.user?.id);
            console.log('Organization ID:', organizationId);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            if (!organizationId) {
                console.error('❌ No organization ID provided');
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            // Verify organization exists
            const organization = await database_1.default.organization.findUnique({
                where: { id: organizationId },
            });
            if (!organization) {
                console.error('❌ Organization not found:', organizationId);
                throw new errorHandler_1.AppError('Organization not found', 404);
            }
            console.log('✅ Organization found:', organization.name);
            // Verify user permissions
            const userId = req.user?.id;
            if (userId) {
                const membership = await database_1.default.organizationMember.findFirst({
                    where: {
                        organizationId,
                        userId,
                        role: { in: ['OWNER', 'ADMIN'] },
                    },
                });
                if (!membership) {
                    throw new errorHandler_1.AppError('You do not have permission to connect WhatsApp', 403);
                }
            }
            // Generate secure state
            const state = `${organizationId}:${crypto_1.default.randomBytes(32).toString('hex')}`;
            // Save state with expiry (10 minutes)
            await database_1.default.oAuthState.create({
                data: {
                    state,
                    organizationId,
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                },
            });
            // Clean up expired states
            await database_1.default.oAuthState.deleteMany({
                where: {
                    expiresAt: { lt: new Date() },
                },
            });
            console.log('✅ OAuth state created');
            // Build Meta Embedded Signup URL
            const metaAuthUrl = new URL(`https://www.facebook.com/${config_1.config.meta.graphApiVersion}/dialog/oauth`);
            metaAuthUrl.searchParams.set('client_id', process.env.META_APP_ID);
            metaAuthUrl.searchParams.set('config_id', process.env.META_CONFIG_ID);
            metaAuthUrl.searchParams.set('state', state);
            metaAuthUrl.searchParams.set('response_type', 'code');
            metaAuthUrl.searchParams.set('override_default_response_type', 'true');
            // Embedded Signup specific params
            metaAuthUrl.searchParams.set('auth_type', '');
            metaAuthUrl.searchParams.set('display', 'popup');
            // Extras for Embedded Signup v3
            const extras = JSON.stringify({
                featureType: 'whatsapp_business_app_onboarding',
                sessionInfoVersion: '3',
                version: 'v3',
                partner_data: null,
                is_hosted_es: true,
            });
            metaAuthUrl.searchParams.set('extras', extras);
            // Redirect URIs
            const redirectUri = `${process.env.FRONTEND_URL}/meta/callback`;
            const fallbackRedirectUri = `https://business.facebook.com/messaging/hosted_es/oauth_callback/?app_id=${process.env.META_APP_ID}&config_id=${process.env.META_CONFIG_ID}&extras=${encodeURIComponent(extras)}`;
            metaAuthUrl.searchParams.set('redirect_uri', redirectUri);
            metaAuthUrl.searchParams.set('fallback_redirect_uri', fallbackRedirectUri);
            // Scopes
            metaAuthUrl.searchParams.set('scope', 'whatsapp_business_management,whatsapp_business_messaging,business_management');
            console.log('✅ OAuth URL generated');
            return (0, response_1.sendSuccess)(res, {
                url: metaAuthUrl.toString(),
                authUrl: metaAuthUrl.toString(), // For compatibility
                state,
            }, 'OAuth URL generated');
        }
        catch (error) {
            console.error('❌ getOAuthUrl failed:', error);
            next(error);
        }
    }
    // Alias for getOAuthUrl
    async initiateConnection(req, res, next) {
        return this.getOAuthUrl(req, res, next);
    }
    async getAuthUrl(req, res, next) {
        return this.getOAuthUrl(req, res, next);
    }
    // ============================================
    // HANDLE CALLBACK (Complete Connection)
    // ============================================
    async handleCallback(req, res, next) {
        try {
            const { code, state } = req.body;
            console.log('\n🔄 ========== META CALLBACK ==========');
            console.log('   Code:', code ? `${code.substring(0, 10)}...` : 'Missing');
            console.log('   State:', state ? `${state.substring(0, 20)}...` : 'Missing');
            if (!code) {
                throw new errorHandler_1.AppError('Authorization code is required', 400);
            }
            if (!state) {
                throw new errorHandler_1.AppError('State parameter is required', 400);
            }
            // Verify state
            const oauthState = await database_1.default.oAuthState.findUnique({
                where: { state },
            });
            if (!oauthState) {
                console.error('❌ Invalid state token');
                throw new errorHandler_1.AppError('Invalid or expired state token', 400);
            }
            if (oauthState.expiresAt < new Date()) {
                await database_1.default.oAuthState.delete({ where: { state } });
                console.error('❌ State token expired');
                throw new errorHandler_1.AppError('State token expired. Please try again.', 400);
            }
            const organizationId = oauthState.organizationId;
            console.log('   Organization ID:', organizationId);
            // Verify user permissions
            const userId = req.user?.id;
            if (userId) {
                const membership = await database_1.default.organizationMember.findFirst({
                    where: {
                        organizationId,
                        userId,
                        role: { in: ['OWNER', 'ADMIN'] },
                    },
                });
                if (!membership) {
                    throw new errorHandler_1.AppError('You do not have permission to connect WhatsApp', 403);
                }
            }
            console.log('📊 Step 1: Exchanging code for access token...');
            // Exchange code for access token
            const tokenResponse = await axios_1.default.get(`https://graph.facebook.com/${config_1.config.meta.graphApiVersion}/oauth/access_token`, {
                params: {
                    client_id: process.env.META_APP_ID,
                    client_secret: process.env.META_APP_SECRET,
                    code,
                    redirect_uri: `${process.env.FRONTEND_URL}/meta/callback`,
                },
            });
            const { access_token } = tokenResponse.data;
            console.log('   ✅ Access token obtained');
            console.log('📊 Step 2: Getting WABA ID from token...');
            // Get WABA ID from token debug
            const debugTokenResponse = await axios_1.default.get(`https://graph.facebook.com/${config_1.config.meta.graphApiVersion}/debug_token`, {
                params: {
                    input_token: access_token,
                    access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
                },
            });
            const wabaId = debugTokenResponse.data.data.granular_scopes?.find((s) => s.scope === 'whatsapp_business_management')?.target_ids?.[0];
            if (!wabaId) {
                console.error('❌ WABA ID not found in token');
                throw new errorHandler_1.AppError('WABA ID not found. Please complete the setup in Meta Business Suite.', 400);
            }
            console.log('   ✅ WABA ID:', wabaId);
            console.log('📊 Step 3: Fetching WABA details...');
            // Get WABA details
            const wabaDetails = await axios_1.default.get(`https://graph.facebook.com/${config_1.config.meta.graphApiVersion}/${wabaId}`, {
                params: {
                    fields: 'id,name,currency,timezone_id,message_template_namespace',
                    access_token,
                },
            });
            console.log('   ✅ WABA Name:', wabaDetails.data.name);
            console.log('📊 Step 4: Fetching phone numbers...');
            // Get phone numbers
            const phoneNumbersResponse = await axios_1.default.get(`https://graph.facebook.com/${config_1.config.meta.graphApiVersion}/${wabaId}/phone_numbers`, {
                params: {
                    access_token,
                },
            });
            const phoneNumbers = phoneNumbersResponse.data.data || [];
            console.log('   ✅ Phone numbers found:', phoneNumbers.length);
            if (phoneNumbers.length === 0) {
                console.warn('⚠️ No phone numbers found for WABA');
            }
            console.log('📊 Step 5: Saving to database...');
            // ============================================
            // STEP 5: SAVE TO DATABASE - ✅ FIXED VERSION
            // ============================================
            console.log('📊 Step 5: Saving to database...');
            let savedAccount = null;
            if (phoneNumbers.length > 0) {
                const primaryPhone = phoneNumbers[0];
                // Encrypt token
                const encryptedToken = (0, encryption_1.encrypt)(access_token);
                console.log('   Token encrypted successfully');
                try {
                    // ✅ CRITICAL FIX: Check if account already exists
                    const existingAccount = await database_1.default.whatsAppAccount.findFirst({
                        where: {
                            OR: [
                                { phoneNumberId: primaryPhone.id },
                                {
                                    organizationId,
                                    wabaId
                                }
                            ]
                        }
                    });
                    if (existingAccount) {
                        // ✅ UPDATE existing account
                        console.log(`   Updating existing account: ${existingAccount.id}`);
                        savedAccount = await database_1.default.whatsAppAccount.update({
                            where: { id: existingAccount.id },
                            data: {
                                organizationId, // ✅ CLAIM ownership (in case it moved orgs)
                                status: 'CONNECTED',
                                phoneNumber: primaryPhone.display_phone_number,
                                displayName: primaryPhone.verified_name || primaryPhone.display_phone_number,
                                verifiedName: primaryPhone.verified_name,
                                qualityRating: primaryPhone.quality_rating,
                                accessToken: encryptedToken,
                                wabaId: wabaId,
                                isDefault: true,
                            },
                        });
                        console.log('   ✅ WhatsAppAccount UPDATED:', savedAccount.id);
                    }
                    else {
                        // ✅ CREATE new account
                        console.log('   Creating new WhatsApp account...');
                        // First, unset any existing default
                        await database_1.default.whatsAppAccount.updateMany({
                            where: { organizationId, isDefault: true },
                            data: { isDefault: false }
                        });
                        savedAccount = await database_1.default.whatsAppAccount.create({
                            data: {
                                organizationId,
                                phoneNumberId: primaryPhone.id,
                                wabaId,
                                accessToken: encryptedToken,
                                phoneNumber: primaryPhone.display_phone_number,
                                displayName: primaryPhone.verified_name || primaryPhone.display_phone_number,
                                verifiedName: primaryPhone.verified_name,
                                qualityRating: primaryPhone.quality_rating,
                                status: 'CONNECTED',
                                isDefault: true,
                            },
                        });
                        console.log('   ✅ WhatsAppAccount CREATED:', savedAccount.id);
                    }
                    // ✅ VERIFY save was successful
                    const verifyAccount = await database_1.default.whatsAppAccount.findUnique({
                        where: { id: savedAccount.id }
                    });
                    if (!verifyAccount) {
                        throw new Error('Account verification failed - not found after save!');
                    }
                    console.log('   ✅ Account verified in database:', {
                        id: verifyAccount.id,
                        phone: verifyAccount.phoneNumber,
                        status: verifyAccount.status,
                    });
                }
                catch (dbError) {
                    console.error('   ❌ Database save error:', dbError);
                    console.error('   Error details:', {
                        code: dbError.code,
                        message: dbError.message,
                        meta: dbError.meta,
                    });
                    // ✅ If unique constraint violation, try to find and update
                    if (dbError.code === 'P2002') {
                        console.log('   🔄 Handling unique constraint - finding existing...');
                        const existing = await database_1.default.whatsAppAccount.findFirst({
                            where: { phoneNumberId: primaryPhone.id }
                        });
                        if (existing) {
                            savedAccount = await database_1.default.whatsAppAccount.update({
                                where: { id: existing.id },
                                data: {
                                    organizationId, // ✅ Update org ownership
                                    status: 'CONNECTED',
                                    accessToken: encryptedToken,
                                    wabaId,
                                    isDefault: true,
                                },
                            });
                            console.log('   ✅ Updated existing account:', savedAccount.id);
                        }
                        else {
                            throw dbError;
                        }
                    }
                    else {
                        throw dbError;
                    }
                }
            }
            // ✅ Also save/update MetaConnection
            let savedMetaConnection = null;
            try {
                const encryptedToken = (0, encryption_1.encrypt)(access_token);
                savedMetaConnection = await database_1.default.metaConnection.upsert({
                    where: { organizationId },
                    update: {
                        accessToken: encryptedToken,
                        wabaId,
                        wabaName: wabaDetails.data.name,
                        status: 'CONNECTED',
                        lastSyncedAt: new Date(),
                    },
                    create: {
                        organizationId,
                        accessToken: encryptedToken,
                        wabaId,
                        wabaName: wabaDetails.data.name,
                        status: 'CONNECTED',
                    },
                });
                console.log('   ✅ MetaConnection saved:', savedMetaConnection.id);
            }
            catch (e) {
                console.log('   ⚠️ MetaConnection save failed:', e.message);
            }
            // ✅ Save PhoneNumbers
            try {
                if (savedMetaConnection) {
                    for (const phone of phoneNumbers) {
                        await database_1.default.phoneNumber.upsert({
                            where: { phoneNumberId: phone.id },
                            update: {
                                phoneNumber: phone.display_phone_number,
                                displayName: phone.verified_name || phone.display_phone_number,
                                qualityRating: phone.quality_rating,
                                verifiedName: phone.verified_name,
                                isActive: true,
                            },
                            create: {
                                metaConnectionId: savedMetaConnection.id,
                                phoneNumberId: phone.id,
                                phoneNumber: phone.display_phone_number,
                                displayName: phone.verified_name || phone.display_phone_number,
                                qualityRating: phone.quality_rating,
                                verifiedName: phone.verified_name,
                                isActive: true,
                                isPrimary: phone.id === phoneNumbers[0].id,
                            },
                        });
                    }
                    console.log('   ✅ PhoneNumbers saved');
                }
            }
            catch (e) {
                console.log('   ⚠️ PhoneNumber save failed:', e.message);
            }
            // ✅ STEP 6: MANDATORY META ONBOARDING STEPS
            try {
                console.log('📊 Step 6: Completing Meta onboarding...');
                // ✅ 1. Subscribe to ALL required webhooks
                await meta_api_1.metaApi.subscribeToWebhooks(wabaId, access_token).catch(err => console.error('⚠️ Webhook subscription failed:', err.message));
                // ✅ 2. Subscribe to WBA Onboarding specific webhooks
                try {
                    await axios_1.default.post(`https://graph.facebook.com/${config_1.config.meta.graphApiVersion}/${wabaId}/subscribed_apps`, {
                        subscribed_fields: [
                            'messages',
                            'message_template_status_update',
                            'history', // ✅ NEW: Past messages
                            'smb_app_state_sync', // ✅ NEW: Business customer contacts
                            'smb_message_echoes', // ✅ NEW: New messages from WBA app
                        ]
                    }, {
                        params: { access_token }
                    });
                    console.log('✅ All webhooks subscribed including WBA onboarding fields');
                }
                catch (webhookErr) {
                    console.error('⚠️ Extended webhook subscription failed:', webhookErr.response?.data || webhookErr.message);
                }
                // ✅ 3. Register Phone Numbers
                for (const phone of phoneNumbers) {
                    await meta_api_1.metaApi.registerPhoneNumber(phone.id, access_token)
                        .catch(err => console.warn(`⚠️ Registration skipped:`, err.message));
                }
                // ✅ 4. Sync message history (WBA Onboarding - within 24 hours!)
                if (savedAccount) {
                    console.log('🔄 Initiating message history sync...');
                    syncMessageHistory(wabaId, access_token, organizationId, savedAccount.id)
                        .catch(err => console.error('⚠️ History sync failed:', err.message));
                }
            }
            catch (onboardingErr) {
                console.error('⚠️ Post-connection steps failed:', onboardingErr.message);
            }
            // Delete used state
            await database_1.default.oAuthState.delete({ where: { state } });
            console.log('✅ Meta callback successful');
            // After saving WhatsAppAccount, VERIFY it exists
            if (savedAccount) {
                // ✅ Verify save was successful
                const verifyAccount = await database_1.default.whatsAppAccount.findUnique({
                    where: { id: savedAccount.id },
                });
                if (!verifyAccount) {
                    console.error('❌ CRITICAL: Account save verification failed!');
                    throw new errorHandler_1.AppError('Failed to save WhatsApp account. Please try again.', 500);
                }
                console.log('✅ Account save verified:', verifyAccount.id);
                // ✅ FIXED: Longer delay for template sync
                setTimeout(async () => {
                    try {
                        console.log('🔄 Starting delayed template sync...');
                        // Wait extra time for any DB replication
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        const result = await templates_service_1.templatesService.syncFromMeta(organizationId, savedAccount.id);
                        console.log('✅ Template sync completed:', result);
                    }
                    catch (syncError) {
                        console.error('❌ Template sync error:', syncError.message);
                        // Non-critical, templates can be synced manually
                    }
                }, 5000); // Increased to 5 seconds
            }
            console.log('🔄 ========== META CALLBACK END ==========\n');
            return (0, response_1.sendSuccess)(res, {
                wabaId,
                wabaName: wabaDetails.data.name,
                phoneNumbers: phoneNumbers.map((p) => ({
                    id: p.id,
                    phoneNumber: p.display_phone_number,
                    displayName: p.verified_name,
                    qualityRating: p.quality_rating,
                })),
                phoneNumberCount: phoneNumbers.length,
                account: savedAccount,
            }, 'WhatsApp account connected successfully');
        }
        catch (error) {
            console.error('❌ Meta callback error:', error);
            // Provide specific error messages
            if (error.response?.data) {
                console.error('   Meta API Error:', error.response.data);
                const apiError = error.response.data.error;
                throw new errorHandler_1.AppError(apiError?.message || 'Meta API error', error.response.status || 500);
            }
            next(error);
        }
    }
    // ============================================
    // GET ACCOUNTS (OLD METHOD - WHATSAPPACCOUNT ONLY)
    // ============================================
    async getAccounts(req, res, next) {
        try {
            const organizationId = getOrgId(req) || req.query.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const orgIdString = Array.isArray(organizationId) ? organizationId[0] : organizationId;
            console.log('📋 Fetching accounts (old method) for org:', orgIdString);
            const accounts = await database_1.default.whatsAppAccount.findMany({
                where: { organizationId: orgIdString },
                orderBy: { createdAt: 'desc' },
            });
            console.log('   Found accounts:', accounts.length);
            return (0, response_1.sendSuccess)(res, accounts, 'Accounts fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // GET WHATSAPP ACCOUNTS (NEW METHOD - SUPPORTS BOTH STRUCTURES)
    // ============================================
    async getWhatsAppAccounts(req, res, next) {
        try {
            const { organizationId } = req.params;
            console.log('\n📋 Fetching WhatsApp accounts for org:', organizationId);
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            let accounts = [];
            // METHOD 1: Check MetaConnection + PhoneNumber (New structure)
            try {
                const metaConnection = await database_1.default.metaConnection.findUnique({
                    where: { organizationId },
                    include: {
                        phoneNumbers: {
                            where: { isActive: true },
                            orderBy: { isPrimary: 'desc' },
                        },
                    },
                });
                if (metaConnection && metaConnection.phoneNumbers && metaConnection.phoneNumbers.length > 0) {
                    console.log('✅ Found MetaConnection with phones:', metaConnection.phoneNumbers.length);
                    accounts = metaConnection.phoneNumbers.map((phone) => ({
                        id: phone.id,
                        phoneNumberId: phone.phoneNumberId,
                        phoneNumber: phone.phoneNumber,
                        displayName: phone.displayName,
                        verifiedName: phone.verifiedName,
                        qualityRating: phone.qualityRating,
                        isPrimary: phone.isPrimary,
                        isActive: phone.isActive,
                        wabaId: metaConnection.wabaId,
                        wabaName: metaConnection.wabaName,
                    }));
                    console.log('📤 Returning accounts from MetaConnection:', accounts.length);
                    return (0, response_1.sendSuccess)(res, accounts, 'Accounts fetched successfully');
                }
            }
            catch (e) {
                console.log('⚠️ MetaConnection check failed:', e.message);
            }
            // METHOD 2: Check WhatsAppAccount table (Fallback)
            console.log('⚠️ No MetaConnection found, checking WhatsAppAccount table...');
            const orgIdString = Array.isArray(organizationId) ? organizationId[0] : organizationId;
            const whatsappAccounts = await database_1.default.whatsAppAccount.findMany({
                where: {
                    organizationId: orgIdString,
                    status: 'CONNECTED'
                },
                orderBy: { createdAt: 'desc' },
            });
            if (whatsappAccounts.length > 0) {
                console.log('✅ Found WhatsAppAccounts:', whatsappAccounts.length);
                accounts = whatsappAccounts.map((acc) => ({
                    id: acc.id,
                    phoneNumberId: acc.phoneNumberId,
                    phoneNumber: acc.phoneNumber,
                    displayName: acc.displayName,
                    verifiedName: acc.verifiedName,
                    qualityRating: acc.qualityRating,
                    wabaId: acc.wabaId,
                    isActive: acc.status === 'CONNECTED',
                }));
            }
            console.log('📤 Returning accounts:', accounts.length);
            return (0, response_1.sendSuccess)(res, accounts, 'Accounts fetched successfully');
        }
        catch (error) {
            console.error('❌ Get WhatsApp accounts error:', error);
            next(error);
        }
    }
    // ============================================
    // GET CONNECTION STATUS
    // ============================================
    async getConnectionStatus(req, res, next) {
        try {
            const { organizationId } = req.params;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            console.log('🔍 Checking connection status for org:', organizationId);
            // Check MetaConnection
            let isConnected = false;
            let status = 'NOT_CONNECTED';
            let details = null;
            try {
                const metaConnection = await database_1.default.metaConnection.findUnique({
                    where: { organizationId },
                    include: {
                        phoneNumbers: {
                            where: { isActive: true },
                        },
                    },
                });
                if (metaConnection) {
                    isConnected = metaConnection.status === 'CONNECTED';
                    status = metaConnection.status;
                    details = {
                        wabaId: metaConnection.wabaId,
                        wabaName: metaConnection.wabaName,
                        phoneNumbers: metaConnection.phoneNumbers?.length || 0,
                        lastSyncedAt: metaConnection.lastSyncedAt,
                    };
                }
            }
            catch (e) {
                console.log('⚠️ MetaConnection not available, checking WhatsAppAccount');
            }
            // Fallback to WhatsAppAccount
            if (!isConnected) {
                const orgIdString = Array.isArray(organizationId) ? organizationId[0] : organizationId;
                const whatsappAccount = await database_1.default.whatsAppAccount.findFirst({
                    where: { organizationId: orgIdString, status: 'CONNECTED' },
                });
                if (whatsappAccount) {
                    isConnected = true;
                    status = 'CONNECTED';
                    details = {
                        wabaId: whatsappAccount.wabaId,
                        phoneNumber: whatsappAccount.phoneNumber,
                        displayName: whatsappAccount.displayName,
                    };
                }
            }
            return (0, response_1.sendSuccess)(res, {
                isConnected,
                status,
                ...details,
            }, 'Connection status fetched');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // GET SINGLE ACCOUNT
    // ============================================
    async getAccount(req, res, next) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const organizationId = getOrgId(req);
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { id, organizationId },
            });
            if (!account) {
                throw new errorHandler_1.AppError('Account not found', 404);
            }
            return (0, response_1.sendSuccess)(res, account, 'Account fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // DISCONNECT ACCOUNT
    // ============================================
    async disconnectAccount(req, res, next) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const organizationId = getOrgId(req);
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandler_1.AppError('Authentication required', 401);
            }
            const membership = await database_1.default.organizationMember.findFirst({
                where: {
                    organizationId,
                    userId,
                    role: { in: ['OWNER', 'ADMIN'] },
                },
            });
            if (!membership) {
                throw new errorHandler_1.AppError('You do not have permission to disconnect', 403);
            }
            await database_1.default.whatsAppAccount.update({
                where: { id },
                data: { status: 'DISCONNECTED' },
            });
            // Also disconnect MetaConnection if exists
            try {
                await database_1.default.metaConnection.update({
                    where: { organizationId },
                    data: { status: 'DISCONNECTED' },
                });
            }
            catch (e) {
                console.log('⚠️ MetaConnection not updated (may not exist)');
            }
            return (0, response_1.sendSuccess)(res, { success: true }, 'Account disconnected successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // GET EMBEDDED SIGNUP CONFIG
    // ============================================
    async getEmbeddedSignupConfig(req, res, next) {
        try {
            const config = {
                appId: process.env.META_APP_ID,
                configId: process.env.META_CONFIG_ID,
                version: 'v25.0',
                features: ['whatsapp_business_app_onboarding'],
            };
            return (0, response_1.sendSuccess)(res, config, 'Config fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // GET INTEGRATION STATUS
    // ============================================
    async getIntegrationStatus(req, res, next) {
        try {
            const status = {
                configured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
                appId: process.env.META_APP_ID,
                version: 'v25.0',
                embeddedSignup: true,
            };
            return (0, response_1.sendSuccess)(res, status, 'Integration status fetched');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // WEBHOOK VERIFICATION (META REQUIREMENT)
    // ============================================
    async verifyWebhook(req, res, next) {
        try {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];
            const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN;
            console.log('📞 Webhook verification request:', {
                mode,
                token: token ? '***' : 'missing',
                challenge: challenge ? 'present' : 'missing',
            });
            if (mode === 'subscribe' && token === verifyToken) {
                console.log('✅ Webhook verified successfully');
                res.status(200).send(challenge);
            }
            else {
                console.error('❌ Webhook verification failed');
                res.sendStatus(403);
            }
        }
        catch (error) {
            console.error('❌ Webhook verification error:', error);
            res.sendStatus(500);
        }
    }
    // ============================================
    // WEBHOOK HANDLER - ✅ COMPLETE WITH STATUS UPDATES
    // ============================================
    async handleWebhook(req, res) {
        try {
            const body = req.body;
            console.log('\n📨 ========== WEBHOOK RECEIVED ==========');
            console.log(JSON.stringify(body, null, 2));
            // Acknowledge receipt immediately (Meta requirement)
            res.sendStatus(200);
            // Process webhook asynchronously
            const entry = body?.entry;
            if (!Array.isArray(entry) || entry.length === 0) {
                console.warn('⚠️ Invalid webhook payload - no entries');
                return;
            }
            for (const item of entry) {
                const changes = item.changes || [];
                for (const change of changes) {
                    const field = change.field;
                    const value = change.value;
                    // ✅ HANDLE MESSAGE STATUS UPDATES
                    if (field === 'messages' && value.statuses && Array.isArray(value.statuses)) {
                        for (const statusUpdate of value.statuses) {
                            console.log('📦 STATUS UPDATE:', {
                                id: statusUpdate.id,
                                status: statusUpdate.status,
                                recipient_id: statusUpdate.recipient_id,
                                timestamp: statusUpdate.timestamp,
                                errors: statusUpdate.errors,
                            });
                            try {
                                // Map Meta status to our MessageStatus enum
                                let dbStatus = client_1.MessageStatus.SENT;
                                let deliveredAt;
                                let readAt;
                                let failedAt;
                                const metaStatus = statusUpdate.status;
                                const timestamp = new Date(Number(statusUpdate.timestamp) * 1000);
                                switch (metaStatus) {
                                    case 'sent':
                                        dbStatus = client_1.MessageStatus.SENT;
                                        break;
                                    case 'delivered':
                                        dbStatus = client_1.MessageStatus.DELIVERED;
                                        deliveredAt = timestamp;
                                        break;
                                    case 'read':
                                        dbStatus = client_1.MessageStatus.READ;
                                        readAt = timestamp;
                                        break;
                                    case 'failed':
                                        dbStatus = client_1.MessageStatus.FAILED;
                                        failedAt = timestamp;
                                        break;
                                    default:
                                        console.warn(`⚠️ Unknown status: ${metaStatus}`);
                                }
                                // Extract failure reason if failed
                                const failureReason = statusUpdate.errors?.[0]?.message || null;
                                // ✅ Update Message in DB
                                const updateData = {
                                    status: dbStatus,
                                };
                                if (deliveredAt)
                                    updateData.deliveredAt = deliveredAt;
                                if (readAt)
                                    updateData.readAt = readAt;
                                if (failedAt)
                                    updateData.failedAt = failedAt;
                                if (failureReason)
                                    updateData.failureReason = failureReason;
                                const updated = await database_1.default.message.updateMany({
                                    where: {
                                        OR: [
                                            { wamId: statusUpdate.id },
                                            { waMessageId: statusUpdate.id },
                                        ],
                                    },
                                    data: updateData,
                                });
                                if (updated.count > 0) {
                                    console.log(`✅ Updated ${updated.count} message(s) to status: ${dbStatus}`);
                                }
                                else {
                                    console.warn(`⚠️ No message found with ID: ${statusUpdate.id}`);
                                }
                                // ✅ Update CampaignContact status if this is a campaign message
                                if (updated.count > 0) {
                                    await database_1.default.campaignContact.updateMany({
                                        where: { waMessageId: statusUpdate.id },
                                        data: {
                                            status: dbStatus,
                                            deliveredAt,
                                            readAt,
                                            failedAt,
                                            failureReason,
                                        },
                                    });
                                }
                            }
                            catch (dbError) {
                                console.error('❌ DB update error:', dbError.message);
                            }
                        }
                    }
                    // ✅ HANDLE INCOMING MESSAGES
                    if (field === 'messages' && value.messages && Array.isArray(value.messages)) {
                        for (const message of value.messages) {
                            console.log('📩 INCOMING MESSAGE:', {
                                id: message.id,
                                from: message.from,
                                type: message.type,
                                timestamp: message.timestamp,
                            });
                            // TODO: Process incoming message
                            // This would create a new Message record with direction: INBOUND
                            // await this.processIncomingMessage(message, value.metadata);
                        }
                    }
                    // ✅ HANDLE TEMPLATE STATUS UPDATES
                    if (field === 'message_template_status_update') {
                        console.log('📋 TEMPLATE STATUS UPDATE:', {
                            messageTemplateId: value.message_template_id,
                            event: value.event,
                        });
                        // TODO: Update template status in DB
                        // await this.updateTemplateStatus(value);
                    }
                }
            }
            console.log('📨 ========== WEBHOOK PROCESSED ==========\n');
        }
        catch (error) {
            console.error('❌ Webhook processing error:', error);
            // Still return 200 to Meta to prevent retries
            res.sendStatus(200);
        }
    }
    // ============================================
    // COMPLETE CONNECTION
    // ============================================
    async completeConnection(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            const userId = req.user?.id; // Note: using id instead of userId based on AuthRequest interface
            if (!organizationId || !userId) {
                throw new errorHandler_1.AppError('Organization not found', 404);
            }
            const { code, accessToken, connectionType } = req.body; // ✅ Get connectionType
            const codeOrToken = accessToken || code;
            if (!codeOrToken) {
                throw new errorHandler_1.AppError('Authorization code or access token is required', 400);
            }
            // ✅ Pass connectionType to service
            const result = await meta_service_1.metaService.completeConnection(codeOrToken, organizationId, userId, connectionType || 'CLOUD_API' // Default to CLOUD_API
            );
            if (result.success) {
                return res.json({
                    success: true,
                    message: 'WhatsApp account connected successfully',
                    data: result.account
                });
            }
            else {
                throw new errorHandler_1.AppError(result.error || 'Failed to connect', 400);
            }
        }
        catch (error) {
            next(error);
        }
    }
}
exports.MetaController = MetaController;
// ✅ Message History Sync (WBA Onboarding requirement)
async function syncMessageHistory(wabaId, accessToken, organizationId, accountId) {
    try {
        console.log('📜 Starting message history sync for WABA:', wabaId);
        // Step 1: Request history sync
        const syncResponse = await axios_1.default.post(`https://graph.facebook.com/${config_1.config.meta.graphApiVersion}/${wabaId}/sync_history`, {}, { params: { access_token: accessToken } });
        console.log('✅ History sync initiated:', syncResponse.data);
        // Step 2: Update DB - mark sync as in progress
        await database_1.default.whatsAppAccount.update({
            where: { id: accountId },
            data: {
                // Store sync status in metadata or a field
                lastSyncedAt: new Date(),
            },
        });
    }
    catch (err) {
        // History sync failure is non-critical
        console.warn('⚠️ History sync failed (non-critical):', err.response?.data?.error?.message || err.message);
    }
}
exports.metaController = new MetaController();
exports.default = exports.metaController;
//# sourceMappingURL=meta.controller.js.map