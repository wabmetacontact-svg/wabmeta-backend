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
const phone_1 = require("../../utils/phone");
const instagramService = __importStar(require("../instagram/instagram.service"));
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
            button: 'INTERACTIVE', // ✅ Already hai - sahi hai
            list: 'INTERACTIVE', // ✅ ADD
            template: 'TEMPLATE',
            system: 'TEXT', // ✅ ADD: System messages
            order: 'TEXT', // ✅ ADD: Order messages
            unsupported: 'TEXT', // ✅ ADD: Graceful handling
            unknown: 'TEXT', // ✅ ADD
        };
        return map[t] || 'TEXT'; // ✅ Default TEXT - kabhi "unsupported" nahi
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
    async findOrCreateContact(organizationId, phone // WhatsApp se aata hai: "919876543210" ya "9876543210"
    ) {
        // ✅ toCanonicalPhone use karo - always +91XXXXXXXXXX
        const canonical = (0, phone_1.toCanonicalPhone)(phone) || (0, phone_1.toCanonicalPhone)(`+${phone}`);
        if (!canonical) {
            console.error(`❌ Cannot normalize phone: ${phone}`);
            throw new Error(`Invalid phone: ${phone}`);
        }
        const variants = (0, phone_1.buildPhoneVariants)(canonical);
        let contact = await database_1.default.contact.findFirst({
            where: {
                organizationId,
                OR: variants.map((p) => ({ phone: p })),
            },
        });
        let wasNewlyCreated = false;
        if (!contact) {
            try {
                // ✅ Extract country code
                const ccDigits = canonical.slice(1, -10); // "91"
                const countryCode = `+${ccDigits}`; // "+91"
                contact = await database_1.default.contact.create({
                    data: {
                        organizationId,
                        phone: canonical, // ✅ +91XXXXXXXXXX - consistent!
                        countryCode, // ✅ +91
                        firstName: 'Unknown',
                        status: 'ACTIVE',
                        source: 'WHATSAPP_INBOUND',
                    },
                });
                wasNewlyCreated = true;
                console.log(`👤 New contact: ${canonical}`);
            }
            catch (error) {
                if (error.code === 'P2002') {
                    // Race condition - koi aur create kar diya
                    contact = await database_1.default.contact.findFirst({
                        where: {
                            organizationId,
                            OR: variants.map((p) => ({ phone: p })),
                        },
                    });
                    if (!contact)
                        throw error;
                }
                else {
                    throw error;
                }
            }
        }
        else if (contact.phone !== canonical) {
            // ✅ Purane format ko migrate karo (non-blocking)
            database_1.default.contact.update({
                where: { id: contact.id },
                data: { phone: canonical }
            }).then(() => {
                console.log(`🔄 Migrated: ${contact.phone} → ${canonical}`);
            }).catch(() => { });
            contact.phone = canonical;
        }
        return { contact: contact, wasNewlyCreated };
    }
    // -----------------------------
    // Instagram Webhook Handler
    // -----------------------------
    async handleInstagramEvent(payload) {
        try {
            const entry = payload.entry?.[0];
            // CASE 1: Messages (DMs)
            if (entry?.messaging) {
                const messaging = entry.messaging[0];
                const igUserId = entry.id; // Page/Account ID
                const senderId = messaging.sender.id; // Customer ID
                // Check if it's a message
                if (messaging.message && !messaging.message.is_echo) {
                    const messageText = messaging.message.text;
                    // Logic A: Find Automation Match
                    const match = await instagramService.findMatchingAutomation(igUserId, messageText);
                    if (match && match.isActive) {
                        // MATCH MIL GAYA! Reply bhejna hai
                        console.log(`🤖 IG Automation Match: ${match.name}`);
                        // Call Instagram Graph API to send message
                        const account = await database_1.default.instagramAccount.findUnique({
                            where: { igUserId }
                        });
                        if (account?.accessToken) {
                            const instagramApi = await Promise.resolve().then(() => __importStar(require('../instagram/instagram.api')));
                            if (match.responseText) {
                                await instagramApi.sendIGMessage(account.accessToken, senderId, match.responseText);
                            }
                        }
                        // Update stats
                        await database_1.default.igDmAutomation.update({
                            where: { id: match.id },
                            data: { repliesCount: { increment: 1 }, lastTriggeredAt: new Date() }
                        });
                    }
                }
            }
            // CASE 2: Comments (Changes)
            if (entry?.changes) {
                const change = entry.changes[0];
                // Check if it's a comment on a post
                if (change.field === 'comments' && change.value.verb === 'add') {
                    const commentId = change.value.id;
                    const commentText = change.value.text.toLowerCase();
                    const igUserId = entry.id; // Business Account ID
                    const senderId = change.value.from.id; // Customer IG ID
                    // Don't reply to our own comments
                    if (senderId === igUserId)
                        return { status: 'skipped', reason: 'Own comment' };
                    // 1. Find matching Comment Rule
                    const rule = await database_1.default.igCommentRule.findFirst({
                        where: {
                            igAccount: { igUserId },
                            isActive: true,
                            OR: [
                                { keywords: { has: commentText } },
                                { keywords: { equals: [] } } // Empty array means reply to all
                            ]
                        },
                        include: { igAccount: true }
                    });
                    if (rule) {
                        const token = rule.igAccount.accessToken;
                        const instagramApi = await Promise.resolve().then(() => __importStar(require('../instagram/instagram.api')));
                        // 2. Public Reply to Comment
                        if (rule.commentReply) {
                            await instagramApi.replyToIGComment(token, commentId, rule.commentReply);
                        }
                        // 3. Private DM (Comment-to-DM)
                        if (rule.dmMessage) {
                            await instagramApi.sendIGMessage(token, senderId, rule.dmMessage);
                        }
                        // 4. Increment stats
                        await database_1.default.igCommentRule.update({
                            where: { id: rule.id },
                            data: { triggeredCount: { increment: 1 } }
                        });
                    }
                }
            }
            return { status: 'success', source: 'instagram' };
        }
        catch (error) {
            console.error('❌ Instagram Webhook Error:', error.message);
            return { status: 'failed', error: error.message };
        }
    }
    // -----------------------------
    // Main Handler
    // -----------------------------
    async handleWebhook(payload) {
        try {
            console.log('📨 Webhook received');
            // 1. Check karein ki ye Instagram event hai ya WhatsApp
            // Instagram payload mein 'object: instagram' hota hai
            if (payload.object === 'instagram') {
                return await this.handleInstagramEvent(payload);
            }
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
                            // ✅ FIX: Find the actual WhatsAppAccount using phoneNumber to get the correct ID
                            const waAccount = await database_1.default.whatsAppAccount.findFirst({
                                where: { phoneNumber: phoneRecord.phoneNumber, organizationId: phoneRecord.metaConnection.organizationId }
                            });
                            account = {
                                id: waAccount ? waAccount.id : null, // ✅ Using WhatsAppAccount ID, not PhoneNumber ID
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
            if (!waFrom || !waMessageId) {
                console.warn('⚠️ Invalid message - missing from/id');
                return;
            }
            console.log(`📥 Inbound: ${waMessageId} from ${waFrom} type=${typeRaw}`);
            // ✅ Duplicate check - same waMessageId already saved?
            const existingMsg = await database_1.default.message.findFirst({
                where: {
                    OR: [
                        { waMessageId },
                        { wamId: waMessageId },
                    ],
                },
                select: { id: true },
            });
            if (existingMsg) {
                console.log(`⏭️ Duplicate message skipped: ${waMessageId}`);
                return;
            }
            // Contact find/create
            const { contact, wasNewlyCreated } = await this.findOrCreateContact(organizationId, waFrom);
            // Conversation find/create
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
                    console.log(`💬 New conversation: ${conversation.id}`);
                }
                catch (err) {
                    if (err.code === 'P2002') {
                        conversation = await database_1.default.conversation.findFirst({
                            where: { organizationId, contactId: contact.id },
                        });
                        if (!conversation)
                            throw err;
                    }
                    else {
                        throw err;
                    }
                }
            }
            // ✅ Content + media parse
            let content = '';
            let mediaUrl = null;
            let mediaType = null;
            let mediaMimeType = null;
            let mediaId = null;
            let fileName = null;
            switch (typeRaw) {
                case 'text':
                    content = message.text?.body || '';
                    break;
                case 'image':
                    mediaId = message.image?.id;
                    mediaMimeType = message.image?.mime_type || 'image/jpeg';
                    content = message.image?.caption || '[Image]';
                    mediaType = 'image';
                    if (mediaId)
                        mediaUrl = mediaId;
                    break;
                case 'video':
                    mediaId = message.video?.id;
                    mediaMimeType = message.video?.mime_type || 'video/mp4';
                    content = message.video?.caption || '[Video]';
                    mediaType = 'video';
                    if (mediaId)
                        mediaUrl = mediaId;
                    break;
                case 'audio':
                    mediaId = message.audio?.id;
                    mediaMimeType = message.audio?.mime_type || 'audio/ogg';
                    content = '[Audio]';
                    mediaType = 'audio';
                    if (mediaId)
                        mediaUrl = mediaId;
                    break;
                case 'document':
                    mediaId = message.document?.id;
                    mediaMimeType = message.document?.mime_type || 'application/pdf';
                    fileName = message.document?.filename || 'document';
                    content = message.document?.caption || `[Document: ${fileName}]`;
                    mediaType = 'document';
                    if (mediaId)
                        mediaUrl = mediaId;
                    break;
                case 'sticker':
                    mediaId = message.sticker?.id;
                    mediaMimeType = message.sticker?.mime_type || 'image/webp';
                    content = '[Sticker]';
                    mediaType = 'sticker';
                    if (mediaId)
                        mediaUrl = mediaId;
                    break;
                case 'location':
                    content = `[Location: ${message.location?.latitude}, ${message.location?.longitude}]`;
                    mediaType = 'location';
                    mediaUrl = JSON.stringify({
                        latitude: message.location?.latitude,
                        longitude: message.location?.longitude,
                        name: message.location?.name,
                        address: message.location?.address,
                    });
                    break;
                case 'contacts':
                    content = '[Contact Card]';
                    mediaType = 'contact';
                    mediaUrl = JSON.stringify(message.contacts);
                    break;
                case 'interactive': {
                    const iType = message?.interactive?.type;
                    if (iType === 'button_reply') {
                        content = message.interactive.button_reply?.title || '[Button Reply]';
                        // ✅ Full structure save karo metadata mein
                        mediaUrl = JSON.stringify({
                            type: 'button_reply',
                            button_reply: {
                                id: message.interactive.button_reply?.id,
                                title: message.interactive.button_reply?.title,
                            }
                        });
                    }
                    else if (iType === 'list_reply') {
                        content = message.interactive.list_reply?.title || '[List Reply]';
                        mediaUrl = JSON.stringify({
                            type: 'list_reply',
                            list_reply: {
                                id: message.interactive.list_reply?.id,
                                title: message.interactive.list_reply?.title,
                                description: message.interactive.list_reply?.description,
                            }
                        });
                    }
                    else if (iType === 'button') {
                        // ✅ Outbound button message (chatbot ne bheja)
                        content = message.interactive?.body?.text || '[Interactive]';
                        mediaUrl = JSON.stringify(message.interactive);
                    }
                    else if (iType === 'list') {
                        content = message.interactive?.body?.text || '[List]';
                        mediaUrl = JSON.stringify(message.interactive);
                    }
                    else {
                        content = '[Interactive]';
                        mediaUrl = JSON.stringify(message.interactive || {});
                    }
                    break;
                }
                case 'button': {
                    // ✅ Template button reply - user ne template button click kiya
                    content = message.button?.text || '[Button Reply]';
                    mediaUrl = JSON.stringify({
                        type: 'button_reply',
                        button_reply: {
                            id: message.button?.payload || message.button?.text,
                            title: message.button?.text,
                        }
                    });
                    break;
                }
                default:
                    content = `[${typeRaw}]`;
            }
            // ✅ Save message
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
                    // ✅ ADD: Full message structure save karo
                    metadata: {
                        originalType: typeRaw,
                        interactive: message?.interactive || null,
                        button: message?.button || null,
                        context: message?.context || null, // Reply context
                        referral: message?.referral || null,
                    },
                },
            });
            // ✅ Update conversation
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
            // Contact message count update (non-blocking)
            database_1.default.contact.update({
                where: { id: contact.id },
                data: {
                    lastMessageAt: messageTime,
                    messageCount: { increment: 1 },
                },
            }).catch((e) => console.error('Contact update error:', e));
            // ✅ Clear cache (non-blocking)
            Promise.resolve().then(() => __importStar(require('../inbox/inbox.service'))).then(({ inboxService }) => inboxService.clearCache(organizationId))
                .catch((e) => console.error('Cache clear error:', e));
            // ✅ Build contact name for socket payload
            const contactName = updatedConversation.contact.whatsappProfileName ||
                (updatedConversation.contact.firstName
                    ? `${updatedConversation.contact.firstName} ${updatedConversation.contact.lastName || ''}`.trim()
                    : updatedConversation.contact.phone);
            const contactWithName = {
                ...updatedConversation.contact,
                name: contactName,
            };
            // ✅ Emit INBOUND message to socket
            const messagePayload = {
                ...savedMessage,
                createdAt: savedMessage.createdAt instanceof Date ? savedMessage.createdAt.toISOString() : savedMessage.createdAt,
                sentAt: savedMessage.sentAt instanceof Date ? savedMessage.sentAt.toISOString() : savedMessage.sentAt,
                deliveredAt: savedMessage.deliveredAt instanceof Date ? savedMessage.deliveredAt.toISOString() : savedMessage.deliveredAt,
                timestamp: savedMessage.timestamp instanceof Date ? savedMessage.timestamp.toISOString() : savedMessage.timestamp,
            };
            exports.webhookEvents.emit('newMessage', {
                organizationId,
                conversationId: updatedConversation.id,
                message: messagePayload,
                conversation: {
                    ...updatedConversation,
                    contact: contactWithName,
                    lastMessageAt: updatedConversation.lastMessageAt instanceof Date
                        ? updatedConversation.lastMessageAt.toISOString()
                        : updatedConversation.lastMessageAt,
                    windowExpiresAt: updatedConversation.windowExpiresAt instanceof Date
                        ? updatedConversation.windowExpiresAt.toISOString()
                        : updatedConversation.windowExpiresAt,
                },
            });
            exports.webhookEvents.emit('conversationUpdated', {
                organizationId,
                conversation: {
                    ...updatedConversation,
                    contact: contactWithName,
                    lastMessageAt: updatedConversation.lastMessageAt instanceof Date
                        ? updatedConversation.lastMessageAt.toISOString()
                        : updatedConversation.lastMessageAt,
                    windowExpiresAt: updatedConversation.windowExpiresAt instanceof Date
                        ? updatedConversation.windowExpiresAt.toISOString()
                        : updatedConversation.windowExpiresAt,
                },
            });
            // ✅ Automations (non-blocking)
            this.runAutomations(wasNewlyCreated, organizationId, contact, content, waFrom, updatedConversation, message, msgType).catch((e) => console.error('Automation error:', e));
            // ✅ Push Notification (non-blocking)
            database_1.default.organization.findUnique({
                where: { id: organizationId },
                select: { ownerId: true },
            }).then((org) => {
                if (org && org.ownerId) {
                    Promise.resolve().then(() => __importStar(require('../notifications/webpush.service'))).then(({ webpushService }) => {
                        webpushService.sendNotificationToUser(org.ownerId, {
                            title: `Message from ${contactWithName.name}`,
                            body: content || `[${typeRaw}]`,
                            url: `/dashboard/inbox`,
                        });
                    }).catch((err) => console.error('Push Notification error:', err));
                }
            }).catch((err) => console.error('Error fetching org owner for push:', err));
            // ✅ Chatbot (non-blocking)
            if (msgType === 'TEXT' || msgType === 'INTERACTIVE') {
                let chatbotContent = content;
                if (msgType === 'INTERACTIVE') {
                    const iType = message?.interactive?.type;
                    chatbotContent = iType === 'button_reply'
                        ? (message.interactive.button_reply.id || message.interactive.button_reply.title || content)
                        : iType === 'list_reply'
                            ? (message.interactive.list_reply.id || message.interactive.list_reply.title || content)
                            : content;
                }
                const isNewConversation = wasNewlyCreated || updatedConversation.unreadCount <= 1;
                chatbot_engine_1.chatbotEngine.processMessage(updatedConversation.id, organizationId, chatbotContent, waFrom, isNewConversation, message).catch((e) => console.error('Chatbot error:', e));
            }
            console.log(`✅ Inbound message processed: ${savedMessage.id}`);
        }
        catch (e) {
            console.error('processIncomingMessage error:', e);
        }
    }
    // ✅ Helper method - automations alag karo
    async runAutomations(wasNewlyCreated, organizationId, contact, content, waFrom, conversation, message, msgType) {
        try {
            if (wasNewlyCreated) {
                await automation_engine_1.automationEngine.triggerUnknownMessage({
                    organizationId,
                    contactId: contact.id,
                    phone: waFrom,
                    message: content,
                    conversationId: conversation.id,
                });
                await automation_engine_1.automationEngine.triggerNewContact({
                    organizationId,
                    contactId: contact.id,
                    phone: waFrom,
                    message: content,
                    conversationId: conversation.id,
                });
            }
            else {
                await automation_engine_1.automationEngine.triggerKeyword({
                    organizationId,
                    contactId: contact.id,
                    phone: waFrom,
                    message: content,
                    conversationId: conversation.id,
                });
            }
            // Button click
            if (msgType === 'INTERACTIVE') {
                const buttonId = message?.interactive?.button_reply?.id;
                if (buttonId) {
                    await automation_engine_1.automationEngine.handleButtonClick({
                        organizationId,
                        contactId: contact.id,
                        buttonId,
                        conversationId: conversation.id,
                    });
                }
            }
        }
        catch (e) {
            console.error('runAutomations error:', e);
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
                            failedCount: true,
                            template: {
                                select: { name: true, category: true, language: true }
                            }
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
                // ✅ REFUND WALLET FOR FAILED MESSAGE
                if (campaignContact.campaign && campaignContact.campaign.template) {
                    try {
                        const template = campaignContact.campaign.template;
                        const { getRateForCategory } = await Promise.resolve().then(() => __importStar(require('../wallet/wallet.deduction.service')));
                        const rateRupees = getRateForCategory(template.category || 'MARKETING', campaignContact.contact?.phone || '', template.language);
                        const refundPaise = Math.round(rateRupees * 100);
                        if (refundPaise > 0) {
                            await database_1.default.$transaction(async (tx) => {
                                const wallet = await tx.wallet.findUnique({ where: { organizationId: campaignContact.campaign.organizationId } });
                                if (wallet) {
                                    const balanceBefore = wallet.balancePaise;
                                    const balanceAfter = balanceBefore + refundPaise;
                                    await tx.wallet.update({
                                        where: { id: wallet.id },
                                        data: { balancePaise: balanceAfter }
                                    });
                                    await tx.walletTransaction.create({
                                        data: {
                                            walletId: wallet.id,
                                            type: 'credit',
                                            amountPaise: refundPaise,
                                            balanceBeforePaise: balanceBefore,
                                            balanceAfterPaise: balanceAfter,
                                            description: `Refund: Failed campaign message (${campaignContact.contact?.phone}) - ${template.name}`,
                                            status: 'completed',
                                            metaChargeId: waMessageId,
                                            metaService: 'template_message_refund',
                                            note: `Campaign Refund (ID: ${campaignContact.campaign.id})`,
                                        }
                                    });
                                    console.log(`💰 Refunded ₹${rateRupees.toFixed(2)} to wallet for failed message to ${campaignContact.contact?.phone}`);
                                }
                            });
                        }
                    }
                    catch (refundErr) {
                        console.error('❌ Failed to process wallet refund:', refundErr.message);
                    }
                }
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