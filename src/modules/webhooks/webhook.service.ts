// src/modules/webhooks/webhook.service.ts - COMPLETE FIXED VERSION

import prisma from '../../config/database';
import { contactsService } from '../contacts/contacts.service';
import { EventEmitter } from 'events';
import { MessageType, MessageStatus } from '@prisma/client';
import { chatbotEngine } from '../chatbot/chatbot.engine';
import { inboxMediaService } from '../inbox/inbox.media';
import { automationEngine } from '../automation/automation.engine';

// ✅ Socket.ts will subscribe to this
export const webhookEvents = new EventEmitter();
webhookEvents.setMaxListeners(100);

export class WebhookService {
  // -----------------------------
  // Helpers
  // -----------------------------
  private accountCache = new Map<string, { data: any; expiresAt: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private extractValue(payload: any) {
    return payload?.entry?.[0]?.changes?.[0]?.value;
  }

  private extractProfile(payload: any, specificMsg: any): { waId: string; profileName: string; phone10: string } | null {
    try {
      const value = this.extractValue(payload);
      const msg = specificMsg || value?.messages?.[0];
      if (!msg) return null;

      const waId = String(msg.from || '');
      // Find matching contact profile in the payload's contacts array
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

  private async findOrCreateContact(organizationId: string, phone10: string) {
    const variants = [phone10, `+91${phone10}`, `91${phone10}`];

    let contact = await prisma.contact.findFirst({
      where: {
        organizationId,
        OR: variants.map((p) => ({ phone: p })),
      },
    });

    if (!contact) {
      try {
        contact = await prisma.contact.create({
          data: {
            organizationId,
            phone: phone10,
            countryCode: '+91',
            firstName: 'Unknown',
            status: 'ACTIVE',
            source: 'WHATSAPP_INBOUND',
          },
        });
        console.log(`👤 Created new contact from inbound: ${phone10}`);
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
    }

    return contact;
  }

  // -----------------------------
  // Main Handler
  // -----------------------------
  async handleWebhook(payload: any): Promise<{ status: string; reason?: string; profileName?: string; error?: string }> {
    try {
      console.log('📨 Webhook received');

      const value = this.extractValue(payload);
      const field = payload?.entry?.[0]?.changes?.[0]?.field || 'unknown';
      const phoneNumberId = value?.metadata?.phone_number_id;

      // Handle cases where phone_number_id is missing
      if (!phoneNumberId) {
        // ✅ Handle Template Updates (WABA Level)
        if (field === 'message_template_status_update') {
          await this.handleTemplateUpdate(payload, value);
          return { status: 'processed', reason: `Handled template update for event: ${value?.event}` };
        }

        // If it's a field we don't process (like account_update), ignore it gracefully
        if (field !== 'messages' && field !== 'statuses') {
          console.log(`ℹ️ Ignoring webhook field: ${field} (No phone_number_id)`);
          return { status: 'ignored', reason: `Unhandled field type: ${field}` };
        }

        // If it's supposed to be a message/status but lacks ID, that's an error
        return { status: 'error', reason: 'No phone_number_id for field: ' + field };
      }

      // ✅ Caching to prevent database pool exhaustion
      let account: any = null;
      const cached = this.accountCache.get(phoneNumberId);
      if (cached && cached.expiresAt > Date.now()) {
        account = cached.data;
      } else {
        account = await prisma.whatsAppAccount.findFirst({
          where: { phoneNumberId },
        });

        // ✅ Fallback: Try newer PhoneNumber table if legacy whatsAppAccount not found
        if (!account) {
          console.log(`🔍 phoneNumberId ${phoneNumberId} not found in legacy WhatsAppAccount, checking PhoneNumber table...`);
          try {
            const phoneRecord = await (prisma as any).phoneNumber.findFirst({
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
            await contactsService.updateContactFromWebhook(profile.phone10, profile.profileName, account.organizationId);
          }
          await this.processIncomingMessage(msg, account.organizationId, account.id, account.phoneNumberId);
        }
      }

      // ✅ Process status updates
      const statuses = value?.statuses || [];
      // Use Promise.all with small groups to avoid blocking everything
      for (const st of statuses) {
        this.processStatusUpdate(st, account.organizationId, account.id).catch(e =>
          console.error('Status update background error:', e)
        );
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

      // Find an account that has this WABA ID
      const account = await prisma.whatsAppAccount.findFirst({
        where: { wabaId },
        select: { id: true, organizationId: true },
      });

      if (account) {
        // Dynamically import metaService to avoid circular dependency issues
        const { metaService } = await import('../meta/meta.service');
        console.log(`📡 Triggering background template sync for Org: ${account.organizationId}`);
        // Run without awaiting to free up the webhook response
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
  // Incoming message processing
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

      console.log(`📥 Processing inbound message: ${waMessageId} from ${waFrom}`);

      let phone10 = waFrom;
      if (phone10.startsWith('91') && phone10.length === 12) phone10 = phone10.substring(2);

      const contact = await this.findOrCreateContact(organizationId, phone10);

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
          console.log(`💬 Created new conversation: ${conversation.id}`);
        } catch (error: any) {
          if (error.code === 'P2002') {
            conversation = await prisma.conversation.findFirst({
              where: { organizationId, contactId: contact.id },
            });
            if (!conversation) throw error;
          } else {
            throw error;
          }
        }
      }

      let content = '';
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;
      let mediaMimeType: string | null = null;
      let mediaId: string | null = null;
      let fileName: string | null = null;

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

          if (mediaId) {
            const mediaResult = await inboxMediaService.processIncomingMedia(
              mediaId!,
              mediaMimeType!,
              organizationId
            );
            mediaUrl = mediaResult.url;
          }
          break;

        case 'video':
          mediaId = message.video?.id;
          mediaMimeType = message.video?.mime_type || 'video/mp4';
          content = message.video?.caption || '[Video]';
          mediaType = 'video';

          if (mediaId) {
            const mediaResult = await inboxMediaService.processIncomingMedia(
              mediaId!,
              mediaMimeType!,
              organizationId
            );
            mediaUrl = mediaResult.url;
          }
          break;

        case 'audio':
          mediaId = message.audio?.id;
          mediaMimeType = message.audio?.mime_type || 'audio/ogg';
          content = '[Audio]';
          mediaType = 'audio';

          if (mediaId) {
            const mediaResult = await inboxMediaService.processIncomingMedia(
              mediaId!,
              mediaMimeType!,
              organizationId
            );
            mediaUrl = mediaResult.url;
          }
          break;

        case 'document':
          mediaId = message.document?.id;
          mediaMimeType = message.document?.mime_type || 'application/pdf';
          fileName = message.document?.filename || 'document';
          content = message.document?.caption || `[Document: ${fileName}]`;
          mediaType = 'document';

          if (mediaId) {
            const mediaResult = await inboxMediaService.processIncomingMedia(
              mediaId!,
              mediaMimeType!,
              organizationId
            );
            mediaUrl = mediaResult.url;
          }
          break;

        case 'sticker':
          mediaId = message.sticker?.id;
          mediaMimeType = message.sticker?.mime_type || 'image/webp';
          content = '[Sticker]';
          mediaType = 'sticker';

          if (mediaId) {
            const mediaResult = await inboxMediaService.processIncomingMedia(
              mediaId!,
              mediaMimeType!,
              organizationId
            );
            mediaUrl = mediaResult.url;
          }
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

      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastMessageAt: messageTime,
          messageCount: { increment: 1 },
        },
      });

      console.log(`✅ Inbound message saved and conversation updated: ${updatedConversation.id}`);

      // ✅ TRIGGER: Unknown Message Automation
      try {
        const contactIsNew = !await prisma.contact.findFirst({
          where: {
            organizationId,
            phone: phone10,
            createdAt: {
              lt: new Date(Date.now() - 60000), // Older than 1 minute
            },
          },
        });

        if (contactIsNew) {
          await automationEngine.triggerUnknownMessage({
            organizationId,
            contactId: contact.id,
            phone: contact.phone,
            message: content,
            conversationId: updatedConversation.id,
          });
        }
      } catch (e) {
        console.error('Unknown message automation error:', e);
      }

      // ✅ DETECT BUTTON CLICKS
      if (msgType === 'INTERACTIVE') {
        const buttonId = message?.interactive?.button_reply?.id;
        if (buttonId) {
          automationEngine.handleButtonClick({
            organizationId,
            contactId: contact.id,
            buttonId,
            conversationId: updatedConversation.id,
          }).catch((e: any) => console.error('Button click error:', e));
        }
      }

      // ✅ Clear inbox cache
      const { inboxService } = await import('../inbox/inbox.service');
      await inboxService.clearCache(organizationId);

      // ✅ Emit events
      webhookEvents.emit('newMessage', {
        organizationId,
        conversationId: updatedConversation.id,
        conversation: {
          ...updatedConversation,
          contact: {
            ...updatedConversation.contact,
            name: (updatedConversation.contact as any).whatsappProfileName ||
              ((updatedConversation.contact as any).firstName
                ? `${(updatedConversation.contact as any).firstName} ${(updatedConversation.contact as any).lastName || ''}`.trim()
                : (updatedConversation.contact as any).phone)
          }
        },
        message: {
          ...savedMessage,
        },
      });

      // Transform contact to include name for frontend compatibility
      const contactWithBotName = {
        ...updatedConversation.contact,
        name: (updatedConversation.contact as any).whatsappProfileName ||
          ((updatedConversation.contact as any).firstName
            ? `${(updatedConversation.contact as any).firstName} ${(updatedConversation.contact as any).lastName || ''}`.trim()
            : (updatedConversation.contact as any).phone)
      };

      webhookEvents.emit('conversationUpdated', {
        organizationId,
        conversation: {
          ...updatedConversation,
          contact: contactWithBotName
        },
      });

      // ✅ Check for keyword automations
      try {
        const automationTriggered = await automationEngine.triggerKeyword({
          organizationId,
          contactId: contact.id,
          phone: contact.phone,
          message: content,
          conversationId: updatedConversation.id,
        });
        
        if (automationTriggered) {
          console.log('🤖 Automation handled this message');
        }
      } catch (e) {
        console.error('Automation trigger error:', e);
      }

      // ✅ Trigger Chatbot Engine
      if (msgType === 'TEXT' || msgType === 'INTERACTIVE') {
        const isNew = !conversation; // Use the check from earlier
        chatbotEngine.processMessage(
          updatedConversation.id,
          organizationId,
          content || '',
          waFrom,
          isNew
        ).catch(e => console.error('🤖 Chatbot engine trigger error:', e));
      }
    } catch (e) {
      console.error('processIncomingMessage error:', e);
    }
  }

  // -----------------------------
  // ✅ Status update processing - FIXED FOR TICK MARKS
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

      // ✅ Find message by waMessageId OR wamId
      let message = await prisma.message.findFirst({
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
        
        message = await prisma.message.findFirst({
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
      let newStatus: MessageStatus = 'SENT';
      if (st === 'sent') newStatus = 'SENT';
      if (st === 'delivered') newStatus = 'DELIVERED';
      if (st === 'read') newStatus = 'READ';
      if (st === 'failed') newStatus = 'FAILED';

      // ✅ Update message
      const updatedMessage = await prisma.message.update({
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
      const metadata = (message.metadata as any) || {};

      // ✅ CRITICAL: Emit socket event for real-time update
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

      // ✅ Update CampaignContact if this is a campaign message
      await this.updateCampaignContactStatus(waMessageId, newStatus, statusTime, updatedMessage.failureReason || undefined);

    } catch (e) {
      console.error('processStatusUpdate error:', e);
    }
  }

  // ✅ Campaign contact status sync
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
              failedCount: true 
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

      // Only update if it's a new "better" status (except FAILED which is terminal)
      if (newPriority <= currentPriority && newStatus !== 'FAILED') {
        return;
      }

      // 1. Update CampaignContact record
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

      // 2. Prepare Campaign counter updates
      const campaignUpdateData: any = {};
      if (newStatus === 'DELIVERED' && currentStatus !== 'DELIVERED' && currentStatus !== 'READ') {
        campaignUpdateData.deliveredCount = { increment: 1 };
      } else if (newStatus === 'READ' && currentStatus !== 'READ') {
        campaignUpdateData.readCount = { increment: 1 };
        // If it jumped from SENT to READ, increment delivered count too
        if (currentStatus !== 'DELIVERED') {
          campaignUpdateData.deliveredCount = { increment: 1 };
        }
      } else if (newStatus === 'FAILED' && currentStatus !== 'FAILED') {
        campaignUpdateData.failedCount = { increment: 1 };
      }

      let campaign = campaignContact.campaign;

      // 3. Apply counter updates to Campaign if needed
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

      // 4. Emit real-time updates via Socket.IO
      const orgId = campaign?.organizationId || campaignContact.campaign?.organizationId;
      const contactPhone = campaignContact.contact?.phone || '';
      
      if (orgId) {
        import('../campaigns/campaigns.socket').then(({ campaignSocketService }) => {
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
        const account = await prisma.whatsAppAccount.findFirst({
          where: { phoneNumberId },
          select: { organizationId: true },
        });
        organizationId = account?.organizationId || null;

        // Fallback to newer PhoneNumber structure
        if (!organizationId) {
          const phoneRecord = await (prisma as any).phoneNumber.findFirst({
            where: { phoneNumberId },
            include: { metaConnection: true }
          });
          organizationId = phoneRecord?.metaConnection?.organizationId || null;
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

  // Optional methods
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
}

export const webhookService = new WebhookService();
export default webhookService;