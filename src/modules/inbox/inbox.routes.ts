// src/modules/inbox/inbox.routes.ts - COMPLETE (existing + media + pin)

import { Router, Request } from 'express';
import { authenticate } from '../../middleware/auth';
import { inboxController } from './inbox.controller';

import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

// ==========================================
// PUBLIC MEDIA PROXY (Used for showing images in UI)
// ==========================================
router.get('/media/:mediaId', (req, res, next) =>
  inboxController.getMedia(req as any, res, next)
);

router.get('/media-proxy', (req, res, next) =>
  inboxController.getMedia(req as any, res, next)
);

router.use(authenticate);

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

const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB
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