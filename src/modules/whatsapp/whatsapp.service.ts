// 📁 src/modules/whatsapp/whatsapp.service.ts - FIXED VERSION
// ✅ FIX 1: getAccountWithToken now delegates to shared getAccountWithDecryptedToken()
//    (same helper meta.service.ts uses). Previously this file had its own copy that
//    would throw errors but never mark the account as DISCONNECTED — so message
//    sending would silently fail while the dashboard still showed "Connected".
// ✅ FIX 2: sendTemplateMessage now does a wallet pre-check BEFORE hitting Meta,
//    so single sends can't push a wallet into deep negative when a customer's
//    balance is already at zero.

import {
  PrismaClient,
  MessageStatus,
  MessageDirection,
  MessageType,
  WhatsAppAccountStatus,
} from '@prisma/client';
import { metaApi } from '../meta/meta.api';
import { maskToken } from '../../utils/encryption';
import { getAccountWithDecryptedToken } from '../../utils/tokenDecryption'; // ✅ FIX: shared helper
import prisma from '../../config/database';
import {
  deductWalletForTemplate,
  getRateForCategory,
} from '../wallet/wallet.deduction.service';

// ============================================
// INTERFACES
// ============================================

interface SendMessageOptions {
  accountId: string;
  to: string;
  type: 'text' | 'template' | 'image' | 'document' | 'video' | 'audio' | 'interactive' | 'location' | 'contacts' | 'sticker';
  content: any;
  conversationId?: string;
  organizationId?: string;
  tempId?: string;
  clientMsgId?: string;
  mediaUrl?: string;
  skipWindowCheck?: boolean;
}

interface SendTemplateOptions {
  accountId: string;
  to: string;
  templateName: string;
  templateLanguage: string;
  components?: any[];
  conversationId?: string;
  organizationId?: string;
  tempId?: string;
  clientMsgId?: string;
}

interface CampaignSendResult {
  sent: number;
  failed: number;
  errors: string[];
}

interface ContactCheckResult {
  valid: boolean;
  waId?: string;
  status: string;
}

// ============================================
// WHATSAPP SERVICE CLASS
// ============================================

class WhatsAppService {
  // ============================================
  // HELPER METHODS
  // ============================================

  private extractMessageContent(type: string, content: any): string {
    if (typeof content === 'string') {
      return content;
    }

    switch (type.toLowerCase()) {
      case 'text':
        if (content?.text?.body) return content.text.body;
        if (content?.body) return content.body;
        return JSON.stringify(content);

      case 'template':
        const templateName = content?.template?.name || 'Unknown Template';
        return `📋 Template: ${templateName}`;

      case 'image':
        return content?.image?.caption || '📷 Image';

      case 'video':
        return content?.video?.caption || '🎥 Video';

      case 'document':
        return content?.document?.caption || content?.document?.filename || '📄 Document';

      case 'audio':
        return '🎵 Audio';

      case 'location':
        return content?.location?.name || '📍 Location';

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
   * ✅ FIX: delegates to the shared getAccountWithDecryptedToken() helper.
   * Previously this method had its own logic that would throw an error but
   * leave the account status as CONNECTED — so message sending would fail
   * while the dashboard showed the account as healthy. Now, if a token
   * can't be decrypted, the shared helper marks the account DISCONNECTED
   * and both the UI and the sending code agree.
   */
  private async getAccountWithToken(accountId: string): Promise<{
    account: any;
    accessToken: string;
  }> {
    const result = await getAccountWithDecryptedToken(accountId);
    if (!result) {
      // The helper has already marked the account as DISCONNECTED if needed.
      // We convert to an exception here because most callers of this method
      // depend on the presence of a valid token to proceed.
      throw new Error(
        'WhatsApp account is not connected or the access token is invalid. Please reconnect your WhatsApp account.'
      );
    }
    return result;
  }

  private formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, '');

    if (digits.length <= 10 && !phone.startsWith('+')) {
      throw new Error(`Phone number ${phone} is missing a country code. Messages cannot be sent without a country code.`);
    }

    return digits;
  }

  private async getOrCreateContact(
    organizationId: string,
    phone: string
  ): Promise<any> {
    const digits = phone.replace(/[^0-9]/g, '');
    const normalized = digits;

    const canonical = `+${normalized}`;
    const withoutPlus = normalized;
    const tenDigit = normalized.slice(-10);

    let contact = await prisma.contact.findFirst({
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
      contact = await prisma.contact.create({
        data: {
          organizationId,
          phone: canonical,
          source: 'WHATSAPP',
          firstName: 'Unknown',
          status: 'ACTIVE',
        },
      });
      console.log(`👤 Created new contact: ${canonical}`);
    } else if (contact.phone !== canonical) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { phone: canonical },
      }).catch(() => { });
      contact.phone = canonical;
      console.log(`🔄 Migrated contact phone → ${canonical}`);
    }

    return contact;
  }

  private async getOrCreateConversation(
    organizationId: string,
    contactId: string,
    phoneNumberId: string,
    messagePreview: string,
    existingConversationId?: string
  ): Promise<any> {
    let conversation = null;

    if (existingConversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: existingConversationId },
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.findUnique({
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
        conversation = await prisma.conversation.create({
          data: {
            organization: { connect: { id: organizationId } },
            contact: { connect: { id: contactId } },
            lastMessageAt: new Date(),
            lastMessagePreview: messagePreview,
            unreadCount: 0,
            isWindowOpen: false,
            isRead: true
          },
        });
        console.log(`💬 Created new conversation: ${conversation.id}`);
      } catch (err) {
        conversation = await prisma.conversation.findUnique({
          where: {
            organizationId_contactId: { organizationId, contactId },
          },
        });
        if (!conversation) throw err;
      }
    } else {
      if (messagePreview) {
        await prisma.conversation.update({
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

  private mapMessageType(type: string): MessageType {
    const map: Record<string, MessageType> = {
      text: MessageType.TEXT,
      template: MessageType.TEMPLATE,
      image: MessageType.IMAGE,
      video: MessageType.VIDEO,
      audio: MessageType.AUDIO,
      document: MessageType.DOCUMENT,
      location: MessageType.LOCATION,
      sticker: MessageType.STICKER,
      contacts: MessageType.CONTACT,
      button: MessageType.INTERACTIVE,
      list: MessageType.INTERACTIVE,
      interactive: MessageType.INTERACTIVE,
    };
    return map[type.toLowerCase()] || MessageType.TEXT;
  }

  // ============================================
  // ✅ NEW: single-send wallet pre-check
  // ============================================

  /**
   * Pre-check: does the wallet have enough balance to cover ONE template send?
   * Returns true if we should proceed, false to block.
   * Wallets that don't exist / are flagged / are inactive fall through to Meta's
   * own billing — same behavior as deductWalletForTemplate's skip conditions.
   */
  private async canAffordSingleTemplateSend(
    organizationId: string,
    templateName: string,
    templateCategory: string | undefined,
    templateLanguage: string | undefined,
    recipientPhone: string
  ): Promise<{ ok: boolean; reason?: string }> {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { organizationId },
      });

      // No wallet, or flagged, or explicitly deactivated → skip pre-check
      if (!wallet || wallet.flagged || !wallet.isActive) {
        return { ok: true };
      }

      // Resolve category if not provided (mirrors deductWalletForTemplate)
      let category = templateCategory;
      if (!category) {
        const template = await prisma.template.findFirst({
          where: { organizationId, name: templateName },
          select: { category: true },
        });
        category = template?.category || 'MARKETING';
      }

      const rateRupees = getRateForCategory(category, recipientPhone, templateLanguage);
      const amountPaise = Math.round(rateRupees * 100);

      const availablePaise =
        wallet.balancePaise +
        (wallet.creditEnabled
          ? Math.max(0, wallet.creditLimitPaise - wallet.creditUsedPaise)
          : 0);

      if (availablePaise < amountPaise) {
        return {
          ok: false,
          reason: `Insufficient wallet balance (₹${(availablePaise / 100).toFixed(2)} available, ₹${rateRupees.toFixed(2)} required for this ${category} message).`,
        };
      }

      return { ok: true };
    } catch (err: any) {
      // Never block a send on a pre-check bug — log and proceed
      console.error('❌ Wallet pre-check errored (allowing send):', err.message);
      return { ok: true };
    }
  }

  // ============================================
  // CONTACT VALIDATION
  // ============================================

  async checkContact(
    accountId: string,
    phone: string
  ): Promise<ContactCheckResult> {
    try {
      const { account, accessToken } = await this.getAccountWithToken(accountId);
      const formattedPhone = this.formatPhoneNumber(phone);

      console.log(`📞 Checking contact: ${formattedPhone}`);

      const result = await metaApi.checkContact(
        account.phoneNumberId,
        accessToken,
        formattedPhone
      );

      const contact = result?.contacts?.[0];
      const status = contact?.status || 'unknown';

      console.log(`📞 Contact check result: ${status}`);

      return {
        valid: status === 'valid',
        waId: contact?.wa_id,
        status,
      };
    } catch (error: any) {
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

  async sendTextMessage(
    accountId: string,
    to: string,
    message: string,
    conversationId?: string,
    organizationId?: string,
    tempId?: string,
    clientMsgId?: string,
    skipWindowCheck?: boolean
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
      skipWindowCheck,
    });
  }

  private hydrateTemplate(bodyText: string, params: any[]): string {
    let text = bodyText;
    if (!params || params.length === 0) return text;

    let flatParams: any[] = [];
    if (params.length > 0) {
      if (params[0]?.type === 'body' || params[0]?.parameters) {
        const bodyComp = params.find(c => c.type === 'body');
        if (bodyComp && bodyComp.parameters) {
          flatParams = bodyComp.parameters;
        }
      } else {
        flatParams = params;
      }
    }

    flatParams.forEach((param, index) => {
      const paramValue = typeof param === 'string' ? param : param?.text || JSON.stringify(param);
      text = text.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), paramValue);
    });
    return text;
  }

  async sendTemplateMessage(options: SendTemplateOptions) {
    const {
      accountId,
      to,
      templateName,
      templateLanguage,
      components,
      conversationId,
      organizationId,
      tempId,
      clientMsgId,
    } = options;

    console.log(`📋 Sending template message: ${templateName}`);
    console.log(`   To: ${to}`);
    console.log(`   Account ID: ${accountId}`);

    try {
      const accountData = await this.getAccountWithToken(accountId);
      if (!accountData) throw new Error('Account not found');

      const { account, accessToken } = accountData;

      const template = await prisma.template.findFirst({
        where: {
          organizationId: account.organizationId,
          name: templateName,
          status: 'APPROVED'
        }
      });

      let fullContent = templateName;
      if (template?.bodyText) {
        fullContent = this.hydrateTemplate(template.bodyText, components || []);
      }

      const orgId = organizationId || account.organizationId;

      // ✅ FIX: wallet pre-check BEFORE hitting Meta. If wallet is empty/insufficient,
      // block here — otherwise we'd send the message, get billed by Meta, and then
      // fire-and-forget deduction would silently fail with no user-visible signal.
      const walletCheck = await this.canAffordSingleTemplateSend(
        orgId,
        templateName,
        template?.category,
        templateLanguage,
        to
      );
      if (!walletCheck.ok) {
        console.warn(`💳 Blocking send: ${walletCheck.reason}`);
        throw new Error(walletCheck.reason || 'Wallet balance insufficient for this message.');
      }

      const formattedTo = this.formatPhoneNumber(to);
      const messagePayload: any = {
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

      const response = await metaApi.sendMessage(
        account.phoneNumberId,
        accessToken,
        formattedTo,
        messagePayload
      );

      const waMessageId = (response as any)?.messages?.[0]?.id || response?.messageId;
      if (!waMessageId) throw new Error('No message ID returned');

      // Wallet deduction (still fire-and-forget; the pre-check above guarantees
      // we won't push balance below zero on the happy path)
      deductWalletForTemplate({
        organizationId: orgId,
        templateName,
        templateCategory: template?.category,
        templateLanguage: templateLanguage,
        recipientPhone: to,
        waMessageId,
      }).then(result => {
        if (result.walletUsed) {
          console.log(`💳 Wallet: -₹${result.amount} for ${templateName}`);
        } else {
          console.log(`💳 Wallet skip: ${result.reason}`);
        }
      }).catch(err => {
        console.error('💳 Wallet deduction failed (non-blocking):', err.message);
      });

      let mediaUrlForDB = null;
      const headerComp = components?.find((c: any) => c.type === 'header');
      if (headerComp && headerComp.parameters && headerComp.parameters[0]) {
        const param = headerComp.parameters[0];
        mediaUrlForDB = param.image?.link || param.video?.link || param.document?.link || null;
      }

      let savedMessage = null;
      if (conversationId && organizationId) {
        const now = new Date();
        savedMessage = await prisma.message.create({
          data: {
            conversationId,
            whatsappAccountId: account.id,
            waMessageId,
            wamId: waMessageId,
            direction: 'OUTBOUND',
            type: 'TEMPLATE',
            content: fullContent,
            mediaUrl: mediaUrlForDB,
            status: 'SENT',
            sentAt: now,
            timestamp: now,
            createdAt: now,
            metadata: {
              ...(tempId ? { tempId } : {}),
              ...(clientMsgId ? { clientMsgId } : {}),
              templateName,
              buttons: template?.buttons || []
            } as any,
          },
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: now,
            lastMessagePreview: fullContent.substring(0, 100),
            isWindowOpen: true,
            windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        const { webhookEvents } = await import('../webhooks/webhook.service');
        webhookEvents.emit('newMessage', {
          organizationId,
          conversationId,
          tempId: tempId || (savedMessage.metadata as any)?.tempId,
          clientMsgId: clientMsgId || (savedMessage.metadata as any)?.clientMsgId,
          message: {
            ...savedMessage,
            tempId: tempId || (savedMessage.metadata as any)?.tempId,
            clientMsgId: clientMsgId || (savedMessage.metadata as any)?.clientMsgId,
          }
        });
      }

      return {
        success: true,
        waMessageId,
        wamId: waMessageId,
        message: savedMessage ? {
          ...(savedMessage as any),
          tempId: tempId || (savedMessage.metadata as any)?.tempId,
          clientMsgId: clientMsgId || (savedMessage.metadata as any)?.clientMsgId,
        } : null
      };

    } catch (error: any) {
      console.error('❌ sendTemplate error:', error);
      throw error;
    }
  }

  async sendMediaMessage(
    accountId: string,
    to: string,
    mediaType: 'image' | 'document' | 'video' | 'audio',
    mediaUrl: string,
    caption?: string,
    conversationId?: string,
    organizationId?: string,
    tempId?: string,
    clientMsgId?: string
  ) {
    const content: any = {
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

  async sendMessage(options: SendMessageOptions) {
    const {
      accountId, to, type, content,
      conversationId, organizationId, tempId, clientMsgId,
      mediaUrl, skipWindowCheck,
    } = options;

    const startTime = Date.now();
    console.log(`📤 sendMessage START: type=${type} to=${to}`);

    const [accountData, conversationData] = await Promise.all([
      this.getAccountWithToken(accountId),
      conversationId
        ? prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            id: true, contactId: true,
            isWindowOpen: true, windowExpiresAt: true,
            lastCustomerMessageAt: true,
          },
        })
        : Promise.resolve(null),
    ]);

    const { account, accessToken } = accountData;
    const orgId = organizationId || account.organizationId;
    const formattedTo = this.formatPhoneNumber(to);

    if (type !== 'template' && !skipWindowCheck && conversationData) {
      const now = new Date();
      let expired = false;

      if (conversationData.windowExpiresAt) {
        expired = new Date(conversationData.windowExpiresAt) <= now;
      } else if (conversationData.isWindowOpen === false) {
        expired = true;
      } else if (conversationData.lastCustomerMessageAt) {
        expired = now.getTime() - new Date(conversationData.lastCustomerMessageAt).getTime() > 24 * 60 * 60 * 1000;
      }

      if (expired) {
        throw new Error('User session expired (24h window closed). Send a Template Message to re-engage.');
      }
    }

    const metaStart = Date.now();
    const messagePayload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedTo,
      type,
      ...content,
    };

    const result = await metaApi.sendMessage(
      account.phoneNumberId, accessToken, formattedTo, messagePayload
    );

    console.log(`⏱️ Meta API: ${Date.now() - metaStart}ms`);

    const waMessageId = result.messageId;
    const now = new Date();
    const messageContent = this.extractMessageContent(type, content);

    let mediaUrlForDB: string | null = null;
    const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
    if (mediaTypes.includes(type)) {
      mediaUrlForDB = content?.[type]?.link || content?.[type]?.url ||
        content?.link || mediaUrl || null;
    }

    const contact = await this.getOrCreateContact(orgId, to);
    let conversation = conversationData;
    if (!conversation) {
      conversation = await this.getOrCreateConversation(
        orgId, contact.id, account.phoneNumberId,
        messageContent.substring(0, 100), conversationId
      );
    }

    const savedMessage = await prisma.message.create({
      data: {
        conversationId: conversation!.id,
        whatsappAccountId: accountId,
        wamId: waMessageId,
        waMessageId: waMessageId,
        direction: MessageDirection.OUTBOUND,
        type: this.mapMessageType(type),
        content: messageContent,
        mediaUrl: mediaUrlForDB,
        status: MessageStatus.SENT,
        timestamp: now,
        sentAt: now,
        createdAt: now,
        metadata: {
          ...(tempId ? { tempId } : {}),
          ...(clientMsgId ? { clientMsgId } : {}),
        } as any,
      },
    });

    setImmediate(async () => {
      try {
        await prisma.conversation.update({
          where: { id: conversation!.id },
          data: {
            lastMessageAt: now,
            lastMessagePreview: messageContent.substring(0, 100),
            isRead: true,
            unreadCount: 0,
          },
        });

        const { inboxService } = await import('../inbox/inbox.service');
        await inboxService.clearCache(orgId);

        const { webhookEvents } = await import('../webhooks/webhook.service');
        const contactData = await prisma.contact.findUnique({
          where: { id: contact.id },
          select: {
            id: true, phone: true, firstName: true, lastName: true,
            whatsappProfileName: true, avatar: true,
          },
        });

        webhookEvents.emit('conversationUpdated', {
          organizationId: orgId,
          conversation: {
            id: conversation!.id,
            lastMessageAt: now.toISOString(),
            lastMessagePreview: messageContent.substring(0, 100),
            unreadCount: 0,
            isRead: true,
            isWindowOpen: conversation!.isWindowOpen,
            windowExpiresAt: conversation!.windowExpiresAt instanceof Date
              ? conversation!.windowExpiresAt.toISOString()
              : conversation!.windowExpiresAt,
            contact: contactData,
          },
        });
      } catch (e) {
        console.error('Background task error:', e);
      }
    });

    console.log(`✅ sendMessage TOTAL: ${Date.now() - startTime}ms`);

    return {
      success: true,
      messageId: waMessageId,
      message: {
        ...savedMessage,
        tempId,
        clientMsgId,
      },
    };
  }

  // ============================================
  // 24h window check — kept for backward compat (dead code, called nowhere internally)
  // ============================================
  private async checkWindowOrThrow(
    organizationId: string,
    conversationId: string | undefined,
    to: string,
    accountId: string,
    type: string,
    content: any
  ) {
    try {
      let conv: any = null;

      if (conversationId) {
        conv = await prisma.conversation.findUnique({
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
        const digits = to.replace(/[^0-9]/g, '');
        const contact = await prisma.contact.findFirst({
          where: {
            organizationId,
            OR: [
              { phone: `+${digits}` },
              { phone: digits },
              { phone: digits.slice(-10) },
            ],
          },
          select: { id: true },
        });

        if (contact) {
          conv = await prisma.conversation.findUnique({
            where: { organizationId_contactId: { organizationId, contactId: contact.id } },
            select: {
              id: true,
              isWindowOpen: true,
              windowExpiresAt: true,
              lastCustomerMessageAt: true,
            },
          });
        }
      }

      if (!conv) {
        throw new Error(
          'No inbound message from user yet. You must start with a Template Message.'
        );
      }

      const now = new Date();
      let windowExpired = false;

      if (conv.windowExpiresAt) {
        windowExpired = new Date(conv.windowExpiresAt) <= now;
      } else if (conv.isWindowOpen === false) {
        windowExpired = true;
      } else if (conv.lastCustomerMessageAt) {
        windowExpired =
          now.getTime() - new Date(conv.lastCustomerMessageAt).getTime() >
          24 * 60 * 60 * 1000;
      } else {
        const inboundCount = await prisma.message.count({
          where: { conversationId: conv.id, direction: MessageDirection.INBOUND },
        });
        windowExpired = inboundCount === 0;
      }

      if (windowExpired) {
        const errorMsg = conv.lastCustomerMessageAt
          ? 'User session expired (24h window closed). Send a Template Message to re-engage.'
          : 'No inbound message from user yet. You must start with a Template Message.';

        if (conv.id) {
          prisma.message.create({
            data: {
              conversationId: conv.id,
              whatsappAccountId: accountId,
              direction: MessageDirection.OUTBOUND,
              type: this.mapMessageType(type),
              content: this.extractMessageContent(type, content),
              status: MessageStatus.FAILED,
              failureReason: errorMsg,
              sentAt: new Date(),
              failedAt: new Date(),
            },
          }).catch(() => { });
        }

        throw new Error(errorMsg);
      }
    } catch (err: any) {
      if (
        err.message?.includes('Template Message') ||
        err.message?.includes('window closed') ||
        err.message?.includes('session expired')
      ) {
        throw err;
      }
      console.warn('Window check error (non-critical):', err.message);
    }
  }

  // ============================================
  // CAMPAIGN METHODS
  // ============================================

  async sendCampaignMessages(
    campaignId: string,
    batchSize: number = 500,
    delayMs: number = 50
  ): Promise<CampaignSendResult> {
    console.log(`\n📢 ========== CAMPAIGN START ==========`);
    console.log(`   Campaign ID: ${campaignId}`);
    console.log(`   Batch Size: ${batchSize}`);
    console.log(`   Delay: ${delayMs}ms`);

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        whatsappAccount: true,
        campaignContacts: {
          where: { status: MessageStatus.PENDING },
          include: { contact: true },
          take: batchSize,
        },
      } as any,
    }) as any;

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'RUNNING') {
      throw new Error('Campaign is not running');
    }

    console.log(`   Template: ${campaign.template.name}`);
    console.log(`   Recipients: ${campaign.campaignContacts.length}`);

    let accessToken: string;
    try {
      const tokenResult = await this.getAccountWithToken(
        campaign.whatsappAccount.id
      );
      accessToken = tokenResult.accessToken;
    } catch (error: any) {
      console.error('❌ Failed to get access token for campaign:', error);

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED' },
      });

      throw new Error(
        'Failed to get access token for campaign. Please reconnect WhatsApp account.'
      );
    }

    const orgId = campaign.whatsappAccount.organizationId;

    const { deductWalletForCampaign } = await import('../wallet/wallet.deduction.service');

    const walletCheck = await deductWalletForCampaign({
      organizationId: orgId,
      templateName: campaign.template.name,
      templateCategory: campaign.template.category,
      totalRecipients: campaign.campaignContacts.length,
      campaignId,
    });

    if (walletCheck.walletActive) {
      console.log(`💳 Wallet check for campaign:`);
      console.log(`   Estimated cost: ₹${walletCheck.estimatedCost.toFixed(2)}`);
      console.log(`   Available: ₹${walletCheck.availableBalance.toFixed(2)}`);

      if (!walletCheck.canProceed) {
        console.warn(`⚠️ Wallet balance low! Shortfall: ₹${walletCheck.shortfall.toFixed(2)}`);
        console.warn(`⚠️ Campaign will continue but wallet may run out`);
      }
    }

    const results: CampaignSendResult = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    let totalSentAmountPaise = 0;
    const templateCategory = campaign.template?.category || 'MARKETING';

    for (const recipient of campaign.campaignContacts) {
      try {
        const formattedPhone = this.formatPhoneNumber(recipient.contact.phone);

        const components = this.buildTemplateComponents(campaign.template, {});

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

        const messageResult = await metaApi.sendMessage(
          campaign.whatsappAccount.phoneNumberId,
          accessToken,
          formattedPhone,
          messagePayload
        );

        await this.updateContactStatus(
          campaignId,
          recipient.contactId,
          MessageStatus.SENT,
          messageResult.messageId
        );

        results.sent++;
        totalSentAmountPaise += Math.round(
          getRateForCategory(templateCategory, recipient.contact.phone) * 100
        );

        console.log(
          `✅ Sent to ${recipient.contact.phone} (${messageResult.messageId})`
        );

        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error: any) {
        console.error(
          `❌ Failed to send to ${recipient.contact.phone}:`,
          error.message
        );

        const errorData = error.response?.data?.error || {};
        const errorCode = errorData.code;
        const errorMessage = errorData.message || error.message;

        let failureReason = errorMessage;

        if (errorCode === 131030 || errorMessage.includes('not a WhatsApp user')) {
          failureReason = 'Phone number is not registered on WhatsApp';
        } else if (errorCode === 131048 || errorCode === 131021 || errorMessage.includes('rate limit')) {
          failureReason = 'Meta messaging rate limit reached';
        } else if (errorCode === 131056 || errorCode === 131051 || errorMessage.includes('restricted') || errorMessage.includes('banned')) {
          failureReason = 'Phone number or account restricted by Meta';
        } else if (errorCode === 132000 || errorMessage.includes('template')) {
          failureReason = 'Template was rejected or is not approved by Meta';
        } else if (errorMessage.includes('expired') || errorMessage.includes('24h')) {
          failureReason = '24-hour window closed (No user reply)';
        }

        await this.updateContactStatus(
          campaignId,
          recipient.contactId,
          MessageStatus.FAILED,
          undefined,
          failureReason
        );

        results.failed++;
        results.errors.push(`${recipient.contact.phone}: ${errorMessage}`);
      }
    }

    await this.checkCampaignCompletion(campaignId);

    if (walletCheck.walletActive && results.sent > 0 && totalSentAmountPaise > 0) {
      try {
        const totalAmountRupees = totalSentAmountPaise / 100;
        const avgRateRupees = totalAmountRupees / results.sent;

        console.log(
          `Wallet country-aware bulk deduction: ${results.sent} msgs, total Rs${totalAmountRupees.toFixed(2)} ` +
          `(avg Rs${avgRateRupees.toFixed(4)}/msg)`
        );

        await prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.findUnique({ where: { organizationId: orgId } });
          if (!wallet || !wallet.isActive || wallet.flagged) {
            console.warn('Wallet not available for bulk deduction - skipping');
            return;
          }

          const balanceBeforePaise = wallet.balancePaise;

          const creditHeadroom = wallet.creditEnabled
            ? Math.max(0, wallet.creditLimitPaise - wallet.creditUsedPaise)
            : 0;
          const availablePaise = wallet.balancePaise + creditHeadroom;

          const actualDeductPaise = Math.min(totalSentAmountPaise, availablePaise);
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
              description:
                `Campaign charge - ${categoryLabel} (${campaign.template.name}) x ${results.sent} messages` +
                ` [country-wise rates, avg Rs${avgRateRupees.toFixed(4)}/msg]`,
              status: 'completed',
              metaService: 'template_message',
              note: `Campaign: ${campaign.name}`,
            },
          });

          console.log(
            `Wallet deducted: Rs${(actualDeductPaise / 100).toFixed(2)} for ${results.sent} msgs ("${campaign.name}")`
          );
        });
      } catch (walletErr: any) {
        console.error('Campaign bulk wallet deduction failed (non-blocking):', walletErr.message);
      }
    } else {
      console.log(`Deduction skipped: walletActive=${walletCheck.walletActive}, sent=${results.sent}, amountPaise=${totalSentAmountPaise}`);
    }

    console.log(`Campaign END ==========`);
    console.log(`   Sent: ${results.sent}`);
    console.log(`   Failed: ${results.failed}\n`);

    return results;
  }

  async updateContactStatus(
    campaignId: string,
    contactId: string,
    status: MessageStatus,
    waMessageId?: string,
    failureReason?: string
  ): Promise<void> {
    const now = new Date();

    const updateData: any = {
      status,
      updatedAt: now,
    };

    if (waMessageId) {
      updateData.waMessageId = waMessageId;
    }

    switch (status) {
      case MessageStatus.SENT:
        updateData.sentAt = now;
        break;
      case MessageStatus.DELIVERED:
        updateData.deliveredAt = now;
        break;
      case MessageStatus.READ:
        updateData.readAt = now;
        break;
      case MessageStatus.FAILED:
        updateData.failedAt = now;
        if (failureReason) {
          updateData.failureReason = failureReason;
        }
        break;
    }

    await prisma.campaignContact.updateMany({
      where: {
        campaignId,
        contactId,
      },
      data: updateData,
    });

    const countFieldMap: Record<string, string> = {
      SENT: 'sentCount',
      DELIVERED: 'deliveredCount',
      READ: 'readCount',
      FAILED: 'failedCount',
    };

    const fieldToIncrement = countFieldMap[status];

    if (fieldToIncrement) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          [fieldToIncrement]: { increment: 1 },
        },
      });
    }
  }

  async checkCampaignCompletion(campaignId: string): Promise<boolean> {
    const remainingRecipients = await prisma.campaignContact.count({
      where: {
        campaignId,
        status: MessageStatus.PENDING,
      },
    });

    if (remainingRecipients === 0) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { sentCount: true, failedCount: true },
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      console.log(
        `🎉 Campaign ${campaignId} completed! Sent: ${campaign?.sentCount || 0}, Failed: ${campaign?.failedCount || 0}`
      );
      return true;
    }

    return false;
  }

  // ============================================
  // TEMPLATE HELPER METHODS
  // ============================================

  private buildTemplateComponents(
    template: any,
    variables: Record<string, string>
  ): any[] {
    const components: any[] = [];

    const isValidHttpUrl = (str: string): boolean => {
      try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    };

    const isWhatsAppMediaId = (str: string): boolean => {
      if (!str) return false;
      if (/^\d{10,}$/.test(str)) return true;
      if (/^\d+:[A-Za-z0-9+/=:_-]+$/.test(str)) return true;
      if (str.length > 20 && !str.includes('http') &&
        !str.includes('.') && /^[A-Za-z0-9+/=_-]+$/.test(str)) {
        return true;
      }
      return false;
    };

    const buildMediaParam = (mediaType: string, mediaValue: string) => {
      const type = mediaType.toLowerCase();
      if (isValidHttpUrl(mediaValue)) {
        return { type, [type]: { link: mediaValue } };
      } else if (isWhatsAppMediaId(mediaValue)) {
        return { type, [type]: { id: mediaValue } };
      }
      return { type, [type]: { link: mediaValue } };
    };

    if (template.headerType) {
      const hType = String(template.headerType).toUpperCase();

      if (hType === 'TEXT' && template.headerContent) {
        const headerVars = this.extractVariables(template.headerContent, variables);
        if (headerVars.length > 0) {
          components.push({ type: 'header', parameters: headerVars });
        }

      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(hType)) {
        const mediaValue =
          variables.header_media ||
          template.headerMediaId ||
          template.headerMediaUrl ||
          template.headerContent;

        if (mediaValue) {
          const mediaParam = buildMediaParam(hType.toLowerCase(), mediaValue);
          components.push({ type: 'header', parameters: [mediaParam] });
        } else {
          console.warn(`⚠️ No media for ${hType} header in template: ${template.name}`);
        }
      }
    }

    const bodyVarNames = this.extractVariablesFromText(template.bodyText);
    if (bodyVarNames.length > 0) {
      const bodyParams = bodyVarNames.map((_: string, index: number) => ({
        type: 'text',
        text:
          variables[`var_${index + 1}`] ||
          variables[`body_${index + 1}`] ||
          'Customer',
      }));
      components.push({ type: 'body', parameters: bodyParams });
    }

    if (template.buttons) {
      const buttons = typeof template.buttons === 'string'
        ? JSON.parse(template.buttons)
        : template.buttons;

      if (Array.isArray(buttons)) {
        buttons.forEach((button: any, index: number) => {
          if (button.type === 'URL' && button.url?.includes('{{')) {
            components.push({
              type: 'button',
              sub_type: 'url',
              index,
              parameters: [{
                type: 'text',
                text: variables[`button_${index}`] || '',
              }],
            });
          }
        });
      }
    }

    return components;
  }

  private extractVariablesFromText(text: string): string[] {
    if (!text) return [];
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    return matches.map((_, index) => `var_${index + 1}`);
  }

  private extractVariables(
    text: string,
    variables: Record<string, string>
  ): any[] {
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    return matches.map((match, index) => ({
      type: 'text',
      text: variables[`var_${index + 1}`] || match,
    }));
  }

  // ============================================
  // MESSAGE STATUS METHODS
  // ============================================

  async markAsRead(accountId: string, messageId: string) {
    try {
      const { account, accessToken } = await this.getAccountWithToken(accountId);

      await metaApi.markMessageAsRead(
        account.phoneNumberId,
        accessToken,
        messageId
      );

      await prisma.message.updateMany({
        where: { wamId: messageId },
        data: {
          status: MessageStatus.READ,
          readAt: new Date()
        }
      });

      console.log(`✅ Marked message ${messageId} as read`);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Failed to mark as read:', error);
      return { success: false, error: error.message };
    }
  }

  async sendTypingIndicator(conversationId: string) {
    try {
      const lastIncoming = await prisma.message.findFirst({
        where: { conversationId, direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' }
      });
      if (!lastIncoming || !lastIncoming.wamId) return { success: false, reason: 'No incoming message' };

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!conversation) return { success: false, reason: 'Conversation not found' };

      const defaultAccount = await this.getDefaultAccount(conversation.organizationId);
      if (!defaultAccount) return { success: false, reason: 'No WhatsApp account found' };

      const { account, accessToken } = await this.getAccountWithToken(defaultAccount.id);

      await metaApi.markMessageAsRead(
        account.phoneNumberId,
        accessToken,
        lastIncoming.wamId,
        true
      );

      return { success: true };
    } catch (error: any) {
      console.error('❌ Failed to send typing indicator:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // ACCOUNT MANAGEMENT
  // ============================================

  async getDefaultAccount(organizationId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        organizationId,
        isDefault: true,
        status: WhatsAppAccountStatus.CONNECTED,
      },
    });

    if (!account) {
      return prisma.whatsAppAccount.findFirst({
        where: {
          organizationId,
          status: WhatsAppAccountStatus.CONNECTED,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return account;
  }

  async validateAccount(accountId: string): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      const { accessToken } = await this.getAccountWithToken(accountId);
      const isValid = await metaApi.isTokenValid(accessToken);

      if (!isValid) {
        return {
          valid: false,
          reason: 'Access token is invalid or expired',
        };
      }

      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        reason: error.message,
      };
    }
  }

  // ============================================
  // QUALITY RATING SYNC METHODS
  // ============================================

  async syncAccountQuality(accountId: string): Promise<{
    success: boolean;
    account?: any;
    error?: string;
  }> {
    try {
      console.log(`🔄 Syncing quality for account: ${accountId}`);

      const { account, accessToken } = await this.getAccountWithToken(
        accountId
      );

      const phoneInfo = await metaApi.getPhoneNumberInfo(
        account.phoneNumberId,
        accessToken
      );

      console.log(`📊 Phone info from Meta:`, {
        quality_rating: phoneInfo?.quality_rating,
        messaging_limit_tier: phoneInfo?.messaging_limit_tier,
        verified_name: phoneInfo?.verified_name,
        platform_type: phoneInfo?.platform_type,
      });

      const updated = await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: {
          qualityRating: phoneInfo?.quality_rating || account.qualityRating,
          messagingLimit:
            phoneInfo?.messaging_limit_tier || account.messagingLimit,
          verifiedName: phoneInfo?.verified_name || account.verifiedName,
          displayName:
            phoneInfo?.verified_name || account.displayName,
          codeVerificationStatus:
            phoneInfo?.code_verification_status ||
            account.codeVerificationStatus,
          updatedAt: new Date(),
        },
      });

      console.log(
        `✅ Quality synced for ${account.phoneNumber}: ${updated.qualityRating}`
      );

      return { success: true, account: updated };
    } catch (error: any) {
      console.error(
        `❌ Quality sync failed for ${accountId}:`,
        error.message
      );
      return { success: false, error: error.message };
    }
  }

  async syncAllAccountsQuality(organizationId: string): Promise<{
    total: number;
    synced: number;
    failed: number;
    results: any[];
  }> {
    console.log(`🔄 Syncing all accounts for org: ${organizationId}`);

    const accounts = await prisma.whatsAppAccount.findMany({
      where: {
        organizationId,
        status: WhatsAppAccountStatus.CONNECTED,
      },
      select: { id: true, phoneNumber: true },
    });

    if (accounts.length === 0) {
      console.log('ℹ️  No connected accounts to sync');
      return { total: 0, synced: 0, failed: 0, results: [] };
    }

    const results = await Promise.allSettled(
      accounts.map((acc) => this.syncAccountQuality(acc.id))
    );

    const synced = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;

    const failed = results.length - synced;

    console.log(
      `✅ Bulk sync complete: ${synced}/${accounts.length} successful`
    );

    return {
      total: accounts.length,
      synced,
      failed,
      results: results.map((r, i) => ({
        accountId: accounts[i].id,
        phoneNumber: accounts[i].phoneNumber,
        success: r.status === 'fulfilled' && r.value.success,
        error:
          r.status === 'rejected'
            ? r.reason?.message
            : r.status === 'fulfilled' && !r.value.success
              ? r.value.error
              : undefined,
      })),
    };
  }
}

export const whatsappService = new WhatsAppService();
export default whatsappService;