// 📁 src/modules/whatsapp/whatsapp.service.ts - COMPLETE FINAL VERSION

import {
  PrismaClient,
  MessageStatus,
  MessageDirection,
  MessageType,
  WhatsAppAccountStatus,
} from '@prisma/client';
import { metaApi } from '../meta/meta.api';
import { safeDecrypt, maskToken } from '../../utils/encryption';
import prisma from '../../config/database';
import { deductWalletForTemplate } from '../wallet/wallet.deduction.service';

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
  mediaUrl?: string;  // ✅ ADD THIS
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

  /**
   * Check if a string looks like a Meta access token
   */
  private looksLikeAccessToken(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    return (
      value.startsWith('EAA') ||
      value.startsWith('EAAG') ||
      value.startsWith('EAAI')
    );
  }

  /**
   * Extract plain text content from message payload
   */
  private extractMessageContent(type: string, content: any): string {
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
  private async getAccountWithToken(accountId: string): Promise<{
    account: any;
    accessToken: string;
  }> {
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: accountId },
      include: { organization: true },
    });

    if (!account) {
      console.error(`❌ Account not found: ${accountId}`);
      throw new Error('WhatsApp account not found');
    }

    if (account.status !== WhatsAppAccountStatus.CONNECTED) {
      console.error(`❌ Account not connected: ${accountId}, status: ${account.status}`);
      throw new Error('WhatsApp account is not connected');
    }

    if (!account.accessToken) {
      console.error(`❌ No access token for account: ${accountId}`);
      throw new Error('No access token found for this account');
    }

    console.log(`🔐 Decrypting token for account ${accountId}...`);

    let accessToken: string | null = null;

    try {
      if (this.looksLikeAccessToken(account.accessToken)) {
        console.log(`📝 Token is already plain text (starts with EAA)`);
        accessToken = account.accessToken;
      } else {
        console.log(`🔓 Attempting to decrypt token...`);
        accessToken = safeDecrypt(account.accessToken);
      }
    } catch (decryptError: any) {
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

    console.log(`✅ Token ready: ${maskToken(accessToken)}`);

    return { account, accessToken };
  }

  /**
   * Format phone number for WhatsApp API
   */
  private formatPhoneNumber(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  /**
   * Get or create contact
   */
  private async getOrCreateContact(
    organizationId: string,
    phone: string
  ): Promise<any> {
    const formattedPhone = phone.startsWith('+')
      ? phone
      : `+${this.formatPhoneNumber(phone)}`;

    const cleanPhone = this.formatPhoneNumber(phone);

    let contact = await prisma.contact.findFirst({
      where: {
        organizationId,
        OR: [
          { phone: formattedPhone },
          { phone: cleanPhone },
          { phone: `+${cleanPhone}` }
        ]
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          organizationId,
          phone: formattedPhone,
          source: 'WHATSAPP',
          firstName: 'Unknown',
          status: 'ACTIVE'
        },
      });
      console.log(`👤 Created new contact: ${contact.id}`);
    }

    return contact;
  }

  /**
   * Get or create conversation
   */
  private async getOrCreateConversation(
    organizationId: string,
    contactId: string,
    phoneNumberId: string, // This is the Meta Phone ID
    messagePreview: string,
    existingConversationId?: string
  ): Promise<any> {
    let conversation = null;

    // 1. Try by ID if provided
    if (existingConversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: existingConversationId },
      });
    }

    // 2. Fallback or primary check by Org + Contact
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
            isWindowOpen: true,
            isRead: true
          },
        });
        console.log(`💬 Created new conversation: ${conversation.id}`);
      } catch (err) {
        // Double check if it was created in the meantime (race condition)
        conversation = await prisma.conversation.findUnique({
          where: {
            organizationId_contactId: { organizationId, contactId },
          },
        });
        if (!conversation) throw err;
      }
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: messagePreview,
          isWindowOpen: true,
          isRead: true,
          unreadCount: 0 // ✅ Reset unread count when sending a message
        },
      });
    }

    return conversation;
  }

  /**
   * Map string type to MessageType enum
   */
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
  // CONTACT VALIDATION
  // ============================================

  /**
   * Check if a phone number has WhatsApp
   */
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

  /**
   * Send a text message
   */
  async sendTextMessage(
    accountId: string,
    to: string,
    message: string,
    conversationId?: string,
    organizationId?: string,
    tempId?: string,
    clientMsgId?: string
  ) {
    return this.sendMessage({
      accountId,
      to,
      type: 'text',
      content: { text: { body: message } },
      conversationId,
      organizationId,
      tempId,
      clientMsgId
    });
  }

  // Helper function to hydrate template text
  private hydrateTemplate(bodyText: string, params: any[]): string {
    let text = bodyText;
    if (!params || params.length === 0) return text;

    // Convert components to parameter array
    // Components array structure: [{ type: 'body', parameters: [{ type: 'text', text: 'Value' }] }]
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
      // Replace {{1}}, {{2}} etc with params
      const paramValue = typeof param === 'string' ? param : param?.text || JSON.stringify(param);
      text = text.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), paramValue);
    });
    return text;
  }

  /**
   * Send a template message
   */
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

      // ✅ 1. Get Template Details from DB to get Body Text
      const template = await prisma.template.findFirst({
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

      // Send to Meta
      const response = await metaApi.sendMessage(
        account.phoneNumberId,
        accessToken,
        formattedTo,
        messagePayload
      );

      const waMessageId = (response as any)?.messages?.[0]?.id || response?.messageId;
      if (!waMessageId) throw new Error('No message ID returned');

      // ✅ ── WALLET DEDUCTION (Meta send ke BAAD, non-blocking) ─────────────────
      const orgId = organizationId || account.organizationId;
      
      // Template category DB se fetch karo
      const templateForCategory = await prisma.template.findFirst({
        where: {
          organizationId: orgId,
          name: templateName,
        },
        select: { category: true },
      });

      // Fire & forget - message blocking nahi hoga
      deductWalletForTemplate({
        organizationId: orgId,
        templateName,
        templateCategory: templateForCategory?.category,
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
      // ✅ ── END WALLET DEDUCTION ────────────────────────────────────────────────

      // ✅ 2.5 Extract Media URL for saving
      let mediaUrlForDB = null;
      const headerComp = components?.find((c: any) => c.type === 'header');
      if (headerComp && headerComp.parameters && headerComp.parameters[0]) {
          const param = headerComp.parameters[0];
          mediaUrlForDB = param.image?.link || param.video?.link || param.document?.link || null;
      }

      // ✅ 3. Save FULL CONTENT to Database
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
            } as any,
          },
        });

        // Update conversation
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: now,
            lastMessagePreview: fullContent.substring(0, 100),
            isWindowOpen: true,
            windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        // Emit Socket Event
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

  /**
   * Send a media message
   */
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

  /**
   * Core send message function - WITH CONTACT CHECK
   */
  async sendMessage(options: SendMessageOptions) {
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
      if (type !== 'template') {
        const contact = await this.getOrCreateContact(organizationId, to);
        const conversation = await this.getOrCreateConversation(
          organizationId,
          contact.id,
          account.phoneNumberId,
          '',
          conversationId
        );

        if (conversation) {
          const lastCustomerMsgAt = conversation.lastCustomerMessageAt;
          const now = new Date();
          const windowExpired = !lastCustomerMsgAt || (now.getTime() - new Date(lastCustomerMsgAt).getTime()) > 24 * 60 * 60 * 1000;

          if (windowExpired) {
            const errorMsg = lastCustomerMsgAt
              ? 'User session expired (24h window closed). Send a Template Message to re-engage.'
              : 'No inbound message from user yet. You must start with a Template Message.';

            console.warn(`⚠️ ${errorMsg}`);

            // Save as failed message so user sees it in inbox
            await prisma.message.create({
              data: {
                conversationId: conversation.id,
                whatsappAccountId: accountId,
                direction: MessageDirection.OUTBOUND,
                type: this.mapMessageType(type),
                content: this.extractMessageContent(type, content),
                status: MessageStatus.FAILED,
                failureReason: errorMsg,
                sentAt: now,
                failedAt: now,
              },
            });

            throw new Error(errorMsg);
          }
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
      const messagePayload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type,
        ...content,
      };

      console.log(`   Payload type:`, type);

      // Send via Meta API
      const result = await metaApi.sendMessage(
        account.phoneNumberId,
        accessToken,
        formattedTo,
        messagePayload
      );

      console.log(`✅ Message sent successfully!`);
      console.log(`   Message ID: ${result.messageId}`);

      // Get or create contact
      const contact = await this.getOrCreateContact(organizationId, to);

      // Extract clean content
      const messageContent = this.extractMessageContent(type, content);
      const messagePreview = messageContent.substring(0, 100);

      console.log(`   Message Content: ${messageContent.substring(0, 50)}...`);

      // ✅ Extract mediaUrl properly
      let mediaUrlForDB: string | null = null;
      const mediaTypesList = ['image', 'video', 'audio', 'document', 'sticker'];

      if (mediaTypesList.includes(type)) {
        // Try all possible locations
        mediaUrlForDB = 
          content?.[type]?.link ||      // { image: { link: '...' } }
          content?.[type]?.url ||       // { image: { url: '...' } }
          content?.link ||              // { link: '...' }
          content?.url ||               // { url: '...' }
          options.mediaUrl ||           // Direct mediaUrl option
          null;

        console.log(`💾 Media URL for ${type}:`, mediaUrlForDB);
      }

      // Get or create conversation
      const conversation = await this.getOrCreateConversation(
        organizationId,
        contact.id,
        account.phoneNumberId,
        messagePreview,
        conversationId
      );

      // Save message to database
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          whatsappAccountId: accountId,
          wamId: result.messageId,
          waMessageId: result.messageId,
          direction: MessageDirection.OUTBOUND,
          type: this.mapMessageType(type),
          content: messageContent,
          mediaUrl: mediaUrlForDB,  // ✅ Properly set
          status: MessageStatus.SENT,
          timestamp: new Date(),
          sentAt: new Date(),
          metadata: {
            ...(tempId ? { tempId } : {}),
            ...(clientMsgId ? { clientMsgId } : {}),
          } as any,
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
      const { webhookEvents } = await import('../webhooks/webhook.service');
      webhookEvents.emit('newMessage', {
        organizationId,
        conversationId: conversation.id,
        tempId: tempId || (message.metadata as any)?.tempId,
        clientMsgId: clientMsgId || (message.metadata as any)?.clientMsgId,
        message: {
          ...message,
          tempId: tempId || (message.metadata as any)?.tempId,
          clientMsgId: clientMsgId || (message.metadata as any)?.clientMsgId,
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
          windowExpiresAt: (conversation as any).windowExpiresAt,
          contact: (message as any).conversation?.contact,
        },
      });

      console.log(`📤 ========== SEND MESSAGE END ==========\n`);

      return {
        success: true,
        messageId: result.messageId,
        message: {
          ...message,
          tempId: tempId || (message.metadata as any)?.tempId,
          clientMsgId: clientMsgId || (message.metadata as any)?.clientMsgId,
        },
      };
    } catch (error: any) {
      console.error(`❌ Failed to send message:`, {
        error: error.message,
        response: error.response?.data,
      });

      if (conversationId) {
        try {
          const failedContent = this.extractMessageContent(type, content);

          await prisma.message.create({
            data: {
              conversationId,
              whatsappAccountId: accountId,
              direction: MessageDirection.OUTBOUND,
              type: this.mapMessageType(type),
              content: failedContent,
              status: MessageStatus.FAILED,
              failureReason: error.response?.data?.error?.message || error.message,
              sentAt: new Date(),
              failedAt: new Date(),
            },
          });
        } catch (dbError) {
          console.error('Failed to save error message to DB:', dbError);
        }
      }

      console.log(`📤 ========== SEND MESSAGE END (ERROR) ==========\n`);

      const errorMessage =
        error.response?.data?.error?.message ||
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

    // ✅ ── WALLET PRE-CHECK for Campaign ────────────────────────────────────────
    const orgId = campaign.whatsappAccount.organizationId;
    
    const { deductWalletForCampaign } = await import('../wallet/wallet.deduction.service');
    
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

    const results: CampaignSendResult = {
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

        const messageResult = await metaApi.sendMessage(
          campaign.whatsappAccount.phoneNumberId,
          accessToken,
          formattedPhone,
          messagePayload
        );

        // Update contact status
        await this.updateContactStatus(
          campaignId,
          recipient.contactId,
          MessageStatus.SENT,
          messageResult.messageId
        );

        results.sent++;

        // ✅ ── PER-MESSAGE WALLET DEDUCTION ──────────────────────────────────────
        if (walletCheck.walletActive) {
          try {
            await deductWalletForTemplate({
              organizationId: orgId,
              templateName: campaign.template.name,
              templateCategory: campaign.template.category,
              recipientPhone: formattedPhone,
              waMessageId: messageResult.messageId,
              campaignId,
              campaignName: campaign.name,
            });
          } catch (err: any) {
            console.error(`💳 Campaign wallet deduction failed for ${formattedPhone}:`, err.message);
          }
        }
        // ✅ ── END DEDUCTION ─────────────────────────────────────────────────────
        console.log(
          `✅ Sent to ${recipient.contact.phone} (${messageResult.messageId})`
        );

        // Delay between messages
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
        
        // Human-readable mapping for common Meta errors
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

    console.log(`📢 ========== CAMPAIGN END ==========`);
    console.log(`   Sent: ${results.sent}`);
    console.log(`   Failed: ${results.failed}\n`);

    return results;
  }

  /**
   * Update campaign contact status
   */
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

  /**
   * Check if campaign is complete
   */
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

  /**
   * Build template components with variables
   */
  private buildTemplateComponents(
    template: any,
    variables: Record<string, string>
  ): any[] {
    const components: any[] = [];

    // Header component
    if (template.headerType) {
      if (template.headerType === 'TEXT' && template.headerContent) {
        const headerVars = this.extractVariables(
          template.headerContent,
          variables
        );
        if (headerVars.length > 0) {
          components.push({
            type: 'header',
            parameters: headerVars,
          });
        }
      } else if (
        ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.headerType)
      ) {
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
      const bodyParams = bodyVars.map((varName: string, index: number) => ({
        type: 'text',
        text:
          variables[varName] ||
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
      const buttons =
        typeof template.buttons === 'string'
          ? JSON.parse(template.buttons)
          : template.buttons;

      if (Array.isArray(buttons)) {
        buttons.forEach((button: any, index: number) => {
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

  /**
   * Mark message as read
   */
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
}

export const whatsappService = new WhatsAppService();
export default whatsappService;