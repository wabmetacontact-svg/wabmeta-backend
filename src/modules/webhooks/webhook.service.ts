// src/modules/webhooks/webhook.service.ts - FIXED VERSION
// ✅ FIX: updateCampaignContactStatus refund is now IDEMPOTENT.
// Previously, if Meta sent the same 'failed' status webhook twice (which happens
// on webhook retries or if two events arrive concurrently), BOTH invocations would
// read the same stale currentStatus (non-FAILED) and BOTH would credit the wallet
// — meaning one failed message could be refunded 2x (or more).
//
// The new refund path is guarded by a Prisma $transaction with a
// "does a completed refund transaction already exist for this waMessageId?" check
// under a serializable read, so only ONE refund can ever land per waMessageId.

import prisma from '../../config/database';
import { contactsService } from '../contacts/contacts.service';
import { EventEmitter } from 'events';
import { MessageType, MessageStatus } from '@prisma/client';
import { webhookLog, campaignLog } from '../../utils/logger';
import { chatbotEngine } from '../chatbot/chatbot.engine';
import { inboxMediaService } from '../inbox/inbox.media';
import { automationEngine } from '../automation/automation.engine';
import { toCanonicalPhone, buildPhoneVariants } from '../../utils/phone';
import * as instagramService from '../instagram/instagram.service';

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
      return { content: '[Interactive]', mediaUrl: null };
    }

    return { content: `[${type}]`, mediaUrl: null };
  }

  // ============================================
  // ✅ FIX 1: findOrCreateContact - UPSERT
  // ============================================
  private async findOrCreateContact(
    organizationId: string,
    phone: string
  ): Promise<{ contact: any; wasNewlyCreated: boolean }> {

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
      // ✅ Migrate old format phones silently
      if (existing.phone !== canonical) {
        prisma.contact.update({
          where: { id: existing.id },
          data: { phone: canonical },
        })
        .then(() => console.log(`🔄 Phone migrated: ${existing.phone} → ${canonical}`))
        .catch(() => {}); // Non-fatal
      }
      return { contact: existing, wasNewlyCreated: false };
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
          firstName: 'Unknown',
          status: 'ACTIVE',
          source: 'WHATSAPP_INBOUND',
        },
        update: {
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
  private async findOrCreateConversation(
    organizationId: string,
    contactId: string,
    metaPhoneNumberId: string | null,  // Meta ka phoneNumberId string
    messageTime: Date
  ): Promise<any> {

    // ✅ STEP 1: Meta phoneNumberId se actual PhoneNumber.id (UUID) dhundo
    let phoneNumberUUID: string | null = null;

    if (metaPhoneNumberId) {
      try {
        const phoneRecord = await prisma.phoneNumber.findFirst({
          where: { phoneNumberId: metaPhoneNumberId }, // Meta's string ID
          select: { id: true }, // Hamara UUID chahiye
        });

        if (phoneRecord) {
          phoneNumberUUID = phoneRecord.id; // ✅ Actual FK-valid UUID
        } else {
          // PhoneNumber table mein nahi mila - null rakho (field is optional)
          console.warn(
            `⚠️ PhoneNumber not found for metaPhoneNumberId: ${metaPhoneNumberId} ` +
            `(org: ${organizationId}) - conversation will have null phoneNumberId`
          );
        }
      } catch (e) {
        console.error('PhoneNumber lookup error:', e);
        // Fail silently - null phoneNumberId se conversation ban sakti hai
      }
    }

    // ✅ STEP 2: Conversation upsert with valid UUID (or null)
    try {
      const conversation = await prisma.conversation.upsert({
        where: {
          organizationId_contactId: {
            organizationId,
            contactId,
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
            organizationId_contactId: { organizationId, contactId },
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

          const match = await instagramService.findMatchingAutomation(igUserId, messageText);

          if (match && match.isActive) {
            console.log(`🤖 IG Automation Match: ${match.name}`);

            const account = await prisma.instagramAccount.findUnique({
              where: { igUserId }
            });

            if (account?.accessToken) {
              const instagramApi = await import('../instagram/instagram.api');
              if (match.responseText) {
                await instagramApi.sendIGMessage(account.accessToken, senderId, match.responseText);
              }
            }

            await prisma.igDmAutomation.update({
              where: { id: match.id },
              data: { repliesCount: { increment: 1 }, lastTriggeredAt: new Date() }
            });
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

          const rule = await prisma.igCommentRule.findFirst({
            where: {
              igAccount: { igUserId },
              isActive: true,
              OR: [
                { keywords: { has: commentText } },
                { keywords: { equals: [] } }
              ]
            },
            include: { igAccount: true }
          });

          if (rule) {
            const token = rule.igAccount.accessToken;
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
          if (profile.profileName && profile.profileName !== 'Unknown') {
            await contactsService.updateContactFromWebhook(profile.phone10, profile.profileName, account.organizationId);
          }
          await this.processIncomingMessage(msg, account.organizationId, account.id, account.phoneNumberId);
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
  // Incoming message processing (unchanged)
  // -----------------------------
  private async processIncomingMessage(
    message: any,
    organizationId: string,
    whatsappAccountId: string,
    phoneNumberId: string
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

      const existingMsg = await prisma.message.findFirst({
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

      const { contact, wasNewlyCreated } = await this.findOrCreateContact(
        organizationId,
        waFrom
      );

      let conversation = await this.findOrCreateConversation(
        organizationId,
        contact.id,
        phoneNumberId,  // ✅ Method internally converts this to UUID via PhoneNumber table
        messageTime
      );

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

      // ✅ PERMANENT FIX (Rule 1): Background mirror incoming Meta media to R2 / Cloudinary
      if (mediaId) {
        inboxMediaService
          .mirrorInboundMedia(
            savedMessage.id,
            mediaId,
            organizationId,
            mediaMimeType || 'application/octet-stream'
          )
          .catch((mirrorErr: any) =>
            console.error('⚠️ Inbound media mirroring failed:', mirrorErr?.message)
          );
      }

      const updatedConversation = await prisma.conversation.update({
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

      const contactName =
        (updatedConversation.contact as any).whatsappProfileName ||
        ((updatedConversation.contact as any).firstName
          ? `${(updatedConversation.contact as any).firstName} ${(updatedConversation.contact as any).lastName || ''}`.trim()
          : (updatedConversation.contact as any).phone);

      const contactWithName = {
        ...updatedConversation.contact,
        name: contactName,
      };

      const messagePayload = {
        ...savedMessage,
        createdAt: savedMessage.createdAt instanceof Date ? savedMessage.createdAt.toISOString() : savedMessage.createdAt,
        sentAt: savedMessage.sentAt instanceof Date ? savedMessage.sentAt.toISOString() : savedMessage.sentAt,
        deliveredAt: savedMessage.deliveredAt instanceof Date ? savedMessage.deliveredAt.toISOString() : savedMessage.deliveredAt,
        timestamp: savedMessage.timestamp instanceof Date ? savedMessage.timestamp.toISOString() : savedMessage.timestamp,
      };

      webhookEvents.emit('newMessage', {
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

      webhookEvents.emit('conversationUpdated', {
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

      this.runAutomations(
        wasNewlyCreated, organizationId, contact,
        content, waFrom, updatedConversation, message, msgType
      ).catch((e: any) => console.error('Automation error:', e));

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
        chatbotEngine.processMessage(
          updatedConversation.id,
          organizationId,
          chatbotContent,
          waFrom,
          isNewConversation,
          message
        ).catch((e: any) => console.error('Chatbot error:', e));
      }

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

  private async runAutomations(
    wasNewlyCreated: boolean,
    organizationId: string,
    contact: any,
    content: string,
    waFrom: string,
    conversation: any,
    message: any,
    msgType: string
  ) {
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
      automationEngine.triggerUnknownMessage(context)
        .catch(err => console.error('❌ Unknown message trigger:', err.message));

      // ✅ 2. Keyword trigger (for all messages)
      if (content) {
        automationEngine.triggerKeyword(context)
          .catch(err => console.error('❌ Keyword trigger:', err.message));
      }

      // ✅ 3. New contact trigger (only if contact was JUST created)
      if (wasNewlyCreated) {
        automationEngine.triggerNewContact({
          organizationId,
          contactId: contact.id,
          phone: waFrom,
        }).catch(err => console.error('❌ New contact trigger:', err.message));
      }

      if (msgType === 'INTERACTIVE') {
        const buttonId = message?.interactive?.button_reply?.id;
        if (buttonId) {
          await automationEngine.handleButtonClick({
            organizationId,
            contactId: contact.id,
            buttonId,
            conversationId: conversation.id,
          });
        }
      }
    } catch (e) {
      console.error('runAutomations error:', e);
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
      console.error(`❌ Message ${message.id} failed. Meta Error:`, JSON.stringify(statusObj?.errors || [], null, 2));
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

          const balanceBefore = wallet.balancePaise;
          const balanceAfter = balanceBefore + refundPaise;

          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balancePaise: balanceAfter },
          });

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

  private async handleHistorySync(payload: any, value: any) {
    try {
      console.log('📜 History sync webhook received');
      const wabaId = payload.entry[0].id;

      const account = await prisma.whatsAppAccount.findFirst({
        where: { wabaId },
        select: { id: true, organizationId: true, phoneNumberId: true }
      });

      if (!account) return;

      const messages = value?.messages || [];
      console.log(`📜 Processing ${messages.length} historical messages`);

      for (const msg of messages) {
        try {
          await this.processIncomingMessage(
            msg,
            account.organizationId,
            account.id,
            value?.metadata?.phone_number_id || account.phoneNumberId || ''
          );
        } catch (e) {
          console.error('History message processing error:', e);
        }
      }

      console.log('✅ History sync complete');
    } catch (e) {
      console.error('handleHistorySync error:', e);
    }
  }

  private async handleSmbStateSync(payload: any, value: any) {
    try {
      console.log('👥 SMB state sync webhook received');
      const wabaId = payload.entry[0].id;

      const account = await prisma.whatsAppAccount.findFirst({
        where: { wabaId },
        select: { id: true, organizationId: true }
      });

      if (!account) return;

      const contacts = value?.contacts || [];
      console.log(`👥 Syncing ${contacts.length} contacts from WBA app`);

      for (const contact of contacts) {
        try {
          const phone = contact.wa_id || contact.phone;
          const name = contact.profile?.name || 'Unknown';

          if (phone) {
            await contactsService.updateContactFromWebhook(
              phone,
              name,
              account.organizationId
            );
          }
        } catch (e) {
          console.error('SMB contact sync error:', e);
        }
      }

      console.log('✅ SMB state sync complete');
    } catch (e) {
      console.error('handleSmbStateSync error:', e);
    }
  }

  private async handleSmbMessageEchoes(payload: any, value: any) {
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
    } catch (e) {
      console.error('handleSmbMessageEchoes error:', e);
    }
  }

  private async handleCallWebhook(payload: any, value: any) {
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
      if (!phoneNumberId) return;

      const account = await prisma.whatsAppAccount.findFirst({
        where: { phoneNumberId },
      });

      if (!account) return;

      if (direction === 'inbound' && from) {
        const cleanPhone = String(from).replace(/[^0-9]/g, '');
        let phone10 = cleanPhone;
        if (phone10.startsWith('91') && phone10.length === 12) {
          phone10 = phone10.substring(2);
        }

        let contact = await prisma.contact.findFirst({
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
          contact = await prisma.contact.create({
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

        (prisma as any).callLog?.create({
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
        })?.catch((dbErr: any) => console.warn('Call log DB save failed:', dbErr.message));

        webhookEvents.emit('incomingCall', {
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
        (prisma as any).callLog?.updateMany({
          where: { callId },
          data: {
            status: status || 'updated',
            duration: duration || undefined,
            endedAt: status === 'ended' ? new Date() : undefined,
          },
        })?.catch((dbErr: any) => console.warn('Call log update failed:', dbErr.message));

        webhookEvents.emit('callStatusUpdate', {
          organizationId: account.organizationId,
          callId,
          status,
          duration,
          direction: 'OUTBOUND',
          timestamp: new Date().toISOString(),
        });
      }

      console.log(`✅ Call webhook processed: ${callId} -> ${status}`);

    } catch (e) {
      console.error('handleCallWebhook error:', e);
    }
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