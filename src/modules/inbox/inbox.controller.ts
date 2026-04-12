// src/modules/inbox/inbox.controller.ts - COMPLETE (existing + labels/pin/media)

import { Request, Response, NextFunction } from 'express';
import { inboxService } from './inbox.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import {
  ConversationsQueryInput,
  MessagesQueryInput,
  SendMessageInput,
  UpdateConversationInput,
} from './inbox.types';

import prisma from '../../config/database';
import whatsappService from '../whatsapp/whatsapp.service';
import axios from 'axios';
import { inboxMediaService } from './inbox.media';

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
  file?: any;
}

export class InboxController {
  // ==========================================
  // GET CONVERSATIONS
  // ==========================================
  async getConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const query: ConversationsQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search as string,
        isArchived: req.query.isArchived === 'true',
        isRead:
          req.query.isRead === 'true'
            ? true
            : req.query.isRead === 'false'
              ? false
              : undefined,
        assignedTo: req.query.assignedTo as string,
        labels: req.query.labels ? (req.query.labels as string).split(',') : undefined,
        sortBy: (req.query.sortBy as any) || 'lastMessageAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const result = await inboxService.getConversations(organizationId, query);
      return res.json({
        success: true,
        message: 'Conversations fetched successfully',
        data: result.conversations,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CONVERSATION BY ID
  // ==========================================
  async getConversationById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params as { id: string };
      const conversation = await inboxService.getConversationById(organizationId, id);
      return sendSuccess(res, conversation, 'Conversation fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET MESSAGES
  // ==========================================
  async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params as { id: string };
      const query: MessagesQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        before: req.query.before as string,
        after: req.query.after as string,
      };

      const result = await inboxService.getMessages(organizationId, id, query);
      return sendSuccess(res, result, 'Messages fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SEND MESSAGE (existing)
  // ==========================================
  async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params as { id: string };
      const { content, tempId, clientMsgId } = req.body;

      if (!content) {
        throw new AppError('Message content is required', 400);
      }

      // 1. Get Conversation detail to get contact phone
      const conversation = await inboxService.getConversationById(organizationId, id);

      // 2. Get Default WA Account
      const account = await whatsappService.getDefaultAccount(organizationId);
      if (!account?.id) {
        throw new AppError('No connected WhatsApp account found', 400);
      }

      // 3. Send via WhatsApp Service- using generic sendMessage for consistency
      const result = await whatsappService.sendMessage({
        accountId: account.id,
        to: conversation.contact.phone,
        type: 'text',
        content: { text: { body: content } },
        conversationId: id,
        organizationId: organizationId,
        tempId: tempId || req.body.localId || req.body.local_id || req.body._id,
        clientMsgId: clientMsgId || req.body.client_msg_id || req.body.clientMsgId
      });

      // 4. Clear Inbox Cache
      await inboxService.clearCache(organizationId);

      // ✅ CRITICAL: Serialize dates to ISO strings for JSON response
      const message = result.message;
      const serializedMessage = {
        ...message,
        createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
        timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : (message.timestamp || message.createdAt),
        sentAt: message.sentAt instanceof Date ? message.sentAt.toISOString() : (message.sentAt || null),
        deliveredAt: message.deliveredAt instanceof Date ? message.deliveredAt.toISOString() : (message.deliveredAt || null),
        readAt: message.readAt instanceof Date ? message.readAt.toISOString() : (message.readAt || null),
      };

      return sendSuccess(res, serializedMessage, 'Message sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // MARK AS READ
  // ==========================================
  async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const conversation = await inboxService.markAsRead(organizationId, id);
      return sendSuccess(res, conversation, 'Marked as read');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ARCHIVE / UNARCHIVE
  // ==========================================
  async archiveConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const conversation = await inboxService.archiveConversation(organizationId, id, true);
      return sendSuccess(res, conversation, 'Conversation archived');
    } catch (error) {
      next(error);
    }
  }

  async unarchiveConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const conversation = await inboxService.archiveConversation(organizationId, id, false);
      return sendSuccess(res, conversation, 'Conversation unarchived');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ASSIGN CONVERSATION
  // ==========================================
  async assignConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const { userId } = req.body;
      const conversation = await inboxService.assignConversation(organizationId, id, userId);
      return sendSuccess(res, conversation, 'Conversation assigned');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE CONVERSATION
  // ==========================================
  async updateConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const input: UpdateConversationInput = req.body;
      const conversation = await inboxService.updateConversation(organizationId, id, input);
      return sendSuccess(res, conversation, 'Conversation updated');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ADD LABELS
  // ==========================================
  async addLabels(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const { labels } = req.body;

      if (!Array.isArray(labels)) {
        throw new AppError('labels must be an array', 400);
      }

      const conversation = await inboxService.addLabels(organizationId, id, labels);
      return sendSuccess(res, conversation, 'Labels added');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // REMOVE LABEL
  // ==========================================
  async removeLabel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id, label } = req.params as { id: string; label: string };
      const conversation = await inboxService.removeLabel(organizationId, id, label);
      return sendSuccess(res, conversation, 'Label removed');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DELETE CONVERSATION
  // ==========================================
  async deleteConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const result = await inboxService.deleteConversation(organizationId, id);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // BULK UPDATE
  // ==========================================
  async bulkUpdate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { conversationIds, ...updates } = req.body;
      const result = await inboxService.bulkUpdate(organizationId, conversationIds, updates);
      return sendSuccess(res, result, `${result.updated} conversations updated`);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SEARCH MESSAGES
  // ==========================================
  async searchMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await inboxService.searchMessages(organizationId, query, page, limit);
      return sendSuccess(res, result, 'Search completed');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET STATS
  // ==========================================
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const stats = await inboxService.getStats(organizationId);
      return sendSuccess(res, stats, 'Stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET LABELS
  // ==========================================
  async getLabels(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const labels = await inboxService.getAllLabels(organizationId);
      return sendSuccess(res, labels, 'Labels fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // START CONVERSATION WITH CONTACT
  // ==========================================
  async startConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { contactId } = req.body;
      const conversation = await inboxService.getOrCreateConversation(organizationId, contactId);
      return sendSuccess(res, conversation, 'Conversation ready');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ✅ NEW: PIN/UNPIN CONVERSATION
  // PATCH /inbox/conversations/:id/pin
  // body: { isPinned: boolean }
  // ==========================================
  async togglePin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const { isPinned } = req.body as { isPinned: boolean };

      // Ensure conversation belongs to org
      await inboxService.getConversationById(organizationId, id);

      const updated = await prisma.conversation.update({
        where: { id },
        data: { isPinned: Boolean(isPinned) }, // IDE: restart TS server if this shows an error
      });

      return sendSuccess(res, updated, Boolean(isPinned) ? 'Conversation pinned' : 'Conversation unpinned');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ✅ NEW: UPLOAD MEDIA
  // POST /inbox/media/upload (multipart form-data: file)
  // ==========================================
  async uploadMedia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      if (!req.file) throw new AppError('File is required', 400);

      const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https') as string;
      const host = req.get('host');

      const url = `${proto}://${host}/uploads/media/${req.file.filename}`;

      const mime = req.file.mimetype || '';
      const mediaType =
        mime.startsWith('image/') ? 'image'
          : mime.startsWith('video/') ? 'video'
            : mime.startsWith('audio/') ? 'audio'
              : 'document';

      return sendSuccess(
        res,
        {
          url,
          mediaType,
          mimeType: mime,
          filename: req.file.originalname,
          size: req.file.size,
        },
        'File uploaded',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ✅ NEW: SEND MEDIA MESSAGE
  // POST /inbox/conversations/:id/messages/media
  // body: { mediaType: "image|video|audio|document", mediaUrl: string, caption?: string }
  // ==========================================
  async sendMediaMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const { mediaType, mediaUrl, caption } = req.body as {
        mediaType: 'image' | 'video' | 'audio' | 'document';
        mediaUrl: string;
        caption?: string;
      };

      if (!mediaType || !mediaUrl) throw new AppError('mediaType and mediaUrl are required', 400);

      // Validate conversation
      const conversation = await inboxService.getConversationById(organizationId, id);

      // Use default WA account
      const account = await whatsappService.getDefaultAccount(organizationId);
      if (!account?.id) {
        throw new AppError('No WhatsApp account connected. Please connect WhatsApp first.', 400);
      }

      const result = await whatsappService.sendMediaMessage(
        account.id,
        conversation.contact.phone,
        mediaType,
        mediaUrl,
        caption,
        id,
        organizationId,
        req.body.tempId || req.body.localId || req.body.local_id || req.body._id,
        req.body.clientMsgId || req.body.client_msg_id || req.body.clientMsgId
      );

      // ✅ Clear Inbox Cache
      await inboxService.clearCache(organizationId);

      return sendSuccess(res, result, 'Media message sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ✅ NEW: PROXY WHATSAPP MEDIA
  // GET /inbox/media/:mediaId
  // ==========================================
  async getMedia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const mediaId = req.params.mediaId;
      const urlQuery = req.query.url;
      const mediaUrl = Array.isArray(urlQuery) ? (urlQuery[0] as string) : (urlQuery as string);

      // ✅ Determine what we have
      const idToFetch = (mediaId || mediaUrl) as string;

      if (!idToFetch) {
        return res.status(400).json({ error: 'Media ID required' });
      }

      // ✅ Get organization ID from multiple sources
      const organizationId =
        req.user?.organizationId ||
        ((Array.isArray(req.query.organizationId) ? req.query.organizationId[0] : req.query.organizationId) as string) ||
        ((Array.isArray(req.query.orgId) ? req.query.orgId[0] : req.query.orgId) as string);

      // ✅ Get access token
      let accessToken: string | null = null;

      // Try 1: WhatsAppAccount table
      const accountWhere: any = organizationId
        ? { organizationId, isActive: true }
        : { isActive: true };

      const account = await prisma.whatsAppAccount.findFirst({
        where: accountWhere,
        select: { id: true, accessToken: true },
        orderBy: { createdAt: 'desc' },
      });

      if (account?.accessToken) {
        try {
          const { safeDecryptStrict } = await import('../../utils/encryption');
          accessToken = safeDecryptStrict(account.accessToken);
        } catch (e) {
          console.warn('⚠️ Failed to decrypt WhatsAppAccount token');
        }
      }

      // Try 2: MetaConnection table
      if (!accessToken) {
        const metaWhere: any = organizationId
          ? { organizationId }
          : {};

        const mConn = await prisma.metaConnection.findFirst({
          where: metaWhere,
          orderBy: { createdAt: 'desc' },
        });

        if (mConn?.accessToken) {
          try {
            const { safeDecryptStrict } = await import('../../utils/encryption');
            accessToken = safeDecryptStrict(mConn.accessToken);
          } catch (e) {
            console.warn('⚠️ Failed to decrypt MetaConnection token');
          }
        }
      }

      if (!accessToken) {
        console.error('❌ No access token found for media proxy');
        return res.status(404).json({ error: 'No WhatsApp account found' });
      }

      const { config } = await import('../../config');
      const version = config.meta?.graphApiVersion || 'v22.0';

      let downloadUrl: string | null = null;

      // ✅ Case 1: Already a full HTTP URL
      if (idToFetch.startsWith('http')) {
        downloadUrl = idToFetch;
      } else {
        // ✅ Case 2: It's a Media ID → Fetch fresh URL from Meta
        console.log(`🔄 Fetching fresh media URL for ID: ${idToFetch}`);

        try {
          const mediaInfoRes = await axios.get(
            `https://graph.facebook.com/${version}/${idToFetch}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 10000,
            }
          );

          downloadUrl = mediaInfoRes.data?.url;

          if (!downloadUrl) {
            console.error('❌ No URL in Meta response:', mediaInfoRes.data);
            return this.sendMediaPlaceholder(res, 'No download URL from Meta');
          }

          console.log(`✅ Got fresh download URL`);
        } catch (metaErr: any) {
          console.error(
            '❌ Meta API error:',
            metaErr.response?.data || metaErr.message
          );
          return this.sendMediaPlaceholder(
            res,
            metaErr.response?.data?.error?.message || 'Meta API error'
          );
        }
      }

      if (!downloadUrl) {
        return this.sendMediaPlaceholder(res, 'Media URL not found');
      }

      // ✅ Download and stream media
      console.log(`📥 Downloading media from CDN...`);

      const mediaResponse = await axios.get(downloadUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: 'stream',
        timeout: 30000,
      });

      // ✅ Set proper headers
      const contentType =
        mediaResponse.headers['content-type'] || 'application/octet-stream';
      const contentLength = mediaResponse.headers['content-length'];

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600'); // 1 hour cache
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // ✅ Stream response
      mediaResponse.data.pipe(res);

      mediaResponse.data.on('error', (err: any) => {
        console.error('❌ Stream error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error' });
        }
      });

      console.log(`✅ Media streaming: ${contentType}`);
    } catch (error: any) {
      console.error('❌ getMedia error:', error.message);
      return this.sendMediaPlaceholder(res, error.message);
    }
  }

  // ✅ Helper: Send placeholder SVG for failed images
  private sendMediaPlaceholder(res: Response, reason?: string) {
    console.warn('⚠️ Sending media placeholder. Reason:', reason);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(`
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
        <rect fill="#1f2937" width="200" height="150" rx="8"/>
        <text x="100" y="65" text-anchor="middle" fill="#6b7280" font-size="32">🖼️</text>
        <text x="100" y="95" text-anchor="middle" fill="#6b7280" font-size="11" font-family="sans-serif">
          Media unavailable
        </text>
        <text x="100" y="112" text-anchor="middle" fill="#4b5563" font-size="9" font-family="sans-serif">
          Click retry to reload
        </text>
      </svg>
    `);
  }
}

export const inboxController = new InboxController();