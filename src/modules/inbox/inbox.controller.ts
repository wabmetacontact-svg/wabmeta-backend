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
import fs from 'fs';
import path from 'path';

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
      const { mediaType, mediaUrl, caption } = req.body;

      console.log('📸 sendMediaMessage:', { mediaType, mediaUrl, id });

      if (!mediaType || !mediaUrl) {
        throw new AppError('mediaType and mediaUrl are required', 400);
      }

      const conversation = await inboxService.getConversationById(organizationId, id);
      const account = await whatsappService.getDefaultAccount(organizationId);
      
      if (!account?.id) {
        throw new AppError('No WhatsApp account connected', 400);
      }

      // ✅ whatsappService.sendMessage directly call karo
      // sendMediaMessage wrapper use mat karo
      const result = await whatsappService.sendMessage({
        accountId: account.id,
        to: conversation.contact.phone,
        type: mediaType as any,
        content: {
          [mediaType]: {
            link: mediaUrl,
            ...(caption ? { caption } : {}),
          },
        },
        conversationId: id,
        organizationId,
        tempId: (req.body.tempId || req.body.localId || req.body.local_id || req.body._id) as string,
        clientMsgId: (req.body.clientMsgId || req.body.client_msg_id || req.body.clientMsgId) as string,
        mediaUrl: mediaUrl as string,
      });

      await inboxService.clearCache(organizationId);

      // ✅ Serialize response
      const msg = result.message as any;
      const now = new Date().toISOString();

      const serialized = {
        ...msg,
        createdAt: msg?.createdAt instanceof Date 
          ? msg.createdAt.toISOString() : msg?.createdAt || now,
        timestamp: msg?.timestamp instanceof Date 
          ? msg.timestamp.toISOString() : msg?.timestamp || now,
        sentAt: msg?.sentAt instanceof Date 
          ? msg.sentAt.toISOString() : msg?.sentAt || now,
      };

      return sendSuccess(res, { message: serialized }, 'Media sent', 201);

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
      const mediaId = req.params.mediaId as string;
      const urlQuery = req.query.url;
      const mediaUrlParam = (Array.isArray(urlQuery) ? urlQuery[0] : urlQuery) as string;
      const idToFetch = ((mediaId || mediaUrlParam) as string)?.trim();

      console.log('📸 getMedia:', { idToFetch });

      if (!idToFetch || idToFetch === 'proxy') {
        return res.status(400).json({ error: 'Media ID required' });
      }

      // ✅ Local uploads - direct serve
      if (idToFetch.startsWith('/uploads/') || idToFetch.includes('uploads/media/')) {
        const filePath = path.join(
          process.cwd(),
          idToFetch.startsWith('/') ? idToFetch : `/${idToFetch}`
        );
        
        if (fs.existsSync(filePath)) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.sendFile(filePath);
        }
        return this.sendMediaPlaceholder(res, 'Local file not found');
      }

      // ✅ Non-Meta HTTP URL - redirect
      if (
        idToFetch.startsWith('http') &&
        !idToFetch.includes('lookaside.fbsbx.com') &&
        !idToFetch.includes('mmg.whatsapp.net') &&
        !idToFetch.includes('fbcdn.net') &&
        !idToFetch.includes('scontent')
      ) {
        return res.redirect(302, idToFetch);
      }

      // ============================================
      // ✅ HARDCODED ACCOUNT - Direct se token lo
      // Only one account hai system mein
      // ============================================
      
      // Step 1: Is mediaId se message ka account dhundo
      let accessToken: string | null = null;
      let phoneNumberId: string | null = null;

      if (/^\d+$/.test(idToFetch)) {
        
        // ✅ Message se directly account dhundo
        const message = await prisma.message.findFirst({
          where: {
            OR: [
              { mediaId: idToFetch },
              { mediaUrl: idToFetch },
            ],
          },
          select: {
            id: true,
            whatsappAccountId: true,
            conversationId: true,
          },
        });

        console.log('🔍 Message found:', message?.id, '| AccountId:', message?.whatsappAccountId);

        // ✅ Specific account se token lo
        if (message?.whatsappAccountId) {
          const account = await prisma.whatsAppAccount.findUnique({
            where: { id: message.whatsappAccountId },
            select: { 
              accessToken: true, 
              phoneNumberId: true,
              id: true,
            },
          });

          if (account?.accessToken) {
            try {
              const { safeDecryptStrict } = await import('../../utils/encryption');
              const decrypted = safeDecryptStrict(account.accessToken);
              if (decrypted) {
                accessToken = decrypted;
                phoneNumberId = account.phoneNumberId;
                console.log('✅ Token from message account:', account.id);
                console.log('✅ PhoneNumberId:', phoneNumberId);
                console.log('✅ Token preview:', decrypted.substring(0, 15) + '...');
              }
            } catch (decryptErr: any) {
              console.error('❌ Decrypt failed:', decryptErr.message);
            }
          }
        }

        // ✅ Fallback: Org ki koi bhi active account
        if (!accessToken) {
          const orgId = req.user?.organizationId 
                     || (req.query.organizationId as string)
                     || 'cmn1m8f7n0096kfj8dflnhoyv'; // Fallback hardcoded

          console.log('🔍 Fallback: searching accounts for org:', orgId);

          const accounts = await prisma.whatsAppAccount.findMany({
            where: { 
              organizationId: orgId,
              isActive: true,
              status: 'CONNECTED',
            },
            select: { 
              id: true,
              accessToken: true, 
              phoneNumberId: true,
            },
            orderBy: { updatedAt: 'desc' },
          });

          console.log(`🔍 Found ${accounts.length} accounts`);

          for (const acc of accounts) {
            if (!acc.accessToken) continue;
            
            try {
              const { safeDecryptStrict } = await import('../../utils/encryption');
              const decrypted = safeDecryptStrict(acc.accessToken);
              
              console.log('🔑 Decrypted token preview:', decrypted?.substring(0, 15));
              
              if (decrypted && decrypted.length > 50) {
                accessToken = decrypted;
                phoneNumberId = acc.phoneNumberId;
                console.log('✅ Using fallback account:', acc.id);
                break;
              }
            } catch (e: any) {
              console.error('❌ Decrypt error for account:', acc.id, e.message);
              continue;
            }
          }
        }

        // ✅ Last resort: MetaConnection
        if (!accessToken) {
          const orgId = req.user?.organizationId || 'cmn1m8f7n0096kfj8dflnhoyv';
          
          const metaConn = await prisma.metaConnection.findFirst({
            where: { organizationId: orgId },
            select: { accessToken: true },
            orderBy: { updatedAt: 'desc' },
          });

          if (metaConn?.accessToken) {
            try {
              const { safeDecryptStrict } = await import('../../utils/encryption');
              const decrypted = safeDecryptStrict(metaConn.accessToken);
              if (decrypted && decrypted.length > 50) {
                accessToken = decrypted;
                console.log('✅ Using MetaConnection token');
              }
            } catch (e) {}
          }
        }
      }

      console.log('🔐 Final token status:', accessToken ? `Found (${accessToken.substring(0, 10)}...)` : 'NOT FOUND');
      console.log('📞 PhoneNumberId:', phoneNumberId);

      if (!accessToken) {
        console.error('❌ No access token found after all attempts');
        return this.sendMediaPlaceholder(res, 'Authentication failed');
      }

      // ============================================
      // ✅ Fetch from Meta Graph API
      // ============================================
      const version = 'v22.0';
      let downloadUrl: string | null = null;

      if (/^\d+$/.test(idToFetch)) {
        console.log(`🔄 Calling Meta API: graph.facebook.com/${version}/${idToFetch}`);

        try {
          const metaRes = await axios.get(
            `https://graph.facebook.com/${version}/${idToFetch}`,
            {
              headers: { 
                Authorization: `Bearer ${accessToken}`,
              },
              timeout: 15000,
            }
          );

          console.log('✅ Meta API response:', {
            url: metaRes.data?.url ? 'present' : 'missing',
            mimeType: metaRes.data?.mime_type,
            fileSize: metaRes.data?.file_size,
          });

          downloadUrl = metaRes.data?.url;

        } catch (e: any) {
          const errData = e.response?.data?.error;
          console.error('❌ Meta API failed:', {
            httpStatus: e.response?.status,
            code: errData?.code,
            subcode: errData?.error_subcode,
            message: errData?.message,
            tokenUsed: accessToken.substring(0, 20) + '...',
          });

          // ✅ Subcode 33 = Media expired (>30 days) ya wrong token
          if (errData?.error_subcode === 33) {
            console.error('💡 DIAGNOSIS: Media ID invalid/expired OR wrong token');
            console.error('💡 Token starts with:', accessToken.substring(0, 10));
            console.error('💡 Expected EAA... token format');
          }

          return this.sendMediaPlaceholder(
            res, 
            errData?.error_subcode === 33 
              ? 'Media expired (>30 days old)' 
              : errData?.message || 'Meta API error'
          );
        }

      } else if (idToFetch.startsWith('http')) {
        downloadUrl = idToFetch;
      }

      if (!downloadUrl) {
        console.error('❌ No download URL obtained');
        return this.sendMediaPlaceholder(res, 'No download URL');
      }

      // ============================================
      // ✅ Stream media to client
      // ============================================
      console.log('📥 Downloading from CDN...');

      const mediaRes = await axios.get(downloadUrl, {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: 'stream',
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024, // 50MB max
      });

      const contentType = mediaRes.headers['content-type'] || 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      if (mediaRes.headers['content-length']) {
        res.setHeader('Content-Length', mediaRes.headers['content-length']);
      }

      // Handle stream errors
      req.on('close', () => {
        mediaRes.data.destroy();
      });

      mediaRes.data.on('error', (err: any) => {
        console.error('❌ Media stream error:', err.message);
        if (!res.headersSent) {
          res.status(500).end();
        }
      });

      mediaRes.data.pipe(res);
      console.log(`✅ Streaming ${contentType} to client`);

    } catch (error: any) {
      console.error('❌ getMedia fatal error:', {
        message: error.message,
        stack: error.stack?.split('\n')[1],
      });
      return this.sendMediaPlaceholder(res, error.message);
    }
  }

  private sendMediaPlaceholder(res: Response, reason?: string) {
    if (!res.headersSent) {
      console.warn('⚠️ Sending placeholder. Reason:', reason);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache, no-store');
      res.status(200).send(`
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="150">
          <rect fill="#1f2937" width="200" height="150" rx="8"/>
          <text x="100" y="60" text-anchor="middle" fill="#6b7280" 
                font-size="28">🖼️</text>
          <text x="100" y="90" text-anchor="middle" fill="#9ca3af" 
                font-size="11" font-family="sans-serif">
            Media unavailable
          </text>
          <text x="100" y="110" text-anchor="middle" fill="#4b5563" 
                font-size="9" font-family="sans-serif">
            ${(reason || '').substring(0, 35)}
          </text>
        </svg>
      `);
    }
  }

  // ==========================================
  // DELETE MESSAGE
  // DELETE /inbox/conversations/:id/messages/:messageId
  // ==========================================
  async deleteMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);
      const { id, messageId } = req.params as { id: string; messageId: string };
      const result = await inboxService.deleteMessage(organizationId, id, messageId);
      return sendSuccess(res, result, 'Message deleted');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // EDIT MESSAGE
  // PATCH /inbox/conversations/:id/messages/:messageId
  // body: { content: string }
  // ==========================================
  async editMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);
      const { id, messageId } = req.params as { id: string; messageId: string };
      const { content } = req.body;
      if (!content?.trim()) throw new AppError('Content is required', 400);
      const updated = await inboxService.editMessage(organizationId, id, messageId, content.trim());
      return sendSuccess(res, updated, 'Message updated');
    } catch (error) {
      next(error);
    }
  }
}

export const inboxController = new InboxController();