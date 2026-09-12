"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboxMediaService = exports.InboxMediaService = void 0;
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../../config/database"));
const encryption_1 = require("../../utils/encryption");
const config_1 = require("../../config");
const r2_service_1 = require("../../services/r2.service");
const cloudinary_service_1 = require("../../services/cloudinary.service");
class InboxMediaService {
    /**
     * ✅ PERMANENT FIX: Meta media ko R2/Cloudinary par mirror karo taaki ZINDAGI BHAR EXPIRE NA HO
     */
    async downloadAndStorePermanentMedia(mediaId, accessToken, organizationId, mimeType) {
        try {
            // 1. Get Meta temporary URL
            const version = config_1.config.meta?.graphApiVersion || 'v22.0';
            const metaUrlRes = await axios_1.default.get(`https://graph.facebook.com/${version}/${mediaId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
            const tempMediaUrl = metaUrlRes.data?.url;
            if (!tempMediaUrl)
                return null;
            // 2. Download binary stream from Meta
            const mediaBinary = await axios_1.default.get(tempMediaUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
                responseType: 'arraybuffer',
                timeout: 30000,
            });
            const buffer = Buffer.from(mediaBinary.data);
            const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
            const filename = `inbox_${organizationId}_${Date.now()}.${ext}`;
            // 3. Upload to Cloudflare R2 (Permanent Storage)
            if (r2_service_1.r2Service.isConfigured()) {
                const r2Result = await r2_service_1.r2Service.uploadMediaBuffer(buffer, filename, mimeType, `inbox/${organizationId}`);
                console.log('✅ Inbox Media Mirror to R2 Success:', r2Result.url);
                return r2Result.url; // 👈 PERMANENT URL (Never Expire)
            }
            else if (cloudinary_service_1.cloudinaryService.isConfigured()) {
                const res = await cloudinary_service_1.cloudinaryService.uploadTemplateMedia(buffer, filename, mimeType, organizationId);
                console.log('✅ Inbox Media Mirror to Cloudinary Success:', res.secureUrl);
                return res.secureUrl;
            }
            return null;
        }
        catch (error) {
            console.error('❌ Failed to mirror media to R2/Cloudinary:', error?.message);
            return null; // Fallback to proxied stream
        }
    }
    /**
     * Helper to mirror inbound media in background for a saved message
     */
    async mirrorInboundMedia(messageId, mediaId, organizationId, mimeType) {
        try {
            let accessToken = null;
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { organizationId, isActive: true },
            });
            if (account?.accessToken) {
                accessToken = (0, encryption_1.safeDecryptStrict)(account.accessToken);
            }
            if (!accessToken) {
                const connection = await database_1.default.metaConnection.findFirst({
                    where: { organizationId },
                });
                if (connection?.accessToken) {
                    accessToken = (0, encryption_1.safeDecryptStrict)(connection.accessToken);
                }
            }
            if (!accessToken)
                return null;
            const permanentUrl = await this.downloadAndStorePermanentMedia(mediaId, accessToken, organizationId, mimeType);
            if (permanentUrl) {
                const existing = await database_1.default.message.findUnique({
                    where: { id: messageId },
                    select: { metadata: true },
                });
                const prevMetadata = existing?.metadata || {};
                await database_1.default.message.update({
                    where: { id: messageId },
                    data: {
                        mediaUrl: permanentUrl,
                        metadata: {
                            ...prevMetadata,
                            permanentMediaUrl: permanentUrl,
                            mirrored: true,
                        },
                    },
                });
            }
            return permanentUrl;
        }
        catch (e) {
            console.error('❌ mirrorInboundMedia error:', e?.message);
            return null;
        }
    }
    // ==========================================
    // GET MEDIA URL FROM WHATSAPP
    // ==========================================
    async getMediaUrl(mediaId, accessToken) {
        try {
            const version = config_1.config.meta?.graphApiVersion || 'v22.0';
            // Step 1: Get media URL from WhatsApp
            const response = await axios_1.default.get(`https://graph.facebook.com/${version}/${mediaId}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const mediaUrl = response.data?.url;
            if (!mediaUrl) {
                console.error('No media URL in response:', response.data);
                return null;
            }
            return mediaUrl;
        }
        catch (error) {
            console.error('Error getting media URL:', error.response?.data || error.message);
            return null;
        }
    }
    // ==========================================
    // DOWNLOAD MEDIA AS BASE64
    // ==========================================
    async downloadMediaAsBase64(mediaId, accessToken, mimeType) {
        try {
            // Step 1: Get the media URL
            const mediaUrl = await this.getMediaUrl(mediaId, accessToken);
            if (!mediaUrl) {
                return null;
            }
            // Step 2: Download the media
            const response = await axios_1.default.get(mediaUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                responseType: 'arraybuffer',
            });
            // Step 3: Convert to base64
            const base64 = Buffer.from(response.data).toString('base64');
            const contentType = response.headers['content-type'] || mimeType || 'application/octet-stream';
            return {
                base64: `data:${contentType};base64,${base64}`,
                mimeType: contentType,
            };
        }
        catch (error) {
            console.error('Error downloading media:', error.response?.data || error.message);
            return null;
        }
    }
    // ==========================================
    // GET MEDIA URL FOR FRONTEND (PROXY)
    // ==========================================
    async getProxiedMediaUrl(mediaId, organizationId) {
        try {
            // Get WhatsApp account with access token
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    status: 'CONNECTED',
                },
            });
            if (!account || !account.accessToken) {
                console.error('No active WhatsApp account found');
                return null;
            }
            // Decrypt access token
            const accessToken = (0, encryption_1.safeDecryptStrict)(account.accessToken);
            if (!accessToken) {
                console.error('Failed to decrypt access token');
                return null;
            }
            // Get media URL
            const mediaUrl = await this.getMediaUrl(mediaId, accessToken);
            return mediaUrl;
        }
        catch (error) {
            console.error('Error getting proxied media URL:', error);
            return null;
        }
    }
    // ==========================================
    // PROCESS INCOMING MEDIA MESSAGE
    // ==========================================
    async processIncomingMedia(mediaId, mediaType, organizationId) {
        try {
            console.log(`🔍 Processing media ${mediaId} for org ${organizationId}`);
            let accessToken = null;
            // 1. Try legacy WhatsAppAccount table first
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    isActive: true,
                },
            });
            if (account?.accessToken) {
                accessToken = (0, encryption_1.safeDecryptStrict)(account.accessToken);
            }
            // 2. Fallback to newer MetaConnection table if not found or no token
            if (!accessToken) {
                const connection = await database_1.default.metaConnection.findFirst({
                    where: { organizationId },
                });
                if (connection?.accessToken) {
                    accessToken = (0, encryption_1.safeDecryptStrict)(connection.accessToken);
                }
            }
            if (!accessToken) {
                console.error('❌ No decrypted access token found for media processing');
                return {
                    url: null,
                    base64: null,
                    mimeType: mediaType,
                    mediaId,
                };
            }
            // Get direct URL
            const url = await this.getMediaUrl(mediaId, accessToken);
            // For images, also get base64 for caching
            let base64 = null;
            if (mediaType.startsWith('image/') && url) {
                const result = await this.downloadMediaAsBase64(mediaId, accessToken, mediaType);
                if (result) {
                    base64 = result.base64;
                }
            }
            return {
                url,
                base64,
                mimeType: mediaType,
                mediaId,
            };
        }
        catch (error) {
            console.error('Error processing incoming media:', error);
            return {
                url: null,
                base64: null,
                mimeType: mediaType,
                mediaId,
            };
        }
    }
}
exports.InboxMediaService = InboxMediaService;
exports.inboxMediaService = new InboxMediaService();
exports.default = exports.inboxMediaService;
//# sourceMappingURL=inbox.media.js.map