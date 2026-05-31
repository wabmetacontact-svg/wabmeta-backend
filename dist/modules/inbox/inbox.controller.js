"use strict";
// src/modules/inbox/inbox.controller.ts - COMPLETE (existing + labels/pin/media)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboxController = exports.InboxController = void 0;
const inbox_service_1 = require("./inbox.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
const whatsapp_service_1 = __importDefault(require("../whatsapp/whatsapp.service"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_1 = __importDefault(require("@ffmpeg-installer/ffmpeg"));
// Set ffmpeg path
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.default.path);
class InboxController {
    // ==========================================
    // GET CONVERSATIONS
    // ==========================================
    async getConversations(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const query = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
                search: req.query.search,
                isArchived: req.query.isArchived === 'true',
                isRead: req.query.isRead === 'true'
                    ? true
                    : req.query.isRead === 'false'
                        ? false
                        : undefined,
                assignedTo: req.query.assignedTo,
                labels: req.query.labels ? req.query.labels.split(',') : undefined,
                sortBy: req.query.sortBy || 'lastMessageAt',
                sortOrder: req.query.sortOrder || 'desc',
            };
            const result = await inbox_service_1.inboxService.getConversations(organizationId, query);
            return res.json({
                success: true,
                message: 'Conversations fetched successfully',
                data: result.conversations,
                meta: result.meta,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CONVERSATION BY ID
    // ==========================================
    async getConversationById(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { id } = req.params;
            const conversation = await inbox_service_1.inboxService.getConversationById(organizationId, id);
            return (0, response_1.sendSuccess)(res, conversation, 'Conversation fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET MESSAGES
    // ==========================================
    async getMessages(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { id } = req.params;
            const query = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 50,
                before: req.query.before,
                after: req.query.after,
            };
            const result = await inbox_service_1.inboxService.getMessages(organizationId, id, query);
            return (0, response_1.sendSuccess)(res, result, 'Messages fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // SEND MESSAGE (existing)
    // ==========================================
    async sendMessage(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { id } = req.params;
            const { content, tempId, clientMsgId } = req.body;
            if (!content) {
                throw new errorHandler_1.AppError('Message content is required', 400);
            }
            // 1. Get Conversation detail to get contact phone
            const conversation = await inbox_service_1.inboxService.getConversationById(organizationId, id);
            // 2. Get Default WA Account
            const account = await whatsapp_service_1.default.getDefaultAccount(organizationId);
            if (!account?.id) {
                throw new errorHandler_1.AppError('No connected WhatsApp account found', 400);
            }
            // 3. Send via WhatsApp Service- using generic sendMessage for consistency
            const result = await whatsapp_service_1.default.sendMessage({
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
            await inbox_service_1.inboxService.clearCache(organizationId);
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
            return (0, response_1.sendSuccess)(res, serializedMessage, 'Message sent successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // MARK AS READ
    // ==========================================
    async markAsRead(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const conversation = await inbox_service_1.inboxService.markAsRead(organizationId, id);
            return (0, response_1.sendSuccess)(res, conversation, 'Marked as read');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ARCHIVE / UNARCHIVE
    // ==========================================
    async archiveConversation(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const conversation = await inbox_service_1.inboxService.archiveConversation(organizationId, id, true);
            return (0, response_1.sendSuccess)(res, conversation, 'Conversation archived');
        }
        catch (error) {
            next(error);
        }
    }
    async unarchiveConversation(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const conversation = await inbox_service_1.inboxService.archiveConversation(organizationId, id, false);
            return (0, response_1.sendSuccess)(res, conversation, 'Conversation unarchived');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ASSIGN CONVERSATION
    // ==========================================
    async assignConversation(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const { userId } = req.body;
            const conversation = await inbox_service_1.inboxService.assignConversation(organizationId, id, userId);
            return (0, response_1.sendSuccess)(res, conversation, 'Conversation assigned');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // UPDATE CONVERSATION
    // ==========================================
    async updateConversation(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const input = req.body;
            const conversation = await inbox_service_1.inboxService.updateConversation(organizationId, id, input);
            return (0, response_1.sendSuccess)(res, conversation, 'Conversation updated');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ADD LABELS
    // ==========================================
    async addLabels(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const { labels } = req.body;
            if (!Array.isArray(labels)) {
                throw new errorHandler_1.AppError('labels must be an array', 400);
            }
            const conversation = await inbox_service_1.inboxService.addLabels(organizationId, id, labels);
            return (0, response_1.sendSuccess)(res, conversation, 'Labels added');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // REMOVE LABEL
    // ==========================================
    async removeLabel(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id, label } = req.params;
            const conversation = await inbox_service_1.inboxService.removeLabel(organizationId, id, label);
            return (0, response_1.sendSuccess)(res, conversation, 'Label removed');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DELETE CONVERSATION
    // ==========================================
    async deleteConversation(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const result = await inbox_service_1.inboxService.deleteConversation(organizationId, id);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // BULK UPDATE
    // ==========================================
    async bulkUpdate(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { conversationIds, ...updates } = req.body;
            const result = await inbox_service_1.inboxService.bulkUpdate(organizationId, conversationIds, updates);
            return (0, response_1.sendSuccess)(res, result, `${result.updated} conversations updated`);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // SEARCH MESSAGES
    // ==========================================
    async searchMessages(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const searchParams = req.query.search ? String(req.query.search) : undefined;
            const query = req.query.q ? String(req.query.q) : '';
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const result = await inbox_service_1.inboxService.searchMessages(organizationId, query, page, limit);
            return (0, response_1.sendSuccess)(res, result, 'Search completed');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET STATS
    // ==========================================
    async getStats(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const stats = await inbox_service_1.inboxService.getStats(organizationId);
            return (0, response_1.sendSuccess)(res, stats, 'Stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET LABELS
    // ==========================================
    async getLabels(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const labels = await inbox_service_1.inboxService.getAllLabels(organizationId);
            return (0, response_1.sendSuccess)(res, labels, 'Labels fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // CREATE CUSTOM LABEL
    async createCustomLabel(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { label } = req.body;
            if (!label || typeof label !== 'string' || label.trim() === '') {
                throw new errorHandler_1.AppError('label is required and must be a string', 400);
            }
            const result = await inbox_service_1.inboxService.createCustomLabel(organizationId, label.trim());
            return (0, response_1.sendSuccess)(res, result, 'Label created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // DELETE CUSTOM LABEL
    async deleteCustomLabel(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { label } = req.params;
            await inbox_service_1.inboxService.deleteCustomLabel(organizationId, String(label));
            return (0, response_1.sendSuccess)(res, null, 'Label deleted successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // START CONVERSATION WITH CONTACT
    // ==========================================
    async startConversation(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { contactId } = req.body;
            const conversation = await inbox_service_1.inboxService.getOrCreateConversation(organizationId, contactId);
            return (0, response_1.sendSuccess)(res, conversation, 'Conversation ready');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ✅ NEW: PIN/UNPIN CONVERSATION
    // PATCH /inbox/conversations/:id/pin
    // body: { isPinned: boolean }
    // ==========================================
    async togglePin(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const { isPinned } = req.body;
            // Ensure conversation belongs to org
            await inbox_service_1.inboxService.getConversationById(organizationId, id);
            const updated = await database_1.default.conversation.update({
                where: { id },
                data: { isPinned: Boolean(isPinned) }, // IDE: restart TS server if this shows an error
            });
            return (0, response_1.sendSuccess)(res, updated, Boolean(isPinned) ? 'Conversation pinned' : 'Conversation unpinned');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ✅ NEW: TYPING INDICATOR
    // POST /inbox/conversations/:id/typing
    // ==========================================
    async sendTypingIndicator(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            // Ensure conversation belongs to org
            await inbox_service_1.inboxService.getConversationById(organizationId, id);
            const result = await whatsapp_service_1.default.sendTypingIndicator(id);
            if (!result.success) {
                // We don't want to throw an error and crash the UI just because typing failed (e.g. no incoming message)
                return (0, response_1.sendSuccess)(res, null, `Typing indicator not sent: ${result.reason || result.error}`);
            }
            return (0, response_1.sendSuccess)(res, null, 'Typing indicator sent');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ✅ NEW: UPLOAD MEDIA
    // POST /inbox/media/upload (multipart form-data: file)
    // ==========================================
    async uploadMedia(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            if (!req.file)
                throw new errorHandler_1.AppError('File is required', 400);
            const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https');
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
                const outputPath = path_1.default.join(path_1.default.dirname(inputPath), finalFilename);
                try {
                    await new Promise((resolve, reject) => {
                        (0, fluent_ffmpeg_1.default)(inputPath)
                            .audioCodec('libopus')
                            .toFormat('ogg')
                            .on('error', (err) => reject(err))
                            .on('end', () => resolve(true))
                            .save(outputPath);
                    });
                    finalMime = 'audio/ogg; codecs=opus';
                    // Optionally get new size
                    if (fs_1.default.existsSync(outputPath)) {
                        const stats = fs_1.default.statSync(outputPath);
                        finalSize = stats.size;
                    }
                    console.log(`✅ Audio successfully transcoded to: ${finalFilename}`);
                }
                catch (err) {
                    console.error('❌ FFmpeg conversion failed:', err.message);
                    // Fallback to original
                    if (originalExt === 'webm' || originalExt === 'ogg')
                        finalMime = 'audio/ogg; codecs=opus';
                    else if (originalExt === 'm4a')
                        finalMime = 'audio/mp4';
                    else if (originalExt === 'mp3')
                        finalMime = 'audio/mpeg';
                }
            }
            const url = `${proto}://${host}/uploads/media/${finalFilename}`;
            const mediaType = finalMime.startsWith('image/') ? 'image'
                : finalMime.startsWith('video/') ? 'video'
                    : finalMime.startsWith('audio/') ? 'audio'
                        : 'document';
            return (0, response_1.sendSuccess)(res, {
                url,
                mediaType,
                mimeType: finalMime,
                filename: req.file.originalname,
                size: finalSize,
            }, 'File uploaded', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ✅ NEW: SEND MEDIA MESSAGE
    // POST /inbox/conversations/:id/messages/media
    // body: { mediaType: "image|video|audio|document", mediaUrl: string, caption?: string }
    // ==========================================
    async sendMediaMessage(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const { mediaUrl, caption } = req.body;
            let finalMediaType = req.body.mediaType;
            // Auto-detect proper type from URL extension
            const ext = mediaUrl?.split('.').pop()?.toLowerCase() || '';
            if (['webm', 'ogg', 'mp3', 'm4a', 'aac', 'amr'].includes(ext)) {
                finalMediaType = 'audio'; // Force audio type
            }
            console.log('📸 sendMediaMessage:', { mediaType: finalMediaType, mediaUrl, id });
            if (!finalMediaType || !mediaUrl) {
                throw new errorHandler_1.AppError('mediaType and mediaUrl are required', 400);
            }
            const conversation = await inbox_service_1.inboxService.getConversationById(organizationId, id);
            const account = await whatsapp_service_1.default.getDefaultAccount(organizationId);
            if (!account?.id) {
                throw new errorHandler_1.AppError('No WhatsApp account connected', 400);
            }
            // ✅ whatsappService.sendMessage directly call karo
            // sendMediaMessage wrapper use mat karo
            const result = await whatsapp_service_1.default.sendMessage({
                accountId: account.id,
                to: conversation.contact.phone,
                type: finalMediaType,
                content: {
                    [finalMediaType]: {
                        link: mediaUrl,
                        ...(caption ? { caption } : {}),
                    },
                },
                conversationId: id,
                organizationId,
                tempId: (req.body.tempId || req.body.localId || req.body.local_id || req.body._id),
                clientMsgId: (req.body.clientMsgId || req.body.client_msg_id || req.body.clientMsgId),
                mediaUrl: mediaUrl,
            });
            await inbox_service_1.inboxService.clearCache(organizationId);
            // ✅ Serialize response
            const msg = result.message;
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
            return (0, response_1.sendSuccess)(res, { message: serialized }, 'Media sent', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ✅ NEW: PROXY WHATSAPP MEDIA
    // GET /inbox/media/:mediaId
    // ==========================================
    async getMedia(req, res, next) {
        try {
            const mediaId = req.params.mediaId;
            const urlQuery = req.query.url;
            const mediaUrlParam = (Array.isArray(urlQuery) ? urlQuery[0] : urlQuery);
            const idToFetch = (mediaId || mediaUrlParam)?.trim();
            console.log('📸 getMedia:', { idToFetch });
            if (!idToFetch || idToFetch === 'proxy') {
                return res.status(400).json({ error: 'Media ID required' });
            }
            // ✅ Local uploads - direct serve
            if (idToFetch.startsWith('/uploads/') || idToFetch.includes('uploads/media/')) {
                const filePath = path_1.default.join(process.cwd(), idToFetch.startsWith('/') ? idToFetch : `/${idToFetch}`);
                if (fs_1.default.existsSync(filePath)) {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Cache-Control', 'public, max-age=86400');
                    return res.sendFile(filePath);
                }
                return this.sendMediaPlaceholder(res, 'Local file not found');
            }
            // ✅ Non-Meta HTTP URL - redirect
            if (idToFetch.startsWith('http') &&
                !idToFetch.includes('lookaside.fbsbx.com') &&
                !idToFetch.includes('mmg.whatsapp.net') &&
                !idToFetch.includes('fbcdn.net') &&
                !idToFetch.includes('scontent')) {
                return res.redirect(302, idToFetch);
            }
            // ============================================
            // ✅ HARDCODED ACCOUNT - Direct se token lo
            // Only one account hai system mein
            // ============================================
            // Step 1: Is mediaId se message ka account dhundo
            let accessToken = null;
            let phoneNumberId = null;
            if (/^\d+$/.test(idToFetch)) {
                // ✅ Message se directly account dhundo
                const message = await database_1.default.message.findFirst({
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
                    const account = await database_1.default.whatsAppAccount.findUnique({
                        where: { id: message.whatsappAccountId },
                        select: {
                            accessToken: true,
                            phoneNumberId: true,
                            id: true,
                        },
                    });
                    if (account?.accessToken) {
                        try {
                            const { safeDecryptStrict } = await Promise.resolve().then(() => __importStar(require('../../utils/encryption')));
                            const decrypted = safeDecryptStrict(account.accessToken);
                            if (decrypted) {
                                accessToken = decrypted;
                                phoneNumberId = account.phoneNumberId;
                                console.log('✅ Token from message account:', account.id);
                                console.log('✅ PhoneNumberId:', phoneNumberId);
                                console.log('✅ Token preview:', decrypted.substring(0, 15) + '...');
                            }
                        }
                        catch (decryptErr) {
                            console.error('❌ Decrypt failed:', decryptErr.message);
                        }
                    }
                }
                // ✅ Fallback: Org ki koi bhi active account
                if (!accessToken) {
                    const orgId = req.user?.organizationId
                        || req.query.organizationId
                        || 'cmn1m8f7n0096kfj8dflnhoyv'; // Fallback hardcoded
                    console.log('🔍 Fallback: searching accounts for org:', orgId);
                    const accounts = await database_1.default.whatsAppAccount.findMany({
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
                        if (!acc.accessToken)
                            continue;
                        try {
                            const { safeDecryptStrict } = await Promise.resolve().then(() => __importStar(require('../../utils/encryption')));
                            const decrypted = safeDecryptStrict(acc.accessToken);
                            console.log('🔑 Decrypted token preview:', decrypted?.substring(0, 15));
                            if (decrypted && decrypted.length > 50) {
                                accessToken = decrypted;
                                phoneNumberId = acc.phoneNumberId;
                                console.log('✅ Using fallback account:', acc.id);
                                break;
                            }
                        }
                        catch (e) {
                            console.error('❌ Decrypt error for account:', acc.id, e.message);
                            continue;
                        }
                    }
                }
                // ✅ Last resort: MetaConnection
                if (!accessToken) {
                    const orgId = req.user?.organizationId || 'cmn1m8f7n0096kfj8dflnhoyv';
                    const metaConn = await database_1.default.metaConnection.findFirst({
                        where: { organizationId: orgId },
                        select: { accessToken: true },
                        orderBy: { updatedAt: 'desc' },
                    });
                    if (metaConn?.accessToken) {
                        try {
                            const { safeDecryptStrict } = await Promise.resolve().then(() => __importStar(require('../../utils/encryption')));
                            const decrypted = safeDecryptStrict(metaConn.accessToken);
                            if (decrypted && decrypted.length > 50) {
                                accessToken = decrypted;
                                console.log('✅ Using MetaConnection token');
                            }
                        }
                        catch (e) { }
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
            let downloadUrl = null;
            if (/^\d+$/.test(idToFetch)) {
                console.log(`🔄 Calling Meta API: graph.facebook.com/${version}/${idToFetch}`);
                try {
                    const metaRes = await axios_1.default.get(`https://graph.facebook.com/${version}/${idToFetch}`, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                        timeout: 15000,
                    });
                    console.log('✅ Meta API response:', {
                        url: metaRes.data?.url ? 'present' : 'missing',
                        mimeType: metaRes.data?.mime_type,
                        fileSize: metaRes.data?.file_size,
                    });
                    downloadUrl = metaRes.data?.url;
                }
                catch (e) {
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
                    return this.sendMediaPlaceholder(res, errData?.error_subcode === 33
                        ? 'Media expired (>30 days old)'
                        : errData?.message || 'Meta API error');
                }
            }
            else if (idToFetch.startsWith('http')) {
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
            const mediaRes = await axios_1.default.get(downloadUrl, {
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
            mediaRes.data.on('error', (err) => {
                console.error('❌ Media stream error:', err.message);
                if (!res.headersSent) {
                    res.status(500).end();
                }
            });
            mediaRes.data.pipe(res);
            console.log(`✅ Streaming ${contentType} to client`);
        }
        catch (error) {
            console.error('❌ getMedia fatal error:', {
                message: error.message,
                stack: error.stack?.split('\n')[1],
            });
            return this.sendMediaPlaceholder(res, error.message);
        }
    }
    sendMediaPlaceholder(res, reason) {
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
    async deleteMessage(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id, messageId } = req.params;
            const result = await inbox_service_1.inboxService.deleteMessage(organizationId, id, messageId);
            return (0, response_1.sendSuccess)(res, result, 'Message deleted');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // EDIT MESSAGE
    // PATCH /inbox/conversations/:id/messages/:messageId
    // body: { content: string }
    // ==========================================
    async editMessage(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id, messageId } = req.params;
            const { content } = req.body;
            if (!content?.trim())
                throw new errorHandler_1.AppError('Content is required', 400);
            const updated = await inbox_service_1.inboxService.editMessage(organizationId, id, messageId, content.trim());
            return (0, response_1.sendSuccess)(res, updated, 'Message updated');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ✅ NEW: RESOLVE TEMPLATE MEDIA
    // POST /inbox/template/resolve-media
    // body: { templateId, phoneNumberId, accessToken }
    // ==========================================
    async resolveTemplateMedia(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { templateId } = req.body;
            if (!templateId)
                throw new errorHandler_1.AppError('templateId is required', 400);
            // ── Template fetch karo ───────────────────────────────────────
            const template = await database_1.default.template.findFirst({
                where: { id: templateId, organizationId },
            });
            if (!template)
                throw new errorHandler_1.AppError('Template not found', 404);
            const headerType = (template.headerType || '').toUpperCase();
            // Media template nahi hai
            if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
                return (0, response_1.sendSuccess)(res, { mediaId: null, mediaUrl: null }, 'No media header');
            }
            const mediaId = template.headerMediaId;
            const mediaUrl = template.headerContent;
            // ── Priority 1: Numeric ID already hai ───────────────────────
            if (mediaId && /^\d+$/.test(mediaId)) {
                console.log('✅ Template has valid numeric mediaId:', mediaId);
                return (0, response_1.sendSuccess)(res, {
                    mediaId,
                    mediaUrl,
                    source: 'cached_numeric_id',
                }, 'Media resolved');
            }
            // ── Priority 2: Cloudinary URL se re-upload karo ─────────────
            const cloudinaryUrl = (mediaUrl && mediaUrl.startsWith('http') && !mediaUrl.includes('scontent')
                ? mediaUrl : null) ||
                (mediaId && mediaId.startsWith('http') && !mediaId.includes('scontent')
                    ? mediaId : null);
            if (!cloudinaryUrl) {
                throw new errorHandler_1.AppError(`Template "${template.name}" has no valid media. ` +
                    `Please re-upload the ${headerType.toLowerCase()} in Templates.`, 400);
            }
            // ── WhatsApp account dhundo ───────────────────────────────────
            const waAccount = await database_1.default.whatsAppAccount.findFirst({
                where: { organizationId, status: 'CONNECTED' },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
            if (!waAccount)
                throw new errorHandler_1.AppError('No connected WhatsApp account', 400);
            const { safeDecryptStrict } = await Promise.resolve().then(() => __importStar(require('../../utils/encryption')));
            const accessToken = waAccount.accessToken ? safeDecryptStrict(waAccount.accessToken) : null;
            if (!accessToken)
                throw new errorHandler_1.AppError('Invalid access token', 400);
            const phoneNumberId = waAccount.phoneNumberId;
            if (!phoneNumberId)
                throw new errorHandler_1.AppError('Phone number ID missing in WhatsApp account', 400);
            // ── MIME detect karo ─────────────────────────────────────────
            const detectMime = (url, type) => {
                const urlPath = url.split('?')[0].toLowerCase();
                // Extension check
                const extMatch = urlPath.match(/\.([a-z0-9]+)$/i);
                if (extMatch) {
                    const extMap = {
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
                    if (extMap[extMatch[1]])
                        return extMap[extMatch[1]];
                }
                // Cloudinary path check
                if (urlPath.includes('/image/upload/'))
                    return 'image/jpeg';
                if (urlPath.includes('/video/upload/'))
                    return 'video/mp4';
                if (urlPath.includes('/raw/upload/'))
                    return 'application/pdf';
                // Header type fallback
                const defaults = {
                    IMAGE: 'image/jpeg', VIDEO: 'video/mp4',
                    DOCUMENT: 'application/pdf', AUDIO: 'audio/mpeg',
                };
                return defaults[type] || 'application/pdf';
            };
            const buildFilename = (url, mime) => {
                const seg = url.split('?')[0].split('/').pop() || 'media';
                if (/\.[a-zA-Z0-9]{2,5}$/.test(seg))
                    return seg;
                const mimeExt = {
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
            const dlResponse = await axios_1.default.get(cloudinaryUrl, {
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
            const { metaApi } = await Promise.resolve().then(() => __importStar(require('../meta/meta.api')));
            const uploadResult = await metaApi.uploadMedia(phoneNumberId, accessToken, buffer, finalMime, finalFilename);
            const freshMediaId = uploadResult.id;
            console.log('✅ Fresh mediaId:', freshMediaId);
            // ── Cache in DB ───────────────────────────────────────────────
            await database_1.default.template.update({
                where: { id: template.id },
                data: { headerMediaId: freshMediaId },
            }).catch((e) => console.warn('⚠️ Cache update failed:', e.message));
            return (0, response_1.sendSuccess)(res, {
                mediaId: freshMediaId,
                mediaUrl: cloudinaryUrl,
                source: 'fresh_upload',
            }, 'Media resolved and uploaded');
        }
        catch (error) {
            console.error('❌ resolveTemplateMedia error:', error.message);
            next(error);
        }
    }
}
exports.InboxController = InboxController;
exports.inboxController = new InboxController();
//# sourceMappingURL=inbox.controller.js.map