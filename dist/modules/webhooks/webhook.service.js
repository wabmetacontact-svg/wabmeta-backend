"use strict";
// src/modules/webhooks/webhook.service.ts - COMPLETE FIXED VERSION
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
exports.webhookService = exports.WebhookService = exports.webhookEvents = void 0;
const database_1 = __importDefault(require("../../config/database"));
const contacts_service_1 = require("../contacts/contacts.service");
const events_1 = require("events");
const chatbot_engine_1 = require("../chatbot/chatbot.engine");
const automation_engine_1 = require("../automation/automation.engine");
// ✅ Socket.ts will subscribe to this
exports.webhookEvents = new events_1.EventEmitter();
exports.webhookEvents.setMaxListeners(100);
class WebhookService {
    // -----------------------------
    // Helpers
    // -----------------------------
    accountCache = new Map();
    CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    extractValue(payload) {
        return payload?.entry?.[0]?.changes?.[0]?.value;
    }
    extractProfile(payload, specificMsg) {
        try {
            const value = this.extractValue(payload);
            const msg = specificMsg || value?.messages?.[0];
            if (!msg)
                return null;
            const waId = String(msg.from || '');
            // Find matching contact profile in the payload's contacts array
            const contact = value?.contacts?.find((c) => c.wa_id === waId);
            let phone10 = waId;
            if (phone10.startsWith('91') && phone10.length === 12)
                phone10 = phone10.substring(2);
            return {
                waId,
                profileName: contact?.profile?.name || 'Unknown',
                phone10,
            };
        }
        catch (e) {
            console.error('extractProfile error:', e);
            return null;
        }
    }
    isIndianNumber(waId) {
        return typeof waId === 'string' && waId.startsWith('91') && waId.length === 12;
    }
    mapMessageType(typeRaw) {
        const t = String(typeRaw || '').toLowerCase();
        const map = {
            text: 'TEXT',
            image: 'IMAGE',
            video: 'VIDEO',
            audio: 'AUDIO',
            document: 'DOCUMENT',
            sticker: 'STICKER',
            location: 'LOCATION',
            contacts: 'CONTACT',
            interactive: 'INTERACTIVE',
            button: 'INTERACTIVE',
            list: 'INTERACTIVE',
            template: 'TEMPLATE',
        };
        return map[t] || 'TEXT';
    }
    buildContentAndMedia(message) {
        const type = String(message?.type || 'text').toLowerCase();
        if (type === 'text')
            return { content: message?.text?.body || '', mediaUrl: null };
        // ✅ Store mediaId as mediaUrl — proxy fetches fresh URL on demand (CDN URLs expire in ~5min)
        if (type === 'image')
            return { content: message?.image?.caption || '[Image]', mediaUrl: message?.image?.id || null };
        if (type === 'video')
            return { content: message?.video?.caption || '[Video]', mediaUrl: message?.video?.id || null };
        if (type === 'document')
            return { content: message?.document?.filename || '[Document]', mediaUrl: message?.document?.id || null };
        if (type === 'audio')
            return { content: '[Audio]', mediaUrl: message?.audio?.id || null };
        if (type === 'sticker')
            return { content: '[Sticker]', mediaUrl: message?.sticker?.id || null };
        if (type === 'location')
            return { content: '[Location]', mediaUrl: null };
        if (type === 'contacts')
            return { content: '[Contact]', mediaUrl: null };
        if (type === 'interactive') {
            const iType = message?.interactive?.type;
            if (iType === 'button_reply')
                return { content: message.interactive.button_reply.title || '[Button Reply]', mediaUrl: null };
            if (iType === 'list_reply')
                return { content: message.interactive.list_reply.title || '[List Reply]', mediaUrl: null };
            return { content: '[Interactive]', mediaUrl: null };
        }
        return { content: `[${type}]`, mediaUrl: null };
    }
    // ✅ Canonical phone normalizer — always returns E.164 without '+' prefix
    // e.g. '9340103340' → '919340103340'  |  '+919340103340' → '919340103340'
    normalizePhone(phone) {
        const digits = phone.replace(/[^0-9]/g, '');
        if (digits.length === 10)
            return `91${digits}`; // 10-digit Indian
        if (digits.length === 11 && digits.startsWith('0'))
            return `91${digits.slice(1)}`; // 0XXXXXXXXXX
        return digits; // already has country code
    }
    async findOrCreateContact(organizationId, phone10) {
        // ✅ Always store in E.164 format with + prefix: +919XXXXXXXXX
        const canonical = `+${this.normalizePhone(phone10)}`; // e.g. "+919340103340"
        const withoutPlus = canonical.slice(1); // e.g. "919340103340"
        const tenDigit = withoutPlus.slice(-10); // e.g. "9340103340"
        const variants = [canonical, withoutPlus, tenDigit];
        let contact = await database_1.default.contact.findFirst({
            where: {
                organizationId,
                OR: variants.map((p) => ({ phone: p })),
            },
        });
        // ✅ Track creation status
        let wasNewlyCreated = false;
        if (!contact) {
            try {
                contact = await database_1.default.contact.create({
                    data: {
                        organizationId,
                        phone: canonical, // ✅ Always store as +919XXXXXXXXX
                        countryCode: '+91',
                        firstName: 'Unknown',
                        status: 'ACTIVE',
                        source: 'WHATSAPP_INBOUND',
                    },
                });
                wasNewlyCreated = true;
                console.log(`👤 New contact created: ${canonical}`);
            }
            catch (error) {
                if (error.code === 'P2002') {
                    contact = await database_1.default.contact.findFirst({
                        where: {
                            organizationId,
                            OR: variants.map((p) => ({ phone: p })),
                        },
                    });
                    if (!contact)
                        throw error;
                    wasNewlyCreated = false;
                }
                else {
                    throw error;
                }
            }
        }
        else if (contact.phone !== canonical) {
            // ✅ Silently migrate old format to canonical
            await database_1.default.contact.update({
                where: { id: contact.id },
                data: { phone: canonical },
            }).catch(() => { }); // non-blocking migration
            contact.phone = canonical;
            console.log(`🔄 Migrated contact phone: ${contact.phone} → ${canonical}`);
        }
        return { contact: contact, wasNewlyCreated };
    }
    // -----------------------------
    // Main Handler
    // -----------------------------
    async handleWebhook(payload) {
        try {
            console.log('📨 Webhook received');
            const value = this.extractValue(payload);
            const field = payload?.entry?.[0]?.changes?.[0]?.field || 'unknown';
            const phoneNumberId = value?.metadata?.phone_number_id;
            console.log('📨 Webhook field:', field);
            // ✅ Handle WBA Onboarding specific events
            switch (field) {
                // ✅ Message history sync
                case 'history':
                    await this.handleHistorySync(payload, value);
                    return { status: 'processed', reason: 'History sync processed' };
                // ✅ SMB app state sync (contacts)
                case 'smb_app_state_sync':
                    await this.handleSmbStateSync(payload, value);
                    return { status: 'processed', reason: 'SMB state sync processed' };
                // ✅ Message echoes from WBA app
                case 'smb_message_echoes':
                    await this.handleSmbMessageEchoes(payload, value);
                    return { status: 'processed', reason: 'SMB echoes processed' };
                case 'message_template_status_update':
                    await this.handleTemplateUpdate(payload, value);
                    return { status: 'processed', reason: 'Template update processed' };
                case 'calls':
                    await this.handleCallWebhook(payload, value);
                    return { status: 'processed', reason: 'Call webhook processed' };
                case 'messages':
                case 'statuses':
                    // Existing handlers handle these downstream
                    break;
                default:
                    console.log(`ℹ️ Unhandled field: ${field}`);
                    return { status: 'ignored', reason: `Unhandled field: ${field}` };
            }
            // Handle cases where phone_number_id is missing for messages/statuses
            if (!phoneNumberId) {
                // If it's supposed to be a message/status but lacks ID, that's an error
                return { status: 'error', reason: 'No phone_number_id for field: ' + field };
            }
            // ✅ Caching to prevent database pool exhaustion
            let account = null;
            const cached = this.accountCache.get(phoneNumberId);
            if (cached && cached.expiresAt > Date.now()) {
                account = cached.data;
            }
            else {
                account = await database_1.default.whatsAppAccount.findFirst({
                    where: { phoneNumberId },
                });
                // ✅ Fallback: Try newer PhoneNumber table if legacy whatsAppAccount not found
                if (!account) {
                    console.log(`🔍 phoneNumberId ${phoneNumberId} not found in legacy WhatsAppAccount, checking PhoneNumber table...`);
                    try {
                        const phoneRecord = await database_1.default.phoneNumber.findFirst({
                            where: { phoneNumberId },
                            include: { metaConnection: true }
                        });
                        if (phoneRecord) {
                            console.log(`✅ Found account via PhoneNumber table fallback for ID: ${phoneNumberId}`);
                            account = {
                                id: phoneRecord.id, // Using PhoneNumber ID as account ID
                                organizationId: phoneRecord.metaConnection.organizationId,
                                phoneNumberId: phoneRecord.phoneNumberId,
                                phoneNumber: phoneRecord.phoneNumber,
                                wabaId: phoneRecord.metaConnection.wabaId
                            };
                        }
                    }
                    catch (phoneErr) {
                        console.error('Error checking PhoneNumber fallback:', phoneErr);
                    }
                }
                if (account) {
                    this.accountCache.set(phoneNumberId, {
                        data: account,
                        expiresAt: Date.now() + this.CACHE_TTL
                    });
                }
            }
            if (!account) {
                // For test webhooks from Meta, the ID might be "123456789012345" or similar
                // We should probably ignore it if the account isn't found instead of erroring, 
                // to keep logs clean from Meta's periodic tests or unconfigured numbers.
                if (phoneNumberId.length < 10) { // Simple heuristic for test/fake IDs
                    return { status: 'ignored', reason: 'Account not found for test/invalid phoneNumberId: ' + phoneNumberId };
                }
                console.warn(`⚠️ Account not found for phoneNumberId: ${phoneNumberId}`);
                return { status: 'error', reason: 'Account not found for phoneNumberId: ' + phoneNumberId };
            }
            // Process incoming messages
            const messages = value?.messages || [];
            for (const msg of messages) {
                const profile = this.extractProfile(payload, msg);
                if (profile) {
                    // Update contact name from webhook
                    if (profile.profileName && profile.profileName !== 'Unknown') {
                        await contacts_service_1.contactsService.updateContactFromWebhook(profile.phone10, profile.profileName, account.organizationId);
                    }
                    await this.processIncomingMessage(msg, account.organizationId, account.id, account.phoneNumberId);
                }
            }
            // ✅ Process status updates (Sequential to avoid pool exhaustion)
            const statuses = value?.statuses || [];
            for (const st of statuses) {
                try {
                    await this.processStatusUpdate(st, account.organizationId, account.id);
                }
                catch (e) {
                    console.error('Status update sequential error:', e);
                }
            }
            return { status: 'processed' };
        }
        catch (e) {
            console.error('❌ Webhook processing error:', e);
            return { status: 'error', error: e.message };
        }
    }
    // -----------------------------
    // Template webhook processing
    // -----------------------------
    async handleTemplateUpdate(payload, value) {
        try {
            const wabaId = payload.entry[0].id;
            const event = value.event;
            const templateName = value.message_template_name;
            console.log(`🔄 Template update webhook received [${event}] for template: ${templateName} (WABA: ${wabaId})`);
            // Find an account that has this WABA ID
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { wabaId },
                select: { id: true, organizationId: true },
            });
            if (account) {
                // Dynamically import metaService to avoid circular dependency issues
                const { metaService } = await Promise.resolve().then(() => __importStar(require('../meta/meta.service')));
                console.log(`📡 Triggering background template sync for Org: ${account.organizationId}`);
                // Run without awaiting to free up the webhook response
                metaService.syncTemplates(account.id, account.organizationId).catch(e => {
                    console.error('❌ Background template sync failed:', e);
                });
            }
            else {
                console.log(`⚠️ No account found associated with WABA ID: ${wabaId}`);
            }
        }
        catch (e) {
            console.error('❌ Template update handling error:', e);
        }
    }
    // -----------------------------
    // Incoming message processing
    // -----------------------------
    async processIncomingMessage(message, organizationId, whatsappAccountId, phoneNumberId) {
        try {
            const waFrom = String(message?.from || '');
            const waMessageId = String(message?.id || '');
            const typeRaw = String(message?.type || 'text');
            const msgType = this.mapMessageType(typeRaw);
            const ts = Number(message?.timestamp || Date.now() / 1000);
            const messageTime = new Date(ts * 1000);
            console.log(`📥 Processing inbound message: ${waMessageId} from ${waFrom}`);
            let phone10 = waFrom;
            if (phone10.startsWith('91') && phone10.length === 12)
                phone10 = phone10.substring(2);
            const { contact, wasNewlyCreated } = await this.findOrCreateContact(organizationId, phone10);
            let conversation = await database_1.default.conversation.findFirst({
                where: { organizationId, contactId: contact.id },
            });
            if (!conversation) {
                try {
                    conversation = await database_1.default.conversation.create({
                        data: {
                            organization: { connect: { id: organizationId } },
                            contact: { connect: { id: contact.id } },
                            isWindowOpen: true,
                            windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                            unreadCount: 0,
                            isRead: false,
                            lastMessageAt: messageTime,
                        },
                    });
                    console.log(`💬 Created new conversation: ${conversation.id}`);
                }
                catch (error) {
                    if (error.code === 'P2002') {
                        conversation = await database_1.default.conversation.findFirst({
                            where: { organizationId, contactId: contact.id },
                        });
                        if (!conversation)
                            throw error;
                    }
                    else {
                        throw error;
                    }
                }
            }
            let content = '';
            let mediaUrl = null;
            let mediaType = null;
            let mediaMimeType = null;
            let mediaId = null;
            let fileName = null;
            // Handle different message types
            switch (typeRaw) {
                case 'text':
                    content = message.text?.body || '';
                    break;
                case 'image':
                    mediaId = message.image?.id;
                    mediaMimeType = message.image?.mime_type || 'image/jpeg';
                    content = message.image?.caption || '[Image]';
                    mediaType = 'image';
                    // ✅ Store the permanent mediaId as mediaUrl — proxy fetches fresh CDN URL on demand
                    if (mediaId)
                        mediaUrl = mediaId;
                    break;
                case 'video':
                    mediaId = message.video?.id;
                    mediaMimeType = message.video?.mime_type || 'video/mp4';
                    content = message.video?.caption || '[Video]';
                    mediaType = 'video';
                    // ✅ Store permanent mediaId
                    if (mediaId)
                        mediaUrl = mediaId;
                    break;
                case 'audio':
                    mediaId = message.audio?.id;
                    mediaMimeType = message.audio?.mime_type || 'audio/ogg';
                    content = '[Audio]';
                    mediaType = 'audio';
                    // ✅ Store permanent mediaId
                    if (mediaId)
                        mediaUrl = mediaId;
                    break;
                case 'document':
                    mediaId = message.document?.id;
                    mediaMimeType = message.document?.mime_type || 'application/pdf';
                    fileName = message.document?.filename || 'document';
                    content = message.document?.caption || `[Document: ${fileName}]`;
                    mediaType = 'document';
                    // ✅ Store permanent mediaId
                    if (mediaId)
                        mediaUrl = mediaId;
                    break;
                case 'sticker':
                    mediaId = message.sticker?.id;
                    mediaMimeType = message.sticker?.mime_type || 'image/webp';
                    content = '[Sticker]';
                    mediaType = 'sticker';
                    // ✅ Store permanent mediaId
                    if (mediaId)
                        mediaUrl = mediaId;
                    break;
                case 'location':
                    const lat = message.location?.latitude;
                    const lng = message.location?.longitude;
                    content = `[Location: ${lat}, ${lng}]`;
                    mediaType = 'location';
                    mediaUrl = JSON.stringify({
                        latitude: lat,
                        longitude: lng,
                        name: message.location?.name,
                        address: message.location?.address,
                    });
                    break;
                case 'contacts':
                    content = '[Contact Card]';
                    mediaType = 'contact';
                    mediaUrl = JSON.stringify(message.contacts);
                    break;
                case 'interactive':
                    const iType = message?.interactive?.type;
                    content = iType === 'button_reply' ? message.interactive.button_reply.title :
                        iType === 'list_reply' ? message.interactive.list_reply.title : '[Interactive]';
                    break;
                default:
                    content = `[${typeRaw}]`;
            }
            const savedMessage = await database_1.default.message.create({
                data: {
                    conversationId: conversation.id,
                    whatsappAccountId,
                    waMessageId,
                    wamId: waMessageId,
                    direction: 'INBOUND',
                    type: msgType,
                    content,
                    mediaUrl,
                    mediaType,
                    mediaMimeType,
                    mediaId,
                    fileName,
                    status: 'DELIVERED',
                    sentAt: messageTime,
                    deliveredAt: messageTime,
                    timestamp: messageTime,
                    createdAt: messageTime,
                },
            });
            const updatedConversation = await database_1.default.conversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: messageTime,
                    lastMessagePreview: (content || `[${typeRaw}]`).substring(0, 100),
                    lastCustomerMessageAt: messageTime,
                    unreadCount: { increment: 1 },
                    isRead: false,
                    isWindowOpen: true,
                    windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
                include: {
                    contact: {
                        select: {
                            id: true,
                            phone: true,
                            firstName: true,
                            lastName: true,
                            avatar: true,
                            whatsappProfileName: true,
                        },
                    },
                },
            });
            await database_1.default.contact.update({
                where: { id: contact.id },
                data: {
                    lastMessageAt: messageTime,
                    messageCount: { increment: 1 },
                },
            });
            console.log(`✅ Inbound message saved and conversation updated: ${updatedConversation.id}`);
            // ✅ AUTOMATION TRIGGERS - Clean Logic
            try {
                if (wasNewlyCreated) {
                    // 🆕 Brand new contact - UNKNOWN_MESSAGE trigger
                    console.log(`🤖 New contact detected → triggerUnknownMessage`);
                    await automation_engine_1.automationEngine.triggerUnknownMessage({
                        organizationId,
                        contactId: contact.id,
                        phone: waFrom, // ✅ Full number with country code (e.g. 917982722016)
                        message: content,
                        conversationId: updatedConversation.id,
                    });
                }
                else {
                    // 👤 Existing contact - KEYWORD trigger check
                    console.log(`🔑 Existing contact → triggerKeyword check`);
                    const triggered = await automation_engine_1.automationEngine.triggerKeyword({
                        organizationId,
                        contactId: contact.id,
                        phone: waFrom, // ✅ Full number with country code
                        message: content,
                        conversationId: updatedConversation.id,
                    });
                    if (triggered) {
                        console.log('🤖 Keyword automation triggered for existing contact');
                    }
                }
            }
            catch (automationError) {
                // ✅ Automation error inbox ko affect na kare
                console.error('🤖 Automation error (non-blocking):', automationError);
            }
            // ✅ Button click handler - dono cases me check karo
            if (msgType === 'INTERACTIVE') {
                const buttonId = message?.interactive?.button_reply?.id;
                if (buttonId) {
                    automation_engine_1.automationEngine.handleButtonClick({
                        organizationId,
                        contactId: contact.id,
                        buttonId,
                        conversationId: updatedConversation.id,
                    }).catch((e) => console.error('Button click error:', e));
                }
            }
            // ✅ Clear inbox cache
            const { inboxService } = await Promise.resolve().then(() => __importStar(require('../inbox/inbox.service')));
            await inboxService.clearCache(organizationId);
            // ✅ Emit events
            exports.webhookEvents.emit('newMessage', {
                organizationId,
                conversationId: updatedConversation.id,
                conversation: {
                    ...updatedConversation,
                    contact: {
                        ...updatedConversation.contact,
                        name: updatedConversation.contact.whatsappProfileName ||
                            (updatedConversation.contact.firstName
                                ? `${updatedConversation.contact.firstName} ${updatedConversation.contact.lastName || ''}`.trim()
                                : updatedConversation.contact.phone)
                    }
                },
                message: {
                    ...savedMessage,
                },
            });
            // Transform contact to include name for frontend compatibility
            const contactWithBotName = {
                ...updatedConversation.contact,
                name: updatedConversation.contact.whatsappProfileName ||
                    (updatedConversation.contact.firstName
                        ? `${updatedConversation.contact.firstName} ${updatedConversation.contact.lastName || ''}`.trim()
                        : updatedConversation.contact.phone)
            };
            exports.webhookEvents.emit('conversationUpdated', {
                organizationId,
                conversation: {
                    ...updatedConversation,
                    contact: contactWithBotName
                },
            });
            // ✅ Trigger Chatbot Engine
            if (msgType === 'TEXT' || msgType === 'INTERACTIVE') {
                // isNewConversation = true if:
                // 1. Contact was just created (brand new), OR
                // 2. This is the first message in this conversation (messageCount was 0 before this)
                const isNewConversation = wasNewlyCreated || (updatedConversation.unreadCount <= 1);
                // For button/list replies, pass the button ID too so engine can match edges
                let chatbotContent = content || '';
                if (msgType === 'INTERACTIVE') {
                    const iType = message?.interactive?.type;
                    if (iType === 'button_reply') {
                        // Pass both id and title so engine can match either
                        chatbotContent = message.interactive.button_reply.id || message.interactive.button_reply.title || content || '';
                    }
                    else if (iType === 'list_reply') {
                        chatbotContent = message.interactive.list_reply.id || message.interactive.list_reply.title || content || '';
                    }
                }
                chatbot_engine_1.chatbotEngine.processMessage(updatedConversation.id, organizationId, chatbotContent, waFrom, isNewConversation).catch(e => console.error('🤖 Chatbot engine trigger error:', e));
            }
        }
        catch (e) {
            console.error('processIncomingMessage error:', e);
        }
    }
    // -----------------------------
    // ✅ Status update processing - FIXED FOR TICK MARKS
    // -----------------------------
    async processStatusUpdate(statusObj, organizationId, whatsappAccountId) {
        try {
            const waMessageId = String(statusObj?.id || '');
            const st = String(statusObj?.status || '').toLowerCase();
            const ts = Number(statusObj?.timestamp || Date.now() / 1000);
            const statusTime = new Date(ts * 1000);
            if (!waMessageId) {
                console.warn('⚠️ No waMessageId in status update');
                return;
            }
            console.log(`📬 Processing status update: ${waMessageId} -> ${st}`);
            // ✅ Find message by waMessageId OR wamId
            let message = await database_1.default.message.findFirst({
                where: {
                    OR: [
                        { waMessageId },
                        { wamId: waMessageId },
                    ],
                },
                include: {
                    conversation: {
                        select: {
                            id: true,
                            contactId: true,
                            organizationId: true,
                        },
                    },
                },
            });
            // ✅ Race Condition Fix: If message not found, wait and retry
            // (Meta sometimes sends status updates faster than we can save the message)
            let retries = 3;
            while (!message && retries > 0) {
                console.log(`⏳ Message not found yet, retrying in 1s for waMessageId: ${waMessageId} (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                message = await database_1.default.message.findFirst({
                    where: {
                        OR: [
                            { waMessageId },
                            { wamId: waMessageId },
                        ],
                    },
                    include: {
                        conversation: {
                            select: {
                                id: true,
                                contactId: true,
                                organizationId: true,
                            },
                        },
                    },
                });
                retries--;
            }
            if (!message) {
                console.log(`⚠️ Message still not found for waMessageId: ${waMessageId}`);
                // Optionally: We could "stub" the message here if we had recipient_id
                return;
            }
            // Map status
            let newStatus = 'SENT';
            if (st === 'sent')
                newStatus = 'SENT';
            if (st === 'delivered')
                newStatus = 'DELIVERED';
            if (st === 'read')
                newStatus = 'READ';
            if (st === 'failed')
                newStatus = 'FAILED';
            // ✅ Update message
            const updatedMessage = await database_1.default.message.update({
                where: { id: message.id },
                data: {
                    status: newStatus,
                    statusUpdatedAt: statusTime,
                    ...(st === 'sent' ? { sentAt: statusTime } : {}),
                    ...(st === 'delivered' ? { deliveredAt: statusTime } : {}),
                    ...(st === 'read' ? { readAt: statusTime } : {}),
                    ...(st === 'failed'
                        ? {
                            failedAt: statusTime,
                            failureReason: statusObj?.errors?.[0]?.message || 'Unknown error',
                        }
                        : {}),
                },
            });
            console.log(`✅ Message status updated: ${message.id} -> ${newStatus}`);
            if (newStatus === 'FAILED') {
                console.error(`❌ Message ${message.id} failed. Meta Error:`, JSON.stringify(statusObj?.errors || [], null, 2));
            }
            // Retrieve metadata for tempId/clientMsgId
            const metadata = message.metadata || {};
            // ✅ CRITICAL: Emit socket event for real-time update
            exports.webhookEvents.emit('messageStatus', {
                organizationId: message.conversation?.organizationId || organizationId,
                conversationId: message.conversationId,
                messageId: message.id,
                waMessageId: message.waMessageId,
                wamId: message.wamId,
                status: newStatus,
                failureReason: updatedMessage.failureReason,
                timestamp: statusTime.toISOString(),
                tempId: metadata.tempId,
                clientMsgId: metadata.clientMsgId
            });
            // ✅ Update CampaignContact if this is a campaign message
            await this.updateCampaignContactStatus(waMessageId, newStatus, statusTime, updatedMessage.failureReason || undefined);
        }
        catch (e) {
            console.error('processStatusUpdate error:', e);
        }
    }
    // ✅ Campaign contact status sync
    async updateCampaignContactStatus(waMessageId, newStatus, statusTime, failureReason) {
        try {
            const campaignContact = await database_1.default.campaignContact.findFirst({
                where: { waMessageId },
                include: {
                    campaign: {
                        select: {
                            id: true,
                            organizationId: true,
                            status: true,
                            totalContacts: true,
                            sentCount: true,
                            deliveredCount: true,
                            readCount: true,
                            failedCount: true
                        }
                    },
                    contact: { select: { phone: true } },
                },
            });
            if (!campaignContact)
                return;
            console.log(`📊 Found campaign contact: ${campaignContact.id}`);
            const currentStatus = campaignContact.status;
            const statusPriority = {
                'PENDING': 0,
                'QUEUED': 0.5,
                'SENT': 1,
                'DELIVERED': 2,
                'READ': 3,
                'FAILED': -1,
            };
            const currentPriority = statusPriority[currentStatus] ?? 0;
            const newPriority = statusPriority[newStatus] ?? 0;
            // Only update if it's a new "better" status (except FAILED which is terminal)
            if (newPriority <= currentPriority && newStatus !== 'FAILED') {
                return;
            }
            // 1. Update CampaignContact record
            await database_1.default.campaignContact.updateMany({
                where: { id: campaignContact.id },
                data: {
                    status: newStatus,
                    ...(newStatus === 'DELIVERED' ? { deliveredAt: statusTime } : {}),
                    ...(newStatus === 'READ' ? { readAt: statusTime } : {}),
                    ...(newStatus === 'FAILED' ? { failedAt: statusTime, failureReason: failureReason || 'Delivery failed' } : {}),
                },
            });
            console.log(`✅ Campaign contact updated: ${campaignContact.id} -> ${newStatus}`);
            // 2. Prepare Campaign counter updates
            const campaignUpdateData = {};
            if (newStatus === 'DELIVERED' && currentStatus !== 'DELIVERED' && currentStatus !== 'READ') {
                campaignUpdateData.deliveredCount = { increment: 1 };
            }
            else if (newStatus === 'READ' && currentStatus !== 'READ') {
                campaignUpdateData.readCount = { increment: 1 };
                // If it jumped from SENT to READ, increment delivered count too
                if (currentStatus !== 'DELIVERED') {
                    campaignUpdateData.deliveredCount = { increment: 1 };
                }
            }
            else if (newStatus === 'FAILED' && currentStatus !== 'FAILED') {
                campaignUpdateData.failedCount = { increment: 1 };
            }
            let campaign = campaignContact.campaign;
            // 3. Apply counter updates to Campaign if needed
            if (campaign && Object.keys(campaignUpdateData).length > 0) {
                campaign = await database_1.default.campaign.update({
                    where: { id: campaignContact.campaignId },
                    data: campaignUpdateData,
                    select: {
                        id: true,
                        organizationId: true,
                        status: true,
                        totalContacts: true,
                        sentCount: true,
                        deliveredCount: true,
                        readCount: true,
                        failedCount: true
                    }
                });
                console.log(`📈 Updated campaign counters for: ${campaign.id}`);
            }
            // 4. Emit real-time updates via Socket.IO
            const orgId = campaign?.organizationId || campaignContact.campaign?.organizationId;
            const contactPhone = campaignContact.contact?.phone || '';
            if (orgId) {
                Promise.resolve().then(() => __importStar(require('../campaigns/campaigns.socket'))).then(({ campaignSocketService }) => {
                    // A. Emit individual contact status update
                    campaignSocketService.emitContactStatus(orgId, campaignContact.campaignId, {
                        contactId: campaignContact.contactId,
                        phone: contactPhone,
                        status: newStatus,
                        messageId: waMessageId,
                        error: failureReason
                    });
                    // B. Emit overall campaign progress update if campaign was updated
                    if (campaign) {
                        const processed = (campaign.sentCount || 0) + (campaign.failedCount || 0);
                        const total = campaign.totalContacts || 1;
                        const percentage = Math.min(100, Math.round((processed / total) * 100));
                        campaignSocketService.emitCampaignProgress(orgId, campaignContact.campaignId, {
                            sent: campaign.sentCount || 0,
                            failed: campaign.failedCount || 0,
                            delivered: campaign.deliveredCount || 0,
                            read: campaign.readCount || 0,
                            total: campaign.totalContacts,
                            percentage,
                            status: campaign.status,
                        });
                    }
                }).catch(e => console.error('❌ Socket emission failed in webhook:', e));
            }
        }
        catch (e) {
            console.error('updateCampaignContactStatus error:', e);
        }
    }
    // -----------------------------
    // Verify webhook
    // -----------------------------
    verifyWebhook(mode, token, challenge) {
        const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || 'wabmeta_webhook_verify_2024';
        if (mode === 'subscribe' && token === VERIFY_TOKEN)
            return challenge;
        return null;
    }
    // -----------------------------
    // Log webhook
    // -----------------------------
    async logWebhook(payload, status, error) {
        try {
            const value = this.extractValue(payload);
            const phoneNumberId = value?.metadata?.phone_number_id;
            let organizationId = null;
            if (phoneNumberId) {
                // ✅ Use cache in logWebhook too
                const cached = this.accountCache.get(phoneNumberId);
                if (cached && cached.expiresAt > Date.now()) {
                    organizationId = cached.data.organizationId;
                }
                else {
                    const account = await database_1.default.whatsAppAccount.findFirst({
                        where: { phoneNumberId },
                        select: { organizationId: true },
                    });
                    organizationId = account?.organizationId || null;
                    // Fallback to newer PhoneNumber structure
                    if (!organizationId) {
                        try {
                            const phoneRecord = await database_1.default.phoneNumber.findFirst({
                                where: { phoneNumberId },
                                include: { metaConnection: true }
                            });
                            organizationId = phoneRecord?.metaConnection?.organizationId || null;
                        }
                        catch (e) { }
                    }
                }
            }
            const mapped = status === 'processed' ? 'SUCCESS' :
                status === 'error' ? 'FAILED' :
                    status === 'rejected' ? 'FAILED' :
                        status === 'ignored' ? 'SUCCESS' :
                            'SUCCESS';
            await database_1.default.webhookLog.create({
                data: {
                    organizationId,
                    source: 'whatsapp',
                    eventType: payload?.entry?.[0]?.changes?.[0]?.field || 'unknown',
                    payload,
                    status: mapped,
                    processedAt: new Date(),
                    errorMessage: error || null,
                },
            });
        }
        catch (e) {
            console.error('logWebhook error:', e);
        }
    }
    // Optional methods
    async expireConversationWindows() {
        try {
            const now = new Date();
            await database_1.default.conversation.updateMany({
                where: {
                    isWindowOpen: true,
                    windowExpiresAt: { lt: now },
                },
                data: {
                    isWindowOpen: false,
                },
            });
        }
        catch (e) {
            console.error('expireConversationWindows error:', e);
        }
    }
    async resetDailyMessageLimits() {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            await database_1.default.whatsAppAccount.updateMany({
                where: {
                    lastLimitReset: { lt: yesterday },
                },
                data: {
                    dailyMessagesUsed: 0,
                    lastLimitReset: new Date(),
                },
            });
        }
        catch (e) {
            console.error('resetDailyMessageLimits error:', e);
        }
    }
    // ✅ Handle history sync webhook
    async handleHistorySync(payload, value) {
        try {
            console.log('📜 History sync webhook received');
            const wabaId = payload.entry[0].id;
            // Find organization
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { wabaId },
                select: { id: true, organizationId: true, phoneNumberId: true }
            });
            if (!account)
                return;
            // Process historical messages
            const messages = value?.messages || [];
            console.log(`📜 Processing ${messages.length} historical messages`);
            for (const msg of messages) {
                try {
                    await this.processIncomingMessage(msg, account.organizationId, account.id, value?.metadata?.phone_number_id || account.phoneNumberId || '');
                }
                catch (e) {
                    console.error('History message processing error:', e);
                }
            }
            console.log('✅ History sync complete');
        }
        catch (e) {
            console.error('handleHistorySync error:', e);
        }
    }
    // ✅ Handle SMB state sync (contacts sync)
    async handleSmbStateSync(payload, value) {
        try {
            console.log('👥 SMB state sync webhook received');
            const wabaId = payload.entry[0].id;
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { wabaId },
                select: { id: true, organizationId: true }
            });
            if (!account)
                return;
            // Process contacts from SMB app
            const contacts = value?.contacts || [];
            console.log(`👥 Syncing ${contacts.length} contacts from WBA app`);
            for (const contact of contacts) {
                try {
                    const phone = contact.wa_id || contact.phone;
                    const name = contact.profile?.name || 'Unknown';
                    if (phone) {
                        await contacts_service_1.contactsService.updateContactFromWebhook(phone, name, account.organizationId);
                    }
                }
                catch (e) {
                    console.error('SMB contact sync error:', e);
                }
            }
            console.log('✅ SMB state sync complete');
        }
        catch (e) {
            console.error('handleSmbStateSync error:', e);
        }
    }
    // ✅ Handle SMB message echoes
    async handleSmbMessageEchoes(payload, value) {
        try {
            console.log('💬 SMB message echoes webhook received');
            const messages = value?.messages || [];
            // These are messages sent from WBA app
            // We save them as OUTBOUND messages in our system
            for (const msg of messages) {
                console.log('Echo message:', {
                    id: msg.id,
                    to: msg.to,
                    type: msg.type,
                });
                // Process as needed
            }
        }
        catch (e) {
            console.error('handleSmbMessageEchoes error:', e);
        }
    }
    // ✅ Handle calls webhook (inbound & outbound call events)
    async handleCallWebhook(payload, value) {
        try {
            const callData = value?.call || {};
            const callId = callData.id;
            const status = callData.status;
            const direction = callData.direction; // 'inbound' | 'outbound'
            const from = callData.from;
            const to = callData.to;
            const duration = callData.duration;
            console.log(`📞 Call webhook received:`, {
                callId,
                status,
                direction,
                from: from ? String(from).substring(0, 6) : undefined,
            });
            // Phone number se organization find karo
            const phoneNumberId = value?.metadata?.phone_number_id;
            if (!phoneNumberId)
                return;
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { phoneNumberId },
            });
            if (!account)
                return;
            // ✅ Inbound call - contact find/create
            if (direction === 'inbound' && from) {
                const cleanPhone = String(from).replace(/[^0-9]/g, '');
                let phone10 = cleanPhone;
                if (phone10.startsWith('91') && phone10.length === 12) {
                    phone10 = phone10.substring(2);
                }
                // Contact find/create
                let contact = await database_1.default.contact.findFirst({
                    where: {
                        organizationId: account.organizationId,
                        OR: [
                            { phone: phone10 },
                            { phone: `+91${phone10}` },
                            { phone: `91${phone10}` },
                        ],
                    },
                });
                if (!contact) {
                    contact = await database_1.default.contact.create({
                        data: {
                            organizationId: account.organizationId,
                            phone: phone10,
                            firstName: 'Unknown',
                            status: 'ACTIVE',
                            source: 'WHATSAPP_CALL',
                        },
                    });
                    console.log('👤 New contact from inbound call:', phone10);
                }
                // Save call log (non-blocking)
                database_1.default.callLog?.create({
                    data: {
                        organizationId: account.organizationId,
                        whatsappAccountId: account.id,
                        contactId: contact.id,
                        callId: callId || `call_${Date.now()}`,
                        direction: 'INBOUND',
                        status: status || 'received',
                        from: cleanPhone,
                        to: account.phoneNumber,
                        duration: duration || null,
                        startedAt: new Date(),
                        endedAt: status === 'ended' ? new Date() : null,
                    },
                })?.catch((dbErr) => console.warn('Call log DB save failed:', dbErr.message));
                // ✅ Real-time notification emit
                exports.webhookEvents.emit('incomingCall', {
                    organizationId: account.organizationId,
                    callId,
                    from: cleanPhone,
                    contactId: contact.id,
                    contactName: contact.firstName || phone10,
                    status,
                    direction: 'INBOUND',
                    timestamp: new Date().toISOString(),
                });
                console.log(`📞 Inbound call processed from: ${phone10}`);
            }
            // ✅ Outbound call status update
            if (direction === 'outbound' && callId) {
                database_1.default.callLog?.updateMany({
                    where: { callId },
                    data: {
                        status: status || 'updated',
                        duration: duration || undefined,
                        endedAt: status === 'ended' ? new Date() : undefined,
                    },
                })?.catch((dbErr) => console.warn('Call log update failed:', dbErr.message));
                // Status update emit
                exports.webhookEvents.emit('callStatusUpdate', {
                    organizationId: account.organizationId,
                    callId,
                    status,
                    duration,
                    direction: 'OUTBOUND',
                    timestamp: new Date().toISOString(),
                });
            }
            console.log(`✅ Call webhook processed: ${callId} -> ${status}`);
        }
        catch (e) {
            console.error('handleCallWebhook error:', e);
        }
    }
}
exports.WebhookService = WebhookService;
exports.webhookService = new WebhookService();
exports.default = exports.webhookService;
//# sourceMappingURL=webhook.service.js.map