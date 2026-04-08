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
      const organizationId = req.user?.organizationId || (req.query.organizationId as string) || (req.query.orgId as string);
      const mediaId = req.params.mediaId;
      let mediaUrl = req.query.url as string;

      if (!mediaId && !mediaUrl) {
        return res.status(400).json({ error: 'Media ID or URL is required' });
      }

      const searchOrgId = organizationId;

      let accessToken: string | null = null;
      let accountId: string | null = null;

      // Try WhatsAppAccount first
      const account = await prisma.whatsAppAccount.findFirst({
        where: searchOrgId ? {
          organizationId: searchOrgId,
          isActive: true
        } : {
          isActive: true
        },
        select: {
          id: true,
          accessToken: true,
        },
      });

      if (account?.accessToken) {
        const { safeDecryptStrict } = await import('../../utils/encryption');
        try {
            accessToken = safeDecryptStrict(account.accessToken);
            accountId = account.id;
        } catch (e) {
            console.error('Failed to decrypt WhatsAppAccount token in getMedia', e);
        }
      }

      // Fallback to MetaConnection
      if (!accessToken) {
          const mConnection = await prisma.metaConnection.findFirst({
              where: searchOrgId ? { organizationId: searchOrgId } : undefined
          });
          if (mConnection?.accessToken) {
              const { safeDecryptStrict } = await import('../../utils/encryption');
              try {
                  accessToken = safeDecryptStrict(mConnection.accessToken);
              } catch (e) {
                  console.error('Failed to decrypt MetaConnection token in getMedia', e);
              }
          }
      }

      if (!accessToken) {
        return res.status(404).json({ error: 'No active WhatsApp account or access token found' });
      }

      const { config } = await import('../../config');
      const version = config.meta?.graphApiVersion || 'v22.0';

      // Determine the actual download URL to stream
      // Priority: explicit ?url= param > mediaId param > mediaUrl stored in DB (which may be a numeric ID)
      let downloadUrl: string | null = null;

      if (mediaUrl && mediaUrl.startsWith('http')) {
        // Already a full URL — use directly
        downloadUrl = mediaUrl;
      } else {
        // We have a media ID (either from :mediaId param or from DB as ?url=numericId)
        // Always fetch a fresh signed URL from Meta — stored CDN URLs expire in ~5 minutes
        const idToFetch = (typeof mediaId === 'string' && !mediaId.startsWith('http')) ? mediaId : mediaUrl;
        if (!idToFetch) {
          return res.status(400).json({ error: 'No valid media ID or URL provided' });
        }

        console.log(`🔄 Fetching fresh media URL from Meta for ID: ${idToFetch}`);
        const mediaInfoResponse = await axios.get(
          `https://graph.facebook.com/${version}/${idToFetch}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        downloadUrl = mediaInfoResponse.data?.url;
      }

      if (!downloadUrl) {
        return res.status(404).json({ error: 'Media not found or expired' });
      }

      // Download and stream media to client
      const mediaResponse = await axios.get(downloadUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: 'stream',
        timeout: 30000,
      });

      // Step 3: Set response headers
      const contentType = mediaResponse.headers['content-type'] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24 hours
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Step 4: Pipe the media stream to response
      mediaResponse.data.pipe(res);

    } catch (error: any) {
      console.error('Error proxying media:', error.response?.data || error.message);

      // Return placeholder for failed images
      const acceptQuery = req.query.accept as string | undefined;
      if (req.headers.accept?.includes('image') || acceptQuery?.includes('image')) {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(`
          <svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
            <rect fill="#f3f4f6" width="200" height="150"/>
            <text x="100" y="75" text-anchor="middle" fill="#9ca3af" font-size="12">Media unavailable</text>
          </svg>
        `);
      } else {
        res.status(500).json({ error: 'Failed to load media' });
      }
    }
  }
}

export const inboxController = new InboxController();