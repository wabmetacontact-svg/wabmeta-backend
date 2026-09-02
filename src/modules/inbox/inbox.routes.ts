// src/modules/inbox/inbox.routes.ts - COMPLETE (existing + media + pin)

import { Router, Request } from 'express';
import { authenticate } from '../../middleware/auth';
import { featureLock } from '../../middleware/featureLock';
import { inboxController } from './inbox.controller';
import { inboxMediaService } from './inbox.media';
import axios from 'axios';
import prisma from '../../config/database';
import { safeDecryptStrict } from '../../utils/encryption';

import multer from 'multer';
import fs from 'fs';
import path from 'path';

import { gateMutations, OPERATOR_ROLES } from '../../middleware/requireRole';
const router = Router();

// ==========================================
// ✅ Media proxy endpoint
// ==========================================
router.get('/media/:mediaId', authenticate, async (req: any, res: any) => {
  try {
    const { mediaId } = req.params;
    const organizationId = req.user?.organizationId;
    const download = req.query.download === 'true'; // ✅ NEW
    
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!mediaId || !/^\d+$/.test(mediaId)) {
      return res.status(400).json({ error: 'Invalid media ID' });
    }
    
    console.log(`📥 Media proxy request: ${mediaId} for org ${organizationId}`);
    
    // Find message
    const message = await prisma.message.findFirst({
      where: {
        mediaId,
        conversation: { organizationId },
      },
      select: {
        mediaUrl: true,
        mediaMimeType: true,
        fileName: true,
        metadata: true,
        // Media id us WABA/app se bandhi hoti hai jisne wo receive ki thi,
        // isliye uska token chahiye - kisi bhi org account ka nahi
        whatsappAccountId: true,
        createdAt: true,
      },
    });
    
    const meta = (message?.metadata as any) || {};
    const cloudinaryUrl = meta.cloudinaryUrl || 
                         (message?.mediaUrl?.includes('cloudinary.com') 
                           ? message.mediaUrl 
                           : null);
    
    // ✅ FIX: If Cloudinary URL exists, PROXY it (don't redirect)
    // This avoids Cloudinary PDF issues
    if (cloudinaryUrl) {
      try {
        console.log(`☁️ Fetching from Cloudinary: ${mediaId}`);
        const response = await axios.get(cloudinaryUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
        });
        
        const mimeType = message?.mediaMimeType || 
                        response.headers['content-type'] || 
                        'application/octet-stream';
        
        const fileName = message?.fileName || `file_${mediaId}`;
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader(
          'Content-Disposition',
          download 
            ? `attachment; filename="${fileName}"`
            : `inline; filename="${fileName}"`
        );
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        return res.send(Buffer.from(response.data));
        
      } catch (err: any) {
        console.error('Cloudinary fetch failed, trying Meta:', err.message);
        // Fall through to Meta fetch
      }
    }
    
    // Meta media sirf ~30 din rakhta hai. Us se purane message ka backup
    // agar nahi hua to media Meta par bhi nahi hai - us par har baar 1-1.5s
    // ka round trip lagana bekaar hai (ek purani chat kholne par 8-10 aise
    // calls ek saath jaati thi, sab 404). Seedha bata do.
    if (message?.createdAt) {
      const ageDays =
        (Date.now() - new Date(message.createdAt).getTime()) / 86400000;

      if (ageDays > 30) {
        console.log(
          `⌛ Media ${mediaId} is ${Math.floor(ageDays)} days old and was never backed up - expired on Meta`
        );
        return res.status(410).json({
          success: false,
          error: 'MEDIA_EXPIRED',
          message:
            'This media is no longer available. WhatsApp only stores media for 30 days.',
        });
      }
    }

    // ✅ Step 3: Meta se fetch karo
    let accessToken: string | null = null;

    // Pehle wahi account jispe ye message aaya tha. Pehle yahan seedha
    // findFirst({ organizationId, isActive }) tha - yaani org ka *koi bhi*
    // account. Jis org ke ek se zyada WhatsApp accounts hain wahan Meta
    // galat token dekh kar GraphMethodException (code 100, subcode 33) deta
    // tha aur media 404 ho jati thi.
    if (message?.whatsappAccountId) {
      const ownAccount = await prisma.whatsAppAccount.findUnique({
        where: { id: message.whatsappAccountId },
        select: { accessToken: true },
      });
      if (ownAccount?.accessToken) {
        accessToken = safeDecryptStrict(ownAccount.accessToken);
      }
    }

    // Purane messages mein whatsappAccountId na ho to legacy fallback
    if (!accessToken) {
      const account = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, isActive: true },
      });

      if (account?.accessToken) {
        accessToken = safeDecryptStrict(account.accessToken);
      }
    }
    
    if (!accessToken) {
      const connection = await prisma.metaConnection.findFirst({
        where: { organizationId },
      });
      if (connection?.accessToken) {
        accessToken = safeDecryptStrict(connection.accessToken);
      }
    }
    
    if (!accessToken) {
      return res.status(404).json({ error: 'No WhatsApp account configured' });
    }
    
    // Get media URL from Meta
    const mediaUrl = await inboxMediaService.getMediaUrl(mediaId, accessToken);
    
    if (!mediaUrl) {
      return res.status(404).json({ error: 'Media not found on Meta' });
    }
    
    // Download from Meta CDN
    const mediaResponse = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 100 * 1024 * 1024, // 100MB
    });
    
    const mimeType = mediaResponse.headers['content-type'] || 
                     message?.mediaMimeType || 
                     'application/octet-stream';
    
    const fileName = message?.fileName || `file_${mediaId}`;
    
    // ✅ Send to client with proper headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition', 
      download 
        ? `attachment; filename="${fileName}"`
        : `inline; filename="${fileName}"`
    );
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.send(Buffer.from(mediaResponse.data));
    
  } catch (error: any) {
    console.error('Media proxy error:', error.message || error);
    return res.status(500).json({ 
      error: 'Failed to fetch media',
      details: error.message,
    });
  }
});

router.get('/media-proxy', authenticate, (req, res, next) =>
  inboxController.getMedia(req as any, res, next)
);

router.use(authenticate);

// Plan lock. Note: upar registered media routes (/media/:mediaId,
// /media-proxy) jaan-bujh kar iske bahar hain - purani conversations ki
// media locked plan par bhi load hoti rahe.
router.use(featureLock('inbox'));

// Writes are role-gated; reads stay open to every member including VIEWER.
router.use(gateMutations(...OPERATOR_ROLES));

// ==========================================
// MULTER CONFIG (uploads/media)
// ==========================================
const uploadDir = path.join(process.cwd(), 'uploads', 'media');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req: Request, file: any, cb: (error: Error | null, destination: string) => void) => cb(null, uploadDir),
  filename: (req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});

// Only real chat media. Blocks HTML/SVG/JS, which would execute in the browser
// if opened from our own origin (stored XSS).
const ALLOWED_UPLOAD_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'video/mp4', 'video/3gpp', 'video/quicktime', 'video/webm', 'video/x-msvideo',
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/aac', 'audio/amr', 'audio/mp4',
  'audio/m4a', 'audio/x-m4a', 'audio/webm', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/opus',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif',
  'mp4', '3gp', 'mov', 'webm', 'avi',
  'mp3', 'ogg', 'opus', 'aac', 'amr', 'm4a', 'wav',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'zip',
]);

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req: Request, file: any, cb: any) => {
    const rawMime = (file.mimetype || '').toLowerCase();
    const cleanMime = rawMime.split(';')[0].trim();
    const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || '';

    if (ALLOWED_UPLOAD_MIMES.has(cleanMime) || ALLOWED_UPLOAD_MIMES.has(rawMime) || ALLOWED_EXTENSIONS.has(ext)) {
      return cb(null, true);
    }
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

// ==========================================
// MEDIA (REMOVED: Moved to public section)
// ==========================================

// POST /inbox/media/upload
router.post('/media/upload', upload.single('file'), (req, res, next) =>
  inboxController.uploadMedia(req as any, res, next)
);

// POST /inbox/conversations/:id/messages/media
router.post('/conversations/:id/messages/media', (req, res, next) =>
  inboxController.sendMediaMessage(req as any, res, next)
);

// ==========================================
// PIN (NEW)
// ==========================================

// PATCH /inbox/conversations/:id/pin
router.patch('/conversations/:id/pin', (req, res, next) =>
  inboxController.togglePin(req as any, res, next)
);

// POST /inbox/conversations/:id/typing
router.post('/conversations/:id/typing', (req, res, next) =>
  inboxController.sendTypingIndicator(req as any, res, next)
);

// ✅ Template media resolve
router.post('/template/resolve-media', (req, res, next) =>
  inboxController.resolveTemplateMedia(req as any, res, next)
);

// ==========================================
// CONVERSATIONS
// ==========================================

router.get('/conversations', (req, res, next) =>
  inboxController.getConversations(req as any, res, next)
);

router.post('/conversations/start', (req, res, next) =>
  inboxController.startConversation(req as any, res, next)
);

router.get('/conversations/:id', (req, res, next) =>
  inboxController.getConversationById(req as any, res, next)
);

router.put('/conversations/:id', (req, res, next) =>
  inboxController.updateConversation(req as any, res, next)
);

router.delete('/conversations/:id', (req, res, next) =>
  inboxController.deleteConversation(req as any, res, next)
);

// ==========================================
// MARK AS READ
// ==========================================
router.post('/conversations/:id/read', (req, res, next) =>
  inboxController.markAsRead(req as any, res, next)
);

router.put('/conversations/:id/read', (req, res, next) =>
  inboxController.markAsRead(req as any, res, next)
);

router.patch('/conversations/:id/read', (req, res, next) =>
  inboxController.markAsRead(req as any, res, next)
);

// ==========================================
// MESSAGES
// ==========================================
router.get('/conversations/:id/messages', (req, res, next) =>
  inboxController.getMessages(req as any, res, next)
);

router.post('/conversations/:id/messages', (req, res, next) =>
  inboxController.sendMessage(req as any, res, next)
);

// DELETE /inbox/conversations/:id/messages/:messageId
router.delete('/conversations/:id/messages/:messageId', (req, res, next) =>
  inboxController.deleteMessage(req as any, res, next)
);

// PATCH /inbox/conversations/:id/messages/:messageId (edit content)
router.patch('/conversations/:id/messages/:messageId', (req, res, next) =>
  inboxController.editMessage(req as any, res, next)
);

// ==========================================
// ARCHIVE
// ==========================================
router.post('/conversations/:id/archive', (req, res, next) =>
  inboxController.archiveConversation(req as any, res, next)
);

router.post('/conversations/:id/unarchive', (req, res, next) =>
  inboxController.unarchiveConversation(req as any, res, next)
);

router.delete('/conversations/:id/archive', (req, res, next) =>
  inboxController.unarchiveConversation(req as any, res, next)
);

// ==========================================
// ASSIGNMENT
// ==========================================
router.post('/conversations/:id/assign', (req, res, next) =>
  inboxController.assignConversation(req as any, res, next)
);

// ==========================================
// LABELS
// ==========================================
router.get('/labels', (req, res, next) =>
  inboxController.getLabels(req as any, res, next)
);
router.post('/labels', (req, res, next) =>
  inboxController.createCustomLabel(req as any, res, next)
);
router.delete('/labels/:label', (req, res, next) =>
  inboxController.deleteCustomLabel(req as any, res, next)
);

router.post('/conversations/:id/labels', (req, res, next) =>
  inboxController.addLabels(req as any, res, next)
);

router.delete('/conversations/:id/labels/:label', (req, res, next) =>
  inboxController.removeLabel(req as any, res, next)
);

// ==========================================
// BULK
// ==========================================
router.post('/bulk', (req, res, next) =>
  inboxController.bulkUpdate(req as any, res, next)
);

router.post('/bulk-delete', (req, res, next) =>
  inboxController.bulkDelete(req as any, res, next)
);

router.delete('/delete-all', (req, res, next) =>
  inboxController.deleteAll(req as any, res, next)
);

// ==========================================
// SEARCH & STATS
// ==========================================
router.get('/search', (req, res, next) =>
  inboxController.searchMessages(req as any, res, next)
);

router.get('/stats', (req, res, next) =>
  inboxController.getStats(req as any, res, next)
);

export default router;