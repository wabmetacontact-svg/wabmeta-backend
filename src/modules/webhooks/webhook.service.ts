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

import prisma from '../../config/database';
import { parsePartnerAdded, recordPartnerAdded } from '../meta/partnerSolution';
import { contactsService } from '../contacts/contacts.service';
import { EventEmitter } from 'events';
import { MessageType, MessageStatus } from '@prisma/client';
import { webhookLog, campaignLog } from '../../utils/logger';
import { chatbotEngine } from '../chatbot/chatbot.engine';
import { automationEngine } from '../automation/automation.engine';
import { detectOptSignal, applyOptSignal } from '../contacts/optOut';
import { shouldAiReply } from '../aiagent/aiagent.prompt';
import { toCanonicalPhone, buildPhoneVariants } from '../../utils/phone';
import * as instagramService from '../instagram/instagram.service';
import { notificationsService } from '../notifications/notifications.service';
import { recordHistoryProgress } from '../meta/coexistence';

/** A customer's answer to a call permission request, in words for the chat. */
export const callPermissionReplyText = (reply: any): string => {
  if (reply?.response !== 'accept') return '📵 Declined calls from your business';
  if (reply.is_permanent) return '📞 Allowed calls from your business';
  const exp = Number(reply.expiration_timestamp);
  return exp
    ? `📞 Allowed calls until ${new Date(exp * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}`
    : '📞 Allowed calls from your business';
};

export const webhookEvents = new EventEmitter();
webhookEvents.setMaxListeners(100);

export class WebhookService {
  private refundQueue: Array<{
    waMessageId: string;
    organizationId: string;
    campaignId: string;
    contactPhone: string;
    template: any;
  }> = [];
  private refundProcessing = false;
  private emergencyLoggedCampaigns = new Set<string>();

  private accountCache = new Map<string, { data: any; expiresAt: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  // Meta ka phoneNumberId -> hamara PhoneNumber.id (UUID). Ye mapping
  // practically immutable hai, isliye accountCache jaisa TTL cache safe hai.
  private phoneNumberUUIDCache = new Map<string, { id: string; expiresAt: number }>();

  private extractValue(payload: any) {
    return payload?.entry?.[0]?.changes?.[0]?.value;
  }

  private extractProfile(payload: any, specificMsg: any): { waId: string; profileName: string; phone10: string } | null {
    try {
      const value = this.extractValue(payload);
      const msg = specificMsg || value?.messages?.[0];
      if (!msg) return null;

      const waId = String(msg.from || '');
      const contact = value?.contacts?.find((c: any) => c.wa_id === waId);

      let phone10 = waId;
      if (phone10.startsWith('91') && phone10.length === 12) phone10 = phone10.substring(2);

      return {
        waId,
        profileName: contact?.profile?.name || 'Unknown',
        phone10,
      };
    } catch (e) {
      console.error('extractProfile error:', e);
      return null;
    }
  }

  private isIndianNumber(waId: string): boolean {
    return typeof waId === 'string' && waId.startsWith('91') && waId.length === 12;
  }

  private mapMessageType(typeRaw: string): MessageType {
    const t = String(typeRaw || '').toLowerCase();
    const map: Record<string, MessageType> = {
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

  private buildContentAndMedia(message: any): { content: string | null; mediaUrl: string | null } {
    const type = String(message?.type || 'text').toLowerCase();

    if (type === 'text') return { content: message?.text?.body || '', mediaUrl: null };
    if (type === 'image') return { content: message?.image?.caption || '[Image]', mediaUrl: message?.image?.id || null };
    if (type === 'video') return { content: message?.video?.caption || '[Video]', mediaUrl: message?.video?.id || null };
    if (type === 'document') return { content: message?.document?.filename || '[Document]', mediaUrl: message?.document?.id || null };
    if (type === 'audio') return { content: '[Audio]', mediaUrl: message?.audio?.id || null };
    if (type === 'sticker') return { content: '[Sticker]', mediaUrl: message?.sticker?.id || null };
    if (type === 'location') return { content: '[Location]', mediaUrl: null };
    if (type === 'contacts') return { content: '[Contact]', mediaUrl: null };
    if (type === 'interactive') {
      const iType = message?.interactive?.type;
      if (iType === 'button_reply') return { content: message.interactive.button_reply.title || '[Button Reply]', mediaUrl: null };
      if (iType === 'list_reply') return { content: message.interactive.list_reply.title || '[List Reply]', mediaUrl: null };
      if (iType === 'call_permission_reply') return { content: callPermissionReplyText(message.interactive.call_permission_reply), mediaUrl: null };
      return { content: '[Interactive]', mediaUrl: null };
    }

    return { content: `[${type}]`, mediaUrl: null };
  }

  // ============================================
  // ✅ FIX 1: findOrCreateContact - UPSERT
  // ============================================
  // Public: calling.service resolves the caller of an inbound call with it too.
  async findOrCreateContact(
    organizationId: string,
    phone: string,
    profileName?: string
  ): Promise<{ contact: any; wasNewlyCreated: boolean }> {

    const goodName =
      profileName && profileName !== 'Unknown' ? profileName : null;

    const canonical = toCanonicalPhone(phone) || toCanonicalPhone(`+${phone}`);

    if (!canonical) {
      console.error(`❌ Cannot normalize phone: ${phone}`);
      throw new Error(`Invalid phone: ${phone}`);
    }

    const variants = buildPhoneVariants(canonical);

    // ✅ STEP 1: Fast path - findFirst with all variants
    const existing = await prisma.contact.findFirst({
      where: {
        organizationId,
        OR: variants.map((p) => ({ phone: p })),
      },
    });

    if (existing) {
      // Phone migration + WhatsApp profile name refresh - dono ek hi background
      // write mein. Message delivery inme se kisi ke liye nahi rukti.
      const patch: any = {};

      if (existing.phone !== canonical) patch.phone = canonical;

      const nameChanged = !!goodName && existing.firstName !== goodName;
      if (nameChanged) {
        patch.firstName = goodName;
        patch.whatsappProfileName = goodName;
        patch.whatsappProfileFetched = true;
        patch.lastProfileFetchAt = new Date();
      }

      if (Object.keys(patch).length > 0) {
        prisma.contact
          .update({ where: { id: existing.id }, data: patch })
          .catch((e: any) =>
            console.error('Contact profile update error:', e?.message)
          );
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

      const contact = await prisma.contact.upsert({
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
        prisma.subscription.updateMany({
          where: { organizationId },
          data: { contactsUsed: { increment: 1 } },
        }).catch((e: any) => console.error('Subscription increment error:', e));
      }

      return { contact, wasNewlyCreated };

    } catch (error: any) {
      // ✅ P2002 = Race condition even after upsert
      // (happens when variant phone exists, not canonical)
      if (error.code === 'P2002') {
        console.warn(`⚠️ P2002 race on contact ${canonical}, finding existing...`);

        const fallback = await prisma.contact.findFirst({
          where: {
            organizationId,
            OR: variants.map((p) => ({ phone: p })),
          },
        });

        if (fallback) return { contact: fallback, wasNewlyCreated: false };
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
  private async resolvePhoneNumberUUID(
    metaPhoneNumberId: string | null
  ): Promise<string | null> {
    if (!metaPhoneNumberId) return null;

    const cached = this.phoneNumberUUIDCache.get(metaPhoneNumberId);
    if (cached && cached.expiresAt > Date.now()) return cached.id;

    try {
      const phoneRecord = await prisma.phoneNumber.findFirst({
        where: { phoneNumberId: metaPhoneNumberId }, // Meta's string ID
        select: { id: true }, // Hamara UUID chahiye
      });

      if (!phoneRecord) {
        // PhoneNumber table mein nahi mila - null rakho (field optional hai).
        // Negative result cache mat karo, number baad mein register ho sakta hai.
        console.warn(
          `⚠️ PhoneNumber not found for metaPhoneNumberId: ${metaPhoneNumberId} ` +
          `- conversation will have null phoneNumberId`
        );
        return null;
      }

      this.phoneNumberUUIDCache.set(metaPhoneNumberId, {
        id: phoneRecord.id,
        expiresAt: Date.now() + this.CACHE_TTL,
      });

      return phoneRecord.id; // ✅ Actual FK-valid UUID
    } catch (e) {
      console.error('PhoneNumber lookup error:', e);
      // Fail silently - null phoneNumberId se conversation ban sakti hai
      return null;
    }
  }

  private async findOrCreateConversation(
    organizationId: string,
    contactId: string,
    metaPhoneNumberId: string | null,  // sirf logging ke liye
    messageTime: Date,
    phoneNumberUUID: string | null     // pehle se resolve kiya hua (cached)
  ): Promise<any> {

    // ✅ Conversation upsert with valid UUID (or null)
    try {
      const conversation = await prisma.conversation.upsert({
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

    } catch (error: any) {
      // ✅ P2003 - FK violation (safety net, should not happen now)
      if (error.code === 'P2003') {
        console.error(
          `❌ P2003 FK violation on conversation create. ` +
          `phoneNumberUUID used: ${phoneNumberUUID}, ` +
          `metaPhoneNumberId: ${metaPhoneNumberId}. ` +
          `Retrying without phoneNumberId...`
        );

        // ✅ Last resort: create without phoneNumberId
        const conversation = await prisma.conversation.upsert({
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
        const existing = await prisma.conversation.findFirst({
          where: { organizationId, contactId },
        });
        if (existing) return existing;
      }

      throw error;
    }
  }

  // -----------------------------
  // Instagram Webhook Handler (unchanged)
  // -----------------------------
  private async handleInstagramEvent(payload: any): Promise<{ status: string; reason?: string; source?: string; error?: string }> {
    try {
      const entry = payload.entry?.[0];

      if (entry?.messaging) {
        const messaging = entry.messaging[0];

        const igUserId = entry.id;
        const senderId = messaging.sender.id;

        if (messaging.message && !messaging.message.is_echo) {
          const messageText = messaging.message.text;
          const igMessageId = messaging.message.mid;

          const account = await prisma.instagramAccount.findUnique({
            where: { igUserId }
          });

          // Store the DM (text or media) in the unified inbox (best-effort).
          let automationPaused = false;
          if (account) {
            try {
              const { recordInboundIgMessage } = await import('../instagram/instagram.inbox');
              const conv = await recordInboundIgMessage(account, senderId, { text: messageText, mid: igMessageId, attachments: messaging.message.attachments });
              automationPaused = !!conv?.automationPaused;
            } catch (e: any) {
              console.error('IG inbox record error:', e?.message || e);
            }

            // Suspended / read-only: keep the message, answer nothing.
            const { orgCanSend } = await import('../admin/orgControl');
            if (!(await orgCanSend(account.organizationId))) automationPaused = true;
          }

          // Human handoff: once an agent takes over, no channel automation fires.
          const match = automationPaused ? null : await instagramService.findMatchingAutomation(igUserId, messageText);

          if (match && match.isActive) {
            console.log(`🤖 IG Automation Match: ${match.name}`);

            if (account?.accessToken) {
              const instagramApi = await import('../instagram/instagram.api');
              if (match.responseText) {
                await instagramApi.sendIGMessage(instagramService.igAccessToken(account.accessToken), senderId, match.responseText);
              }
            }

            await prisma.igDmAutomation.update({
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
              const instagramApi = await import('../instagram/instagram.api');
              await instagramApi.sendIGMessage(instagramService.igAccessToken(account.accessToken), senderId, storyRule.dmMessage);
              await prisma.igStoryRule.update({
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

          if (senderId === igUserId) return { status: 'skipped', reason: 'Own comment' };

          const mediaId = change.value.media?.id || change.value.media_id;
          const rules = await prisma.igCommentRule.findMany({
            where: { igAccount: { igUserId }, isActive: true },
            include: { igAccount: true },
          });
          // Match: post targeting (empty = all posts) + keyword (empty = all comments, else contains).
          const rule = rules.find((r) => {
            const postOk = !r.postIds?.length || (mediaId && r.postIds.includes(mediaId));
            if (!postOk) return false;
            if (!r.keywords?.length) return true;
            return r.keywords.some((k) => commentText.includes(String(k).toLowerCase()));
          });

          const { orgCanSend } = await import('../admin/orgControl');
          if (rule && (await orgCanSend(rule.igAccount.organizationId))) {
            const token = instagramService.igAccessToken(rule.igAccount.accessToken);
            const instagramApi = await import('../instagram/instagram.api');

            if (rule.commentReply) {
              await instagramApi.replyToIGComment(token, commentId, rule.commentReply);
            }

            if (rule.dmMessage) {
              await instagramApi.sendIGMessage(token, senderId, rule.dmMessage);
            }

            await prisma.igCommentRule.update({
              where: { id: rule.id },
              data: { triggeredCount: { increment: 1 } }
            });
          }
        }
      }

      return { status: 'success', source: 'instagram' };
    } catch (error: any) {
      console.error('❌ Instagram Webhook Error:', error.message);
      return { status: 'failed', error: error.message };
    }
  }

  // ============================================
  // PHONE NUMBER QUALITY UPDATE
  // ============================================
  private async handleQualityUpdate(payload: any, value: any): Promise<void> {
    const wabaId = payload?.entry?.[0]?.id;
    if (!wabaId) return;

    const accounts = await prisma.whatsAppAccount.findMany({
      where: { wabaId: String(wabaId), isActive: true },
      select: { id: true, phoneNumber: true },
    });

    // Event me sirf display_phone_number hota hai. Match na mile to WABA ke
    // saare number sync kar do - sync idempotent hai.
    const digits = (v: any) => String(v || '').replace(/\D/g, '');
    const target = digits(value?.display_phone_number);
    const matched = target
      ? accounts.filter((a) => {
          const d = digits(a.phoneNumber);
          return d && (d.endsWith(target) || target.endsWith(d));
        })
      : [];

    const { whatsappService } = await import('../whatsapp/whatsapp.service');
    for (const acc of matched.length ? matched : accounts) {
      const res = await whatsappService.syncAccountQuality(acc.id);
      if (!res.success) {
        webhookLog.warn('Quality sync after webhook failed', { accountId: acc.id, error: res.error });
      }
    }
  }

  // ============================================
  // MAIN WEBHOOK HANDLER
  // ✅ FIX: "📨 Webhook received" log REMOVED
  //    webhook.routes.ts already handle karta hai logging
  //    Yahan rakhne se double log aata tha
  // ============================================
  async handleWebhook(
    payload: any
  ): Promise<{
    status: string;
    reason?: string;
    profileName?: string;
    error?: string;
  }> {
    try {
      if (payload.object === 'instagram') {
        return await this.handleInstagramEvent(payload);
      }

      const value         = this.extractValue(payload);
      const field         = payload?.entry?.[0]?.changes?.[0]?.field || 'unknown';
      const phoneNumberId = value?.metadata?.phone_number_id;

      // ✅ Clean single log with context
      webhookLog.debug('Webhook received', {
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

        case 'calls': {
          // WhatsApp Calling: connect / terminate events and call statuses.
          const { callingService } = await import('../calling/calling.service');
          await callingService.handleCallsWebhook(value);
          return { status: 'processed', reason: 'Call webhook processed' };
        }

        case 'phone_number_quality_update':
          // Meta event (FLAGGED / UNFLAGGED / DOWNGRADE / UPGRADE) me rating
          // khud nahi aati - number ko turant sync karo; wahi sync rating
          // likhti hai aur girne par org ko notify karti hai (qualityAlert.ts).
          // Iske bina girawat agli raat ki sync tak chhupi rehti.
          await this.handleQualityUpdate(payload, value);
          return { status: 'processed', reason: `Quality update: ${value?.event || 'unknown'}` };

        case 'account_update': {
          // PARTNER_ADDED is Meta confirming a client signed up through a
          // Multi-Partner Solution - i.e. is billed on the Solution Partner's
          // credit line. Other account_update events are not used yet.
          const partner = parsePartnerAdded(value);
          if (!partner) {
            return { status: 'ignored', reason: `account_update: ${value?.event || 'unknown'}` };
          }

          const updated = await recordPartnerAdded(partner);
          console.log(
            `🤝 [Solution] PARTNER_ADDED waba=${partner.wabaId} ` +
            `solution=${partner.solutionId || '(none)'} accounts=${updated}`
          );
          return { status: 'processed', reason: 'Partner added recorded' };
        }

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

      let account: any = null;
      const cached = this.accountCache.get(phoneNumberId);
      if (cached && cached.expiresAt > Date.now()) {
        account = cached.data;
      } else {
        account = await prisma.whatsAppAccount.findFirst({
          where: { phoneNumberId },
        });

        if (!account) {
          console.log(`🔍 phoneNumberId ${phoneNumberId} not found in legacy WhatsAppAccount, checking PhoneNumber table...`);
          try {
            const phoneRecord = await (prisma as any).phoneNumber.findFirst({
              where: { phoneNumberId },
              include: { metaConnection: true }
            });

            if (phoneRecord) {
              console.log(`✅ Found account via PhoneNumber table fallback for ID: ${phoneNumberId}`);

              const waAccount = await prisma.whatsAppAccount.findFirst({
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
          } catch (phoneErr) {
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
          await this.processIncomingMessage(
            msg,
            account.organizationId,
            account.id,
            account.phoneNumberId,
            profile.profileName
          );
        }
      }

      const statuses = value?.statuses || [];
      for (const st of statuses) {
        try {
          await this.processStatusUpdate(st, account.organizationId, account.id);
        } catch (e) {
          console.error('Status update sequential error:', e);
        }
      }

      return { status: 'processed' };
    } catch (e: any) {
      console.error('❌ Webhook processing error:', e);
      return { status: 'error', error: e.message };
    }
  }

  // -----------------------------
  // Template webhook processing
  // -----------------------------
  private async handleTemplateStatusUpdate(
    metaTemplateId: string,
    newStatus: string,
    rejectionReason?: string,
    metaCategory?: string
  ) {
    const template = await prisma.template.findFirst({
      where: { metaTemplateId },
    });

    if (!template) {
      console.warn(`⚠️ Webhook: Template not found: ${metaTemplateId}`);
      return;
    }

    const updateData: any = {
      status: newStatus as any,
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

    await prisma.template.update({
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
  private async handleTemplateCategoryUpdate(value: any) {
    try {
      const metaTemplateId = String(value.message_template_id || '');
      // Meta uses new_category (with correct_category on some payloads).
      const newCategory = String(
        value.new_category || value.correct_category || value.category || ''
      ).toUpperCase().trim();

      if (!metaTemplateId || !newCategory) return;

      const result = await prisma.template.updateMany({
        where: { metaTemplateId },
        data:  { category: newCategory as any },
      });

      if (result.count > 0) {
        console.log(`🏷️  Template ${metaTemplateId} category → ${newCategory} (billing rate updated)`);
      }
    } catch (e: any) {
      console.error('Template category update error:', e.message);
    }
  }

  private async handleTemplateUpdate(payload: any, value: any) {
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
        if (event === 'APPROVED') newStatus = 'APPROVED';
        else if (event === 'REJECTED') newStatus = 'REJECTED';
        else if (event === 'PAUSED') newStatus = 'PAUSED';

        await this.handleTemplateStatusUpdate(metaTemplateId, newStatus, rejectionReason, metaCategory);
      }
    } catch (e) {
      console.error('❌ Template update handling error:', e);
    }
  }

  // -----------------------------
  // Incoming message processing
  // Critical path: [dedupe | contact | phoneNumber] -> conversation upsert ->
  // message create -> socket emit. Baaki sab writes iske baad/background mein.
  // -----------------------------
  /**
   * Meta message ka content/media nikaalo. Live inbound (processIncomingMessage)
   * aur coexistence history import dono yahi use karte hain.
   */
  private parseMessageContent(message: any): {
    content: string;
    mediaUrl: string | null;
    mediaType: string | null;
    mediaMimeType: string | null;
    mediaId: string | null;
    fileName: string | null;
  } {
    const typeRaw = String(message?.type || 'text');
    let content: string = '';
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    let mediaMimeType: string | null = null;
    let mediaId: string | null = null;
    let fileName: string | null = null;

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
        if (mediaId) mediaUrl = mediaId;
        break;
      case 'video':
        mediaId = message.video?.id;
        mediaMimeType = message.video?.mime_type || 'video/mp4';
        content = message.video?.caption || '[Video]';
        mediaType = 'video';
        if (mediaId) mediaUrl = mediaId;
        break;
      case 'audio':
        mediaId = message.audio?.id;
        mediaMimeType = message.audio?.mime_type || 'audio/ogg';
        content = '[Audio]';
        mediaType = 'audio';
        if (mediaId) mediaUrl = mediaId;
        break;
      case 'document':
        mediaId = message.document?.id;
        mediaMimeType = message.document?.mime_type || 'application/pdf';
        fileName = message.document?.filename || 'document';
        content = message.document?.caption || `[Document: ${fileName}]`;
        mediaType = 'document';
        if (mediaId) mediaUrl = mediaId;
        break;
      case 'sticker':
        mediaId = message.sticker?.id;
        mediaMimeType = message.sticker?.mime_type || 'image/webp';
        content = '[Sticker]';
        mediaType = 'sticker';
        if (mediaId) mediaUrl = mediaId;
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
        } else if (iType === 'list_reply') {
          content = message.interactive.list_reply?.title || '[List Reply]';
          mediaUrl = JSON.stringify({
            type: 'list_reply',
            list_reply: {
              id: message.interactive.list_reply?.id,
              title: message.interactive.list_reply?.title,
              description: message.interactive.list_reply?.description,
            }
          });
        } else if (iType === 'button') {
          content = message.interactive?.body?.text || '[Interactive]';
          mediaUrl = JSON.stringify(message.interactive);
        } else if (iType === 'list') {
          content = message.interactive?.body?.text || '[List]';
          mediaUrl = JSON.stringify(message.interactive);
        } else if (iType === 'call_permission_reply') {
          content = callPermissionReplyText(message.interactive.call_permission_reply);
          mediaUrl = JSON.stringify(message.interactive);
        } else {
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

    return { content, mediaUrl, mediaType, mediaMimeType, mediaId, fileName };
  }

  private async processIncomingMessage(
    message: any,
    organizationId: string,
    whatsappAccountId: string,
    phoneNumberId: string,
    profileName?: string
  ) {
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
        prisma.message.findFirst({
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

      let conversation = await this.findOrCreateConversation(
        organizationId,
        contact.id,
        phoneNumberId,
        messageTime,
        phoneNumberUUID
      );

      const { content, mediaUrl, mediaType, mediaMimeType, mediaId, fileName } =
        this.parseMessageContent(message);

      const savedMessage = await prisma.message.create({
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

      const contactName =
        (contact as any).whatsappProfileName ||
        ((contact as any).firstName
          ? `${(contact as any).firstName} ${(contact as any).lastName || ''}`.trim()
          : (contact as any).phone);

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

      const conversationPayload: any = {
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

      webhookEvents.emit('newMessage', {
        organizationId,
        conversationId: conversation.id,
        message: messagePayload,
        conversation: conversationPayload,
      });

      webhookEvents.emit('conversationUpdated', {
        organizationId,
        conversation: conversationPayload,
      });

      // Phone par push notification. Socket sirf tab kaam karta hai jab app
      // khula ho - band app tak message pahunchane ka yahi ek raasta hai.
      // Jaan-bujh kar await nahi kiya: push bhejne me lagne wala waqt
      // webhook ka jawab dene me der na kare, warna Meta retry karega.
      notificationsService
        .notifyNewMessage({
          organizationId,
          conversationId: conversation.id,
          contactName,
          preview,
        })
        .catch((err) =>
          console.error('New message notification failed:', err?.message)
        );

      const updatedConversation = await prisma.conversation.update({
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

      prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastMessageAt: messageTime,
          messageCount: { increment: 1 },
        },
      }).catch((e: any) => console.error('Contact update error:', e));

      import('../inbox/inbox.service')
        .then(({ inboxService }) => inboxService.clearCache(organizationId))
        .catch((e: any) => console.error('Cache clear error:', e));

      // Authoritative unreadCount DB se aata hai. Agar optimistic value se
      // alag nikla (do message ek saath aane par possible hai), to sirf tabhi
      // ek correction emit bhejo - warna dobara emit karne ki zarurat nahi.
      if (updatedConversation.unreadCount !== conversationPayload.unreadCount) {
        conversationPayload.unreadCount = updatedConversation.unreadCount;
        webhookEvents.emit('conversationUpdated', {
          organizationId,
          conversation: conversationPayload,
        });
      }

      // Opt-out sabse pehle. "STOP" par contact UNSUBSCRIBED ho jata hai
      // (campaigns pehle se sirf ACTIVE ko bhejte hain), aur uske baad na
      // automation chalti hai na chatbot - ruk jane ko kehne ke baad bot ka
      // jawab aana sabse kharab cheez hai, aur wahi Block/Report karwata hai.
      const optSignal = detectOptSignal(content);
      const suppressBot = optSignal
        ? await applyOptSignal(optSignal, contact.id, organizationId)
        : false;

      if (!suppressBot) {
        // Automation + chatbot saath chalte hain (pehle jaise); dono me se kisi
        // ne jawab nahi diya to AI agent. Poora routing background me.
        this.routeInbound({
          wasNewlyCreated, organizationId, contact, content, waFrom,
          conversation: updatedConversation, message, msgType,
          whatsappAccountId, savedMessageId: savedMessage.id,
        }).catch((e: any) => console.error('Inbound routing error:', e));
      }

      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { ownerId: true },
      }).then((org: any) => {
        if (org && org.ownerId) {
          import('../notifications/webpush.service').then(({ webpushService }) => {
            webpushService.sendNotificationToUser(org.ownerId, {
              title: `Message from ${contactWithName.name}`,
              body: content || `[${typeRaw}]`,
              url: `/dashboard/inbox`,
            });
          }).catch((err: any) => console.error('Push Notification error:', err));
        }
      }).catch((err: any) => console.error('Error fetching org owner for push:', err));


      // ✅ Auto-backup inbound media to Cloudinary (fire-and-forget)
      const MEDIA_TYPES_TO_BACKUP = ['image', 'video', 'audio', 'document', 'sticker'];
      if (MEDIA_TYPES_TO_BACKUP.includes(typeRaw) && mediaId) {
        this.backupInboundMediaAsync(
          mediaId,
          mediaMimeType || 'application/octet-stream',
          organizationId,
          savedMessage.id,
          whatsappAccountId
        ).catch(err => {
          console.error('Async media backup error:', err.message);
        });
      }

      console.log(`✅ Inbound message processed: ${savedMessage.id}`);

    } catch (e) {
      console.error('processIncomingMessage error:', e);
    }
  }

  /**
   * Inbound WhatsApp message kaun sambhale. Pehle faisla, phir kaam:
   *  1. Chatbot ke button/list ka tap -> sirf chatbot (keyword automation nahi).
   *  2. Kisi automation ka wait_for_response is reply se aage badha, ya kisi
   *     KEYWORD automation ka keyword laga -> message automation ka, chatbot
   *     chup. Pehle dono saath chalte the aur customer ko do jawab jaate the.
   *  3. Baaki par chatbot.
   * Unknown-message / new-contact / media triggers pehle jaise chalte hain.
   * Kisi ne nahi pakda to AI agent (agar org ne on kiya ho). Inbox me agent ne
   * chat le li ho (automationPaused) to chatbot aur AI chup.
   */
  private async routeInbound(p: {
    wasNewlyCreated: boolean;
    organizationId: string;
    contact: any;
    content: string;
    waFrom: string;
    conversation: any;
    message: any;
    msgType: string;
    whatsappAccountId: string;
    savedMessageId: string;
  }): Promise<void> {
    const { organizationId, conversation, message, msgType, content } = p;

    // A suspended or read-only organization keeps receiving messages (they
    // are already saved), but no bot, AI or automation answers on its behalf.
    const { orgCanSend } = await import('../admin/orgControl');
    if (!(await orgCanSend(organizationId))) return;

    const paused = !!conversation.automationPaused;
    const replyId: string | undefined = msgType === 'INTERACTIVE'
      ? message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id
      : undefined;

    const chatbotOwnsTap = !paused && !!replyId
      && await chatbotEngine.ownsReply(organizationId, conversation.id, replyId)
        .catch((): boolean => false);

    const context = {
      organizationId,
      contactId: p.contact.id,
      phone: p.waFrom,
      message: content,
      conversationId: conversation.id,
    };

    // ✅ 0. Pehle is reply ka asar: scheduled follow-ups rokna aur
    // wait_for_response wale runs aage badhana. Naye triggers iske BAAD -
    // warna isi message se shuru hua naya run turant "reply aa gaya" samajh
    // kar ruk jata.
    const resumed = await automationEngine.onInboundMessage({
      ...context,
      buttonId: replyId,
      resume: !chatbotOwnsTap,
    }).catch((err): boolean => {
      console.error('❌ Inbound automation handling:', err.message);
      return false;
    });

    const keywordAutomations = content && !chatbotOwnsTap
      ? await automationEngine.matchKeywordAutomations(context)
      : [];

    const automationClaimed = resumed || keywordAutomations.length > 0;

    const automationPromise = this.runAutomations(
      p.wasNewlyCreated, context, message, msgType, keywordAutomations
    ).then((ran) => ran || resumed);

    let chatbotPromise: Promise<boolean> = Promise.resolve(false);
    if (
      !paused &&
      (msgType === 'TEXT' || msgType === 'INTERACTIVE') &&
      (chatbotOwnsTap || !automationClaimed)
    ) {
      let chatbotContent = content;
      if (msgType === 'INTERACTIVE') {
        const iType = message?.interactive?.type;
        chatbotContent = iType === 'button_reply'
          ? (message.interactive.button_reply.id || message.interactive.button_reply.title || content)
          : iType === 'list_reply'
            ? (message.interactive.list_reply.id || message.interactive.list_reply.title || content)
            : content;
      }

      const isNewConversation = await this.isFreshChat(
        conversation.id, p.savedMessageId, p.wasNewlyCreated
      );
      chatbotPromise = chatbotEngine.processMessage(
        conversation.id,
        organizationId,
        chatbotContent,
        p.waFrom,
        isNewConversation,
        message
      ).catch((e: any) => {
        console.error('Chatbot error:', e);
        return false;
      });
    }

    const [handledByAutomation, handledByChatbot] = await Promise.all([automationPromise, chatbotPromise]);

    // Agent on hai ya nahi - wo engine khud dekhta hai
    if (!shouldAiReply({ agentEnabled: true, paused, handledByAutomation, handledByChatbot, msgType, text: content })) {
      return;
    }

    const { aiAgentEngine } = await import('../aiagent/aiagent.engine');
    await aiAgentEngine.handleInbound({
      organizationId,
      conversationId: conversation.id,
      contactId: p.contact.id,
      phone: p.waFrom,
      text: content,
      whatsappAccountId: p.whatsappAccountId,
      excludeMessageId: p.savedMessageId,
    });
  }

  /**
   * "Nayi chat" = default chatbot shuru ho sakta hai: contact abhi bana, ya
   * customer ka pichla message 24 ghante se purana / hai hi nahi.
   * Pehle `unreadCount <= 1` dekhte the - par har outbound (bot ka apna
   * jawab bhi) unreadCount 0 kar deta hai, to lagbhag har message "nayi chat"
   * tha aur flow khatam hote hi agla message default bot ko shuru se chala
   * deta tha: wahi welcome/menu baar-baar.
   */
  private async isFreshChat(
    conversationId: string,
    currentMessageId: string,
    wasNewlyCreated: boolean
  ): Promise<boolean> {
    if (wasNewlyCreated) return true;
    try {
      const previous = await prisma.message.findFirst({
        where: { conversationId, direction: 'INBOUND', id: { not: currentMessageId } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      return !previous || Date.now() - previous.createdAt.getTime() > 24 * 60 * 60 * 1000;
    } catch (e: any) {
      console.error('isFreshChat error:', e?.message);
      return false;
    }
  }

  /** true = kisi automation ne is message par kuch chalaya */
  private async runAutomations(
    wasNewlyCreated: boolean,
    context: {
      organizationId: string;
      contactId: string;
      phone: string;
      message: string;
      conversationId: string;
    },
    message: any,
    msgType: string,
    keywordAutomations: any[]
  ): Promise<boolean> {
    const { organizationId, contactId, phone } = context;
    try {
      // Triggers saath (pehle bhi saath chalte the); result ka intezar taaki
      // pata chale kisi ne message pakda ya nahi.
      const results = await Promise.all([
        // ✅ 1. Unknown message trigger (for new/unknown senders)
        // Fire regardless of contact existence - the trigger itself checks
        automationEngine.triggerUnknownMessage(context).catch((err): boolean => {
          console.error('❌ Unknown message trigger:', err.message);
          return false;
        }),

        // ✅ 2. Keyword trigger - kaun si lagi, wo routeInbound pehle tay kar chuka
        keywordAutomations.length
          ? automationEngine.runKeywordAutomations(keywordAutomations, context).catch((err): boolean => {
              console.error('❌ Keyword trigger:', err.message);
              return false;
            })
          : Promise.resolve(false),

        // 4. Media received: the customer sent an image, video, document or
        // audio. The raw WhatsApp message carries its id and caption under
        // its own type key (message.image.id, message.video.caption, ...).
        ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(msgType)
          ? automationEngine.triggerMediaReceived({
              ...context,
              media: {
                type: msgType,
                id: message?.[msgType.toLowerCase()]?.id ?? null,
                caption: message?.[msgType.toLowerCase()]?.caption ?? null,
              },
            }).catch((err): boolean => {
              console.error('❌ Media trigger:', err.message);
              return false;
            })
          : Promise.resolve(false),

        // ✅ 3. New contact trigger (only if contact was JUST created)
        wasNewlyCreated
          ? automationEngine.triggerNewContact({
              organizationId,
              contactId,
              phone,
            }).catch((err): boolean => {
              console.error('❌ New contact trigger:', err.message);
              return false;
            })
          : Promise.resolve(false),
      ]);

      return results.some(Boolean);
    } catch (e) {
      console.error('runAutomations error:', e);
      return false;
    }
  }

  // -----------------------------
  // Status update processing
  // -----------------------------
  private async processStatusUpdate(
    statusObj: any,
    organizationId: string,
    whatsappAccountId: string
  ) {
    try {
      const waMessageId = String(statusObj?.id || '');
      const st          = String(statusObj?.status || '').toLowerCase();
      const ts          = Number(statusObj?.timestamp || Date.now() / 1000);
      const statusTime  = new Date(ts * 1000);

      if (!waMessageId) return;

      // ✅ Clean log - short ID
      webhookLog.debug('Status update', {
        wamid: waMessageId,
        status: st,
      });

      let newStatus: MessageStatus = 'SENT';
      if (st === 'sent')      newStatus = 'SENT';
      if (st === 'delivered') newStatus = 'DELIVERED';
      if (st === 'read')      newStatus = 'READ';
      if (st === 'failed')    newStatus = 'FAILED';

      const failureReason = st === 'failed'
        ? (statusObj?.errors?.[0]?.message || 'Unknown error')
        : undefined;

      // Update campaign contact
      await this.updateCampaignContactStatus(
        waMessageId, newStatus, statusTime, failureReason
      );

      // Gupshup number ka service message deliver nahi hua - Gupshup paisa
      // nahi leta, to customer ka charge bhi wapas (gupshup.router). Baaki
      // messages par koi charge hi nahi hota, tab ye kuch nahi karta.
      if (newStatus === 'FAILED') {
        import('../wallet/wallet.deduction.service')
          .then(({ refundServiceCharge }) =>
            refundServiceCharge(waMessageId, failureReason || 'delivery failed')
          )
          .catch(() => {});
      }

      // ✅ FIX: Query with ALL possible field names
      const message = await prisma.message.findFirst({
        where: {
          OR: [
            { waMessageId },
            { wamId: waMessageId },
            { whatsappMessageId: waMessageId },  // ✅ ADD THIS
          ],
        },
        include: {
          conversation: {
            select: {
              id:              true,
              contactId:       true,
              organizationId:  true,
            },
          },
        },
      });

      if (message) {
        await this.updateChatMessageStatus(
          message, newStatus, statusTime, statusObj, organizationId
        );
      } else {
        // ✅ FIX: Better retry (silent if truly missing)
        this.retryUpdateChatMessageStatusInBackground(
          waMessageId, newStatus, statusTime, statusObj, organizationId
        ).catch(() => {});
      }

    } catch (e: any) {
      webhookLog.error('processStatusUpdate error', e);
    }
  }

  private async updateChatMessageStatus(
    message: any,
    newStatus: MessageStatus,
    statusTime: Date,
    statusObj: any,
    organizationId: string
  ) {
    // ✅ FIX: Prevent status regression
    const STATUS_PRIORITY: Record<string, number> = {
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

    const updatedMessage = await prisma.message.update({
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
        prisma.conversation.update({
          where: { id: message.conversationId },
          data: {
            isWindowOpen: false,
            windowExpiresAt: new Date(),
          },
        }).catch((err: any) => console.error('Failed to update conversation window state:', err?.message));

        webhookEvents.emit('conversationUpdated', {
          organizationId: message.conversation?.organizationId || organizationId,
          conversation: {
            id: message.conversationId,
            isWindowOpen: false,
            windowExpiresAt: new Date().toISOString(),
          },
        });
      }
    }

    const metadata = (message.metadata as any) || {};

    webhookEvents.emit('messageStatus', {
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

  private async retryUpdateChatMessageStatusInBackground(
    waMessageId:      string,
    newStatus:        MessageStatus,
    statusTime:       Date,
    statusObj:        any,
    organizationId:   string
  ) {
    // ✅ Exponential backoff - total 20 seconds
    const retryDelays = [500, 1000, 2000, 3000, 5000, 8000];

    for (const delay of retryDelays) {
      await new Promise(r => setTimeout(r, delay));

      const message = await prisma.message.findFirst({
        where: {
          OR: [
            { waMessageId },
            { wamId: waMessageId },
            { whatsappMessageId: waMessageId },  // ✅ Include all
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
        await this.updateChatMessageStatus(
          message, newStatus, statusTime, statusObj, organizationId
        );
        return;
      }
    }

    // ✅ Only log if it's actually a problem (not warning-spam)
    // Most likely: message from before webhook was setup OR different org
    // Silent by default - only warn in debug mode
    if (process.env.LOG_LEVEL === 'debug') {
      webhookLog.debug('Message not found after retries', {
        wamid: waMessageId,
        status: newStatus,
      });
    }
  }

  // ============================================
  // ✅ FIXED: Campaign contact status sync — idempotent refund
  // ============================================
  private async updateCampaignContactStatus(
    waMessageId: string,
    newStatus: MessageStatus,
    statusTime: Date,
    failureReason?: string
  ) {
    try {
      const campaignContact = await prisma.campaignContact.findFirst({
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

      if (!campaignContact) return;

      const currentStatus = campaignContact.status;

      // ✅ Status priority — only allow forward transitions (unless FAILED)
      const statusPriority: Record<string, number> = {
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
      if (newPriority <= currentPriority && newStatus !== 'FAILED') return;

      // Skip if already FAILED
      if (currentStatus === 'FAILED' && newStatus !== 'FAILED') return;

      // ✅ Update campaign contact
      await prisma.campaignContact.updateMany({
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
          const shouldRefund = await this.shouldRefundFailure(
            campaignContact.campaignId,
            campaignContact.campaign.totalContacts,
          );

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
          } else {
            console.log(
              `⏭️  Skipping refund (threshold reached): ${waMessageId} ` +
              `(Campaign: ${campaignContact.campaignId})`
            );
          }
        }
      }

      // ✅ Recompute campaign counters from source of truth (single query)
      const counts = await prisma.campaignContact.groupBy({
        by: ['status'],
        where: { campaignId: campaignContact.campaignId },
        _count: true,
      });

      const get = (s: string) => counts.find(c => c.status === s)?._count || 0;
      const pending = get('PENDING') + get('QUEUED');
      const sentOnly = get('SENT');
      const delivered = get('DELIVERED');
      const read = get('READ');
      const failed = get('FAILED');
      const total = pending + sentOnly + delivered + read + failed;

      // Cumulative counts (for storage)
      const cumulativeSent = sentOnly + delivered + read;
      const cumulativeDelivered = delivered + read;

      await prisma.campaign.update({
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
          const { campaignSocketService } = await import('../campaigns/campaigns.socket');
          const { campaignsService } = await import('../campaigns/campaigns.service');

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
          } as any);

          // Live counts go through the same smart display as the send loop
          // and the REST stats - emitting the raw failed count here made the
          // Failed card jump between real and smart numbers mid-campaign.
          // The DB above keeps the real counts.
          const smart = campaignsService.calculateSmartDisplay({
            totalContacts: total,
            deliveredCount: delivered,
            readCount: read,
            failedCount: failed,
            pendingCount: pending,
            sentCount: sentOnly,
          });
          const shownSent = smart.displaySent + cumulativeDelivered;
          const shownFailed = smart.displayFailed;

          // Emit progress update
          const processed = shownSent + shownFailed;
          const percentage = Math.min(100, Math.round((processed / Math.max(total, 1)) * 100));

          campaignSocketService.emitCampaignProgress(orgId, campaignContact.campaignId, {
            sent: shownSent,
            failed: shownFailed,
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
            sentCount: shownSent,
            deliveredCount: cumulativeDelivered,
            readCount: read,
            failedCount: shownFailed,
          });
        } catch (e) {
          console.error('❌ Socket emit failed:', e);
        }
      }
    } catch (e) {
      console.error('updateCampaignContactStatus error:', e);
    }
  }

  // ============================================
  // ✅ Process refunds sequentially (not parallel)
  // ============================================
  private async processRefundQueue(): Promise<void> {
    if (this.refundProcessing || this.refundQueue.length === 0) return;

    this.refundProcessing = true;

    while (this.refundQueue.length > 0) {
      const item = this.refundQueue.shift()!;

      try {
        await this.processRefundWithRetry(
          item.waMessageId,
          item.organizationId,
          item.campaignId,
          item.contactPhone,
          item.template,
        );

        // ✅ Small gap between refunds to avoid DB pressure
        await new Promise(r => setTimeout(r, 100));
      } catch (err: any) {
        console.error('Refund queue item failed:', err.message);
        await this.storeFailedRefund(
          item.waMessageId,
          item.organizationId,
        );
      }
    }

    this.refundProcessing = false;
  }

  // ============================================
  // ✅ NEW METHOD: Refund with retry + timeout fix
  // ============================================
  private async processRefundWithRetry(
    waMessageId: string,
    organizationId: string,
    campaignId: string,
    contactPhone: string,
    template: { name: string; category: string; language: string },
    attempt: number = 1,
  ): Promise<void> {
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = [1000, 3000, 5000]; // 1s, 3s, 5s

    try {
      const { getRateForCategory } = await import('../wallet/wallet.deduction.service');
      const rateRupees = getRateForCategory(
        template.category || 'MARKETING',
        contactPhone,
        template.language,
      );
      const refundPaise = Math.round(rateRupees * 100);

      if (refundPaise <= 0) return;

      // ✅ FIX: 30-second timeout (was 5s default)
      await prisma.$transaction(
        async (tx) => {
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
        },
        {
          maxWait:  10000,  // ✅ 10s wait for connection
          timeout:  30000,  // ✅ 30s transaction timeout (was default 5s)
          isolationLevel: 'ReadCommitted', // ✅ Reduce contention
        },
      );
    } catch (err: any) {
      // The unique index on (metaChargeId, metaService) is the authoritative
      // idempotency guard. A concurrent duplicate refund now fails the insert
      // with P2002 -- that means the refund already landed, so treat it as
      // success rather than an error.
      if (err?.code === 'P2002') {
        console.log(`⏭️  Refund already recorded for ${waMessageId} (unique guard)`);
        return;
      }

      const isTimeoutError = 
        err.message?.includes('Transaction already closed') ||
        err.message?.includes('timeout');

      // ✅ Retry on timeout errors
      if (isTimeoutError && attempt < MAX_ATTEMPTS) {
        const delay = RETRY_DELAY_MS[attempt - 1];
        console.warn(
          `⚠️  Refund attempt ${attempt}/${MAX_ATTEMPTS} timed out, retrying in ${delay}ms...`,
        );

        await new Promise(resolve => setTimeout(resolve, delay));

        return this.processRefundWithRetry(
          waMessageId,
          organizationId,
          campaignId,
          contactPhone,
          template,
          attempt + 1,
        );
      }

      // ✅ Final failure - throw so caller can store for manual retry
      console.error(`❌ Refund failed after ${attempt} attempts:`, err.message);
      throw err;
    }
  }

  // ============================================
  // ✅ NEW METHOD: Store failed refunds for manual/cron retry
  // ============================================
  private async storeFailedRefund(
    waMessageId: string,
    organizationId: string,
  ): Promise<void> {
    try {
      // Option A: Store in webhook logs
      await prisma.webhookLog.create({
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
    } catch (e) {
      console.error('Failed to store failed refund:', e);
    }
  }

  // ============================================
  // ✅ NEW: Determine if failure should be refunded
  // ============================================
  private async shouldRefundFailure(
    campaignId: string,
    totalContacts: number,
  ): Promise<boolean> {
    const HONEST_THRESHOLD = 300;

    // Small campaign - always refund
    if (totalContacts <= HONEST_THRESHOLD) {
      return true;
    }

    // ✅ NEW: Check real delivery rate
    const campaign = await prisma.campaign.findUnique({
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
          console.log(
            `💰 Emergency refund mode for campaign ${campaignId}: Delivery ${deliveryRate.toFixed(1)}%`
          );
          this.emergencyLoggedCampaigns.add(campaignId);
          
          // Clear after 5 mins to allow re-logging
          setTimeout(() => this.emergencyLoggedCampaigns.delete(campaignId), 5 * 60 * 1000);
        }
        return true;
      }
    }

    // Calculate max refundable (normal smart mode)
    let maxFailRate = 0.10;
    if (totalContacts > 5000) maxFailRate = 0.05;
    else if (totalContacts > 1000) maxFailRate = 0.06;
    else if (totalContacts > 500) maxFailRate = 0.08;

    const maxRefundable = Math.ceil(totalContacts * maxFailRate);

    const alreadyRefunded = await prisma.walletTransaction.count({
      where: {
        metaService: 'template_message_refund',
        note: { contains: campaignId },
      },
    });

    const canRefundMore = alreadyRefunded < maxRefundable;

    if (!canRefundMore) {
      console.log(
        `💰 Refund limit reached for campaign ${campaignId}: ${alreadyRefunded}/${maxRefundable}`
      );
    }

    return canRefundMore;
  }

  // -----------------------------
  // Verify webhook
  // -----------------------------
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const VERIFY_TOKEN =
      process.env.META_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || 'wabmeta_webhook_verify_2024';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) return challenge;
    return null;
  }

  // -----------------------------
  // Log webhook
  // -----------------------------
  async logWebhook(payload: any, status: string, error?: string): Promise<void> {
    try {
      const value = this.extractValue(payload);
      const phoneNumberId = value?.metadata?.phone_number_id;

      let organizationId: string | null = null;
      if (phoneNumberId) {
        const cached = this.accountCache.get(phoneNumberId);
        if (cached && cached.expiresAt > Date.now()) {
          organizationId = cached.data.organizationId;
        } else {
          const account = await prisma.whatsAppAccount.findFirst({
            where: { phoneNumberId },
            select: { organizationId: true },
          });
          organizationId = account?.organizationId || null;

          if (!organizationId) {
            try {
              const phoneRecord = await (prisma as any).phoneNumber.findFirst({
                where: { phoneNumberId },
                include: { metaConnection: true }
              });
              organizationId = phoneRecord?.metaConnection?.organizationId || null;
            } catch (e) { }
          }
        }
      }

      const mapped =
        status === 'processed' ? 'SUCCESS' :
          status === 'error' ? 'FAILED' :
            status === 'rejected' ? 'FAILED' :
              status === 'ignored' ? 'SUCCESS' :
                'SUCCESS';

      await prisma.webhookLog.create({
        data: {
          organizationId,
          source: 'whatsapp',
          eventType: payload?.entry?.[0]?.changes?.[0]?.field || 'unknown',
          payload,
          status: mapped as any,
          processedAt: new Date(),
          errorMessage: error || null,
        },
      });
    } catch (e) {
      console.error('logWebhook error:', e);
    }
  }

  async expireConversationWindows() {
    try {
      const now = new Date();
      await prisma.conversation.updateMany({
        where: {
          isWindowOpen: true,
          windowExpiresAt: { lt: now },
        },
        data: {
          isWindowOpen: false,
        },
      });
    } catch (e) {
      console.error('expireConversationWindows error:', e);
    }
  }

  async resetDailyMessageLimits() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await prisma.whatsAppAccount.updateMany({
        where: {
          lastLimitReset: { lt: yesterday },
        },
        data: {
          dailyMessagesUsed: 0,
          lastLimitReset: new Date(),
        },
      });
    } catch (e) {
      console.error('resetDailyMessageLimits error:', e);
    }
  }

  // ============================================
  // COEXISTENCE: contacts + chat history import
  // ============================================
  // Meta ye tab bhejta hai jab humne connect ke baad smb_app_data se maanga ho
  // (src/modules/meta/coexistence.ts). Shape:
  //   history:            value.history[] -> { metadata{phase,progress}, threads[] -> { id: customer wa_id, messages[] }, errors? }
  //   smb_app_state_sync: value.state_sync[] -> { type:'contact', contact{full_name,first_name,phone_number}, action:'add'|'remove' }
  //
  // Ye PURANI chats hain: inpar chatbot / AI / automation nahi chalte, unread
  // nahi badhta, notification nahi jaata aur 24h window sirf tab khulti hai
  // jab customer ka aakhri message sach me 24 ghante ke andar ka ho. Isliye
  // processIncomingMessage ki jagah alag, bina side-effect wala raasta.

  private async findSyncAccount(payload: any, value: any) {
    const phoneNumberId = value?.metadata?.phone_number_id;
    if (phoneNumberId) {
      const byPhone = await prisma.whatsAppAccount.findUnique({
        where: { phoneNumberId: String(phoneNumberId) },
        select: { id: true, organizationId: true, phoneNumberId: true, phoneNumber: true },
      });
      if (byPhone) return byPhone;
    }
    const wabaId = payload?.entry?.[0]?.id;
    if (!wabaId) return null;
    return prisma.whatsAppAccount.findFirst({
      where: { wabaId: String(wabaId) },
      select: { id: true, organizationId: true, phoneNumberId: true, phoneNumber: true },
    });
  }

  private mapHistoryStatus(status: any): MessageStatus {
    switch (String(status || '').toUpperCase()) {
      case 'READ':
      case 'PLAYED':
        return 'READ';
      case 'SENT':
        return 'SENT';
      case 'PENDING':
        return 'PENDING';
      case 'ERROR':
      case 'FAILED':
        return 'FAILED';
      default:
        return 'DELIVERED';
    }
  }

  private async handleHistorySync(payload: any, value: any) {
    try {
      const account = await this.findSyncAccount(payload, value);
      if (!account) {
        webhookLog.warn('History webhook for unknown account', { wabaId: payload?.entry?.[0]?.id });
        return;
      }

      const businessDigits = String(
        value?.metadata?.display_phone_number || account.phoneNumber || ''
      ).replace(/\D/g, '');

      const chunks: any[] = Array.isArray(value?.history) ? value.history : [];
      const topErrors: any[] = Array.isArray(value?.errors) ? value.errors : [];

      for (const chunk of [{ errors: topErrors }, ...chunks]) {
        // 2593109 = business ne WhatsApp Business app me history sharing band rakhi.
        if ((chunk?.errors || []).some((e: any) => Number(e?.code) === 2593109)) {
          webhookLog.warn('History sharing declined by business', { accountId: account.id });
          await recordHistoryProgress(account.id, { declined: true });
          continue;
        }

        let imported = 0;
        for (const thread of (chunk as any)?.threads || []) {
          imported += (await this.importHistoryThread(account, businessDigits, thread)).count;
        }
        if (imported > 0) this.clearInboxCache(account.organizationId);

        const meta = (chunk as any)?.metadata;
        if (meta) {
          await recordHistoryProgress(account.id, {
            phase: Number(meta.phase),
            progress: Number(meta.progress),
          });
          webhookLog.info('History chunk imported', {
            accountId: account.id,
            phase: meta.phase,
            chunk: meta.chunk_order,
            progress: meta.progress,
            imported,
          });
        }
      }
    } catch (e: any) {
      webhookLog.error('handleHistorySync error', { error: e?.message });
    }
  }

  /**
   * Ek customer ki chat ke messages save karo - coexistence history, ya
   * `echo` = business ne connect ke BAAD phone ki WhatsApp Business app se
   * bheja (smb_message_echoes). Kitne naye messages bane aur kis conversation
   * me, wo lautao.
   */
  private async importHistoryThread(
    account: { id: string; organizationId: string; phoneNumberId: string },
    businessDigits: string,
    thread: any,
    opts: { echo?: boolean } = {}
  ): Promise<{ count: number; conversationId: string | null }> {
    const customer = String(thread?.id || '');
    const messages: any[] = Array.isArray(thread?.messages) ? thread.messages : [];
    if (!customer || messages.length === 0) return { count: 0, conversationId: null };

    const { contact } = await this.findOrCreateContact(account.organizationId, customer);
    const phoneNumberUUID = await this.resolvePhoneNumberUUID(account.phoneNumberId);

    // Nayi conversation BAND window ke saath - neeche asli samay se tay hoti hai.
    const conversation = await prisma.conversation.upsert({
      where: {
        organizationId_contactId_channel: {
          organizationId: account.organizationId,
          contactId: contact.id,
          channel: 'WHATSAPP',
        },
      },
      create: {
        organizationId: account.organizationId,
        contactId: contact.id,
        ...(phoneNumberUUID ? { phoneNumberId: phoneNumberUUID } : {}),
        isWindowOpen: false,
        windowExpiresAt: null,
        unreadCount: 0,
        isRead: true,
      },
      update: {},
    });

    const rows: any[] = [];
    let newest: { at: Date; preview: string } | null = null;
    let newestInbound: Date | null = null;

    for (const msg of messages) {
      const waMessageId = String(msg?.id || '');
      if (!waMessageId) continue;

      const at = new Date(Number(msg?.timestamp || 0) * 1000);
      if (isNaN(at.getTime()) || at.getTime() === 0) continue;

      const typeRaw = String(msg?.type || 'text');
      const outbound = String(msg?.from || '').replace(/\D/g, '') === businessDigits;
      const parsed = this.parseMessageContent(msg);
      // Echo abhi-abhi bheja gaya hai - aage ka status (DELIVERED/READ) normal
      // statuses webhook se isi wamid par aata hai.
      const status: MessageStatus = !outbound
        ? 'DELIVERED'
        : opts.echo
          ? 'SENT'
          : this.mapHistoryStatus(msg?.history_context?.status);

      rows.push({
        conversationId: conversation.id,
        whatsappAccountId: account.id,
        waMessageId,
        wamId: waMessageId,
        direction: outbound ? 'OUTBOUND' : 'INBOUND',
        type: this.mapMessageType(typeRaw),
        ...parsed,
        status,
        sentAt: at,
        deliveredAt: status === 'DELIVERED' || status === 'READ' ? at : null,
        readAt: status === 'READ' ? at : null,
        timestamp: at,
        createdAt: at,
        metadata: {
          originalType: typeRaw,
          source: opts.echo ? 'business_app_echo' : 'coexistence_history',
          historyStatus: msg?.history_context?.status || null,
          context: msg?.context || null,
        },
      });

      if (!newest || at > newest.at) {
        newest = { at, preview: (parsed.content || `[${typeRaw}]`).substring(0, 100) };
      }
      if (!outbound && (!newestInbound || at > newestInbound)) newestInbound = at;
    }

    if (rows.length === 0) return { count: 0, conversationId: conversation.id };

    // waMessageId unique hai - Meta ek chunk dobara bheje to duplicate chup-chaap chhoot jaata hai.
    const { count } = await prisma.message.createMany({ data: rows, skipDuplicates: true });
    // Sab pehle se the (Meta ne dobara bheja) - conversation ko mat chhedo.
    if (count === 0) return { count: 0, conversationId: conversation.id };

    // Conversation ka "aakhri message" sirf tab badlo jab history wala usse naya ho -
    // connect ke baad aaye live messages ko purana message peeche na dhakel de.
    const patch: any = {};
    if (newest && (!conversation.lastMessageAt || newest.at > conversation.lastMessageAt)) {
      patch.lastMessageAt = newest.at;
      patch.lastMessagePreview = newest.preview;
    }
    if (
      newestInbound &&
      (!conversation.lastCustomerMessageAt || newestInbound > conversation.lastCustomerMessageAt)
    ) {
      patch.lastCustomerMessageAt = newestInbound;
      const expires = new Date(newestInbound.getTime() + 24 * 60 * 60 * 1000);
      if (expires.getTime() > Date.now()) {
        patch.isWindowOpen = true;
        patch.windowExpiresAt = expires;
      }
    }
    // Business ne phone se jawab diya = chat dekh li. WhatsApp app bhi yahi karti hai.
    if (opts.echo && count > 0) {
      patch.isRead = true;
      patch.unreadCount = 0;
    }
    if (Object.keys(patch).length > 0) {
      await prisma.conversation.update({ where: { id: conversation.id }, data: patch });
    }

    return { count, conversationId: conversation.id };
  }

  private clearInboxCache(organizationId: string) {
    import('../inbox/inbox.service')
      .then(({ inboxService }) => inboxService.clearCache(organizationId))
      .catch((e: any) => webhookLog.warn('Inbox cache clear failed', { error: e?.message }));
  }

  private async handleSmbStateSync(payload: any, value: any) {
    try {
      const account = await this.findSyncAccount(payload, value);
      if (!account) {
        webhookLog.warn('SMB state sync for unknown account', { wabaId: payload?.entry?.[0]?.id });
        return;
      }

      const items: any[] = Array.isArray(value?.state_sync) ? value.state_sync : [];
      let saved = 0;

      for (const item of items) {
        // 'remove' = business ne phone se contact hataya. CRM ka contact nahi
        // mitate - usme notes, labels, campaigns ho sakte hain.
        if (item?.type !== 'contact' || item?.action === 'remove') continue;

        const phone = item?.contact?.phone_number;
        if (!phone) continue;

        // Ye naam business ne apne phone me save kiya hai, WhatsApp profile
        // name nahi. Isliye sirf tab lagao jab CRM me naam hai hi nahi.
        const savedName = String(item.contact.full_name || item.contact.first_name || '').trim();

        try {
          const { contact } = await this.findOrCreateContact(account.organizationId, String(phone));
          if (savedName && (!contact.firstName || contact.firstName === 'Unknown')) {
            await prisma.contact.update({
              where: { id: contact.id },
              data: { firstName: savedName },
            });
          }
          saved++;
        } catch (e: any) {
          webhookLog.warn('SMB contact sync error', { error: e?.message });
        }
      }

      webhookLog.info('SMB contacts synced', { accountId: account.id, received: items.length, saved });
    } catch (e: any) {
      webhookLog.error('handleSmbStateSync error', { error: e?.message });
    }
  }

  /**
   * Coexistence: business ne connect ke baad phone ki WhatsApp Business app se
   * message bheja. Meta use `message_echoes` me bhejta hai (from = business,
   * to = customer). Pehle ye sirf log hota tha, isliye phone se diye jawab
   * Inbox me dikhte hi nahi the - agent ko lagta tha customer ko kisi ne
   * reply nahi kiya. Ab OUTBOUND message ki tarah save + live emit hota hai.
   * Chatbot/AI/automation nahi chalte (ye customer ka message nahi hai).
   */
  private async handleSmbMessageEchoes(payload: any, value: any) {
    try {
      const account = await this.findSyncAccount(payload, value);
      if (!account) {
        webhookLog.warn('Message echo for unknown account', { wabaId: payload?.entry?.[0]?.id });
        return;
      }

      const echoes: any[] = Array.isArray(value?.message_echoes) ? value.message_echoes : [];
      const businessDigits = String(
        value?.metadata?.display_phone_number || account.phoneNumber || ''
      ).replace(/\D/g, '');

      // Ek webhook me kai customers ke echo ho sakte hain - customer ke hisaab se baanto.
      const byCustomer = new Map<string, any[]>();
      for (const echo of echoes) {
        const to = String(echo?.to || '');
        if (!to) continue;
        byCustomer.set(to, [...(byCustomer.get(to) || []), echo]);
      }

      let saved = 0;
      for (const [to, messages] of byCustomer) {
        const { count, conversationId } = await this.importHistoryThread(
          account,
          businessDigits,
          { id: to, messages },
          { echo: true }
        );
        if (count === 0 || !conversationId) continue;
        saved += count;
        await this.emitEchoes(account.organizationId, conversationId, messages.map((m) => String(m?.id || '')));
      }

      if (saved > 0) this.clearInboxCache(account.organizationId);
      webhookLog.info('Business app echoes saved', { accountId: account.id, received: echoes.length, saved });
    } catch (e: any) {
      webhookLog.error('handleSmbMessageEchoes error', { error: e?.message });
    }
  }

  /** Naye save hue echo messages Inbox ko live bhejo (socket.ts newMessage relay). */
  private async emitEchoes(organizationId: string, conversationId: string, waMessageIds: string[]) {
    const [saved, conversation] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId, waMessageId: { in: waMessageIds.filter(Boolean) } },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.conversation.findUnique({ where: { id: conversationId }, include: { contact: true } }),
    ]);
    if (!conversation) return;

    const c: any = conversation.contact || {};
    const conversationPayload: any = {
      ...conversation,
      contact: {
        id: c.id,
        phone: c.phone,
        firstName: c.firstName,
        lastName: c.lastName,
        avatar: c.avatar,
        whatsappProfileName: c.whatsappProfileName,
        name:
          c.whatsappProfileName ||
          (c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : c.phone),
      },
    };

    for (const message of saved) {
      webhookEvents.emit('newMessage', {
        organizationId,
        conversationId,
        message,
        conversation: conversationPayload,
      });
    }
    webhookEvents.emit('conversationUpdated', { organizationId, conversation: conversationPayload });
  }

  // ============================================
  // ✅ NEW: Auto-backup inbound media to Cloudinary
  // Meta media 30 din baad expire hoti hai
  // ============================================
  private async backupInboundMediaAsync(
    mediaId: string,
    mimeType: string,
    organizationId: string,
    messageId: string,
    whatsappAccountId: string
  ): Promise<void> {
    try {
      // Small delay - let message save complete
      await new Promise(r => setTimeout(r, 1000));

      const axios = (await import('axios')).default;
      const { safeDecryptStrict } = await import('../../utils/encryption');
      const { config } = await import('../../config');

      const account = await prisma.whatsAppAccount.findUnique({
        where: { id: whatsappAccountId },
        select: { accessToken: true }
      });

      if (!account?.accessToken) return;

      const accessToken = safeDecryptStrict(account.accessToken);
      if (!accessToken) return;

      // Step 1: Get media URL from Meta
      const version = config.meta?.graphApiVersion || 'v22.0';
      const infoRes = await axios.get(
        `https://graph.facebook.com/${version}/${mediaId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      const metaDownloadUrl = infoRes.data?.url;
      const actualMime = infoRes.data?.mime_type || mimeType;

      if (!metaDownloadUrl) return;

      // Step 2: Download from Meta CDN
      const mediaRes = await axios.get(metaDownloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: 100 * 1024 * 1024,
      });

      const buffer = Buffer.from(mediaRes.data);
      if (buffer.length === 0) return;

      // Step 3: Upload to Cloudflare R2 (or fallback to Cloudinary)
      let mediaUrl = '';
      let storageKey = '';

      const { r2Service } = await import('../../services/r2.service');
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
        } catch (e: any) {
          console.error('❌ R2 inbound upload failed:', e.message);
        }
      }

      if (!mediaUrl) {
        const { cloudinaryService } = await import('../../services/cloudinary.service');
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

      if (!mediaUrl) return;

      // Step 4: Update message with media URL
      const existingMsg = await prisma.message.findUnique({
        where: { id: messageId },
        select: { metadata: true }
      });

      const existingMeta = (existingMsg?.metadata as any) || {};

      await prisma.message.update({
        where: { id: messageId },
        data: {
          mediaUrl: mediaUrl,
          metadata: {
            ...existingMeta,
            storageUrl: mediaUrl,
            storageKey: storageKey,
            backedUpAt: new Date().toISOString(),
            originalMetaMediaId: mediaId,
          } as any,
        },
      });

      console.log(`☁️ Auto-backed up inbound media: ${messageId}`);
    } catch (err: any) {
      // Silently fail - media will backup on first user access
      console.error(`Inbound backup failed for ${messageId}:`, err.message);
    }
  }
}

export const webhookService = new WebhookService();
export default webhookService;