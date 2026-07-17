"use strict";
// 📁 src/modules/meta/meta.routes.ts - COMPLETE FINAL VERSION
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const meta_controller_1 = require("./meta.controller");
const redis_1 = require("../../config/redis");
const redis = (0, redis_1.getRedis)();
const auth_1 = require("../../middleware/auth");
const meta_service_1 = require("./meta.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
const connectionLock_1 = require("../../middleware/connectionLock");
const config_1 = require("../../config");
const router = (0, express_1.Router)();
// ============================================
// PUBLIC ROUTES (Webhook) - BEFORE authenticate
// ============================================
/**
 * GET /webhook - Webhook verification
 */
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = config_1.config.meta.webhookVerifyToken;
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
});
const verifyMetaSignature = (req) => {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature)
        return false;
    const appSecret = config_1.config.meta.appSecret;
    if (!appSecret)
        return false;
    const rawBody = req.rawBody;
    if (!rawBody)
        return false;
    try {
        const expectedSig = `sha256=${crypto_1.default
            .createHmac('sha256', appSecret)
            .update(rawBody)
            .digest('hex')}`;
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSig);
        if (sigBuffer.length !== expectedBuffer.length) {
            return false;
        }
        return crypto_1.default.timingSafeEqual(sigBuffer, expectedBuffer);
    }
    catch {
        return false;
    }
};
/**
 * POST /webhook - Handle incoming webhook events
 */
router.post('/webhook', (req, res, next) => {
    if (!verifyMetaSignature(req)) {
        console.error('❌ Invalid webhook signature');
        return res.sendStatus(403);
    }
    next();
}, async (req, res) => {
    // ✅ STEP 1: Pehle 200 do (Meta requirement - 20 sec timeout)
    res.sendStatus(200);
    try {
        const body = req.body;
        const entry = body?.entry;
        if (!Array.isArray(entry) || entry.length === 0)
            return;
        for (const item of entry) {
            for (const change of (item.changes || [])) {
                const value = change.value;
                const field = change.field;
                // ✅ STEP 2: Message status updates
                if (field === 'messages' && value?.statuses) {
                    for (const statusUpdate of value.statuses) {
                        // ✅ Idempotency check
                        const dedupKey = `webhook:status:${statusUpdate.id}:${statusUpdate.status}`;
                        const alreadyProcessed = await redis.get(dedupKey);
                        if (alreadyProcessed) {
                            console.log(`⚠️ Duplicate webhook skipped: ${statusUpdate.id}`);
                            continue;
                        }
                        await redis.set(dedupKey, '1', 'EX', 86400);
                        await processStatusUpdate(statusUpdate);
                    }
                }
                // ✅ STEP 3: Incoming messages
                if (field === 'messages' && value?.messages) {
                    for (const message of value.messages) {
                        const dedupKey = `webhook:msg:${message.id}`;
                        const exists = await redis.get(dedupKey);
                        if (exists) {
                            console.log(`⚠️ Duplicate message skipped: ${message.id}`);
                            continue;
                        }
                        await redis.set(dedupKey, '1', 'EX', 86400);
                        await processIncomingMessage(message, value.metadata);
                    }
                }
                // ✅ STEP 4: Template status
                if (field === 'message_template_status_update') {
                    await processTemplateUpdate(value);
                }
            }
        }
    }
    catch (error) {
        console.error('❌ Webhook processing error:', error);
        // Already sent 200, so just log
    }
});
// ✅ Extract processors as separate functions
async function processStatusUpdate(statusUpdate) {
    const metaStatus = statusUpdate.status;
    const timestamp = new Date(Number(statusUpdate.timestamp) * 1000);
    const statusMap = {
        sent: { status: 'SENT' },
        delivered: { status: 'DELIVERED', deliveredAt: timestamp },
        read: { status: 'READ', readAt: timestamp },
        failed: {
            status: 'FAILED',
            failedAt: timestamp,
            failureReason: statusUpdate.errors?.[0]?.message || null
        }
    };
    const updateData = statusMap[metaStatus];
    if (!updateData)
        return;
    const updated = await database_1.default.message.updateMany({
        where: {
            OR: [
                { wamId: statusUpdate.id },
                { waMessageId: statusUpdate.id }
            ]
        },
        data: updateData
    });
    if (updated.count > 0) {
        // Campaign contact update
        await database_1.default.campaignContact.updateMany({
            where: { waMessageId: statusUpdate.id },
            data: updateData
        });
        // ✅ Socket emit for real-time UI update
        try {
            const { webhookEvents } = await Promise.resolve().then(() => __importStar(require('../webhooks/webhook.service')));
            webhookEvents.emit('messageStatusUpdated', {
                waMessageId: statusUpdate.id,
                status: updateData.status,
                deliveredAt: updateData.deliveredAt,
                readAt: updateData.readAt,
                failedAt: updateData.failedAt,
            });
        }
        catch (e) {
            console.warn('⚠️ Failed to emit messageStatusUpdated socket event:', e);
        }
        console.log(`✅ Status updated: ${statusUpdate.id} → ${updateData.status}`);
    }
}
async function processIncomingMessage(message, metadata) {
    console.log('📩 INCOMING MESSAGE:', {
        id: message.id,
        from: message.from,
        type: message.type,
        timestamp: message.timestamp,
    });
    // TODO: Process incoming message
}
async function processTemplateUpdate(value) {
    try {
        const metaTemplateId = value.message_template_id?.toString();
        if (metaTemplateId) {
            let templateStatus = 'PENDING';
            if (value.event === 'APPROVED')
                templateStatus = 'APPROVED';
            if (value.event === 'REJECTED')
                templateStatus = 'REJECTED';
            await database_1.default.template.updateMany({
                where: { metaTemplateId },
                data: {
                    status: templateStatus,
                    rejectionReason: value.reason || null,
                },
            });
            console.log(`✅ Template ${metaTemplateId} updated to ${templateStatus}`);
        }
    }
    catch (templateError) {
        console.error('❌ Template update error:', templateError.message);
    }
}
// ============================================
// ============================================
// PUBLIC OAUTH CALLBACKS
// These use state token verification instead of JWT
// ============================================
// /connect - Frontend FB.login Embedded Signup flow (NO state token)
router.post('/connect', auth_1.authenticate, connectionLock_1.checkConnectionLock, async (req, res, next) => {
    try {
        const { code, organizationId, wabaId, phoneNumberId } = req.body;
        const userId = req.user?.id;
        console.log('\n🔄 ========== META CONNECT (FB.login flow) ==========');
        console.log('   Code:', code ? `${code.substring(0, 10)}...` : 'Missing');
        console.log('   Organization ID:', organizationId);
        console.log('   User ID:', userId);
        console.log('   Session WABA ID:', wabaId || '(not provided — will lookup from token)');
        console.log('   Session Phone ID:', phoneNumberId || '(not provided — will lookup from WABA)');
        if (!code) {
            throw new errorHandler_1.AppError('Authorization code is required', 400);
        }
        if (!organizationId) {
            throw new errorHandler_1.AppError('Organization ID is required', 400);
        }
        if (!userId) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
        // Verify membership
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
        // Check single account limit
        const existingConnected = await database_1.default.whatsAppAccount.findFirst({
            where: { organizationId, status: 'CONNECTED' },
        });
        if (existingConnected) {
            throw new errorHandler_1.AppError(`Organization already has a connected WhatsApp account (${existingConnected.phoneNumber}). ` +
                `Please disconnect it first.`, 400);
        }
        // ✅ Use metaService.completeConnection with embeddedSignup=true
        // Pass wabaId + phoneNumberId from session info (if captured by frontend)
        const result = await meta_service_1.metaService.completeConnection(code, organizationId, userId, 'CLOUD_API', undefined, // no onProgress callback
        true, // embeddedSignup = true → skipRedirectUri during token exchange
        wabaId || undefined, // ✅ Session WABA ID from message event
        phoneNumberId || undefined // ✅ Session Phone Number ID from message event
        );
        if (result.success) {
            console.log('✅ FB.login connection successful');
            return (0, response_1.sendSuccess)(res, {
                account: result.account,
                warning: result.warning,
                message: result.message,
            }, 'WhatsApp connected successfully');
        }
        else {
            console.error('❌ FB.login connection failed:', result.error);
            throw new errorHandler_1.AppError(result.error || 'Connection failed', 400);
        }
    }
    catch (error) {
        console.error('❌ /connect error:', error);
        next(error);
    }
});
// ============================================
// PROTECTED ROUTES
// ============================================
router.use(auth_1.authenticate);
// ============================================
// OAUTH & CONNECTION ROUTES (Private - to generate URL)
// ============================================
// ============================================
// CONFIGURATION ROUTES
// ============================================
router.get('/config', meta_controller_1.metaController.getEmbeddedSignupConfig.bind(meta_controller_1.metaController));
router.get('/integration-status', meta_controller_1.metaController.getIntegrationStatus.bind(meta_controller_1.metaController));
// ============================================
// ORGANIZATION-BASED ROUTES
// ============================================
router.get('/organizations/:organizationId/accounts', async (req, res, next) => {
    try {
        const { organizationId } = req.params;
        const userId = req.user?.id;
        if (userId) {
            const membership = await database_1.default.organizationMember.findFirst({
                where: { organizationId, userId },
            });
            if (!membership)
                throw new errorHandler_1.AppError('You do not have access to this organization', 403);
        }
        const accounts = await meta_service_1.metaService.getAccounts(organizationId);
        return (0, response_1.sendSuccess)(res, {
            accounts,
            total: accounts.length,
            hasConnected: accounts.some((a) => a.status === 'CONNECTED'),
        }, 'Accounts fetched successfully');
    }
    catch (error) {
        next(error);
    }
});
router.get('/organizations/:organizationId/accounts/:accountId', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
        const userId = req.user?.id;
        if (userId) {
            const membership = await database_1.default.organizationMember.findFirst({
                where: { organizationId, userId },
            });
            if (!membership) {
                throw new errorHandler_1.AppError('You do not have access to this organization', 403);
            }
        }
        const account = await meta_service_1.metaService.getAccount(accountId, organizationId);
        return (0, response_1.sendSuccess)(res, account, 'Account fetched successfully');
    }
    catch (error) {
        next(error);
    }
});
router.delete('/organizations/:organizationId/accounts/:accountId', connectionLock_1.checkConnectionLock, async (req, res, next) => {
    try {
        const organizationId = req.params.organizationId;
        const accountId = req.params.accountId;
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
            throw new errorHandler_1.AppError('You do not have permission to disconnect accounts', 403);
        }
        console.log(`🔌 Disconnecting account ${accountId} from org ${organizationId}`);
        const result = await meta_service_1.metaService.disconnectAccount(accountId, organizationId);
        return (0, response_1.sendSuccess)(res, result, 'Account disconnected successfully');
    }
    catch (error) {
        next(error);
    }
});
router.post('/organizations/:organizationId/accounts/:accountId/default', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
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
            throw new errorHandler_1.AppError('You do not have permission to set default account', 403);
        }
        const result = await meta_service_1.metaService.setDefaultAccount(accountId, organizationId);
        return (0, response_1.sendSuccess)(res, result, 'Default account updated successfully');
    }
    catch (error) {
        next(error);
    }
});
router.post('/organizations/:organizationId/accounts/:accountId/sync-templates', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
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
            throw new errorHandler_1.AppError('You do not have permission to sync templates', 403);
        }
        const result = await meta_service_1.metaService.syncTemplates(accountId, organizationId);
        return (0, response_1.sendSuccess)(res, result, 'Templates synced successfully');
    }
    catch (error) {
        next(error);
    }
});
router.post('/organizations/:organizationId/accounts/:accountId/health', async (req, res, next) => {
    try {
        const { organizationId, accountId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
        const membership = await database_1.default.organizationMember.findFirst({
            where: { organizationId, userId },
        });
        if (!membership) {
            throw new errorHandler_1.AppError('You do not have access to this organization', 403);
        }
        const result = await meta_service_1.metaService.refreshAccountHealth(accountId, organizationId);
        return (0, response_1.sendSuccess)(res, result, 'Health check completed');
    }
    catch (error) {
        next(error);
    }
});
router.get('/organizations/:organizationId/status', async (req, res, next) => {
    try {
        const { organizationId } = req.params;
        const userId = req.user?.id;
        if (userId) {
            const membership = await database_1.default.organizationMember.findFirst({
                where: { organizationId, userId },
            });
            if (!membership) {
                throw new errorHandler_1.AppError('You do not have access to this organization', 403);
            }
        }
        const whatsappAccounts = await database_1.default.whatsAppAccount.findMany({
            where: { organizationId, status: 'CONNECTED' },
            select: {
                id: true,
                phoneNumber: true,
                displayName: true,
                isDefault: true,
                status: true,
                qualityRating: true,
                wabaId: true,
            },
        });
        let allAccounts = [...whatsappAccounts];
        let hasMetaConnection = false;
        try {
            const metaConnection = await database_1.default.metaConnection.findUnique({
                where: { organizationId },
                include: { phoneNumbers: { where: { isActive: true } } },
            });
            if (metaConnection && metaConnection.status === 'CONNECTED') {
                hasMetaConnection = true;
                if (metaConnection.phoneNumbers?.length > 0) {
                    const metaAccounts = metaConnection.phoneNumbers.map((phone) => ({
                        id: phone.id,
                        phoneNumber: phone.phoneNumber,
                        displayName: phone.displayName || phone.verifiedName,
                        isDefault: phone.isPrimary,
                        status: 'CONNECTED',
                        qualityRating: phone.qualityRating,
                        wabaId: metaConnection.wabaId,
                    }));
                    allAccounts = [...allAccounts, ...metaAccounts];
                }
            }
        }
        catch (e) {
            console.log('⚠️ MetaConnection table not available');
        }
        const status = allAccounts.length > 0 ? 'CONNECTED' : 'DISCONNECTED';
        return (0, response_1.sendSuccess)(res, {
            status,
            connectedCount: allAccounts.length,
            hasWhatsAppAccount: whatsappAccounts.length > 0,
            hasMetaConnection,
            accounts: allAccounts,
        }, 'Organization status fetched');
    }
    catch (error) {
        next(error);
    }
});
router.post('/organizations/:organizationId/sync', async (req, res, next) => {
    try {
        const { organizationId } = req.params;
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
            throw new errorHandler_1.AppError('You do not have permission to sync', 403);
        }
        const accounts = await database_1.default.whatsAppAccount.findMany({
            where: { organizationId, status: 'CONNECTED' },
        });
        const results = [];
        for (const account of accounts) {
            try {
                const result = await meta_service_1.metaService.syncTemplates(account.id, organizationId);
                results.push({
                    accountId: account.id,
                    phoneNumber: account.phoneNumber,
                    success: true,
                    ...result,
                });
            }
            catch (err) {
                results.push({
                    accountId: account.id,
                    phoneNumber: account.phoneNumber,
                    success: false,
                    error: err.message,
                });
            }
        }
        return (0, response_1.sendSuccess)(res, { results, total: results.length }, 'Sync completed');
    }
    catch (error) {
        next(error);
    }
});
router.delete('/organizations/:organizationId/disconnect', connectionLock_1.checkConnectionLock, async (req, res, next) => {
    try {
        const organizationId = req.params.organizationId;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
        const membership = await database_1.default.organizationMember.findFirst({
            where: { organizationId, userId, role: 'OWNER' },
        });
        if (!membership) {
            throw new errorHandler_1.AppError('Only organization owners can disconnect all accounts', 403);
        }
        const result = await database_1.default.whatsAppAccount.updateMany({
            where: { organizationId },
            data: { status: 'DISCONNECTED' },
        });
        try {
            await database_1.default.metaConnection.delete({ where: { organizationId } });
        }
        catch (e) {
            console.log('⚠️ No MetaConnection to delete');
        }
        return (0, response_1.sendSuccess)(res, { success: true, disconnectedCount: result.count }, 'All accounts disconnected successfully');
    }
    catch (error) {
        next(error);
    }
});
// ============================================
// HEADER-BASED ROUTES (Legacy)
// ============================================
router.get('/accounts', meta_controller_1.metaController.getAccounts.bind(meta_controller_1.metaController));
router.get('/accounts/:id', meta_controller_1.metaController.getAccount.bind(meta_controller_1.metaController));
router.delete('/accounts/:id', connectionLock_1.checkConnectionLock, meta_controller_1.metaController.disconnectAccount.bind(meta_controller_1.metaController));
// ✅ Also support POST /accounts/:id/disconnect (frontend uses this)
router.post('/accounts/:id/disconnect', connectionLock_1.checkConnectionLock, meta_controller_1.metaController.disconnectAccount.bind(meta_controller_1.metaController));
// ✅ Set default account shortcut (gets org from JWT context)
router.post('/accounts/:id/set-default', async (req, res, next) => {
    try {
        const { id: accountId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
        // Find account to get organizationId
        const account = await database_1.default.whatsAppAccount.findFirst({
            where: { id: accountId },
            include: {
                organization: {
                    include: {
                        members: { where: { userId, role: { in: ['OWNER', 'ADMIN'] } } }
                    }
                }
            },
        });
        if (!account) {
            throw new errorHandler_1.AppError('Account not found', 404);
        }
        const organizationId = account.organizationId;
        const membership = await database_1.default.organizationMember.findFirst({
            where: { organizationId, userId, role: { in: ['OWNER', 'ADMIN'] } },
        });
        if (!membership) {
            throw new errorHandler_1.AppError('You do not have permission to set default account', 403);
        }
        const result = await meta_service_1.metaService.setDefaultAccount(accountId, organizationId);
        return (0, response_1.sendSuccess)(res, result, 'Default account updated successfully');
    }
    catch (error) {
        next(error);
    }
});
// ============================================
// HEALTH CHECK
// ============================================
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'Meta Integration',
        version: config_1.config.meta.graphApiVersion,
        configured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
        embeddedSignup: !!process.env.META_CONFIG_ID,
        webhookConfigured: !!process.env.META_WEBHOOK_VERIFY_TOKEN,
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
//# sourceMappingURL=meta.routes.js.map