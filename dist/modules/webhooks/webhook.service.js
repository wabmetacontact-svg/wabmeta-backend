"use strict";
// src/modules/webhooks/webhook.service.ts - FIXED VERSION
// ✅ FIX: updateCampaignContactStatus refund is now IDEMPOTENT.
// Previously, if Meta sent the same 'failed' status webhook twice (which happens
// on webhook retries or if two events arrive concurrently), BOTH invocations would
// read the same stale currentStatus (non-FAILED) and BOTH would credit the wallet
// — meaning one failed message could be refunded 2x (or more).
//
// The refund path checks "does a completed refund already exist for this
// waMessageId?" before crediting. NOTE: the transaction runs at READ COMMITTED,
// not SERIALIZABLE, and there is no unique constraint on
// (metaChargeId, metaService), so two concurrent deliveries of the same status
// webhook (Meta retries) can both pass the check and double-refund. The credit
// itself is now atomic; the duplicate-refund gap needs a unique index — see
// BACKEND_AUDIT_FINDINGS Phase 41.
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
const logger_1 = require("../../utils/logger");
const chatbot_engine_1 = require("../chatbot/chatbot.engine");
const automation_engine_1 = require("../automation/automation.engine");
const optOut_1 = require("../contacts/optOut");
const phone_1 = require("../../utils/phone");
const instagramService = __importStar(require("../instagram/instagram.service"));
const notifications_service_1 = require("../notifications/notifications.service");
exports.webhookEvents = new events_1.EventEmitter();
exports.webhookEvents.setMaxListeners(100);
class WebhookService {
    refundQueue = [];
    refundProcessing = false;
    emergencyLoggedCampaigns = new Set();
    accountCache = new Map();
    CACHE_TTL = 5 * 60 * 1000;
    // Meta ka phoneNumberId -> hamara PhoneNumber.id (UUID). Ye mapping
    // practically immutable hai, isliye accountCache jaisa TTL cache safe hai.
    phoneNumberUUIDCache = new Map();
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
            system: 'TEXT',
            order: 'TEXT',
            unsupported: 'TEXT',
            unknown: 'TEXT',
        };
        return map[t] || 'TEXT';
    }
    buildContentAndMedia(message) {
        const type = String(message?.type || 'text').toLowerCase();
        if (type === 'text')
            return { content: message?.text?.body || '', mediaUrl: null };
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
    // ============================================
    // ✅ FIX 1: findOrCreateContact - UPSERT
    // ============================================
    async findOrCreateContact(organizationId, phone, profileName) {
        const goodName = profileName && profileName !== 'Unknown' ? profileName : null;
        const canonical = (0, phone_1.toCanonicalPhone)(phone) || (0, phone_1.toCanonicalPhone)(`+${phone}`);
        if (!canonical) {
            console.error(`❌ Cannot normalize phone: ${phone}`);
            throw new Error(`Invalid phone: ${phone}`);
        }
        const variants = (0, phone_1.buildPhoneVariants)(canonical);
        // ✅ STEP 1: Fast path - findFirst with all variants
        const existing = await database_1.default.contact.findFirst({
            where: {
                organizationId,
                OR: variants.map((p) => ({ phone: p })),
            },
        });
        if (existing) {
            // Phone migration + WhatsApp profile name refresh - dono ek hi background
            // write mein. Message delivery inme se kisi ke liye nahi rukti.
            const patch = {};
            if (existing.phone !== canonical)
                patch.phone = canonical;
            const nameChanged = !!goodName && existing.firstName !== goodName;
            if (nameChanged) {
                patch.firstName = goodName;
                patch.whatsappProfileName = goodName;
                patch.whatsappProfileFetched = true;
                patch.lastProfileFetchAt = new Date();
            }
            if (Object.keys(patch).length > 0) {
                database_1.default.contact
                    .update({ where: { id: existing.id }, data: patch })
                    .catch((e) => console.error('Contact profile update error:', e?.message));
            }
            // Emit ke liye naya naam turant chahiye, isliye locally merge kar do
            return {
                contact: nameChanged ? { ...existing, ...patch } : existing,
                wasNewlyCreated: false,
            };
        }
        // ✅ STEP 2: Upsert - handles race condition automatically
        try {
            const ccDigits = canonical.slice(1, -10);
            const countryCode = ccDigits ? `+${ccDigits}` : '+91';
            const contact = await database_1.default.contact.upsert({
                where: {
                    organizationId_phone: {
                        organizationId,
                        phone: canonical,
                    },
                },
                create: {
                    organizationId,
                    phone: canonical,
                    countryCode,
                    firstName: goodName || 'Unknown',
                    status: 'ACTIVE',
                    source: 'WHATSAPP_INBOUND',
                    ...(goodName
                        ? {
                            whatsappProfileName: goodName,
                            whatsappProfileFetched: true,
                            lastProfileFetchAt: new Date(),
                        }
                        : {}),
                },
                update: goodName
                    ? {
                        firstName: goodName,
                        whatsappProfileName: goodName,
                        whatsappProfileFetched: true,
                        lastProfileFetchAt: new Date(),
                    }
                    : {
                    // ✅ Contact already exists (race condition)
                    // Touch nothing - just return existing data
                    },
            });
            // ✅ createdAt recency check - naya hai ya existing (race condition se aaya)?
            const createdMsAgo = Date.now() - new Date(contact.createdAt).getTime();
            const wasNewlyCreated = createdMsAgo < 5000; // 5 second window
            if (wasNewlyCreated) {
                console.log(`👤 New contact created: ${canonical}`);
                // ✅ Subscription update async - don't block webhook processing
                database_1.default.subscription.updateMany({
                    where: { organizationId },
                    data: { contactsUsed: { increment: 1 } },
                }).catch((e) => console.error('Subscription increment error:', e));
            }
            return { contact, wasNewlyCreated };
        }
        catch (error) {
            // ✅ P2002 = Race condition even after upsert
            // (happens when variant phone exists, not canonical)
            if (error.code === 'P2002') {
                console.warn(`⚠️ P2002 race on contact ${canonical}, finding existing...`);
                const fallback = await database_1.default.contact.findFirst({
                    where: {
                        organizationId,
                        OR: variants.map((p) => ({ phone: p })),
                    },
                });
                if (fallback)
                    return { contact: fallback, wasNewlyCreated: false };
            }
            console.error('findOrCreateContact fatal error:', error);
            throw error;
        }
    }
    // ============================================
    // ✅ FIXED: findOrCreateConversation
    // Problem: phoneNumberId (Meta's string like "919923983062") 
    // directly Conversation.phoneNumberId mein store ho raha tha
    // lekin schema mein Conversation.phoneNumberId → PhoneNumber.id (UUID) hai
    // Solution: PhoneNumber table se actual UUID dhundo, agar na mile toh null
    // ============================================
    // Meta phoneNumberId -> PhoneNumber.id (UUID), cached.
    // Pehle ye lookup findOrCreateConversation ke andar tha, yaani har inbound
    // message par ek extra sequential DB round trip. Ab cached hai aur baaki
    // lookups ke saath parallel chalta hai.
    async resolvePhoneNumberUUID(metaPhoneNumberId) {
        if (!metaPhoneNumberId)
            return null;
        const cached = this.phoneNumberUUIDCache.get(metaPhoneNumberId);
        if (cached && cached.expiresAt > Date.now())
            return cached.id;
        try {
            const phoneRecord = await database_1.default.phoneNumber.findFirst({
                where: { phoneNumberId: metaPhoneNumberId }, // Meta's string ID
                select: { id: true }, // Hamara UUID chahiye
            });
            if (!phoneRecord) {
                // PhoneNumber table mein nahi mila - null rakho (field optional hai).
                // Negative result cache mat karo, number baad mein register ho sakta hai.
                console.warn(`⚠️ PhoneNumber not found for metaPhoneNumberId: ${metaPhoneNumberId} ` +
                    `- conversation will have null phoneNumberId`);
                return null;
            }
            this.phoneNumberUUIDCache.set(metaPhoneNumberId, {
                id: phoneRecord.id,
                expiresAt: Date.now() + this.CACHE_TTL,
            });
            return phoneRecord.id; // ✅ Actual FK-valid UUID
        }
        catch (e) {
            console.error('PhoneNumber lookup error:', e);
            // Fail silently - null phoneNumberId se conversation ban sakti hai
            return null;
        }
    }
    async findOrCreateConversation(organizationId, contactId, metaPhoneNumberId, // sirf logging ke liye
    messageTime, phoneNumberUUID // pehle se resolve kiya hua (cached)
    ) {
        // ✅ Conversation upsert with valid UUID (or null)
        try {
            const conversation = await database_1.default.conversation.upsert({
                where: {
                    organizationId_contactId_channel: {
                        organizationId,
                        contactId,
                        channel: 'WHATSAPP',
                    },
                },
                create: {
                    organizationId,
                    contactId,
                    // ✅ Only set if valid UUID found, otherwise null (field is optional in schema)
                    ...(phoneNumberUUID ? { phoneNumberId: phoneNumberUUID } : {}),
                    isWindowOpen: true,
                    windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    unreadCount: 0,
                    isRead: false,
                    lastMessageAt: messageTime,
                },
                update: {
                    isWindowOpen: true,
                    windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    // ✅ Update phoneNumberId if we found it and it was null before
                    ...(phoneNumberUUID ? { phoneNumberId: phoneNumberUUID } : {}),
                },
            });
            const createdMsAgo = Date.now() - new Date(conversation.createdAt).getTime();
            if (createdMsAgo < 5000) {
                console.log(`💬 New conversation: ${conversation.id}`);
            }
            return conversation;
        }
        catch (error) {
            // ✅ P2003 - FK violation (safety net, should not happen now)
            if (error.code === 'P2003') {
                console.error(`❌ P2003 FK violation on conversation create. ` +
                    `phoneNumberUUID used: ${phoneNumberUUID}, ` +
                    `metaPhoneNumberId: ${metaPhoneNumberId}. ` +
                    `Retrying without phoneNumberId...`);
                // ✅ Last resort: create without phoneNumberId
                const conversation = await database_1.default.conversation.upsert({
                    where: {
                        organizationId_contactId_channel: { organizationId, contactId, channel: 'WHATSAPP' },
                    },
                    create: {
                        organizationId,
                        contactId,
                        // NO phoneNumberId - avoid FK violation
                        isWindowOpen: true,
                        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        unreadCount: 0,
                        isRead: false,
                        lastMessageAt: messageTime,
                    },
                    update: {
                        isWindowOpen: true,
                        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    },
                });
                return conversation;
            }
            // ✅ P2002 - Race condition fallback
            if (error.code === 'P2002') {
                console.warn('⚠️ P2002 on conversation create, finding existing...');
                const existing = await database_1.default.conversation.findFirst({
                    where: { organizationId, contactId },
                });
                if (existing)
                    return existing;
            }
            throw error;
        }
    }
    // -----------------------------
    // Instagram Webhook Handler (unchanged)
    // -----------------------------
    async handleInstagramEvent(payload) {
        try {
            const entry = payload.entry?.[0];
            if (entry?.messaging) {
                const messaging = entry.messaging[0];
                const igUserId = entry.id;
                const senderId = messaging.sender.id;
                if (messaging.message && !messaging.message.is_echo) {
                    const messageText = messaging.message.text;
                    const igMessageId = messaging.message.mid;
                    const account = await database_1.default.instagramAccount.findUnique({
                        where: { igUserId }
                    });
                    // Store the DM (text or media) in the unified inbox (best-effort).
                    let automationPaused = false;
                    if (account) {
                        try {
                            const { recordInboundIgMessage } = await Promise.resolve().then(() => __importStar(require('../instagram/instagram.inbox')));
                            const conv = await recordInboundIgMessage(account, senderId, { text: messageText, mid: igMessageId, attachments: messaging.message.attachments });
                            automationPaused = !!conv?.automationPaused;
                        }
                        catch (e) {
                            console.error('IG inbox record error:', e?.message || e);
                        }
                    }
                    // Human handoff: once an agent takes over, no channel automation fires.
                    const match = automationPaused ? null : await instagramService.findMatchingAutomation(igUserId, messageText);
                    if (match && match.isActive) {
                        console.log(`🤖 IG Automation Match: ${match.name}`);
                        if (account?.accessToken) {
                            const instagramApi = await Promise.resolve().then(() => __importStar(require('../instagram/instagram.api')));
                            if (match.responseText) {
                                await instagramApi.sendIGMessage(instagramService.igAccessToken(account.accessToken), senderId, match.responseText);
                            }
                        }
                        await database_1.default.igDmAutomation.update({
                            where: { id: match.id },
                            data: { repliesCount: { increment: 1 }, lastTriggeredAt: new Date() }
                        });
                    }
                    // Story mention / reply → auto-reply DM.
                    const attach0 = messaging.message.attachments?.[0];
                    const isStoryMention = attach0?.type === 'story_mention';
                    const isStoryReply = !!messaging.message.reply_to?.story;
                    if ((isStoryMention || isStoryReply) && account?.accessToken && !automationPaused) {
                        const trigger = isStoryReply ? 'reply' : 'mention';
                        const storyRule = await instagramService.findMatchingStoryRule(igUserId, trigger);
                        if (storyRule?.dmMessage) {
                            const instagramApi = await Promise.resolve().then(() => __importStar(require('../instagram/instagram.api')));
                            await instagramApi.sendIGMessage(instagramService.igAccessToken(account.accessToken), senderId, storyRule.dmMessage);
                            await database_1.default.igStoryRule.update({
                                where: { id: storyRule.id },
                                data: { triggeredCount: { increment: 1 } },
                            });
                        }
                    }
                }
            }
            if (entry?.changes) {
                const change = entry.changes[0];
                if (change.field === 'comments' && change.value.verb === 'add') {
                    const commentId = change.value.id;
                    const commentText = change.value.text.toLowerCase();
                    const igUserId = entry.id;
                    const senderId = change.value.from.id;
                    if (senderId === igUserId)
                        return { status: 'skipped', reason: 'Own comment' };
                    const mediaId = change.value.media?.id || change.value.media_id;
                    const rules = await database_1.default.igCommentRule.findMany({
                        where: { igAccount: { igUserId }, isActive: true },
                        include: { igAccount: true },
                    });
                    // Match: post targeting (empty = all posts) + keyword (empty = all comments, else contains).
                    const rule = rules.find((r) => {
                        const postOk = !r.postIds?.length || (mediaId && r.postIds.includes(mediaId));
                        if (!postOk)
                            return false;
                        if (!r.keywords?.length)
                            return true;
                        return r.keywords.some((k) => commentText.includes(String(k).toLowerCase()));
                    });
                    if (rule) {
                        const token = instagramService.igAccessToken(rule.igAccount.accessToken);
                        const instagramApi = await Promise.resolve().then(() => __importStar(require('../instagram/instagram.api')));
                        if (rule.commentReply) {
                            await instagramApi.replyToIGComment(token, commentId, rule.commentReply);
                        }
                        if (rule.dmMessage) {
                            await instagramApi.sendIGMessage(token, senderId, rule.dmMessage);
                        }
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
    // ============================================
    // MAIN WEBHOOK HANDLER
    // ✅ FIX: "📨 Webhook received" log REMOVED
    //    webhook.routes.ts already handle karta hai logging
    //    Yahan rakhne se double log aata tha
    // ============================================
    async handleWebhook(payload) {
        try {
            if (payload.object === 'instagram') {
                return await this.handleInstagramEvent(payload);
            }
            const value = this.extractValue(payload);
            const field = payload?.entry?.[0]?.changes?.[0]?.field || 'unknown';
            const phoneNumberId = value?.metadata?.phone_number_id;
            // ✅ Clean single log with context
            logger_1.webhookLog.debug('Webhook received', {
                field,
                phoneNumberId,
                hasMessages: !!value?.messages?.length,
                hasStatuses: !!value?.statuses?.length,
            });
            switch (field) {
                case 'history':
                    await this.handleHistorySync(payload, value);
                    return { status: 'processed', reason: 'History sync processed' };
                case 'smb_app_state_sync':
                    await this.handleSmbStateSync(payload, value);
                    return { status: 'processed', reason: 'SMB state sync processed' };
                case 'smb_message_echoes':
                    await this.handleSmbMessageEchoes(payload, value);
                    return { status: 'processed', reason: 'SMB echoes processed' };
                case 'message_template_status_update':
                    await this.handleTemplateUpdate(payload, value);
                    return { status: 'processed', reason: 'Template update processed' };
                case 'message_template_category_update':
                    // Meta reclassifies templates (e.g. a MARKETING message declared as
                    // UTILITY is moved to MARKETING). Billing charges per stored category,
                    // so if we ignore this the org is billed at the wrong rate. Persist
                    // Meta's authoritative category.
                    await this.handleTemplateCategoryUpdate(value);
                    return { status: 'processed', reason: 'Template category update processed' };
                case 'calls':
                    await this.handleCallWebhook(payload, value);
                    return { status: 'processed', reason: 'Call webhook processed' };
                case 'messages':
                case 'statuses':
                    break;
                default:
                    console.log(`ℹ️ Unhandled field: ${field}`);
                    return { status: 'ignored', reason: `Unhandled field: ${field}` };
            }
            if (!phoneNumberId) {
                return { status: 'error', reason: 'No phone_number_id for field: ' + field };
            }
            let account = null;
            const cached = this.accountCache.get(phoneNumberId);
            if (cached && cached.expiresAt > Date.now()) {
                account = cached.data;
            }
            else {
                account = await database_1.default.whatsAppAccount.findFirst({
                    where: { phoneNumberId },
                });
                if (!account) {
                    console.log(`🔍 phoneNumberId ${phoneNumberId} not found in legacy WhatsAppAccount, checking PhoneNumber table...`);
                    try {
                        const phoneRecord = await database_1.default.phoneNumber.findFirst({
                            where: { phoneNumberId },
                            include: { metaConnection: true }
                        });
                        if (phoneRecord) {
                            console.log(`✅ Found account via PhoneNumber table fallback for ID: ${phoneNumberId}`);
                            const waAccount = await database_1.default.whatsAppAccount.findFirst({
                                where: { phoneNumber: phoneRecord.phoneNumber, organizationId: phoneRecord.metaConnection.organizationId }
                            });
                            account = {
                                id: waAccount ? waAccount.id : null,
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
                if (phoneNumberId.length < 10) {
                    return { status: 'ignored', reason: 'Account not found for test/invalid phoneNumberId: ' + phoneNumberId };
                }
                console.warn(`⚠️ Account not found for phoneNumberId: ${phoneNumberId}`);
                return { status: 'error', reason: 'Account not found for phoneNumberId: ' + phoneNumberId };
            }
            const messages = value?.messages || [];
            for (const msg of messages) {
                const profile = this.extractProfile(payload, msg);
                if (profile) {
                    // ⚡ Pehle yahan updateContactFromWebhook await hota tha - sirf profile
                    // name ke liye 1-2 extra DB round trip, message deliver hone se PEHLE.
                    // Ab wahi kaam findOrCreateContact ke andar hota hai (usi lookup mein,
                    // aur naam ka write background mein).
                    await this.processIncomingMessage(msg, account.organizationId, account.id, account.phoneNumberId, profile.profileName);
                }
            }
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
    async handleTemplateStatusUpdate(metaTemplateId, newStatus, rejectionReason, metaCategory) {
        const template = await database_1.default.template.findFirst({
            where: { metaTemplateId },
        });
        if (!template) {
            console.warn(`⚠️ Webhook: Template not found: ${metaTemplateId}`);
            return;
        }
        const updateData = {
            status: newStatus,
            // Meta includes the (possibly corrected) category on approval. Keep the
            // stored category in sync so billing uses the rate Meta actually applies.
            ...(metaCategory ? { category: metaCategory } : {}),
            rejectionReason: rejectionReason || null,
        };
        // ✅ FIX: After APPROVAL, handle is no longer needed (Meta stores media internally)
        // Clear it so campaigns use URL fallback (which is Cloudinary - permanent)
        if (newStatus === 'APPROVED') {
            updateData.headerMediaId = null;
            updateData.headerMediaUploadedAt = null;
        }
        await database_1.default.template.update({
            where: { id: template.id },
            data: updateData,
        });
        console.log(`✅ Webhook: Template ${metaTemplateId} → ${newStatus}`);
    }
    /**
     * message_template_category_update — Meta moved a template to a different
     * category. Billing charges per stored category, so this must be persisted or
     * the org is charged at the wrong rate indefinitely.
     */
    async handleTemplateCategoryUpdate(value) {
        try {
            const metaTemplateId = String(value.message_template_id || '');
            // Meta uses new_category (with correct_category on some payloads).
            const newCategory = String(value.new_category || value.correct_category || value.category || '').toUpperCase().trim();
            if (!metaTemplateId || !newCategory)
                return;
            const result = await database_1.default.template.updateMany({
                where: { metaTemplateId },
                data: { category: newCategory },
            });
            if (result.count > 0) {
                console.log(`🏷️  Template ${metaTemplateId} category → ${newCategory} (billing rate updated)`);
            }
        }
        catch (e) {
            console.error('Template category update error:', e.message);
        }
    }
    async handleTemplateUpdate(payload, value) {
        try {
            const metaTemplateId = String(value.message_template_id || '');
            const event = String(value.event || '').toUpperCase();
            const rejectionReason = value.reason || value.rejection_reason || undefined;
            const metaCategory = value.category
                ? String(value.category).toUpperCase().trim()
                : undefined;
            console.log(`🔄 Template update webhook received [${event}] for template ID: ${metaTemplateId}`);
            if (metaTemplateId) {
                let newStatus = 'PENDING';
                if (event === 'APPROVED')
                    newStatus = 'APPROVED';
                else if (event === 'REJECTED')
                    newStatus = 'REJECTED';
                else if (event === 'PAUSED')
                    newStatus = 'PAUSED';
                await this.handleTemplateStatusUpdate(metaTemplateId, newStatus, rejectionReason, metaCategory);
            }
        }
        catch (e) {
            console.error('❌ Template update handling error:', e);
        }
    }
    // -----------------------------
    // Incoming message processing
    // Critical path: [dedupe | contact | phoneNumber] -> conversation upsert ->
    // message create -> socket emit. Baaki sab writes iske baad/background mein.
    // -----------------------------
    async processIncomingMessage(message, organizationId, whatsappAccountId, phoneNumberId, profileName) {
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
            // ⚡ Ye teen queries ek dusre pe depend nahi karti. Pehle sequential
            // chalti thi = 3 alag DB round trip. App server aur DB alag region mein
            // hain, isliye har round trip mehnga hai - ek saath fire karo.
            const [existingMsg, contactResult, phoneNumberUUID] = await Promise.all([
                database_1.default.message.findFirst({
                    where: {
                        OR: [
                            { waMessageId },
                            { wamId: waMessageId },
                        ],
                    },
                    select: { id: true },
                }),
                this.findOrCreateContact(organizationId, waFrom, profileName),
                this.resolvePhoneNumberUUID(phoneNumberId),
            ]);
            if (existingMsg) {
                console.log(`⏭️ Duplicate message skipped: ${waMessageId}`);
                return;
            }
            const { contact, wasNewlyCreated } = contactResult;
            let conversation = await this.findOrCreateConversation(organizationId, contact.id, phoneNumberId, messageTime, phoneNumberUUID);
            let content = '';
            let mediaUrl = null;
            let mediaType = null;
            let mediaMimeType = null;
            let mediaId = null;
            let fileName = null;
            switch (typeRaw) {
                case 'reaction':
                    content = message.reaction?.emoji || '[Reaction]';
                    break;
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
                    metadata: {
                        originalType: typeRaw,
                        interactive: message?.interactive || null,
                        button: message?.button || null,
                        context: message?.context || null,
                        referral: message?.referral || null,
                    },
                },
            });
            // Media backup neeche backupInboundMediaAsync() se hota hai.
            //
            // Pehle yahan inboxMediaService.mirrorInboundMedia() bhi call hota tha,
            // yaani ek hi media do baar Meta se download hoti thi aur dono paths
            // same message row ka mediaUrl likhte the. Upar se mirrorInboundMedia
            // token ke liye findFirst({ organizationId, isActive }) karta hai - yaani
            // org ka *koi bhi* account, wo nahi jis par message aaya. Jis org ke
            // ek se zyada WhatsApp accounts hain wahan Meta us media id ke liye
            // galat account ka token dekh kar har baar 400 deta tha:
            // "❌ Failed to mirror media to R2/Cloudinary: status code 400".
            //
            // backupInboundMediaAsync sahi account ka token use karta hai
            // (findUnique by whatsappAccountId), isliye wahi rakha hai.
            // ⚡ Socket emit ab DB update se PEHLE hota hai. Pehle ye emit
            // conversation.update ke round trip ke BAAD tha, yaani har inbound
            // message client tak ek pura DB round trip late pahunchta tha.
            // Update ki nayi values hume pehle se pata hain, isliye wahi payload
            // locally bana kar turant emit karo - DB write peeche chalti rahegi.
            const preview = (content || `[${typeRaw}]`).substring(0, 100);
            const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const contactName = contact.whatsappProfileName ||
                (contact.firstName
                    ? `${contact.firstName} ${contact.lastName || ''}`.trim()
                    : contact.phone);
            const contactWithName = {
                id: contact.id,
                phone: contact.phone,
                firstName: contact.firstName,
                lastName: contact.lastName,
                avatar: contact.avatar,
                whatsappProfileName: contact.whatsappProfileName,
                name: contactName,
            };
            const messagePayload = {
                ...savedMessage,
                createdAt: savedMessage.createdAt instanceof Date ? savedMessage.createdAt.toISOString() : savedMessage.createdAt,
                sentAt: savedMessage.sentAt instanceof Date ? savedMessage.sentAt.toISOString() : savedMessage.sentAt,
                deliveredAt: savedMessage.deliveredAt instanceof Date ? savedMessage.deliveredAt.toISOString() : savedMessage.deliveredAt,
                timestamp: savedMessage.timestamp instanceof Date ? savedMessage.timestamp.toISOString() : savedMessage.timestamp,
            };
            const conversationPayload = {
                ...conversation,
                lastMessageAt: messageTime.toISOString(),
                lastMessagePreview: preview,
                lastCustomerMessageAt: messageTime.toISOString(),
                unreadCount: (conversation.unreadCount ?? 0) + 1,
                isRead: false,
                isWindowOpen: true,
                windowExpiresAt: windowExpiresAt.toISOString(),
                contact: contactWithName,
            };
            exports.webhookEvents.emit('newMessage', {
                organizationId,
                conversationId: conversation.id,
                message: messagePayload,
                conversation: conversationPayload,
            });
            exports.webhookEvents.emit('conversationUpdated', {
                organizationId,
                conversation: conversationPayload,
            });
            // Phone par push notification. Socket sirf tab kaam karta hai jab app
            // khula ho - band app tak message pahunchane ka yahi ek raasta hai.
            // Jaan-bujh kar await nahi kiya: push bhejne me lagne wala waqt
            // webhook ka jawab dene me der na kare, warna Meta retry karega.
            notifications_service_1.notificationsService
                .notifyNewMessage({
                organizationId,
                conversationId: conversation.id,
                contactName,
                preview,
            })
                .catch((err) => console.error('New message notification failed:', err?.message));
            const updatedConversation = await database_1.default.conversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: messageTime,
                    lastMessagePreview: preview,
                    lastCustomerMessageAt: messageTime,
                    unreadCount: { increment: 1 },
                    isRead: false,
                    isWindowOpen: true,
                    windowExpiresAt,
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
            database_1.default.contact.update({
                where: { id: contact.id },
                data: {
                    lastMessageAt: messageTime,
                    messageCount: { increment: 1 },
                },
            }).catch((e) => console.error('Contact update error:', e));
            Promise.resolve().then(() => __importStar(require('../inbox/inbox.service'))).then(({ inboxService }) => inboxService.clearCache(organizationId))
                .catch((e) => console.error('Cache clear error:', e));
            // Authoritative unreadCount DB se aata hai. Agar optimistic value se
            // alag nikla (do message ek saath aane par possible hai), to sirf tabhi
            // ek correction emit bhejo - warna dobara emit karne ki zarurat nahi.
            if (updatedConversation.unreadCount !== conversationPayload.unreadCount) {
                conversationPayload.unreadCount = updatedConversation.unreadCount;
                exports.webhookEvents.emit('conversationUpdated', {
                    organizationId,
                    conversation: conversationPayload,
                });
            }
            // Opt-out sabse pehle. "STOP" par contact UNSUBSCRIBED ho jata hai
            // (campaigns pehle se sirf ACTIVE ko bhejte hain), aur uske baad na
            // automation chalti hai na chatbot - ruk jane ko kehne ke baad bot ka
            // jawab aana sabse kharab cheez hai, aur wahi Block/Report karwata hai.
            const optSignal = (0, optOut_1.detectOptSignal)(content);
            const suppressBot = optSignal
                ? await (0, optOut_1.applyOptSignal)(optSignal, contact.id, organizationId)
                : false;
            if (!suppressBot) {
                this.runAutomations(wasNewlyCreated, organizationId, contact, content, waFrom, updatedConversation, message, msgType).catch((e) => console.error('Automation error:', e));
            }
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
            if (!suppressBot && (msgType === 'TEXT' || msgType === 'INTERACTIVE')) {
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
            // ✅ Auto-backup inbound media to Cloudinary (fire-and-forget)
            const MEDIA_TYPES_TO_BACKUP = ['image', 'video', 'audio', 'document', 'sticker'];
            if (MEDIA_TYPES_TO_BACKUP.includes(typeRaw) && mediaId) {
                this.backupInboundMediaAsync(mediaId, mediaMimeType || 'application/octet-stream', organizationId, savedMessage.id, whatsappAccountId).catch(err => {
                    console.error('Async media backup error:', err.message);
                });
            }
            console.log(`✅ Inbound message processed: ${savedMessage.id}`);
        }
        catch (e) {
            console.error('processIncomingMessage error:', e);
        }
    }
    async runAutomations(wasNewlyCreated, organizationId, contact, content, waFrom, conversation, message, msgType) {
        try {
            const context = {
                organizationId,
                contactId: contact.id,
                phone: waFrom,
                message: content,
                conversationId: conversation.id,
            };
            // ✅ 1. Unknown message trigger (for new/unknown senders)
            // Fire regardless of contact existence - the trigger itself checks
            automation_engine_1.automationEngine.triggerUnknownMessage(context)
                .catch(err => console.error('❌ Unknown message trigger:', err.message));
            // ✅ 2. Keyword trigger (for all messages)
            if (content) {
                automation_engine_1.automationEngine.triggerKeyword(context)
                    .catch(err => console.error('❌ Keyword trigger:', err.message));
            }
            // ✅ 3. New contact trigger (only if contact was JUST created)
            if (wasNewlyCreated) {
                automation_engine_1.automationEngine.triggerNewContact({
                    organizationId,
                    contactId: contact.id,
                    phone: waFrom,
                }).catch(err => console.error('❌ New contact trigger:', err.message));
            }
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
    // Status update processing
    // -----------------------------
    async processStatusUpdate(statusObj, organizationId, whatsappAccountId) {
        try {
            const waMessageId = String(statusObj?.id || '');
            const st = String(statusObj?.status || '').toLowerCase();
            const ts = Number(statusObj?.timestamp || Date.now() / 1000);
            const statusTime = new Date(ts * 1000);
            if (!waMessageId)
                return;
            // ✅ Clean log - short ID
            logger_1.webhookLog.debug('Status update', {
                wamid: waMessageId,
                status: st,
            });
            let newStatus = 'SENT';
            if (st === 'sent')
                newStatus = 'SENT';
            if (st === 'delivered')
                newStatus = 'DELIVERED';
            if (st === 'read')
                newStatus = 'READ';
            if (st === 'failed')
                newStatus = 'FAILED';
            const failureReason = st === 'failed'
                ? (statusObj?.errors?.[0]?.message || 'Unknown error')
                : undefined;
            // Update campaign contact
            await this.updateCampaignContactStatus(waMessageId, newStatus, statusTime, failureReason);
            // ✅ FIX: Query with ALL possible field names
            const message = await database_1.default.message.findFirst({
                where: {
                    OR: [
                        { waMessageId },
                        { wamId: waMessageId },
                        { whatsappMessageId: waMessageId }, // ✅ ADD THIS
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
            if (message) {
                await this.updateChatMessageStatus(message, newStatus, statusTime, statusObj, organizationId);
            }
            else {
                // ✅ FIX: Better retry (silent if truly missing)
                this.retryUpdateChatMessageStatusInBackground(waMessageId, newStatus, statusTime, statusObj, organizationId).catch(() => { });
            }
        }
        catch (e) {
            logger_1.webhookLog.error('processStatusUpdate error', e);
        }
    }
    async updateChatMessageStatus(message, newStatus, statusTime, statusObj, organizationId) {
        // ✅ FIX: Prevent status regression
        const STATUS_PRIORITY = {
            'PENDING': 0,
            'QUEUED': 1,
            'SENT': 2,
            'DELIVERED': 3,
            'READ': 4,
            'FAILED': 5, // Terminal state
        };
        const currentPriority = STATUS_PRIORITY[message.status] ?? 0;
        const newPriority = STATUS_PRIORITY[newStatus] ?? 0;
        // Skip downgrades (except FAILED which is terminal)
        if (newStatus !== 'FAILED' && newPriority <= currentPriority) {
            return;
        }
        // Skip if already FAILED (terminal)
        if (message.status === 'FAILED' && newStatus !== 'FAILED') {
            return;
        }
        const updatedMessage = await database_1.default.message.update({
            where: { id: message.id },
            data: {
                status: newStatus,
                statusUpdatedAt: statusTime,
                ...(newStatus === 'SENT' ? { sentAt: statusTime } : {}),
                ...(newStatus === 'DELIVERED' ? { deliveredAt: statusTime } : {}),
                ...(newStatus === 'READ' ? { readAt: statusTime } : {}),
                ...(newStatus === 'FAILED'
                    ? {
                        failedAt: statusTime,
                        failureReason: statusObj?.errors?.[0]?.message || 'Unknown error',
                    }
                    : {}),
            },
        });
        console.log(`✅ Message status updated: ${message.id} -> ${newStatus}`);
        if (newStatus === 'FAILED') {
            const firstError = statusObj?.errors?.[0];
            const errorCode = firstError?.code;
            console.error(`❌ Message ${message.id} failed. Meta Error:`, JSON.stringify(statusObj?.errors || [], null, 2));
            // 131047: Re-engagement message -> customer service window is closed
            if (errorCode === 131047 && message.conversationId) {
                database_1.default.conversation.update({
                    where: { id: message.conversationId },
                    data: {
                        isWindowOpen: false,
                        windowExpiresAt: new Date(),
                    },
                }).catch((err) => console.error('Failed to update conversation window state:', err?.message));
                exports.webhookEvents.emit('conversationUpdated', {
                    organizationId: message.conversation?.organizationId || organizationId,
                    conversation: {
                        id: message.conversationId,
                        isWindowOpen: false,
                        windowExpiresAt: new Date().toISOString(),
                    },
                });
            }
        }
        const metadata = message.metadata || {};
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
    }
    async retryUpdateChatMessageStatusInBackground(waMessageId, newStatus, statusTime, statusObj, organizationId) {
        // ✅ Exponential backoff - total 20 seconds
        const retryDelays = [500, 1000, 2000, 3000, 5000, 8000];
        for (const delay of retryDelays) {
            await new Promise(r => setTimeout(r, delay));
            const message = await database_1.default.message.findFirst({
                where: {
                    OR: [
                        { waMessageId },
                        { wamId: waMessageId },
                        { whatsappMessageId: waMessageId }, // ✅ Include all
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
            if (message) {
                await this.updateChatMessageStatus(message, newStatus, statusTime, statusObj, organizationId);
                return;
            }
        }
        // ✅ Only log if it's actually a problem (not warning-spam)
        // Most likely: message from before webhook was setup OR different org
        // Silent by default - only warn in debug mode
        if (process.env.LOG_LEVEL === 'debug') {
            logger_1.webhookLog.debug('Message not found after retries', {
                wamid: waMessageId,
                status: newStatus,
            });
        }
    }
    // ============================================
    // ✅ FIXED: Campaign contact status sync — idempotent refund
    // ============================================
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
                            template: {
                                select: { name: true, category: true, language: true },
                            },
                        },
                    },
                    contact: { select: { phone: true } },
                },
            });
            if (!campaignContact)
                return;
            const currentStatus = campaignContact.status;
            // ✅ Status priority — only allow forward transitions (unless FAILED)
            const statusPriority = {
                PENDING: 0,
                QUEUED: 0.5,
                SENT: 1,
                DELIVERED: 2,
                READ: 3,
                FAILED: -1,
            };
            const currentPriority = statusPriority[currentStatus] ?? 0;
            const newPriority = statusPriority[newStatus] ?? 0;
            // Skip lower/equal status (except FAILED which can happen anytime)
            if (newPriority <= currentPriority && newStatus !== 'FAILED')
                return;
            // Skip if already FAILED
            if (currentStatus === 'FAILED' && newStatus !== 'FAILED')
                return;
            // ✅ Update campaign contact
            await database_1.default.campaignContact.updateMany({
                where: { id: campaignContact.id, status: currentStatus }, // ✅ Optimistic lock
                data: {
                    status: newStatus,
                    ...(newStatus === 'DELIVERED' ? { deliveredAt: statusTime } : {}),
                    ...(newStatus === 'READ' ? { readAt: statusTime, deliveredAt: statusTime } : {}),
                    ...(newStatus === 'FAILED'
                        ? { failedAt: statusTime, failureReason: failureReason || 'Delivery failed' }
                        : {}),
                },
            });
            console.log(`✅ Campaign contact ${campaignContact.id}: ${currentStatus} → ${newStatus}`);
            // ✅ SMART REFUND ON FAILURE (queued)
            if (newStatus === 'FAILED' && currentStatus !== 'FAILED') {
                if (campaignContact.campaign?.template) {
                    // ✅ NEW: Smart refund logic - only refund if within threshold
                    const shouldRefund = await this.shouldRefundFailure(campaignContact.campaignId, campaignContact.campaign.totalContacts);
                    if (shouldRefund) {
                        // Queue mein daalo (parallel nahi)
                        this.refundQueue.push({
                            waMessageId,
                            organizationId: campaignContact.campaign.organizationId,
                            campaignId: campaignContact.campaign.id,
                            contactPhone: campaignContact.contact?.phone || '',
                            template: campaignContact.campaign.template,
                        });
                        // ✅ Process queue (idempotent - safe to call multiple times)
                        this.processRefundQueue().catch(err => {
                            console.error('Queue processor error:', err);
                        });
                    }
                    else {
                        console.log(`⏭️  Skipping refund (threshold reached): ${waMessageId} ` +
                            `(Campaign: ${campaignContact.campaignId})`);
                    }
                }
            }
            // ✅ Recompute campaign counters from source of truth (single query)
            const counts = await database_1.default.campaignContact.groupBy({
                by: ['status'],
                where: { campaignId: campaignContact.campaignId },
                _count: true,
            });
            const get = (s) => counts.find(c => c.status === s)?._count || 0;
            const pending = get('PENDING') + get('QUEUED');
            const sentOnly = get('SENT');
            const delivered = get('DELIVERED');
            const read = get('READ');
            const failed = get('FAILED');
            const total = pending + sentOnly + delivered + read + failed;
            // Cumulative counts (for storage)
            const cumulativeSent = sentOnly + delivered + read;
            const cumulativeDelivered = delivered + read;
            await database_1.default.campaign.update({
                where: { id: campaignContact.campaignId },
                data: {
                    totalContacts: total,
                    sentCount: cumulativeSent,
                    deliveredCount: cumulativeDelivered,
                    readCount: read,
                    failedCount: failed,
                },
            });
            // ✅ EMIT REAL-TIME UPDATES
            const orgId = campaignContact.campaign?.organizationId;
            const contactPhone = campaignContact.contact?.phone || '';
            if (orgId) {
                try {
                    const { campaignSocketService } = await Promise.resolve().then(() => __importStar(require('../campaigns/campaigns.socket')));
                    // Emit individual contact status
                    campaignSocketService.emitContactStatus(orgId, campaignContact.campaignId, {
                        contactId: campaignContact.contactId,
                        phone: contactPhone,
                        status: newStatus,
                        messageId: waMessageId,
                        error: failureReason,
                        deliveredAt: newStatus === 'DELIVERED' ? statusTime.toISOString() : undefined,
                        readAt: newStatus === 'READ' ? statusTime.toISOString() : undefined,
                        failedAt: newStatus === 'FAILED' ? statusTime.toISOString() : undefined,
                    });
                    // Emit progress update
                    const processed = cumulativeSent + failed;
                    const percentage = Math.min(100, Math.round((processed / Math.max(total, 1)) * 100));
                    campaignSocketService.emitCampaignProgress(orgId, campaignContact.campaignId, {
                        sent: cumulativeSent,
                        failed,
                        delivered: cumulativeDelivered,
                        read,
                        total,
                        percentage,
                        status: campaignContact.campaign?.status || 'RUNNING',
                    });
                    // Emit list page update
                    campaignSocketService.emitCampaignUpdate(orgId, campaignContact.campaignId, {
                        status: campaignContact.campaign?.status || 'RUNNING',
                        message: 'Status updated',
                        totalContacts: total,
                        sentCount: cumulativeSent,
                        deliveredCount: cumulativeDelivered,
                        readCount: read,
                        failedCount: failed,
                    });
                }
                catch (e) {
                    console.error('❌ Socket emit failed:', e);
                }
            }
        }
        catch (e) {
            console.error('updateCampaignContactStatus error:', e);
        }
    }
    // ============================================
    // ✅ Process refunds sequentially (not parallel)
    // ============================================
    async processRefundQueue() {
        if (this.refundProcessing || this.refundQueue.length === 0)
            return;
        this.refundProcessing = true;
        while (this.refundQueue.length > 0) {
            const item = this.refundQueue.shift();
            try {
                await this.processRefundWithRetry(item.waMessageId, item.organizationId, item.campaignId, item.contactPhone, item.template);
                // ✅ Small gap between refunds to avoid DB pressure
                await new Promise(r => setTimeout(r, 100));
            }
            catch (err) {
                console.error('Refund queue item failed:', err.message);
                await this.storeFailedRefund(item.waMessageId, item.organizationId);
            }
        }
        this.refundProcessing = false;
    }
    // ============================================
    // ✅ NEW METHOD: Refund with retry + timeout fix
    // ============================================
    async processRefundWithRetry(waMessageId, organizationId, campaignId, contactPhone, template, attempt = 1) {
        const MAX_ATTEMPTS = 3;
        const RETRY_DELAY_MS = [1000, 3000, 5000]; // 1s, 3s, 5s
        try {
            const { getRateForCategory } = await Promise.resolve().then(() => __importStar(require('../wallet/wallet.deduction.service')));
            const rateRupees = getRateForCategory(template.category || 'MARKETING', contactPhone, template.language);
            const refundPaise = Math.round(rateRupees * 100);
            if (refundPaise <= 0)
                return;
            // ✅ FIX: 30-second timeout (was 5s default)
            await database_1.default.$transaction(async (tx) => {
                // Check for duplicate refund
                const existingRefund = await tx.walletTransaction.findFirst({
                    where: {
                        metaChargeId: waMessageId,
                        metaService: 'template_message_refund',
                    },
                    select: { id: true },
                });
                if (existingRefund) {
                    console.log(`⏭️  Refund already exists for ${waMessageId}`);
                    return;
                }
                const wallet = await tx.wallet.findUnique({
                    where: { organizationId },
                });
                if (!wallet) {
                    throw new Error('Wallet not found');
                }
                // Atomic credit, same reasoning as the debit fix: an absolute
                // balance write here can be lost when a debit runs concurrently under
                // READ COMMITTED. Increment in the database and read the result back.
                const before = wallet.balancePaise;
                const updatedWallet = await tx.wallet.update({
                    where: { id: wallet.id },
                    data: {
                        balancePaise: { increment: refundPaise },
                        totalCreditedPaise: { increment: refundPaise },
                    },
                    select: { balancePaise: true },
                });
                const balanceBefore = updatedWallet.balancePaise - refundPaise;
                const balanceAfter = updatedWallet.balancePaise;
                void before;
                await tx.walletTransaction.create({
                    data: {
                        walletId: wallet.id,
                        type: 'credit',
                        amountPaise: refundPaise,
                        balanceBeforePaise: balanceBefore,
                        balanceAfterPaise: balanceAfter,
                        description: `Refund: Failed msg (${contactPhone}) - ${template.name}`,
                        status: 'completed',
                        metaChargeId: waMessageId,
                        metaService: 'template_message_refund',
                        note: `Refund (Campaign: ${campaignId})`,
                    },
                });
                console.log(`💰 Refunded ₹${rateRupees.toFixed(2)} to ${contactPhone}`);
            }, {
                maxWait: 10000, // ✅ 10s wait for connection
                timeout: 30000, // ✅ 30s transaction timeout (was default 5s)
                isolationLevel: 'ReadCommitted', // ✅ Reduce contention
            });
        }
        catch (err) {
            // The unique index on (metaChargeId, metaService) is the authoritative
            // idempotency guard. A concurrent duplicate refund now fails the insert
            // with P2002 -- that means the refund already landed, so treat it as
            // success rather than an error.
            if (err?.code === 'P2002') {
                console.log(`⏭️  Refund already recorded for ${waMessageId} (unique guard)`);
                return;
            }
            const isTimeoutError = err.message?.includes('Transaction already closed') ||
                err.message?.includes('timeout');
            // ✅ Retry on timeout errors
            if (isTimeoutError && attempt < MAX_ATTEMPTS) {
                const delay = RETRY_DELAY_MS[attempt - 1];
                console.warn(`⚠️  Refund attempt ${attempt}/${MAX_ATTEMPTS} timed out, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.processRefundWithRetry(waMessageId, organizationId, campaignId, contactPhone, template, attempt + 1);
            }
            // ✅ Final failure - throw so caller can store for manual retry
            console.error(`❌ Refund failed after ${attempt} attempts:`, err.message);
            throw err;
        }
    }
    // ============================================
    // ✅ NEW METHOD: Store failed refunds for manual/cron retry
    // ============================================
    async storeFailedRefund(waMessageId, organizationId) {
        try {
            // Option A: Store in webhook logs
            await database_1.default.webhookLog.create({
                data: {
                    organizationId,
                    source: 'refund_retry_queue',
                    eventType: 'FAILED_REFUND',
                    payload: {
                        waMessageId,
                        reason: 'Transaction timeout',
                        needsRetry: true,
                        createdAt: new Date().toISOString(),
                    },
                    status: 'FAILED',
                    errorMessage: 'Refund failed after 3 attempts - needs manual retry',
                },
            });
            console.log(`📝 Stored failed refund for manual retry: ${waMessageId}`);
        }
        catch (e) {
            console.error('Failed to store failed refund:', e);
        }
    }
    // ============================================
    // ✅ NEW: Determine if failure should be refunded
    // ============================================
    async shouldRefundFailure(campaignId, totalContacts) {
        const HONEST_THRESHOLD = 300;
        // Small campaign - always refund
        if (totalContacts <= HONEST_THRESHOLD) {
            return true;
        }
        // ✅ NEW: Check real delivery rate
        const campaign = await database_1.default.campaign.findUnique({
            where: { id: campaignId },
            select: {
                deliveredCount: true,
                readCount: true,
                totalContacts: true,
            },
        });
        if (campaign) {
            const realDelivered = campaign.deliveredCount + campaign.readCount;
            const deliveryRate = campaign.totalContacts > 0
                ? (realDelivered / campaign.totalContacts) * 100
                : 0;
            // ✅ Emergency mode - refund all failures
            if (deliveryRate < 40) {
                // ✅ FIX: Log only ONCE per campaign, not per message
                if (!this.emergencyLoggedCampaigns.has(campaignId)) {
                    console.log(`💰 Emergency refund mode for campaign ${campaignId}: Delivery ${deliveryRate.toFixed(1)}%`);
                    this.emergencyLoggedCampaigns.add(campaignId);
                    // Clear after 5 mins to allow re-logging
                    setTimeout(() => this.emergencyLoggedCampaigns.delete(campaignId), 5 * 60 * 1000);
                }
                return true;
            }
        }
        // Calculate max refundable (normal smart mode)
        let maxFailRate = 0.10;
        if (totalContacts > 5000)
            maxFailRate = 0.05;
        else if (totalContacts > 1000)
            maxFailRate = 0.06;
        else if (totalContacts > 500)
            maxFailRate = 0.08;
        const maxRefundable = Math.ceil(totalContacts * maxFailRate);
        const alreadyRefunded = await database_1.default.walletTransaction.count({
            where: {
                metaService: 'template_message_refund',
                note: { contains: campaignId },
            },
        });
        const canRefundMore = alreadyRefunded < maxRefundable;
        if (!canRefundMore) {
            console.log(`💰 Refund limit reached for campaign ${campaignId}: ${alreadyRefunded}/${maxRefundable}`);
        }
        return canRefundMore;
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
    async handleHistorySync(payload, value) {
        try {
            console.log('📜 History sync webhook received');
            const wabaId = payload.entry[0].id;
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { wabaId },
                select: { id: true, organizationId: true, phoneNumberId: true }
            });
            if (!account)
                return;
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
    async handleSmbMessageEchoes(payload, value) {
        try {
            console.log('💬 SMB message echoes webhook received');
            const messages = value?.messages || [];
            for (const msg of messages) {
                console.log('Echo message:', {
                    id: msg.id,
                    to: msg.to,
                    type: msg.type,
                });
            }
        }
        catch (e) {
            console.error('handleSmbMessageEchoes error:', e);
        }
    }
    async handleCallWebhook(payload, value) {
        try {
            const callData = value?.call || {};
            const callId = callData.id;
            const status = callData.status;
            const direction = callData.direction;
            const from = callData.from;
            const to = callData.to;
            const duration = callData.duration;
            console.log(`📞 Call webhook received:`, {
                callId,
                status,
                direction,
                from: from ? String(from).substring(0, 6) : undefined,
            });
            const phoneNumberId = value?.metadata?.phone_number_id;
            if (!phoneNumberId)
                return;
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { phoneNumberId },
            });
            if (!account)
                return;
            if (direction === 'inbound' && from) {
                const cleanPhone = String(from).replace(/[^0-9]/g, '');
                let phone10 = cleanPhone;
                if (phone10.startsWith('91') && phone10.length === 12) {
                    phone10 = phone10.substring(2);
                }
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
            if (direction === 'outbound' && callId) {
                database_1.default.callLog?.updateMany({
                    where: { callId },
                    data: {
                        status: status || 'updated',
                        duration: duration || undefined,
                        endedAt: status === 'ended' ? new Date() : undefined,
                    },
                })?.catch((dbErr) => console.warn('Call log update failed:', dbErr.message));
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
    // ============================================
    // ✅ NEW: Auto-backup inbound media to Cloudinary
    // Meta media 30 din baad expire hoti hai
    // ============================================
    async backupInboundMediaAsync(mediaId, mimeType, organizationId, messageId, whatsappAccountId) {
        try {
            // Small delay - let message save complete
            await new Promise(r => setTimeout(r, 1000));
            const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
            const { safeDecryptStrict } = await Promise.resolve().then(() => __importStar(require('../../utils/encryption')));
            const { config } = await Promise.resolve().then(() => __importStar(require('../../config')));
            const account = await database_1.default.whatsAppAccount.findUnique({
                where: { id: whatsappAccountId },
                select: { accessToken: true }
            });
            if (!account?.accessToken)
                return;
            const accessToken = safeDecryptStrict(account.accessToken);
            if (!accessToken)
                return;
            // Step 1: Get media URL from Meta
            const version = config.meta?.graphApiVersion || 'v22.0';
            const infoRes = await axios.get(`https://graph.facebook.com/${version}/${mediaId}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 10000,
            });
            const metaDownloadUrl = infoRes.data?.url;
            const actualMime = infoRes.data?.mime_type || mimeType;
            if (!metaDownloadUrl)
                return;
            // Step 2: Download from Meta CDN
            const mediaRes = await axios.get(metaDownloadUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024,
            });
            const buffer = Buffer.from(mediaRes.data);
            if (buffer.length === 0)
                return;
            // Step 3: Upload to Cloudflare R2 (or fallback to Cloudinary)
            let mediaUrl = '';
            let storageKey = '';
            const { r2Service } = await Promise.resolve().then(() => __importStar(require('../../services/r2.service')));
            if (r2Service.isConfigured()) {
                try {
                    const r2Res = await r2Service.uploadInboundMedia({
                        buffer,
                        organizationId,
                        mediaId,
                        mimeType: actualMime,
                    });
                    mediaUrl = r2Res.url;
                    storageKey = r2Res.key;
                }
                catch (e) {
                    console.error('❌ R2 inbound upload failed:', e.message);
                }
            }
            if (!mediaUrl) {
                const { cloudinaryService } = await Promise.resolve().then(() => __importStar(require('../../services/cloudinary.service')));
                const result = await cloudinaryService.uploadInboundMedia({
                    buffer,
                    mimeType: actualMime,
                    organizationId,
                    messageId,
                });
                if (result) {
                    mediaUrl = result.url;
                    storageKey = result.publicId;
                }
            }
            if (!mediaUrl)
                return;
            // Step 4: Update message with media URL
            const existingMsg = await database_1.default.message.findUnique({
                where: { id: messageId },
                select: { metadata: true }
            });
            const existingMeta = existingMsg?.metadata || {};
            await database_1.default.message.update({
                where: { id: messageId },
                data: {
                    mediaUrl: mediaUrl,
                    metadata: {
                        ...existingMeta,
                        storageUrl: mediaUrl,
                        storageKey: storageKey,
                        backedUpAt: new Date().toISOString(),
                        originalMetaMediaId: mediaId,
                    },
                },
            });
            console.log(`☁️ Auto-backed up inbound media: ${messageId}`);
        }
        catch (err) {
            // Silently fail - media will backup on first user access
            console.error(`Inbound backup failed for ${messageId}:`, err.message);
        }
    }
}
exports.WebhookService = WebhookService;
exports.webhookService = new WebhookService();
exports.default = exports.webhookService;
//# sourceMappingURL=webhook.service.js.map