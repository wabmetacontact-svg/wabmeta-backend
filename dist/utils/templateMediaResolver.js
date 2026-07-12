"use strict";
// src/utils/templateMediaResolver.ts - PRODUCTION FIX
// ✅ Single source of truth for media resolution
// ✅ Smart caching with automatic refresh
// ✅ Handles all edge cases
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTemplateHeaderMedia = resolveTemplateHeaderMedia;
exports.getFreshMediaIdForSending = getFreshMediaIdForSending;
exports.validateTemplateReady = validateTemplateReady;
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../config/database"));
const cloudinary_service_1 = require("../services/cloudinary.service");
const meta_api_1 = require("../modules/meta/meta.api");
const meta_service_1 = require("../modules/meta/meta.service");
// ✅ Meta media ID expires in 30 days
const MEDIA_TTL_DAYS = 25; // Refresh at 25 days for safety
const MEDIA_TTL_MS = MEDIA_TTL_DAYS * 24 * 60 * 60 * 1000;
/**
 * Detects MIME type from URL
 */
function detectMimeFromUrl(url, headerType) {
    const urlPath = url.split('?')[0].toLowerCase();
    const extMatch = urlPath.match(/\.([a-z0-9]+)$/i);
    if (extMatch) {
        const extMap = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg',
            png: 'image/png', webp: 'image/webp',
            mp4: 'video/mp4', '3gp': 'video/3gpp',
            pdf: 'application/pdf',
        };
        const mime = extMap[extMatch[1].toLowerCase()];
        if (mime)
            return mime;
    }
    // Cloudinary format hints
    if (urlPath.includes('/image/upload/'))
        return 'image/jpeg';
    if (urlPath.includes('/video/upload/'))
        return 'video/mp4';
    if (urlPath.includes('/raw/upload/'))
        return 'application/pdf';
    // Fallback by header type
    const typeDefaults = {
        IMAGE: 'image/jpeg',
        VIDEO: 'video/mp4',
        DOCUMENT: 'application/pdf',
    };
    return typeDefaults[(headerType || '').toUpperCase()] || 'application/pdf';
}
/**
 * Builds proper filename from URL and MIME
 */
function buildFilename(url, mimeType) {
    const urlPath = url.split('?')[0];
    const lastSegment = urlPath.split('/').pop() || 'media';
    if (/\.[a-zA-Z0-9]{2,5}$/.test(lastSegment))
        return lastSegment;
    const mimeToExt = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/3gpp': '3gp',
        'application/pdf': 'pdf',
    };
    const ext = mimeToExt[mimeType] || 'bin';
    return `${lastSegment}.${ext}`;
}
/**
 * ✅ MAIN FUNCTION: Resolves scontent.whatsapp.net URLs to Cloudinary
 * Called when template is synced/created from Meta
 */
async function resolveTemplateHeaderMedia(template) {
    const url = template.headerContent;
    if (!url)
        return null;
    // Already permanent URL
    if (!url.includes('scontent.whatsapp')) {
        return url;
    }
    if (!cloudinary_service_1.cloudinaryService.isConfigured()) {
        console.warn('⚠️ Cloudinary not configured');
        return url;
    }
    try {
        console.log(`🔄 Resolving scontent URL for template: ${template.id}`);
        const response = await axios_1.default.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
        });
        const buffer = Buffer.from(response.data);
        const mimeType = detectMimeFromUrl(url, template.headerType || undefined);
        const filename = buildFilename(url, mimeType);
        const uploadResult = await cloudinary_service_1.cloudinaryService.uploadTemplateMedia(buffer, filename, mimeType, template.organizationId);
        const secureUrl = uploadResult.secureUrl;
        await database_1.default.template.update({
            where: { id: template.id },
            data: { headerContent: secureUrl },
        });
        console.log(`✅ Resolved to Cloudinary: ${secureUrl.substring(0, 60)}...`);
        return secureUrl;
    }
    catch (err) {
        console.error(`❌ Failed to resolve template media:`, err.message);
        return url;
    }
}
/**
 * ✅ CRITICAL FUNCTION: Get fresh Meta media ID for sending messages
 * This is what campaigns/messages use
 *
 * Logic:
 * 1. Check if we have fresh media ID (< 25 days old)
 * 2. If yes → return it
 * 3. If no → download from Cloudinary → upload to Meta → save new ID
 *
 * ✅ SINGLE-FLIGHT: Multiple concurrent calls will share one upload
 */
const inFlightUploads = new Map();
async function getFreshMediaIdForSending(templateId) {
    // ✅ Single-flight: prevent duplicate uploads
    const existing = inFlightUploads.get(templateId);
    if (existing) {
        console.log(`⏳ Waiting for in-flight media upload: ${templateId}`);
        return existing;
    }
    const uploadPromise = _getFreshMediaId(templateId);
    inFlightUploads.set(templateId, uploadPromise);
    try {
        return await uploadPromise;
    }
    finally {
        // Clean up after 5 seconds to allow other requests to reuse
        setTimeout(() => inFlightUploads.delete(templateId), 5000);
    }
}
/**
 * Internal function - actual media ID resolution
 */
async function _getFreshMediaId(templateId) {
    const template = await database_1.default.template.findUnique({
        where: { id: templateId },
        include: { whatsappAccount: true },
    });
    if (!template) {
        console.error(`❌ Template not found: ${templateId}`);
        return null;
    }
    if (!template.whatsappAccount) {
        console.error(`❌ Template has no WhatsApp account: ${templateId}`);
        return null;
    }
    const headerType = (template.headerType || '').toUpperCase();
    // No media header - return null (not an error)
    if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
        return null;
    }
    // ✅ STEP 1: Check if cached media ID is still fresh
    const mediaId = template.headerMediaId;
    const uploadedAt = template.headerMediaUploadedAt;
    if (mediaId && /^\d+$/.test(mediaId) && uploadedAt) {
        const ageMs = Date.now() - new Date(uploadedAt).getTime();
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        if (ageMs < MEDIA_TTL_MS) {
            console.log(`✅ Using cached media ID: ${mediaId} (${ageDays} days old)`);
            return mediaId;
        }
        console.log(`⏰ Cached media ID expired (${ageDays} days old) - refreshing...`);
    }
    // ✅ STEP 2: Need fresh upload - get Cloudinary URL
    let sourceUrl = template.headerContent;
    // If it's a scontent URL, resolve it first
    if (sourceUrl && sourceUrl.includes('scontent.whatsapp')) {
        console.log('🔄 Header has scontent URL - resolving to Cloudinary first...');
        sourceUrl = await resolveTemplateHeaderMedia({
            id: template.id,
            organizationId: template.organizationId,
            headerType: template.headerType,
            headerContent: template.headerContent,
        });
    }
    // Check if we have a valid permanent URL
    if (!sourceUrl || !sourceUrl.startsWith('http')) {
        console.error(`❌ Template ${template.name} has no valid source URL`);
        return null;
    }
    // ✅ STEP 3: Download from source and upload to Meta
    try {
        // Get decrypted token
        const accountWithToken = await meta_service_1.metaService.getAccountWithToken(template.whatsappAccount.id);
        if (!accountWithToken?.accessToken) {
            console.error(`❌ Cannot decrypt token for ${template.whatsappAccount.id}`);
            return null;
        }
        console.log(`📥 Downloading from: ${sourceUrl.substring(0, 60)}...`);
        const response = await axios_1.default.get(sourceUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WabMeta/1.0)',
                'Accept': '*/*',
            },
        });
        const buffer = Buffer.from(response.data);
        const rawMime = (response.headers['content-type'] || '')
            .split(';')[0]
            .trim();
        const mimeType = rawMime && rawMime.startsWith('image/') ||
            rawMime.startsWith('video/') ||
            rawMime.startsWith('application/')
            ? rawMime
            : detectMimeFromUrl(sourceUrl, template.headerType || undefined);
        const filename = buildFilename(sourceUrl, mimeType);
        console.log(`📤 Uploading to Meta: ${filename} (${mimeType}, ${buffer.length} bytes)`);
        const result = await meta_api_1.metaApi.uploadMedia(template.whatsappAccount.phoneNumberId, accountWithToken.accessToken, buffer, mimeType, filename, template.whatsappAccount.wabaId);
        if (!result?.id) {
            console.error('❌ Meta upload returned no ID');
            return null;
        }
        // ✅ STEP 4: Save fresh ID to DB
        await database_1.default.template.update({
            where: { id: template.id },
            data: {
                headerMediaId: result.id,
                headerMediaUploadedAt: new Date(),
                headerMediaLastVerified: new Date(),
            },
        });
        console.log(`✅ Fresh media ID uploaded: ${result.id}`);
        return result.id;
    }
    catch (err) {
        console.error(`❌ Media upload failed for ${template.name}:`, err.message);
        // Log detailed error for debugging
        if (err.response?.data) {
            console.error('   Meta error:', JSON.stringify(err.response.data.error || err.response.data));
        }
        return null;
    }
}
/**
 * ✅ HELPER: Validate template is ready to send
 * Called before campaign starts to fail fast
 */
async function validateTemplateReady(templateId) {
    const template = await database_1.default.template.findUnique({
        where: { id: templateId },
        include: { whatsappAccount: true },
    });
    if (!template)
        return { ready: false, reason: 'Template not found' };
    if (template.status !== 'APPROVED') {
        return { ready: false, reason: `Template not approved (${template.status})` };
    }
    if (!template.whatsappAccount) {
        return { ready: false, reason: 'No WhatsApp account linked' };
    }
    if (template.whatsappAccount.status !== 'CONNECTED') {
        return { ready: false, reason: 'WhatsApp account disconnected' };
    }
    const headerType = (template.headerType || '').toUpperCase();
    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
        // Must have either fresh media ID OR permanent URL to re-upload
        const hasFreshId = template.headerMediaId &&
            /^\d+$/.test(template.headerMediaId) &&
            template.headerMediaUploadedAt &&
            (Date.now() - new Date(template.headerMediaUploadedAt).getTime()) < MEDIA_TTL_MS;
        const hasPermanentUrl = template.headerContent &&
            template.headerContent.startsWith('http') &&
            !template.headerContent.includes('scontent.whatsapp');
        if (!hasFreshId && !hasPermanentUrl) {
            return {
                ready: false,
                reason: `Template "${template.name}" has expired media and no source URL. Please re-upload media.`,
            };
        }
        // ✅ Pre-warm the media ID
        if (!hasFreshId && hasPermanentUrl) {
            console.log(`🔥 Pre-warming media for ${template.name}...`);
            const freshId = await getFreshMediaIdForSending(templateId);
            if (!freshId) {
                return {
                    ready: false,
                    reason: `Failed to upload media for template "${template.name}". Please re-upload manually.`,
                };
            }
        }
    }
    return { ready: true };
}
//# sourceMappingURL=templateMediaResolver.js.map