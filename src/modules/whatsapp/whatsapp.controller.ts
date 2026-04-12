import { Request, Response, NextFunction } from 'express';
import { WhatsAppAccountStatus } from '@prisma/client';
import prisma from '../../config/database';
import { whatsappService } from './whatsapp.service';
import { successResponse, errorResponse } from '../../utils/response';

// ============================================
// HELPER FUNCTIONS
// ============================================

const getOrgId = (req: Request): string | null => {
  const headerOrg =
    (req.header('X-Organization-Id') || req.header('x-organization-id'))?.trim() || '';

  const queryOrg =
    (typeof req.query.organizationId === 'string' ? req.query.organizationId : '')?.trim() || '';

  const userOrg = (req.user as any)?.organizationId?.trim?.() || '';

  return headerOrg || queryOrg || userOrg || null;
};

const sanitizeAccount = (account: any) => {
  const { accessToken, webhookSecret, ...safe } = account;
  return { ...safe, hasAccessToken: !!accessToken };
};

const verifyOrgAccess = async (userId: string, organizationId: string) => {
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  return !!member;
};

// ============================================
// WHATSAPP CONTROLLER CLASS
// ============================================

class WhatsAppController {
  // ============================================
  // ACCOUNT MANAGEMENT
  // ============================================

  // ✅ GET /api/v1/whatsapp/accounts
  async getAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req);
      if (!organizationId) {
        return errorResponse(res, 'X-Organization-Id missing', 400);
      }

      const ok = await verifyOrgAccess(req.user!.id, organizationId);
      if (!ok) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      const accounts = await prisma.whatsAppAccount.findMany({
        where: { organizationId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      return successResponse(res, {
        data: accounts.map(sanitizeAccount),
        message: 'WhatsApp accounts retrieved',
      });
    } catch (e) {
      next(e);
    }
  }

  // ✅ GET /api/v1/whatsapp/accounts/:accountId
  async getAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req);
      const accountId = req.params.accountId as string;

      if (!organizationId) {
        return errorResponse(res, 'X-Organization-Id missing', 400);
      }

      const ok = await verifyOrgAccess(req.user!.id, organizationId);
      if (!ok) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      const account = await prisma.whatsAppAccount.findFirst({
        where: { id: accountId, organizationId },
      });

      if (!account) {
        return errorResponse(res, 'Account not found', 404);
      }

      return successResponse(res, {
        data: sanitizeAccount(account),
        message: 'WhatsApp account retrieved',
      });
    } catch (e) {
      next(e);
    }
  }

  // ✅ POST /api/v1/whatsapp/accounts/:accountId/default
  async setDefaultAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req);
      const accountId = req.params.accountId as string;

      if (!organizationId) {
        return errorResponse(res, 'X-Organization-Id missing', 400);
      }

      const ok = await verifyOrgAccess(req.user!.id, organizationId);
      if (!ok) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      const account = await prisma.whatsAppAccount.findFirst({
        where: { id: accountId, organizationId },
      });

      if (!account) {
        return errorResponse(res, 'Account not found', 404);
      }

      await prisma.whatsAppAccount.updateMany({
        where: { organizationId },
        data: { isDefault: false },
      });

      const updated = await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: { isDefault: true },
      });

      return successResponse(res, {
        data: sanitizeAccount(updated),
        message: 'Default WhatsApp account updated',
      });
    } catch (e) {
      next(e);
    }
  }

  // ✅ DELETE /api/v1/whatsapp/accounts/:accountId
  async disconnectAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req);
      const accountId = req.params.accountId as string;

      if (!organizationId) {
        return errorResponse(res, 'X-Organization-Id missing', 400);
      }

      const ok = await verifyOrgAccess(req.user!.id, organizationId);
      if (!ok) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      const account = await prisma.whatsAppAccount.findFirst({
        where: { id: accountId, organizationId },
      });

      if (!account) {
        return errorResponse(res, 'Account not found', 404);
      }

      await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: {
          status: WhatsAppAccountStatus.DISCONNECTED,
          accessToken: null,
          tokenExpiresAt: null,
          isDefault: false,
        },
      });

      // ✅ Emit socket event for real-time update
      const { webhookEvents } = await import('../webhooks/webhook.service');
      webhookEvents.emit('accountUpdated', {
        organizationId,
        accountId,
        status: WhatsAppAccountStatus.DISCONNECTED,
      });

      if (account.isDefault) {
        const another = await prisma.whatsAppAccount.findFirst({
          where: {
            organizationId,
            id: { not: accountId },
            status: WhatsAppAccountStatus.CONNECTED,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (another) {
          await prisma.whatsAppAccount.update({
            where: { id: another.id },
            data: { isDefault: true },
          });
        }
      }

      return successResponse(res, {
        message: 'WhatsApp account disconnected successfully',
      });
    } catch (e) {
      next(e);
    }
  }

  // ============================================
  // MESSAGE SENDING APIs - ✅ FIXED
  // ============================================

  /**
   * ✅ FIXED: Send Text Message
   */
  async sendText(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req.user as any)?.organizationId;
      const { 
        whatsappAccountId,
        accountId, // support both
        to, 
        recipient, // support both
        phone, // support both
        message,
        text, // support both
        content, // support both
        tempId,        // ✅ Frontend se aata hai
        localId,
        conversationId 
      } = req.body;

      const finalAccountId = whatsappAccountId || accountId;
      const finalTo = to || recipient || phone;
      const finalMessage = message || text || content;
      const finalTempId = tempId || localId;

      if (!finalAccountId || !finalTo || !finalMessage) {
        return errorResponse(res, 'whatsappAccountId, to, and message are required', 400);
      }

      const result = await whatsappService.sendMessage({
        accountId: finalAccountId,
        to: finalTo,
        type: 'text',
        content: { text: { body: finalMessage } },
        conversationId,
        organizationId,
        tempId: finalTempId,    // ✅ Pass tempId
      });

      // ✅ Serialize response
      const msg = result.message as any;
      const now = new Date().toISOString();

      return successResponse(res, {
        data: {
          ...msg,
          // ✅ Guarantee timestamps as strings
          createdAt: msg?.createdAt instanceof Date 
            ? msg.createdAt.toISOString() 
            : msg?.createdAt || now,
          sentAt: msg?.sentAt instanceof Date 
            ? msg.sentAt.toISOString() 
            : msg?.sentAt || now,
          timestamp: msg?.timestamp instanceof Date 
            ? msg.timestamp.toISOString() 
            : msg?.timestamp || msg?.createdAt || now,
        },
        message: 'Message sent'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * ✅ FIXED: Send Template Message
   * Accepts multiple field name formats for flexibility
   */
  async sendTemplate(req: Request, res: Response) {
    try {
      const {
        whatsappAccountId, to, templateName, language, parameters, conversationId,
        tempId, clientMsgId
      } = req.body;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return errorResponse(res, 'Organization not found', 400);
      }

      const result = await whatsappService.sendTemplateMessage({
        organizationId,
        accountId: whatsappAccountId,
        to,
        templateName,
        templateLanguage: language,
        components: parameters,
        conversationId,
        tempId: tempId || req.body.localId,
        clientMsgId: clientMsgId || req.body.client_msg_id
      });

      return successResponse(res, {
        data: result,
        message: 'Template message sent'
      });
    } catch (error: any) {
      console.error('Send template error:', error);
      return errorResponse(res, error.message || 'Failed to send template', 500);
    }
  }

  /**
   * ✅ FIXED: Send Media Message
   * Accepts multiple field name formats for flexibility
   */
  async sendMedia(req: Request, res: Response, next: NextFunction) {
    try {
      // ✅ Support multiple field name formats
      const accountId = req.body.accountId || req.body.whatsappAccountId;
      const to = req.body.to || req.body.recipient || req.body.phone;
      const mediaType = req.body.mediaType || req.body.media_type || req.body.type;
      const mediaUrl = req.body.mediaUrl || req.body.media_url || req.body.url;
      const caption = req.body.caption || req.body.text || '';
      const conversationId = req.body.conversationId;

      // Log incoming request
      console.log('🖼️ Send Media Request:', {
        accountId: accountId ? `${accountId.substring(0, 8)}...` : null,
        to: to ? `${to.substring(0, 6)}***` : null,
        mediaType,
        mediaUrl: mediaUrl ? `${mediaUrl.substring(0, 30)}...` : null,
        hasCaption: !!caption,
        hasConversationId: !!conversationId,
      });

      // Validate accountId
      if (!accountId) {
        return errorResponse(
          res,
          'Account ID is required. Send as "accountId" or "whatsappAccountId"',
          400
        );
      }

      // Validate recipient
      if (!to) {
        return errorResponse(
          res,
          'Recipient phone number is required. Send as "to", "recipient", or "phone"',
          400
        );
      }

      // Validate media type
      const validMediaTypes = ['image', 'video', 'audio', 'document'];
      if (!mediaType || !validMediaTypes.includes(mediaType.toLowerCase())) {
        return errorResponse(
          res,
          `Media type is required and must be one of: ${validMediaTypes.join(', ')}`,
          400
        );
      }

      // Validate media URL
      if (!mediaUrl) {
        return errorResponse(
          res,
          'Media URL is required. Send as "mediaUrl", "media_url", or "url"',
          400
        );
      }

      // Send media via service
      const result = await whatsappService.sendMediaMessage(
        accountId,
        to,
        mediaType.toLowerCase() as 'image' | 'video' | 'audio' | 'document',
        mediaUrl,
        caption,
        conversationId,
        req.user?.organizationId,
        req.body.tempId || req.body.localId,
        req.body.clientMsgId || req.body.client_msg_id
      );

      console.log('✅ Media message sent successfully:', {
        messageId: result?.messageId || 'N/A',
      });

      return successResponse(res, {
        data: result,
        message: 'Media message sent successfully',
      });
    } catch (error: any) {
      console.error('❌ Send media error:', {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
      });
      return errorResponse(res, error.message || 'Failed to send media', 400);
    }
  }

  /**
   * ✅ FIXED: Mark Message as Read
   */
  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      // Support multiple field name formats
      const accountId = req.body.accountId || req.body.whatsappAccountId;
      const messageId = req.body.messageId || req.body.message_id || req.body.wamId;

      console.log('👁️ Mark as Read Request:', {
        accountId: accountId ? `${accountId.substring(0, 8)}...` : null,
        messageId,
      });

      if (!accountId) {
        return errorResponse(
          res,
          'Account ID is required. Send as "accountId" or "whatsappAccountId"',
          400
        );
      }

      if (!messageId) {
        return errorResponse(
          res,
          'Message ID is required. Send as "messageId", "message_id", or "wamId"',
          400
        );
      }

      const result = await whatsappService.markAsRead(accountId, messageId);

      return successResponse(res, {
        data: result,
        message: 'Message marked as read',
      });
    } catch (error: any) {
      console.error('❌ Mark as read error:', error.message);
      next(error);
    }
  }
}

// ============================================
// EXPORT
// ============================================

export const whatsappController = new WhatsAppController();
export default whatsappController;