"use strict";
// 📁 src/modules/whatsapp/whatsapp.service.ts - COMPLETE FINAL VERSION
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
exports.whatsappService = void 0;
const client_1 = require("@prisma/client");
const meta_api_1 = require("../meta/meta.api");
const encryption_1 = require("../../utils/encryption");
const database_1 = __importDefault(require("../../config/database"));
const wallet_deduction_service_1 = require("../wallet/wallet.deduction.service");
// ============================================
// WHATSAPP SERVICE CLASS
// ============================================
class WhatsAppService {
    // ============================================
    // HELPER METHODS
    // ============================================
    /**
     * Check if a string looks like a Meta access token
     */
    looksLikeAccessToken(value) {
        if (!value || typeof value !== 'string')
            return false;
        return (value.startsWith('EAA') ||
            value.startsWith('EAAG') ||
            value.startsWith('EAAI'));
    }
    /**
     * Extract plain text content from message payload
     */
    extractMessageContent(type, content) {
        if (typeof content === 'string') {
            return content;
        }
        switch (type.toLowerCase()) {
            case 'text':
                if (content?.text?.body) {
                    return content.text.body;
                }
                if (content?.body) {
                    return content.body;
                }
                return JSON.stringify(content);
            case 'template':
                const templateName = content?.template?.name || 'Unknown Template';
                return `📋 Template: ${templateName}`;
            case 'image':
                const imageCaption = content?.image?.caption || '';
                return imageCaption || '📷 Image';
            case 'video':
                const videoCaption = content?.video?.caption || '';
                return videoCaption || '🎥 Video';
            case 'document':
                const docCaption = content?.document?.caption || '';
                const fileName = content?.document?.filename || '';
                return docCaption || fileName || '📄 Document';
            case 'audio':
                return '🎵 Audio';
            case 'location':
                const locationName = content?.location?.name || '';
                return locationName || '📍 Location';
            case 'sticker':
                return '🎭 Sticker';
            case 'contacts':
                return '👤 Contact';
            case 'interactive':
                return content?.interactive?.body?.text || 'Interactive message';
            default:
                return JSON.stringify(content);
        }
    }
    /**
     * Get account with safe token decryption
     */
    async getAccountWithToken(accountId) {
        const account = await database_1.default.whatsAppAccount.findUnique({
            where: { id: accountId },
            include: { organization: true },
        });
        if (!account) {
            console.error(`❌ Account not found: ${accountId}`);
            throw new Error('WhatsApp account not found');
        }
        if (account.status !== client_1.WhatsAppAccountStatus.CONNECTED) {
            console.error(`❌ Account not connected: ${accountId}, status: ${account.status}`);
            throw new Error('WhatsApp account is not connected');
        }
        if (!account.accessToken) {
            console.error(`❌ No access token for account: ${accountId}`);
            throw new Error('No access token found for this account');
        }
        console.log(`🔐 Decrypting token for account ${accountId}...`);
        let accessToken = null;
        try {
            if (this.looksLikeAccessToken(account.accessToken)) {
                console.log(`📝 Token is already plain text (starts with EAA)`);
                accessToken = account.accessToken;
            }
            else {
                console.log(`🔓 Attempting to decrypt token...`);
                accessToken = (0, encryption_1.safeDecrypt)(account.accessToken);
            }
        }
        catch (decryptError) {
            console.error(`❌ Decryption error:`, decryptError.message);
            throw new Error('Failed to decrypt access token. Please reconnect your WhatsApp account.');
        }
        if (!accessToken) {
            console.error(`❌ Token is null after decryption attempt`);
            throw new Error('Failed to decrypt access token. Please reconnect your WhatsApp account.');
        }
        if (!this.looksLikeAccessToken(accessToken)) {
            console.error(`❌ Decrypted token doesn't look like a Meta token`);
            console.warn('⚠️ Token format suspicious, attempting to use anyway...');
        }
        console.log(`✅ Token ready: ${(0, encryption_1.maskToken)(accessToken)}`);
        return { account, accessToken };
    }
    /**
     * Format phone number for WhatsApp API
     */
    formatPhoneNumber(phone) {
        const digits = phone.replace(/[^0-9]/g, '');
        if (digits.length <= 10 && !phone.startsWith('+')) {
            throw new Error(`Phone number ${phone} is missing a country code. Messages cannot be sent without a country code.`);
        }
        return digits;
    }
    /**
     * Get or create contact — always stores in canonical E.164 format: +919XXXXXXXXX
     */
    async getOrCreateContact(organizationId, phone) {
        const digits = phone.replace(/[^0-9]/g, '');
        const normalized = digits; // Meta always sends inbound phone with country code
        const canonical = `+${normalized}`; // +919340103340
        const withoutPlus = normalized; // 919340103340
        const tenDigit = normalized.slice(-10); // 9340103340
        let contact = await database_1.default.contact.findFirst({
            where: {
                organizationId,
                OR: [
                    { phone: canonical },
                    { phone: withoutPlus },
                    { phone: tenDigit },
                ],
            },
        });
        if (!contact) {
            contact = await database_1.default.contact.create({
                data: {
                    organizationId,
                    phone: canonical, // ✅ Always store canonical format
                    source: 'WHATSAPP',
                    firstName: 'Unknown',
                    status: 'ACTIVE',
                },
            });
            console.log(`👤 Created new contact: ${canonical}`);
        }
        else if (contact.phone !== canonical) {
            // ✅ Silent migration: update old-format phone to canonical
            await database_1.default.contact.update({
                where: { id: contact.id },
                data: { phone: canonical },
            }).catch(() => { });
            contact.phone = canonical;
            console.log(`🔄 Migrated contact phone → ${canonical}`);
        }
        return contact;
    }
    /**
     * Get or create conversation
     */
    async getOrCreateConversation(organizationId, contactId, phoneNumberId, // This is the Meta Phone ID
    messagePreview, existingConversationId) {
        let conversation = null;
        // 1. Try by ID if provided
        if (existingConversationId) {
            conversation = await database_1.default.conversation.findUnique({
                where: { id: existingConversationId },
            });
        }
        // 2. Fallback or primary check by Org + Contact
        if (!conversation) {
            conversation = await database_1.default.conversation.findUnique({
                where: {
                    organizationId_contactId: {
                        organizationId,
                        contactId,
                    },
                },
            });
        }
        if (!conversation) {
            try {
                conversation = await database_1.default.conversation.create({
                    data: {
                        organization: { connect: { id: organizationId } },
                        contact: { connect: { id: contactId } },
                        lastMessageAt: new Date(),
                        lastMessagePreview: messagePreview,
                        unreadCount: 0,
                        isWindowOpen: false, // ✅ Outbound-initiated: no inbound yet, window closed
                        isRead: true
                    },
                });
                console.log(`💬 Created new conversation: ${conversation.id}`);
            }
            catch (err) {
                // Double check if it was created in the meantime (race condition)
                conversation = await database_1.default.conversation.findUnique({
                    where: {
                        organizationId_contactId: { organizationId, contactId },
                    },
                });
                if (!conversation)
                    throw err;
            }
        }
        else {
            // ✅ Only update preview/time — do NOT touch isWindowOpen (preserve real state)
            if (messagePreview) {
                await database_1.default.conversation.update({
                    where: { id: conversation.id },
                    data: {
                        lastMessageAt: new Date(),
                        lastMessagePreview: messagePreview,
                        isRead: true,
                        unreadCount: 0,
                    },
                });
            }
        }
        return conversation;
    }
    /**
     * Map string type to MessageType enum
     */
    mapMessageType(type) {
        const map = {
            text: client_1.MessageType.TEXT,
            template: client_1.MessageType.TEMPLATE,
            image: client_1.MessageType.IMAGE,
            video: client_1.MessageType.VIDEO,
            audio: client_1.MessageType.AUDIO,
            document: client_1.MessageType.DOCUMENT,
            location: client_1.MessageType.LOCATION,
            sticker: client_1.MessageType.STICKER,
            contacts: client_1.MessageType.CONTACT,
            button: client_1.MessageType.INTERACTIVE,
            list: client_1.MessageType.INTERACTIVE,
            interactive: client_1.MessageType.INTERACTIVE,
        };
        return map[type.toLowerCase()] || client_1.MessageType.TEXT;
    }
    // ============================================
    // CONTACT VALIDATION
    // ============================================
    /**
     * Check if a phone number has WhatsApp
     */
    async checkContact(accountId, phone) {
        try {
            const { account, accessToken } = await this.getAccountWithToken(accountId);
            const formattedPhone = this.formatPhoneNumber(phone);
            console.log(`📞 Checking contact: ${formattedPhone}`);
            const result = await meta_api_1.metaApi.checkContact(account.phoneNumberId, accessToken, formattedPhone);
            const contact = result?.contacts?.[0];
            const status = contact?.status || 'unknown';
            console.log(`📞 Contact check result: ${status}`);
            return {
                valid: status === 'valid',
                waId: contact?.wa_id,
                status,
            };
        }
        catch (error) {
            console.error('❌ Contact check error:', error.message);
            return {
                valid: false,
                status: 'error',
            };
        }
    }
    // ============================================
    // MESSAGE SENDING METHODS
    // ============================================
    /**
     * Send a text message
     */
    async sendTextMessage(accountId, to, message, conversationId, organizationId, tempId, clientMsgId, skipWindowCheck // ✅ ADD THIS
    ) {
        return this.sendMessage({
            accountId,
            to,
            type: 'text',
            content: { text: { body: message } },
            conversationId,
            organizationId,
            tempId,
            clientMsgId,
            skipWindowCheck, // ✅ PASS KARO
        });
    }
    // Helper function to hydrate template text
    hydrateTemplate(bodyText, params) {
        let text = bodyText;
        if (!params || params.length === 0)
            return text;
        // Convert components to parameter array
        // Components array structure: [{ type: 'body', parameters: [{ type: 'text', text: 'Value' }] }]
        let flatParams = [];
        if (params.length > 0) {
            if (params[0]?.type === 'body' || params[0]?.parameters) {
                const bodyComp = params.find(c => c.type === 'body');
                if (bodyComp && bodyComp.parameters) {
                    flatParams = bodyComp.parameters;
                }
            }
            else {
                flatParams = params;
            }
        }
        flatParams.forEach((param, index) => {
            // Replace {{1}}, {{2}} etc with params
            const paramValue = typeof param === 'string' ? param : param?.text || JSON.stringify(param);
            text = text.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), paramValue);
        });
        return text;
    }
    /**
     * Send a template message
     */
    async sendTemplateMessage(options) {
        const { accountId, to, templateName, templateLanguage, components, conversationId, organizationId, tempId, clientMsgId, } = options;
        console.log(`📋 Sending template message: ${templateName}`);
        console.log(`   To: ${to}`);
        console.log(`   Account ID: ${accountId}`);
        try {
            const accountData = await this.getAccountWithToken(accountId);
            if (!accountData)
                throw new Error('Account not found');
            const { account, accessToken } = accountData;
            // ✅ 1. Get Template Details from DB to get Body Text
            const template = await database_1.default.template.findFirst({
                where: {
                    organizationId: account.organizationId,
                    name: templateName,
                    status: 'APPROVED' // Optional
                }
            });
            // ✅ 2. Hydrate text (Fill variables)
            let fullContent = templateName;
            if (template?.bodyText) {
                fullContent = this.hydrateTemplate(template.bodyText, components || []);
            }
            // Formatted phone
            const formattedTo = this.formatPhoneNumber(to);
            const messagePayload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: formattedTo,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: templateLanguage },
                    components: components || [],
                },
            };
            // Send to Meta
            const response = await meta_api_1.metaApi.sendMessage(account.phoneNumberId, accessToken, formattedTo, messagePayload);
            const waMessageId = response?.messages?.[0]?.id || response?.messageId;
            if (!waMessageId)
                throw new Error('No message ID returned');
            // ✅ ── WALLET DEDUCTION (Meta send ke BAAD, non-blocking) ─────────────────
            const orgId = organizationId || account.organizationId;
            // Template category DB se fetch karo
            const templateForCategory = await database_1.default.template.findFirst({
                where: {
                    organizationId: orgId,
                    name: templateName,
                },
                select: { category: true },
            });
            // Fire & forget - message blocking nahi hoga
            (0, wallet_deduction_service_1.deductWalletForTemplate)({
                organizationId: orgId,
                templateName,
                templateCategory: templateForCategory?.category,
                recipientPhone: to,
                waMessageId,
            }).then(result => {
                if (result.walletUsed) {
                    console.log(`💳 Wallet: -₹${result.amount} for ${templateName}`);
                }
                else {
                    console.log(`💳 Wallet skip: ${result.reason}`);
                }
            }).catch(err => {
                console.error('💳 Wallet deduction failed (non-blocking):', err.message);
            });
            // ✅ ── END WALLET DEDUCTION ────────────────────────────────────────────────
            // ✅ 2.5 Extract Media URL for saving
            let mediaUrlForDB = null;
            const headerComp = components?.find((c) => c.type === 'header');
            if (headerComp && headerComp.parameters && headerComp.parameters[0]) {
                const param = headerComp.parameters[0];
                mediaUrlForDB = param.image?.link || param.video?.link || param.document?.link || null;
            }
            // ✅ 3. Save FULL CONTENT to Database
            let savedMessage = null;
            if (conversationId && organizationId) {
                const now = new Date();
                savedMessage = await database_1.default.message.create({
                    data: {
                        conversationId,
                        whatsappAccountId: account.id,
                        waMessageId,
                        wamId: waMessageId,
                        direction: 'OUTBOUND',
                        type: 'TEMPLATE',
                        content: fullContent,
                        mediaUrl: mediaUrlForDB, // ✅ Save media URL if present
                        status: 'SENT',
                        sentAt: now,
                        timestamp: now,
                        createdAt: now,
                        metadata: {
                            ...(tempId ? { tempId } : {}),
                            ...(clientMsgId ? { clientMsgId } : {}),
                            templateName,
                            buttons: template?.buttons || []
                        },
                    },
                });
                // Update conversation
                await database_1.default.conversation.update({
                    where: { id: conversationId },
                    data: {
                        lastMessageAt: now,
                        lastMessagePreview: fullContent.substring(0, 100),
                        isWindowOpen: true,
                        windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
                    },
                });
                // Emit Socket Event
                const { webhookEvents } = await Promise.resolve().then(() => __importStar(require('../webhooks/webhook.service')));
                webhookEvents.emit('newMessage', {
                    organizationId,
                    conversationId,
                    tempId: tempId || savedMessage.metadata?.tempId,
                    clientMsgId: clientMsgId || savedMessage.metadata?.clientMsgId,
                    message: {
                        ...savedMessage,
                        tempId: tempId || savedMessage.metadata?.tempId,
                        clientMsgId: clientMsgId || savedMessage.metadata?.clientMsgId,
                    }
                });
            }
            return {
                success: true,
                waMessageId,
                wamId: waMessageId,
                message: savedMessage ? {
                    ...savedMessage,
                    tempId: tempId || savedMessage.metadata?.tempId,
                    clientMsgId: clientMsgId || savedMessage.metadata?.clientMsgId,
                } : null
            };
        }
        catch (error) {
            console.error('❌ sendTemplate error:', error);
            throw error;
        }
    }
    /**
     * Send a media message
     */
    async sendMediaMessage(accountId, to, mediaType, mediaUrl, caption, conversationId, organizationId, tempId, clientMsgId) {
        const content = {
            [mediaType]: {
                link: mediaUrl,
            },
        };
        if (caption && ['image', 'document', 'video'].includes(mediaType)) {
            content[mediaType].caption = caption;
        }
        return this.sendMessage({
            accountId,
            to,
            type: mediaType,
            content,
            conversationId,
            organizationId,
            tempId,
            clientMsgId
        });
    }
    /**
     * Core send message function - WITH CONTACT CHECK
     */
    async sendMessage(options) {
        const { accountId, to, type, content, conversationId, tempId, clientMsgId } = options;
        console.log(`\n📤 ========== SEND MESSAGE START ==========`);
        console.log(`   Type: ${type}`);
        console.log(`   To: ${to}`);
        console.log(`   Account ID: ${accountId}`);
        try {
            const { account, accessToken } = await this.getAccountWithToken(accountId);
            const organizationId = options.organizationId || account.organizationId;
            console.log(`   Organization ID: ${organizationId}`);
            console.log(`   Phone Number ID: ${account.phoneNumberId}`);
            const formattedTo = this.formatPhoneNumber(to);
            console.log(`   Formatted Phone: ${formattedTo}`);
            // ✅ 24-HOUR WINDOW CHECK (For Text/Media/Interactive)
            // Meta requires Templates for messages outside the 24h window
            if (type !== 'template' && !options.skipWindowCheck) {
                try {
                    // Lightweight fetch — do NOT use getOrCreateConversation (it modifies data)
                    let conv = null;
                    if (conversationId) {
                        conv = await database_1.default.conversation.findUnique({
                            where: { id: conversationId },
                            select: {
                                id: true,
                                isWindowOpen: true,
                                windowExpiresAt: true,
                                lastCustomerMessageAt: true,
                            },
                        });
                    }
                    if (!conv) {
                        // Find by contact + org
                        const contact = await database_1.default.contact.findFirst({
                            where: {
                                organizationId,
                                OR: [
                                    { phone: to },
                                    { phone: `+${this.formatPhoneNumber(to)}` },
                                    { phone: this.formatPhoneNumber(to) },
                                ],
                            },
                            select: { id: true },
                        });
                        if (contact) {
                            conv = await database_1.default.conversation.findUnique({
                                where: {
                                    organizationId_contactId: { organizationId, contactId: contact.id },
                                },
                                select: {
                                    id: true,
                                    isWindowOpen: true,
                                    windowExpiresAt: true,
                                    lastCustomerMessageAt: true,
                                },
                            });
                        }
                    }
                    // If no conversation exists yet, it's a fresh outbound — block it
                    if (!conv) {
                        const errorMsg = 'No inbound message from user yet. You must start with a Template Message.';
                        console.warn(`⚠️ ${errorMsg}`);
                        throw new Error(errorMsg);
                    }
                    const now = new Date();
                    let windowExpired = false;
                    // ✅ Priority 1: windowExpiresAt is the most reliable signal
                    if (conv.windowExpiresAt) {
                        windowExpired = new Date(conv.windowExpiresAt) <= now;
                    }
                    else if (conv.isWindowOpen === false) {
                        windowExpired = true;
                    }
                    else if (conv.lastCustomerMessageAt) {
                        // Priority 2: last customer message time
                        windowExpired = (now.getTime() - new Date(conv.lastCustomerMessageAt).getTime()) > 24 * 60 * 60 * 1000;
                    }
                    else {
                        // Priority 3: count inbound messages
                        const inboundCount = await database_1.default.message.count({
                            where: { conversationId: conv.id, direction: client_1.MessageDirection.INBOUND },
                        });
                        windowExpired = inboundCount === 0;
                    }
                    if (windowExpired) {
                        const errorMsg = conv.lastCustomerMessageAt
                            ? 'User session expired (24h window closed). Send a Template Message to re-engage.'
                            : 'No inbound message from user yet. You must start with a Template Message.';
                        console.warn(`⚠️ ${errorMsg}`);
                        // Save as failed message so user sees it in inbox
                        if (conv.id) {
                            await database_1.default.message.create({
                                data: {
                                    conversationId: conv.id,
                                    whatsappAccountId: accountId,
                                    direction: client_1.MessageDirection.OUTBOUND,
                                    type: this.mapMessageType(type),
                                    content: this.extractMessageContent(type, content),
                                    status: client_1.MessageStatus.FAILED,
                                    failureReason: errorMsg,
                                    sentAt: now,
                                    failedAt: now,
                                },
                            }).catch(() => { }); // non-blocking, don't crash on this
                        }
                        throw new Error(errorMsg);
                    }
                }
                catch (windowCheckErr) {
                    // Re-throw only real window errors, not DB lookup errors
                    if (windowCheckErr.message?.includes('Template Message') ||
                        windowCheckErr.message?.includes('window closed') ||
                        windowCheckErr.message?.includes('session expired')) {
                        throw windowCheckErr;
                    }
                    // DB lookup failed silently — allow message to proceed, Meta API will validate
                    console.warn('⚠️ Window check lookup failed (non-critical), proceeding:', windowCheckErr.message);
                }
            }
            // ✅ Skip contact check to reduce latency (Meta API will fail on send if invalid anyway)
            /*
            let contactValid = true;
            try {
              console.log('📞 Checking if contact has WhatsApp...');
      
              const contactCheck = await metaApi.checkContact(
                account.phoneNumberId,
                accessToken,
                formattedTo
              );
      
              const status = contactCheck?.contacts?.[0]?.status;
      
              if (status && status !== 'valid') { ... }
            } catch (err) { ... }
            */
            // Prepare message payload
            const messagePayload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: formattedTo,
                type,
                ...content,
            };
            console.log(`   Payload type:`, type);
            // Send via Meta API
            const result = await meta_api_1.metaApi.sendMessage(account.phoneNumberId, accessToken, formattedTo, messagePayload);
            console.log(`✅ Message sent successfully!`);
            console.log(`   Message ID: ${result.messageId}`);
            // Get or create contact
            const contact = await this.getOrCreateContact(organizationId, to);
            // Extract clean content
            const messageContent = this.extractMessageContent(type, content);
            const messagePreview = messageContent.substring(0, 100);
            console.log(`   Message Content: ${messageContent.substring(0, 50)}...`);
            // ✅ Extract mediaUrl properly
            let mediaUrlForDB = null;
            const mediaTypesList = ['image', 'video', 'audio', 'document', 'sticker'];
            if (mediaTypesList.includes(type)) {
                // Try all possible locations
                mediaUrlForDB =
                    content?.[type]?.link || // { image: { link: '...' } }
                        content?.[type]?.url || // { image: { url: '...' } }
                        content?.link || // { link: '...' }
                        content?.url || // { url: '...' }
                        options.mediaUrl || // Direct mediaUrl option
                        null;
                console.log(`💾 Media URL for ${type}:`, mediaUrlForDB);
            }
            // Get or create conversation
            const conversation = await this.getOrCreateConversation(organizationId, contact.id, account.phoneNumberId, messagePreview, conversationId);
            // Save message to database
            const message = await database_1.default.message.create({
                data: {
                    conversationId: conversation.id,
                    whatsappAccountId: accountId,
                    wamId: result.messageId,
                    waMessageId: result.messageId,
                    direction: client_1.MessageDirection.OUTBOUND,
                    type: this.mapMessageType(type),
                    content: messageContent,
                    mediaUrl: mediaUrlForDB, // ✅ Properly set
                    status: client_1.MessageStatus.SENT,
                    timestamp: new Date(),
                    sentAt: new Date(),
                    metadata: {
                        ...(tempId ? { tempId } : {}),
                        ...(clientMsgId ? { clientMsgId } : {}),
                    },
                },
                include: {
                    conversation: {
                        include: {
                            contact: true,
                        },
                    },
                },
            });
            console.log(`💾 Message saved to DB: ${message.id}`);
            // ✅ Emit socket event for real-time update
            const { webhookEvents } = await Promise.resolve().then(() => __importStar(require('../webhooks/webhook.service')));
            webhookEvents.emit('newMessage', {
                organizationId,
                conversationId: conversation.id,
                tempId: tempId || message.metadata?.tempId,
                clientMsgId: clientMsgId || message.metadata?.clientMsgId,
                message: {
                    ...message,
                    tempId: tempId || message.metadata?.tempId,
                    clientMsgId: clientMsgId || message.metadata?.clientMsgId,
                },
            });
            webhookEvents.emit('conversationUpdated', {
                organizationId,
                conversation: {
                    id: conversation.id,
                    lastMessageAt: conversation.lastMessageAt,
                    lastMessagePreview: conversation.lastMessagePreview,
                    unreadCount: conversation.unreadCount,
                    isRead: conversation.isRead,
                    isWindowOpen: conversation.isWindowOpen,
                    windowExpiresAt: conversation.windowExpiresAt,
                    contact: message.conversation?.contact,
                },
            });
            console.log(`📤 ========== SEND MESSAGE END ==========\n`);
            return {
                success: true,
                messageId: result.messageId,
                message: {
                    ...message,
                    tempId: tempId || message.metadata?.tempId,
                    clientMsgId: clientMsgId || message.metadata?.clientMsgId,
                },
            };
        }
        catch (error) {
            console.error(`❌ Failed to send message:`, {
                error: error.message,
                response: error.response?.data,
            });
            if (conversationId) {
                try {
                    const failedContent = this.extractMessageContent(type, content);
                    await database_1.default.message.create({
                        data: {
                            conversationId,
                            whatsappAccountId: accountId,
                            direction: client_1.MessageDirection.OUTBOUND,
                            type: this.mapMessageType(type),
                            content: failedContent,
                            status: client_1.MessageStatus.FAILED,
                            failureReason: error.response?.data?.error?.message || error.message,
                            sentAt: new Date(),
                            failedAt: new Date(),
                        },
                    });
                }
                catch (dbError) {
                    console.error('Failed to save error message to DB:', dbError);
                }
            }
            console.log(`📤 ========== SEND MESSAGE END (ERROR) ==========\n`);
            const errorMessage = error.response?.data?.error?.message ||
                error.response?.data?.message ||
                error.message ||
                'Failed to send message';
            throw new Error(errorMessage);
        }
    }
    // ============================================
    // CAMPAIGN METHODS
    // ============================================
    /**
     * Send bulk campaign messages - WITH CONTACT CHECK
     */
    async sendCampaignMessages(campaignId, batchSize = 500, delayMs = 50) {
        console.log(`\n📢 ========== CAMPAIGN START ==========`);
        console.log(`   Campaign ID: ${campaignId}`);
        console.log(`   Batch Size: ${batchSize}`);
        console.log(`   Delay: ${delayMs}ms`);
        const campaign = await database_1.default.campaign.findUnique({
            where: { id: campaignId },
            include: {
                template: true,
                whatsappAccount: true,
                campaignContacts: {
                    where: { status: client_1.MessageStatus.PENDING },
                    include: { contact: true },
                    take: batchSize,
                },
            },
        });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        if (campaign.status !== 'RUNNING') {
            throw new Error('Campaign is not running');
        }
        console.log(`   Template: ${campaign.template.name}`);
        console.log(`   Recipients: ${campaign.campaignContacts.length}`);
        let accessToken;
        try {
            const tokenResult = await this.getAccountWithToken(campaign.whatsappAccount.id);
            accessToken = tokenResult.accessToken;
        }
        catch (error) {
            console.error('❌ Failed to get access token for campaign:', error);
            await database_1.default.campaign.update({
                where: { id: campaignId },
                data: { status: 'FAILED' },
            });
            throw new Error('Failed to get access token for campaign. Please reconnect WhatsApp account.');
        }
        // ✅ ── WALLET PRE-CHECK for Campaign ────────────────────────────────────────
        const orgId = campaign.whatsappAccount.organizationId;
        const { deductWalletForCampaign } = await Promise.resolve().then(() => __importStar(require('../wallet/wallet.deduction.service')));
        const walletCheck = await deductWalletForCampaign({
            organizationId: orgId,
            templateName: campaign.template.name,
            templateCategory: campaign.template.category,
            totalRecipients: campaign.campaignContacts.length,
            campaignId,
        });
        // Log wallet status
        if (walletCheck.walletActive) {
            console.log(`💳 Wallet check for campaign:`);
            console.log(`   Estimated cost: ₹${walletCheck.estimatedCost.toFixed(2)}`);
            console.log(`   Available: ₹${walletCheck.availableBalance.toFixed(2)}`);
            if (!walletCheck.canProceed) {
                console.warn(`⚠️ Wallet balance low! Shortfall: ₹${walletCheck.shortfall.toFixed(2)}`);
                console.warn(`⚠️ Campaign will continue but wallet may run out`);
                // Note: Campaign block nahi karte, user ko notification jayega
            }
        }
        // ✅ ── END WALLET PRE-CHECK ──────────────────────────────────────────────────
        const results = {
            sent: 0,
            failed: 0,
            errors: [],
        };
        for (const recipient of campaign.campaignContacts) {
            try {
                const formattedPhone = this.formatPhoneNumber(recipient.contact.phone);
                // ✅ Skip contact check to reduce latency
                /*
                try {
                  console.log(`📞 Checking contact: ${formattedPhone}`);
                  ...
                } catch (checkError: any) { ... }
                */
                // Build template components
                const components = this.buildTemplateComponents(campaign.template, {});
                // Send message
                const messagePayload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: formattedPhone,
                    type: 'template',
                    template: {
                        name: campaign.template.name,
                        language: { code: campaign.template.language },
                        components,
                    },
                };
                const messageResult = await meta_api_1.metaApi.sendMessage(campaign.whatsappAccount.phoneNumberId, accessToken, formattedPhone, messagePayload);
                // Update contact status
                await this.updateContactStatus(campaignId, recipient.contactId, client_1.MessageStatus.SENT, messageResult.messageId);
                results.sent++;
                console.log(`✅ Sent to ${recipient.contact.phone} (${messageResult.messageId})`);
                // Delay between messages
                if (delayMs > 0) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }
            }
            catch (error) {
                console.error(`❌ Failed to send to ${recipient.contact.phone}:`, error.message);
                const errorData = error.response?.data?.error || {};
                const errorCode = errorData.code;
                const errorMessage = errorData.message || error.message;
                // Human-readable mapping for common Meta errors
                let failureReason = errorMessage;
                if (errorCode === 131030 || errorMessage.includes('not a WhatsApp user')) {
                    failureReason = 'Phone number is not registered on WhatsApp';
                }
                else if (errorCode === 131048 || errorCode === 131021 || errorMessage.includes('rate limit')) {
                    failureReason = 'Meta messaging rate limit reached';
                }
                else if (errorCode === 131056 || errorCode === 131051 || errorMessage.includes('restricted') || errorMessage.includes('banned')) {
                    failureReason = 'Phone number or account restricted by Meta';
                }
                else if (errorCode === 132000 || errorMessage.includes('template')) {
                    failureReason = 'Template was rejected or is not approved by Meta';
                }
                else if (errorMessage.includes('expired') || errorMessage.includes('24h')) {
                    failureReason = '24-hour window closed (No user reply)';
                }
                await this.updateContactStatus(campaignId, recipient.contactId, client_1.MessageStatus.FAILED, undefined, failureReason);
                results.failed++;
                results.errors.push(`${recipient.contact.phone}: ${errorMessage}`);
            }
        }
        await this.checkCampaignCompletion(campaignId);
        // ✅ ── SINGLE BULK WALLET DEDUCTION ─────────────────────────────────────
        // One deduction for ALL sent messages - NOT per-recipient
        if (walletCheck.walletActive && results.sent > 0) {
            try {
                const templateCategory = campaign.template?.category || 'MARKETING';
                // ✅ INTEGER paise arithmetic - avoids floating-point errors
                // e.g. 0.15 * 150 = 22.4999... (bug).  15 paise × 150 = 2250 paise (correct)
                const rateRupees = (0, wallet_deduction_service_1.getRateForCategory)(templateCategory);
                const ratePaise = Math.round(rateRupees * 100); // e.g. 15 for UTILITY
                const totalAmountPaise = ratePaise * results.sent; // e.g. 15 × 150 = 2250
                const totalAmountRupees = totalAmountPaise / 100; // e.g. 22.50
                console.log(`💳 Bulk deduction: ${results.sent} msgs × ₹${rateRupees} = ₹${totalAmountRupees} (${totalAmountPaise} paise)`);
                await database_1.default.$transaction(async (tx) => {
                    const wallet = await tx.wallet.findUnique({ where: { organizationId: orgId } });
                    if (!wallet || !wallet.isActive || wallet.flagged) {
                        console.warn('💳 Wallet not available for bulk deduction - skipping');
                        return;
                    }
                    const balanceBeforePaise = wallet.balancePaise;
                    // Available = wallet balance + credit headroom
                    const creditHeadroom = wallet.creditEnabled
                        ? Math.max(0, wallet.creditLimitPaise - wallet.creditUsedPaise)
                        : 0;
                    const availablePaise = wallet.balancePaise + creditHeadroom;
                    // Deduct as much as available (never go below 0)
                    const actualDeductPaise = Math.min(totalAmountPaise, availablePaise);
                    const creditDeductedPaise = Math.max(0, actualDeductPaise - wallet.balancePaise);
                    const newBalancePaise = Math.max(0, wallet.balancePaise - actualDeductPaise);
                    await tx.wallet.update({
                        where: { id: wallet.id },
                        data: {
                            balancePaise: newBalancePaise,
                            creditUsedPaise: { increment: creditDeductedPaise },
                            totalDebitedPaise: { increment: actualDeductPaise },
                            lastTransactionAt: new Date(),
                        },
                    });
                    const categoryLabel = templateCategory.charAt(0).toUpperCase() + templateCategory.slice(1).toLowerCase();
                    await tx.walletTransaction.create({
                        data: {
                            walletId: wallet.id,
                            type: 'debit',
                            amountPaise: actualDeductPaise,
                            balanceBeforePaise,
                            balanceAfterPaise: newBalancePaise,
                            description: `Campaign charge - ${categoryLabel} (${campaign.template.name}) × ${results.sent} messages`,
                            status: 'completed',
                            metaService: 'template_message',
                            note: `Campaign: ${campaign.name}`,
                        },
                    });
                    console.log(`✅ Bulk wallet deducted: ₹${(actualDeductPaise / 100).toFixed(2)} for ${results.sent} msgs ("${campaign.name}")`);
                });
            }
            catch (walletErr) {
                console.error('💳 Campaign bulk wallet deduction failed (non-blocking):', walletErr.message);
            }
        }
        else {
            console.log(`💳 Deduction skipped: walletActive=${walletCheck.walletActive}, sent=${results.sent}`);
        }
        // ✅ ── END BULK DEDUCTION ─────────────────────────────────────────────────
        console.log(`📢 ========== CAMPAIGN END ==========`);
        console.log(`   Sent: ${results.sent}`);
        console.log(`   Failed: ${results.failed}\n`);
        return results;
    }
    /**
     * Update campaign contact status
     */
    async updateContactStatus(campaignId, contactId, status, waMessageId, failureReason) {
        const now = new Date();
        const updateData = {
            status,
            updatedAt: now,
        };
        if (waMessageId) {
            updateData.waMessageId = waMessageId;
        }
        switch (status) {
            case client_1.MessageStatus.SENT:
                updateData.sentAt = now;
                break;
            case client_1.MessageStatus.DELIVERED:
                updateData.deliveredAt = now;
                break;
            case client_1.MessageStatus.READ:
                updateData.readAt = now;
                break;
            case client_1.MessageStatus.FAILED:
                updateData.failedAt = now;
                if (failureReason) {
                    updateData.failureReason = failureReason;
                }
                break;
        }
        await database_1.default.campaignContact.updateMany({
            where: {
                campaignId,
                contactId,
            },
            data: updateData,
        });
        const countFieldMap = {
            SENT: 'sentCount',
            DELIVERED: 'deliveredCount',
            READ: 'readCount',
            FAILED: 'failedCount',
        };
        const fieldToIncrement = countFieldMap[status];
        if (fieldToIncrement) {
            await database_1.default.campaign.update({
                where: { id: campaignId },
                data: {
                    [fieldToIncrement]: { increment: 1 },
                },
            });
        }
    }
    /**
     * Check if campaign is complete
     */
    async checkCampaignCompletion(campaignId) {
        const remainingRecipients = await database_1.default.campaignContact.count({
            where: {
                campaignId,
                status: client_1.MessageStatus.PENDING,
            },
        });
        if (remainingRecipients === 0) {
            const campaign = await database_1.default.campaign.findUnique({
                where: { id: campaignId },
                select: { sentCount: true, failedCount: true },
            });
            await database_1.default.campaign.update({
                where: { id: campaignId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
            });
            console.log(`🎉 Campaign ${campaignId} completed! Sent: ${campaign?.sentCount || 0}, Failed: ${campaign?.failedCount || 0}`);
            return true;
        }
        return false;
    }
    // ============================================
    // TEMPLATE HELPER METHODS
    // ============================================
    /**
     * Build template components with variables
     */
    buildTemplateComponents(template, variables) {
        const components = [];
        // Header component
        if (template.headerType) {
            if (template.headerType === 'TEXT' && template.headerContent) {
                const headerVars = this.extractVariables(template.headerContent, variables);
                if (headerVars.length > 0) {
                    components.push({
                        type: 'header',
                        parameters: headerVars,
                    });
                }
            }
            else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.headerType)) {
                const mediaUrl = variables.header_media || template.headerMediaUrl;
                if (mediaUrl) {
                    components.push({
                        type: 'header',
                        parameters: [
                            {
                                type: template.headerType.toLowerCase(),
                                [template.headerType.toLowerCase()]: {
                                    link: mediaUrl,
                                },
                            },
                        ],
                    });
                }
            }
        }
        // Body component
        const bodyVars = this.extractVariablesFromText(template.bodyText);
        if (bodyVars.length > 0) {
            const bodyParams = bodyVars.map((varName, index) => ({
                type: 'text',
                text: variables[varName] ||
                    variables[`body_${index + 1}`] ||
                    `{{${index + 1}}}`,
            }));
            components.push({
                type: 'body',
                parameters: bodyParams,
            });
        }
        // Button components
        if (template.buttons) {
            const buttons = typeof template.buttons === 'string'
                ? JSON.parse(template.buttons)
                : template.buttons;
            if (Array.isArray(buttons)) {
                buttons.forEach((button, index) => {
                    if (button.type === 'URL' && button.url?.includes('{{')) {
                        components.push({
                            type: 'button',
                            sub_type: 'url',
                            index,
                            parameters: [
                                {
                                    type: 'text',
                                    text: variables[`button_${index}`] || '',
                                },
                            ],
                        });
                    }
                });
            }
        }
        return components;
    }
    extractVariablesFromText(text) {
        if (!text)
            return [];
        const matches = text.match(/\{\{(\d+)\}\}/g) || [];
        return matches.map((_, index) => `var_${index + 1}`);
    }
    extractVariables(text, variables) {
        const matches = text.match(/\{\{(\d+)\}\}/g) || [];
        return matches.map((match, index) => ({
            type: 'text',
            text: variables[`var_${index + 1}`] || match,
        }));
    }
    // ============================================
    // MESSAGE STATUS METHODS
    // ============================================
    /**
     * Mark message as read
     */
    async markAsRead(accountId, messageId) {
        try {
            const { account, accessToken } = await this.getAccountWithToken(accountId);
            await meta_api_1.metaApi.markMessageAsRead(account.phoneNumberId, accessToken, messageId);
            await database_1.default.message.updateMany({
                where: { wamId: messageId },
                data: {
                    status: client_1.MessageStatus.READ,
                    readAt: new Date()
                }
            });
            console.log(`✅ Marked message ${messageId} as read`);
            return { success: true };
        }
        catch (error) {
            console.error('❌ Failed to mark as read:', error);
            return { success: false, error: error.message };
        }
    }
    // ============================================
    // ACCOUNT MANAGEMENT
    // ============================================
    async getDefaultAccount(organizationId) {
        const account = await database_1.default.whatsAppAccount.findFirst({
            where: {
                organizationId,
                isDefault: true,
                status: client_1.WhatsAppAccountStatus.CONNECTED,
            },
        });
        if (!account) {
            return database_1.default.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    status: client_1.WhatsAppAccountStatus.CONNECTED,
                },
                orderBy: { createdAt: 'desc' },
            });
        }
        return account;
    }
    async validateAccount(accountId) {
        try {
            const { accessToken } = await this.getAccountWithToken(accountId);
            const isValid = await meta_api_1.metaApi.isTokenValid(accessToken);
            if (!isValid) {
                return {
                    valid: false,
                    reason: 'Access token is invalid or expired',
                };
            }
            return { valid: true };
        }
        catch (error) {
            return {
                valid: false,
                reason: error.message,
            };
        }
    }
}
exports.whatsappService = new WhatsAppService();
exports.default = exports.whatsappService;
//# sourceMappingURL=whatsapp.service.js.map