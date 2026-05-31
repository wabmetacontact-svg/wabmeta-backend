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
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

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
      const labels = await inboxService.getAllLabels(organizationId);
      return sendSuccess(res, labels, 'Labels fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // CREATE CUSTOM LABEL
  async createCustomLabel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { label } = req.body;
      if (!label || typeof label !== 'string' || label.trim() === '') {
        throw new AppError('label is required and must be a string', 400);
      }
      const result = await inboxService.createCustomLabel(organizationId, label.trim());
      return sendSuccess(res, result, 'Label created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // DELETE CUSTOM LABEL
  async deleteCustomLabel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { label } = req.params;
      await inboxService.deleteCustomLabel(organizationId, label);
      return sendSuccess(res, null, 'Label deleted successfully');
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
  // ✅ NEW: TYPING INDICATOR
  // POST /inbox/conversations/:id/typing
  // ==========================================
  async sendTypingIndicator(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };

      // Ensure conversation belongs to org
      await inboxService.getConversationById(organizationId, id);

      const result = await whatsappService.sendTypingIndicator(id);
      
      if (!result.success) {
         // We don't want to throw an error and crash the UI just because typing failed (e.g. no incoming message)
         return sendSuccess(res, null, `Typing indicator not sent: ${result.reason || result.error}`);
      }

      return sendSuccess(res, null, 'Typing indicator sent');
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

      let finalFilename = req.file.filename;
      let finalMime = req.file.mimetype || '';
      let finalSize = req.file.size;
      const originalExt = req.file.originalname.split('.').pop()?.toLowerCase() || '';

      const audioExtensions = ['webm', 'ogg', 'm4a', 'mp3', 'aac', 'amr'];
      if (audioExtensions.includes(originalExt)) {
        console.log(`🎵 Audio detected (${originalExt}), transcoding to OGG/Opus...`);
        const inputPath = req.file.path;
        finalFilename = `${req.file.filename.split('.')[0] || Date.now()}_converted.ogg`;
        const outputPath = path.join(path.dirname(inputPath), finalFilename);

        try {
          await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
              .audioCodec('libopus')
              .toFormat('ogg')
              .on('error', (err: any) => reject(err))
              .on('end', () => resolve(true))
              .save(outputPath);
          });
          
          finalMime = 'audio/ogg; codecs=opus';
          
          // Optionally get new size
          if (fs.existsSync(outputPath)) {
             const stats = fs.statSync(outputPath);
             finalSize = stats.size;
          }
          console.log(`✅ Audio successfully transcoded to: ${finalFilename}`);
        } catch (err: any) {
          console.error('❌ FFmpeg conversion failed:', err.message);
          // Fallback to original
          if (originalExt === 'webm' || originalExt === 'ogg') finalMime = 'audio/ogg; codecs=opus';
          else if (originalExt === 'm4a') finalMime = 'audio/mp4';
          else if (originalExt === 'mp3') finalMime = 'audio/mpeg';
        }
      }

      const url = `${proto}://${host}/uploads/media/${finalFilename}`;

      const mediaType =
        finalMime.startsWith('image/') ? 'image'
          : finalMime.startsWith('video/') ? 'video'
            : finalMime.startsWith('audio/') ? 'audio'
              : 'document';

      return sendSuccess(
        res,
        {
          url,
          mediaType,
          mimeType: finalMime,
          filename: req.file.originalname,
          size: finalSize,
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
      const { mediaUrl, caption } = req.body;
      
      let finalMediaType = req.body.mediaType;

      // Auto-detect proper type from URL extension
      const ext = mediaUrl?.split('.').pop()?.toLowerCase() || '';
      if (['webm', 'ogg', 'mp3', 'm4a', 'aac', 'amr'].includes(ext)) {
        finalMediaType = 'audio'; // Force audio type
      }

      console.log('📸 sendMediaMessage:', { mediaType: finalMediaType, mediaUrl, id });

      if (!finalMediaType || !mediaUrl) {
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
        type: finalMediaType as any,
        content: {
          [finalMediaType]: {
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

  // ==========================================
  // ✅ NEW: RESOLVE TEMPLATE MEDIA
  // POST /inbox/template/resolve-media
  // body: { templateId, phoneNumberId, accessToken }
  // ==========================================
  async resolveTemplateMedia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { templateId } = req.body;
      if (!templateId) throw new AppError('templateId is required', 400);

      // ── Template fetch karo ───────────────────────────────────────
      const template = await prisma.template.findFirst({
        where: { id: templateId, organizationId },
      });

      if (!template) throw new AppError('Template not found', 404);

      const headerType = (template.headerType || '').toUpperCase();

      // Media template nahi hai
      if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
        return sendSuccess(res, { mediaId: null, mediaUrl: null }, 'No media header');
      }

      const mediaId = (template as any).headerMediaId as string | null;
      const mediaUrl = (template as any).headerContent as string | null;

      // ── Priority 1: Numeric ID already hai ───────────────────────
      if (mediaId && /^\d+$/.test(mediaId)) {
        console.log('✅ Template has valid numeric mediaId:', mediaId);
        return sendSuccess(res, {
          mediaId,
          mediaUrl,
          source: 'cached_numeric_id',
        }, 'Media resolved');
      }

      // ── Priority 2: Cloudinary URL se re-upload karo ─────────────
      const cloudinaryUrl =
        (mediaUrl && mediaUrl.startsWith('http') && !mediaUrl.includes('scontent')
          ? mediaUrl : null) ||
        (mediaId && mediaId.startsWith('http') && !mediaId.includes('scontent')
          ? mediaId : null);

      if (!cloudinaryUrl) {
        throw new AppError(
          `Template "${template.name}" has no valid media. ` +
          `Please re-upload the ${headerType.toLowerCase()} in Templates.`,
          400
        );
      }

      // ── WhatsApp account dhundo ───────────────────────────────────
      const waAccount = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, status: 'CONNECTED' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      if (!waAccount) throw new AppError('No connected WhatsApp account', 400);

      const { safeDecryptStrict } = await import('../../utils/encryption');
      const accessToken = waAccount.accessToken ? safeDecryptStrict(waAccount.accessToken) : null;
      if (!accessToken) throw new AppError('Invalid access token', 400);

      const phoneNumberId = waAccount.phoneNumberId;
      if (!phoneNumberId) throw new AppError('Phone number ID missing in WhatsApp account', 400);

      // ── MIME detect karo ─────────────────────────────────────────
      const detectMime = (url: string, type: string): string => {
        const urlPath = url.split('?')[0].toLowerCase();

        // Extension check
        const extMatch = urlPath.match(/\.([a-z0-9]+)$/i);
        if (extMatch) {
          const extMap: Record<string, string> = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg',
            png: 'image/png', webp: 'image/webp',
            mp4: 'video/mp4', '3gp': 'video/3gpp',
            pdf: 'application/pdf',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ppt: 'application/vnd.ms-powerpoint',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            txt: 'text/plain', mp3: 'audio/mpeg',
            ogg: 'audio/ogg', aac: 'audio/aac',
          };
          if (extMap[extMatch[1]]) return extMap[extMatch[1]];
        }

        // Cloudinary path check
        if (urlPath.includes('/image/upload/')) return 'image/jpeg';
        if (urlPath.includes('/video/upload/')) return 'video/mp4';
        if (urlPath.includes('/raw/upload/')) return 'application/pdf';

        // Header type fallback
        const defaults: Record<string, string> = {
          IMAGE: 'image/jpeg', VIDEO: 'video/mp4',
          DOCUMENT: 'application/pdf', AUDIO: 'audio/mpeg',
        };
        return defaults[type] || 'application/pdf';
      };

      const buildFilename = (url: string, mime: string): string => {
        const seg = url.split('?')[0].split('/').pop() || 'media';
        if (/\.[a-zA-Z0-9]{2,5}$/.test(seg)) return seg;

        const mimeExt: Record<string, string> = {
          'image/jpeg': 'jpg', 'image/png': 'png',
          'image/webp': 'webp', 'video/mp4': 'mp4',
          'video/3gpp': '3gp', 'application/pdf': 'pdf',
          'application/msword': 'doc',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
          'application/vnd.ms-excel': 'xls',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
          'audio/mpeg': 'mp3', 'audio/ogg': 'ogg',
          'audio/aac': 'aac',
        };
        return `${seg}.${mimeExt[mime] || 'bin'}`;
      };

      // ── Download from Cloudinary ──────────────────────────────────
      console.log('⬇️ Downloading from Cloudinary:', cloudinaryUrl.substring(0, 60));
      const preMime = detectMime(cloudinaryUrl, headerType);
      const preFilename = buildFilename(cloudinaryUrl, preMime);

      const dlResponse = await axios.get(cloudinaryUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'User-Agent': 'WabMeta/1.0', 'Accept': '*/*' },
      });

      const buffer = Buffer.from(dlResponse.data);

      // Validate response MIME
      const INVALID_MIMES = [
        'application/octet-stream', 'binary/octet-stream',
        'application/binary', 'application/unknown',
      ];
      const META_VALID_MIMES = [
        'image/jpeg', 'image/png', 'image/webp',
        'video/mp4', 'video/3gpp',
        'audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr',
        'audio/ogg', 'audio/opus', 'application/pdf',
        'application/msword', 'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
      ];

      const rawCT = (dlResponse.headers['content-type'] || '').split(';')[0].trim();
      const finalMime = (rawCT && !INVALID_MIMES.includes(rawCT) && META_VALID_MIMES.includes(rawCT))
        ? rawCT
        : preMime;

      const finalFilename = buildFilename(cloudinaryUrl, finalMime);

      console.log('📤 Uploading to Meta:', { mimeType: finalMime, filename: finalFilename, size: buffer.length });

      // ── Upload to Meta ────────────────────────────────────────────
      const { metaApi } = await import('../meta/meta.api');
      const uploadResult = await metaApi.uploadMedia(
        phoneNumberId,
        accessToken,
        buffer,
        finalMime,
        finalFilename,
      );

      const freshMediaId = uploadResult.id;
      console.log('✅ Fresh mediaId:', freshMediaId);

      // ── Cache in DB ───────────────────────────────────────────────
      await prisma.template.update({
        where: { id: template.id },
        data: { headerMediaId: freshMediaId },
      }).catch((e: any) => console.warn('⚠️ Cache update failed:', e.message));

      return sendSuccess(res, {
        mediaId: freshMediaId,
        mediaUrl: cloudinaryUrl,
        source: 'fresh_upload',
      }, 'Media resolved and uploaded');

    } catch (error: any) {
      console.error('❌ resolveTemplateMedia error:', error.message);
      next(error);
    }
  }
}

export const inboxController = new InboxController();