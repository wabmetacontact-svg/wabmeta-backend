"use strict";
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
exports.whatsappController = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../../config/database"));
const whatsapp_service_1 = require("./whatsapp.service");
const response_1 = require("../../utils/response");
// ============================================
// HELPER FUNCTIONS
// ============================================
const getOrgId = (req) => {
    const headerOrg = (req.header('X-Organization-Id') || req.header('x-organization-id'))?.trim() || '';
    const queryOrg = (typeof req.query.organizationId === 'string' ? req.query.organizationId : '')?.trim() || '';
    const userOrg = req.user?.organizationId?.trim?.() || '';
    return headerOrg || queryOrg || userOrg || null;
};
const sanitizeAccount = (account) => {
    const { accessToken, webhookSecret, ...safe } = account;
    return { ...safe, hasAccessToken: !!accessToken };
};
const verifyOrgAccess = async (userId, organizationId) => {
    const member = await database_1.default.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
    });
    return !!member;
};
// ============================================
// WHATSAPP CONTROLLER CLASS
// ============================================
class WhatsAppController {
    // ============================================
    // ACCOUNT MANAGEMENT
    // ============================================
    // ✅ GET /api/v1/whatsapp/accounts
    async getAccounts(req, res, next) {
        try {
            const organizationId = getOrgId(req);
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            }
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            const accounts = await database_1.default.whatsAppAccount.findMany({
                where: { organizationId },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
            return (0, response_1.successResponse)(res, {
                data: accounts.map(sanitizeAccount),
                message: 'WhatsApp accounts retrieved',
            });
        }
        catch (e) {
            next(e);
        }
    }
    // ✅ GET /api/v1/whatsapp/accounts/:accountId
    async getAccount(req, res, next) {
        try {
            const organizationId = getOrgId(req);
            const accountId = req.params.accountId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            }
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { id: accountId, organizationId },
            });
            if (!account) {
                return (0, response_1.errorResponse)(res, 'Account not found', 404);
            }
            return (0, response_1.successResponse)(res, {
                data: sanitizeAccount(account),
                message: 'WhatsApp account retrieved',
            });
        }
        catch (e) {
            next(e);
        }
    }
    // ✅ POST /api/v1/whatsapp/accounts/:accountId/default
    async setDefaultAccount(req, res, next) {
        try {
            const organizationId = getOrgId(req);
            const accountId = req.params.accountId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            }
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { id: accountId, organizationId },
            });
            if (!account) {
                return (0, response_1.errorResponse)(res, 'Account not found', 404);
            }
            await database_1.default.whatsAppAccount.updateMany({
                where: { organizationId },
                data: { isDefault: false },
            });
            const updated = await database_1.default.whatsAppAccount.update({
                where: { id: accountId },
                data: { isDefault: true },
            });
            return (0, response_1.successResponse)(res, {
                data: sanitizeAccount(updated),
                message: 'Default WhatsApp account updated',
            });
        }
        catch (e) {
            next(e);
        }
    }
    // ✅ DELETE /api/v1/whatsapp/accounts/:accountId
    async disconnectAccount(req, res, next) {
        try {
            const organizationId = getOrgId(req);
            const accountId = req.params.accountId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            }
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { id: accountId, organizationId },
            });
            if (!account) {
                return (0, response_1.errorResponse)(res, 'Account not found', 404);
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
            // ✅ Emit socket event for real-time update
            const { webhookEvents } = await Promise.resolve().then(() => __importStar(require('../webhooks/webhook.service')));
            webhookEvents.emit('accountUpdated', {
                organizationId,
                accountId,
                status: client_1.WhatsAppAccountStatus.DISCONNECTED,
            });
            if (account.isDefault) {
                const another = await database_1.default.whatsAppAccount.findFirst({
                    where: {
                        organizationId,
                        id: { not: accountId },
                        status: client_1.WhatsAppAccountStatus.CONNECTED,
                    },
                    orderBy: { createdAt: 'desc' },
                });
                if (another) {
                    await database_1.default.whatsAppAccount.update({
                        where: { id: another.id },
                        data: { isDefault: true },
                    });
                }
            }
            return (0, response_1.successResponse)(res, {
                message: 'WhatsApp account disconnected successfully',
            });
        }
        catch (e) {
            next(e);
        }
    }
    // ============================================
    // MESSAGE SENDING APIs - ✅ FIXED
    // ============================================
    /**
     * ✅ FIXED: Send Text Message
     */
    async sendText(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            const { whatsappAccountId, accountId, // support both
            to, recipient, // support both
            phone, // support both
            message, text, // support both
            content, // support both
            tempId, // ✅ Frontend se aata hai
            localId, conversationId } = req.body;
            const finalAccountId = whatsappAccountId || accountId;
            const finalTo = to || recipient || phone;
            const finalMessage = message || text || content;
            const finalTempId = tempId || localId;
            if (!finalAccountId || !finalTo || !finalMessage) {
                return (0, response_1.errorResponse)(res, 'whatsappAccountId, to, and message are required', 400);
            }
            const result = await whatsapp_service_1.whatsappService.sendMessage({
                accountId: finalAccountId,
                to: finalTo,
                type: 'text',
                content: { text: { body: finalMessage } },
                conversationId,
                organizationId,
                tempId: finalTempId, // ✅ Pass tempId
            });
            // ✅ Serialize response
            const msg = result.message;
            const now = new Date().toISOString();
            return (0, response_1.successResponse)(res, {
                data: {
                    ...msg,
                    // ✅ Guarantee timestamps as strings
                    createdAt: msg?.createdAt instanceof Date
                        ? msg.createdAt.toISOString()
                        : msg?.createdAt || now,
                    sentAt: msg?.sentAt instanceof Date
                        ? msg.sentAt.toISOString()
                        : msg?.sentAt || now,
                    timestamp: msg?.timestamp instanceof Date
                        ? msg.timestamp.toISOString()
                        : msg?.timestamp || msg?.createdAt || now,
                },
                message: 'Message sent'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * ✅ FIXED: Send Template Message
     * Accepts multiple field name formats for flexibility
     */
    async sendTemplate(req, res) {
        try {
            const { whatsappAccountId, to, templateName, language, parameters, conversationId, tempId, clientMsgId } = req.body;
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const result = await whatsapp_service_1.whatsappService.sendTemplateMessage({
                organizationId,
                accountId: whatsappAccountId,
                to,
                templateName,
                templateLanguage: language,
                components: parameters,
                conversationId,
                tempId: tempId || req.body.localId,
                clientMsgId: clientMsgId || req.body.client_msg_id
            });
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Template message sent'
            });
        }
        catch (error) {
            console.error('Send template error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Failed to send template', 500);
        }
    }
    /**
     * ✅ FIXED: Send Media Message
     * Accepts multiple field name formats for flexibility
     */
    async sendMedia(req, res, next) {
        try {
            // ✅ Support multiple field name formats
            const accountId = req.body.accountId || req.body.whatsappAccountId;
            const to = req.body.to || req.body.recipient || req.body.phone;
            const mediaType = req.body.mediaType || req.body.media_type || req.body.type;
            const mediaUrl = req.body.mediaUrl || req.body.media_url || req.body.url;
            const caption = req.body.caption || req.body.text || '';
            const conversationId = req.body.conversationId;
            // Log incoming request
            console.log('🖼️ Send Media Request:', {
                accountId: accountId ? `${accountId.substring(0, 8)}...` : null,
                to: to ? `${to.substring(0, 6)}***` : null,
                mediaType,
                mediaUrl: mediaUrl ? `${mediaUrl.substring(0, 30)}...` : null,
                hasCaption: !!caption,
                hasConversationId: !!conversationId,
            });
            // Validate accountId
            if (!accountId) {
                return (0, response_1.errorResponse)(res, 'Account ID is required. Send as "accountId" or "whatsappAccountId"', 400);
            }
            // Validate recipient
            if (!to) {
                return (0, response_1.errorResponse)(res, 'Recipient phone number is required. Send as "to", "recipient", or "phone"', 400);
            }
            // Validate media type
            const validMediaTypes = ['image', 'video', 'audio', 'document'];
            if (!mediaType || !validMediaTypes.includes(mediaType.toLowerCase())) {
                return (0, response_1.errorResponse)(res, `Media type is required and must be one of: ${validMediaTypes.join(', ')}`, 400);
            }
            // Validate media URL
            if (!mediaUrl) {
                return (0, response_1.errorResponse)(res, 'Media URL is required. Send as "mediaUrl", "media_url", or "url"', 400);
            }
            // Send media via service
            const result = await whatsapp_service_1.whatsappService.sendMediaMessage(accountId, to, mediaType.toLowerCase(), mediaUrl, caption, conversationId, req.user?.organizationId, req.body.tempId || req.body.localId, req.body.clientMsgId || req.body.client_msg_id);
            console.log('✅ Media message sent successfully:', {
                messageId: result?.messageId || 'N/A',
            });
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Media message sent successfully',
            });
        }
        catch (error) {
            console.error('❌ Send media error:', {
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 3),
            });
            return (0, response_1.errorResponse)(res, error.message || 'Failed to send media', 400);
        }
    }
    /**
     * ✅ FIXED: Mark Message as Read
     */
    async markAsRead(req, res, next) {
        try {
            // Support multiple field name formats
            const accountId = req.body.accountId || req.body.whatsappAccountId;
            const messageId = req.body.messageId || req.body.message_id || req.body.wamId;
            console.log('👁️ Mark as Read Request:', {
                accountId: accountId ? `${accountId.substring(0, 8)}...` : null,
                messageId,
            });
            if (!accountId) {
                return (0, response_1.errorResponse)(res, 'Account ID is required. Send as "accountId" or "whatsappAccountId"', 400);
            }
            if (!messageId) {
                return (0, response_1.errorResponse)(res, 'Message ID is required. Send as "messageId", "message_id", or "wamId"', 400);
            }
            const result = await whatsapp_service_1.whatsappService.markAsRead(accountId, messageId);
            return (0, response_1.successResponse)(res, {
                data: result,
                message: 'Message marked as read',
            });
        }
        catch (error) {
            console.error('❌ Mark as read error:', error.message);
            next(error);
        }
    }
    // ============================================
    // QUALITY RATING SYNC ENDPOINTS (NEW)
    // ============================================
    /**
     * POST /api/v1/whatsapp/accounts/:accountId/sync-quality
     * Single account ka quality rating refresh karo
     */
    async syncAccountQuality(req, res, next) {
        try {
            const organizationId = getOrgId(req);
            const accountId = req.params.accountId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            }
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            // Verify account belongs to org
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { id: accountId, organizationId },
            });
            if (!account) {
                return (0, response_1.errorResponse)(res, 'Account not found', 404);
            }
            const result = await whatsapp_service_1.whatsappService.syncAccountQuality(accountId);
            if (!result.success) {
                return (0, response_1.errorResponse)(res, result.error || 'Failed to sync quality rating', 500);
            }
            return (0, response_1.successResponse)(res, {
                data: sanitizeAccount(result.account),
                message: 'Quality rating synced successfully',
            });
        }
        catch (e) {
            next(e);
        }
    }
    /**
     * POST /api/v1/whatsapp/accounts/sync-all
     * Saare accounts ka quality rating refresh karo
     */
    async syncAllAccountsQuality(req, res, next) {
        try {
            const organizationId = getOrgId(req);
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'X-Organization-Id missing', 400);
            }
            const ok = await verifyOrgAccess(req.user.id, organizationId);
            if (!ok) {
                return (0, response_1.errorResponse)(res, 'Unauthorized', 403);
            }
            const result = await whatsapp_service_1.whatsappService.syncAllAccountsQuality(organizationId);
            // Updated accounts return karo
            const accounts = await database_1.default.whatsAppAccount.findMany({
                where: { organizationId },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
            return (0, response_1.successResponse)(res, {
                data: {
                    accounts: accounts.map(sanitizeAccount),
                    syncStats: result,
                },
                message: `Synced ${result.synced}/${result.total} accounts`,
            });
        }
        catch (e) {
            next(e);
        }
    }
}
// ============================================
// EXPORT
// ============================================
exports.whatsappController = new WhatsAppController();
exports.default = exports.whatsappController;
//# sourceMappingURL=whatsapp.controller.js.map