"use strict";
// src/modules/inbox/inbox.routes.ts - COMPLETE (existing + media + pin)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const featureLock_1 = require("../../middleware/featureLock");
const inbox_controller_1 = require("./inbox.controller");
const inbox_media_1 = require("./inbox.media");
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../../config/database"));
const encryption_1 = require("../../utils/encryption");
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const requireRole_1 = require("../../middleware/requireRole");
const router = (0, express_1.Router)();
// ==========================================
// ✅ Media proxy endpoint
// ==========================================
router.get('/media/:mediaId', auth_1.authenticate, async (req, res) => {
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
        const message = await database_1.default.message.findFirst({
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
        const meta = message?.metadata || {};
        const cloudinaryUrl = meta.cloudinaryUrl ||
            (message?.mediaUrl?.includes('cloudinary.com')
                ? message.mediaUrl
                : null);
        // ✅ FIX: If Cloudinary URL exists, PROXY it (don't redirect)
        // This avoids Cloudinary PDF issues
        if (cloudinaryUrl) {
            try {
                console.log(`☁️ Fetching from Cloudinary: ${mediaId}`);
                const response = await axios_1.default.get(cloudinaryUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                });
                const mimeType = message?.mediaMimeType ||
                    response.headers['content-type'] ||
                    'application/octet-stream';
                const fileName = message?.fileName || `file_${mediaId}`;
                res.setHeader('Content-Type', mimeType);
                res.setHeader('Content-Disposition', download
                    ? `attachment; filename="${fileName}"`
                    : `inline; filename="${fileName}"`);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.send(Buffer.from(response.data));
            }
            catch (err) {
                console.error('Cloudinary fetch failed, trying Meta:', err.message);
                // Fall through to Meta fetch
            }
        }
        // Meta media sirf ~30 din rakhta hai. Us se purane message ka backup
        // agar nahi hua to media Meta par bhi nahi hai - us par har baar 1-1.5s
        // ka round trip lagana bekaar hai (ek purani chat kholne par 8-10 aise
        // calls ek saath jaati thi, sab 404). Seedha bata do.
        if (message?.createdAt) {
            const ageDays = (Date.now() - new Date(message.createdAt).getTime()) / 86400000;
            if (ageDays > 30) {
                console.log(`⌛ Media ${mediaId} is ${Math.floor(ageDays)} days old and was never backed up - expired on Meta`);
                return res.status(410).json({
                    success: false,
                    error: 'MEDIA_EXPIRED',
                    message: 'This media is no longer available. WhatsApp only stores media for 30 days.',
                });
            }
        }
        // ✅ Step 3: Meta se fetch karo
        let accessToken = null;
        // Pehle wahi account jispe ye message aaya tha. Pehle yahan seedha
        // findFirst({ organizationId, isActive }) tha - yaani org ka *koi bhi*
        // account. Jis org ke ek se zyada WhatsApp accounts hain wahan Meta
        // galat token dekh kar GraphMethodException (code 100, subcode 33) deta
        // tha aur media 404 ho jati thi.
        if (message?.whatsappAccountId) {
            const ownAccount = await database_1.default.whatsAppAccount.findUnique({
                where: { id: message.whatsappAccountId },
                select: { accessToken: true },
            });
            if (ownAccount?.accessToken) {
                accessToken = (0, encryption_1.safeDecryptStrict)(ownAccount.accessToken);
            }
        }
        // Purane messages mein whatsappAccountId na ho to legacy fallback
        if (!accessToken) {
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { organizationId, isActive: true },
            });
            if (account?.accessToken) {
                accessToken = (0, encryption_1.safeDecryptStrict)(account.accessToken);
            }
        }
        if (!accessToken) {
            const connection = await database_1.default.metaConnection.findFirst({
                where: { organizationId },
            });
            if (connection?.accessToken) {
                accessToken = (0, encryption_1.safeDecryptStrict)(connection.accessToken);
            }
        }
        if (!accessToken) {
            return res.status(404).json({ error: 'No WhatsApp account configured' });
        }
        // Get media URL from Meta
        const mediaUrl = await inbox_media_1.inboxMediaService.getMediaUrl(mediaId, accessToken);
        if (!mediaUrl) {
            return res.status(404).json({ error: 'Media not found on Meta' });
        }
        // Download from Meta CDN
        const mediaResponse = await axios_1.default.get(mediaUrl, {
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
        res.setHeader('Content-Disposition', download
            ? `attachment; filename="${fileName}"`
            : `inline; filename="${fileName}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(Buffer.from(mediaResponse.data));
    }
    catch (error) {
        console.error('Media proxy error:', error.message || error);
        return res.status(500).json({
            error: 'Failed to fetch media',
            details: error.message,
        });
    }
});
router.get('/media-proxy', auth_1.authenticate, (req, res, next) => inbox_controller_1.inboxController.getMedia(req, res, next));
router.use(auth_1.authenticate);
// Plan lock. Note: upar registered media routes (/media/:mediaId,
// /media-proxy) jaan-bujh kar iske bahar hain - purani conversations ki
// media locked plan par bhi load hoti rahe.
router.use((0, featureLock_1.featureLock)('inbox'));
// Writes are role-gated; reads stay open to every member including VIEWER.
router.use((0, requireRole_1.gateMutations)(...requireRole_1.OPERATOR_ROLES));
// ==========================================
// MULTER CONFIG (uploads/media)
// ==========================================
const uploadDir = path_1.default.join(process.cwd(), 'uploads', 'media');
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
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
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    fileFilter: (_req, file, cb) => {
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
router.post('/media/upload', upload.single('file'), (req, res, next) => inbox_controller_1.inboxController.uploadMedia(req, res, next));
// POST /inbox/conversations/:id/messages/media
router.post('/conversations/:id/messages/media', (req, res, next) => inbox_controller_1.inboxController.sendMediaMessage(req, res, next));
// ==========================================
// PIN (NEW)
// ==========================================
// PATCH /inbox/conversations/:id/pin
router.patch('/conversations/:id/pin', (req, res, next) => inbox_controller_1.inboxController.togglePin(req, res, next));
// POST /inbox/conversations/:id/typing
router.post('/conversations/:id/typing', (req, res, next) => inbox_controller_1.inboxController.sendTypingIndicator(req, res, next));
// ✅ Template media resolve
router.post('/template/resolve-media', (req, res, next) => inbox_controller_1.inboxController.resolveTemplateMedia(req, res, next));
// ==========================================
// CONVERSATIONS
// ==========================================
router.get('/conversations', (req, res, next) => inbox_controller_1.inboxController.getConversations(req, res, next));
router.post('/conversations/start', (req, res, next) => inbox_controller_1.inboxController.startConversation(req, res, next));
router.get('/conversations/:id', (req, res, next) => inbox_controller_1.inboxController.getConversationById(req, res, next));
router.put('/conversations/:id', (req, res, next) => inbox_controller_1.inboxController.updateConversation(req, res, next));
router.delete('/conversations/:id', (req, res, next) => inbox_controller_1.inboxController.deleteConversation(req, res, next));
// ==========================================
// MARK AS READ
// ==========================================
router.post('/conversations/:id/read', (req, res, next) => inbox_controller_1.inboxController.markAsRead(req, res, next));
router.put('/conversations/:id/read', (req, res, next) => inbox_controller_1.inboxController.markAsRead(req, res, next));
router.patch('/conversations/:id/read', (req, res, next) => inbox_controller_1.inboxController.markAsRead(req, res, next));
// ==========================================
// MESSAGES
// ==========================================
router.get('/conversations/:id/messages', (req, res, next) => inbox_controller_1.inboxController.getMessages(req, res, next));
router.post('/conversations/:id/messages', (req, res, next) => inbox_controller_1.inboxController.sendMessage(req, res, next));
// DELETE /inbox/conversations/:id/messages/:messageId
router.delete('/conversations/:id/messages/:messageId', (req, res, next) => inbox_controller_1.inboxController.deleteMessage(req, res, next));
// PATCH /inbox/conversations/:id/messages/:messageId (edit content)
router.patch('/conversations/:id/messages/:messageId', (req, res, next) => inbox_controller_1.inboxController.editMessage(req, res, next));
// ==========================================
// ARCHIVE
// ==========================================
router.post('/conversations/:id/archive', (req, res, next) => inbox_controller_1.inboxController.archiveConversation(req, res, next));
router.post('/conversations/:id/unarchive', (req, res, next) => inbox_controller_1.inboxController.unarchiveConversation(req, res, next));
router.delete('/conversations/:id/archive', (req, res, next) => inbox_controller_1.inboxController.unarchiveConversation(req, res, next));
// ==========================================
// ASSIGNMENT
// ==========================================
router.post('/conversations/:id/assign', (req, res, next) => inbox_controller_1.inboxController.assignConversation(req, res, next));
// ==========================================
// LABELS
// ==========================================
router.get('/labels', (req, res, next) => inbox_controller_1.inboxController.getLabels(req, res, next));
router.post('/labels', (req, res, next) => inbox_controller_1.inboxController.createCustomLabel(req, res, next));
router.delete('/labels/:label', (req, res, next) => inbox_controller_1.inboxController.deleteCustomLabel(req, res, next));
router.post('/conversations/:id/labels', (req, res, next) => inbox_controller_1.inboxController.addLabels(req, res, next));
router.delete('/conversations/:id/labels/:label', (req, res, next) => inbox_controller_1.inboxController.removeLabel(req, res, next));
// Human handoff: pause/resume channel automation for a conversation.
router.patch('/conversations/:id/automation', (req, res, next) => inbox_controller_1.inboxController.setAutomationPaused(req, res, next));
// ==========================================
// BULK
// ==========================================
router.post('/bulk', (req, res, next) => inbox_controller_1.inboxController.bulkUpdate(req, res, next));
router.post('/bulk-delete', (req, res, next) => inbox_controller_1.inboxController.bulkDelete(req, res, next));
router.delete('/delete-all', (req, res, next) => inbox_controller_1.inboxController.deleteAll(req, res, next));
// ==========================================
// SEARCH & STATS
// ==========================================
router.get('/search', (req, res, next) => inbox_controller_1.inboxController.searchMessages(req, res, next));
router.get('/stats', (req, res, next) => inbox_controller_1.inboxController.getStats(req, res, next));
// AI-drafted reply suggestion for the agent (human-in-the-loop).
router.post('/conversations/:id/suggest-reply', (req, res, next) => inbox_controller_1.inboxController.suggestReply(req, res, next));
exports.default = router;
//# sourceMappingURL=inbox.routes.js.map