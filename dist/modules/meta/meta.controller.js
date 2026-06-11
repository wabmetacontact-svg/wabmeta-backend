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
// Helper to safely get organization ID from headers
const getOrgId = (req) => {
    const header = req.headers['x-organization-id'];
    if (!header)
        return '';
    return Array.isArray(header) ? header[0] : header;
};
class MetaController {
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
}
exports.MetaController = MetaController;
exports.metaController = new MetaController();
exports.default = exports.metaController;
//# sourceMappingURL=meta.controller.js.map