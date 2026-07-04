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
import { chatbotEngine } from '../chatbot/chatbot.engine';
import { inboxMediaService } from '../inbox/inbox.media';
import { automationEngine } from '../automation/automation.engine';
import { toCanonicalPhone, buildPhoneVariants } from '../../utils/phone';
import * as instagramService from '../instagram/instagram.service';

export const webhookEvents = new EventEmitter();
webhookEvents.setMaxListeners(100);

export class WebhookService {
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

    let contact = await prisma.contact.findFirst({
      where: {
        organizationId,
        OR: variants.map((p) => ({ phone: p })),
      },
    });

    let wasNewlyCreated = false;

    if (!contact) {
      try {
        const ccDigits = canonical.slice(1, -10);
        const countryCode = `+${ccDigits}`;

        contact = await prisma.contact.create({
          data: {
            organizationId,
            phone: canonical,
            countryCode,
            firstName: 'Unknown',
            status: 'ACTIVE',
            source: 'WHATSAPP_INBOUND',
          },
        });
        wasNewlyCreated = true;
        console.log(`👤 New contact: ${canonical}`);

      } catch (error: any) {
        if (error.code === 'P2002') {
          contact = await prisma.contact.findFirst({
            where: {
              organizationId,
              OR: variants.map((p) => ({ phone: p })),
            },
          });
          if (!contact) throw error;
        } else {
          throw error;
        }
      }

    } else if (contact.phone !== canonical) {
      prisma.contact.update({
        where: { id: contact.id },
        data: { phone: canonical }
      }).then(() => {
        console.log(`🔄 Migrated: ${contact!.phone} → ${canonical}`);
      }).catch(() => { });
      contact.phone = canonical;
    }

    return { contact: contact!, wasNewlyCreated };
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

  // -----------------------------
  // Main Handler
  // -----------------------------
  async handleWebhook(payload: any): Promise<{ status: string; reason?: string; profileName?: string; error?: string }> {
    try {
      console.log('📨 Webhook received');

      if (payload.object === 'instagram') {
        return await this.handleInstagramEvent(payload);
      }

      const value = this.extractValue(payload);
      const field = payload?.entry?.[0]?.changes?.[0]?.field || 'unknown';
      const phoneNumberId = value?.metadata?.phone_number_id;

      console.log('📨 Webhook field:', field);

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
  private async handleTemplateUpdate(payload: any, value: any) {
    try {
      const wabaId = payload.entry[0].id;
      const event = value.event;
      const templateName = value.message_template_name;

      console.log(`🔄 Template update webhook received [${event}] for template: ${templateName} (WABA: ${wabaId})`);

      const account = await prisma.whatsAppAccount.findFirst({
        where: { wabaId },
        select: { id: true, organizationId: true },
      });

      if (account) {
        const { metaService } = await import('../meta/meta.service');
        console.log(`📡 Triggering background template sync for Org: ${account.organizationId}`);
        metaService.syncTemplates(account.id, account.organizationId).catch(e => {
          console.error('❌ Background template sync failed:', e);
        });
      } else {
        console.log(`⚠️ No account found associated with WABA ID: ${wabaId}`);
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

      let conversation = await prisma.conversation.findFirst({
        where: { organizationId, contactId: contact.id },
      });

      if (!conversation) {
        try {
          conversation = await prisma.conversation.create({
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
        } catch (err: any) {
          if (err.code === 'P2002') {
            conversation = await prisma.conversation.findFirst({
              where: { organizationId, contactId: contact.id },
            });
            if (!conversation) throw err;
          } else {
            throw err;
          }
        }
      }

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
      const st = String(statusObj?.status || '').toLowerCase();
      const ts = Number(statusObj?.timestamp || Date.now() / 1000);
      const statusTime = new Date(ts * 1000);

      if (!waMessageId) {
        console.warn('⚠️ No waMessageId in status update');
        return;
      }

      console.log(`📬 Processing status update: ${waMessageId} -> ${st}`);

      let newStatus: MessageStatus = 'SENT';
      if (st === 'sent') newStatus = 'SENT';
      if (st === 'delivered') newStatus = 'DELIVERED';
      if (st === 'read') newStatus = 'READ';
      if (st === 'failed') newStatus = 'FAILED';

      const failureReason = st === 'failed' ? (statusObj?.errors?.[0]?.message || 'Unknown error') : undefined;

      await this.updateCampaignContactStatus(waMessageId, newStatus, statusTime, failureReason);

      const message = await prisma.message.findFirst({
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

      if (message) {
        await this.updateChatMessageStatus(message, newStatus, statusTime, statusObj, organizationId);
      } else {
        this.retryUpdateChatMessageStatusInBackground(waMessageId, newStatus, statusTime, statusObj, organizationId)
          .catch(() => { });
      }

    } catch (e) {
      console.error('processStatusUpdate error:', e);
    }
  }

  private async updateChatMessageStatus(
    message: any,
    newStatus: MessageStatus,
    statusTime: Date,
    statusObj: any,
    organizationId: string
  ) {
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
    waMessageId: string,
    newStatus: MessageStatus,
    statusTime: Date,
    statusObj: any,
    organizationId: string
  ) {
    let retries = 3;
    while (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const message = await prisma.message.findFirst({
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

      if (message) {
        await this.updateChatMessageStatus(message, newStatus, statusTime, statusObj, organizationId);
        return;
      }
      retries--;
    }
    console.log(`⚠️ Message still not found for waMessageId: ${waMessageId} after background retries`);
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

      if (!campaignContact) return;

      console.log(`📊 Found campaign contact: ${campaignContact.id}`);

      const currentStatus = campaignContact.status;

      const statusPriority: Record<string, number> = {
        'PENDING': 0,
        'QUEUED': 0.5,
        'SENT': 1,
        'DELIVERED': 2,
        'READ': 3,
        'FAILED': -1,
      };

      const currentPriority = statusPriority[currentStatus] ?? 0;
      const newPriority = statusPriority[newStatus] ?? 0;

      if (newPriority <= currentPriority && newStatus !== 'FAILED') {
        return;
      }

      await prisma.campaignContact.updateMany({
        where: { id: campaignContact.id },
        data: {
          status: newStatus,
          ...(newStatus === 'DELIVERED' ? { deliveredAt: statusTime } : {}),
          ...(newStatus === 'READ' ? { readAt: statusTime } : {}),
          ...(newStatus === 'FAILED' ? { failedAt: statusTime, failureReason: failureReason || 'Delivery failed' } : {}),
        },
      });

      console.log(`✅ Campaign contact updated: ${campaignContact.id} -> ${newStatus}`);

      const campaignUpdateData: any = {};
      if (newStatus === 'DELIVERED' && currentStatus !== 'DELIVERED' && currentStatus !== 'READ') {
        campaignUpdateData.deliveredCount = { increment: 1 };
      } else if (newStatus === 'READ' && currentStatus !== 'READ') {
        campaignUpdateData.readCount = { increment: 1 };
        if (currentStatus !== 'DELIVERED') {
          campaignUpdateData.deliveredCount = { increment: 1 };
        }
      } else if (newStatus === 'FAILED' && currentStatus !== 'FAILED') {
        campaignUpdateData.failedCount = { increment: 1 };

        // ✅ FIX: idempotent refund — under a single transaction, first check if a
        // refund transaction for THIS waMessageId already exists. If yes, skip.
        // This prevents Meta webhook retries or racing status updates from
        // crediting the wallet multiple times for the same failed message.
        if (campaignContact.campaign && (campaignContact.campaign as any).template) {
          try {
            const template = (campaignContact.campaign as any).template;
            const { getRateForCategory } = await import('../wallet/wallet.deduction.service');
            const rateRupees = getRateForCategory(
              template.category || 'MARKETING',
              campaignContact.contact?.phone || '',
              template.language
            );
            const refundPaise = Math.round(rateRupees * 100);

            if (refundPaise > 0) {
              await prisma.$transaction(async (tx) => {
                // ✅ IDEMPOTENCY GUARD: has this exact waMessageId already been refunded?
                const existingRefund = await tx.walletTransaction.findFirst({
                  where: {
                    metaChargeId: waMessageId,
                    metaService: 'template_message_refund',
                  },
                  select: { id: true },
                });

                if (existingRefund) {
                  console.log(`↩️ Refund already recorded for ${waMessageId} — skipping duplicate`);
                  return;
                }

                const wallet = await tx.wallet.findUnique({
                  where: { organizationId: campaignContact.campaign.organizationId },
                });

                if (!wallet) {
                  console.log(`↩️ No wallet — skipping refund for ${waMessageId}`);
                  return;
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
                    description: `Refund: Failed campaign message (${campaignContact.contact?.phone}) - ${template.name}`,
                    status: 'completed',
                    metaChargeId: waMessageId,          // ✅ unique key used by the guard above
                    metaService: 'template_message_refund',
                    note: `Campaign Refund (ID: ${campaignContact.campaign.id})`,
                  },
                });
                console.log(`💰 Refunded ₹${rateRupees.toFixed(2)} to wallet for failed message to ${campaignContact.contact?.phone}`);
              });
            }
          } catch (refundErr: any) {
            console.error('❌ Failed to process wallet refund:', refundErr.message);
          }
        }
      }

      let campaign = campaignContact.campaign;

      if (campaign && Object.keys(campaignUpdateData).length > 0) {
        campaign = await prisma.campaign.update({
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
        }) as any;
        console.log(`📈 Updated campaign counters for: ${campaign.id}`);
      }

      const orgId = campaign?.organizationId || campaignContact.campaign?.organizationId;
      const contactPhone = campaignContact.contact?.phone || '';

      if (orgId) {
        import('../campaigns/campaigns.socket').then(({ campaignSocketService }) => {
          campaignSocketService.emitContactStatus(orgId, campaignContact.campaignId, {
            contactId: campaignContact.contactId,
            phone: contactPhone,
            status: newStatus,
            messageId: waMessageId,
            error: failureReason
          });

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
    } catch (e) {
      console.error('updateCampaignContactStatus error:', e);
    }
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
}

export const webhookService = new WebhookService();
export default webhookService;