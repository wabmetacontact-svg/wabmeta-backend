"use strict";
// src/modules/inbox/inbox.routes.ts - COMPLETE (existing + media + pin)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const inbox_controller_1 = require("./inbox.controller");
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
// ==========================================
// PUBLIC MEDIA PROXY (Used for showing images in UI)
// ==========================================
router.get('/media/:mediaId', (req, res, next) => inbox_controller_1.inboxController.getMedia(req, res, next));
router.get('/media-proxy', (req, res, next) => inbox_controller_1.inboxController.getMedia(req, res, next));
router.use(auth_1.authenticate);
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
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 16 * 1024 * 1024 }, // 16MB
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
// ==========================================
// BULK
// ==========================================
router.post('/bulk', (req, res, next) => inbox_controller_1.inboxController.bulkUpdate(req, res, next));
// ==========================================
// SEARCH & STATS
// ==========================================
router.get('/search', (req, res, next) => inbox_controller_1.inboxController.searchMessages(req, res, next));
router.get('/stats', (req, res, next) => inbox_controller_1.inboxController.getStats(req, res, next));
exports.default = router;
//# sourceMappingURL=inbox.routes.js.map