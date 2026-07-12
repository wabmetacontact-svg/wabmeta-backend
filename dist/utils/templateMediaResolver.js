"use strict";
// src/utils/templateMediaResolver.ts - PRODUCTION FIXED
// ✅ FORCED MIME by headerType (never trusts Cloudinary content-type)
// ✅ Ignores octet-stream completely
// ✅ Always sends valid MIME to Meta
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
const MEDIA_TTL_DAYS = 25;
const MEDIA_TTL_MS = MEDIA_TTL_DAYS * 24 * 60 * 60 * 1000;
// ✅ Valid Meta MIME types
const META_VALID_MIMES = new Set([
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/3gpp',
    'audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg', 'audio/opus',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
]);
// ✅ Invalid MIMEs to IGNORE
const INVALID_MIMES = new Set([
    'application/octet-stream',
    'binary/octet-stream',
    'application/binary',
    'application/download',
    '',
]);
/**
 * ✅ CRITICAL: MIME detection strategy
 * Priority: HeaderType → URL extension → Cloudinary hints → Default
 * NEVER trust Cloudinary's returned content-type for raw uploads
 */
function detectMimeType(url, headerType, fallbackMime) {
    const upperType = String(headerType || '').toUpperCase();
    const urlPath = url.split('?')[0].toLowerCase();
    // ========================================
    // PRIORITY 1: Detect from URL extension
    // ========================================
    const extMatch = urlPath.match(/\.([a-z0-9]+)(?:\?|$)/i);
    if (extMatch) {
        const ext = extMatch[1].toLowerCase();
        const extMap = {
            jpg: { mime: 'image/jpeg', ext: 'jpg' },
            jpeg: { mime: 'image/jpeg', ext: 'jpg' },
            png: { mime: 'image/png', ext: 'png' },
            webp: { mime: 'image/webp', ext: 'webp' },
            mp4: { mime: 'video/mp4', ext: 'mp4' },
            '3gp': { mime: 'video/3gpp', ext: '3gp' },
            '3gpp': { mime: 'video/3gpp', ext: '3gp' },
            pdf: { mime: 'application/pdf', ext: 'pdf' },
            doc: { mime: 'application/msword', ext: 'doc' },
            docx: {
                mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                ext: 'docx',
            },
            xls: { mime: 'application/vnd.ms-excel', ext: 'xls' },
            xlsx: {
                mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                ext: 'xlsx',
            },
            ppt: { mime: 'application/vnd.ms-powerpoint', ext: 'ppt' },
            pptx: {
                mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                ext: 'pptx',
            },
            txt: { mime: 'text/plain', ext: 'txt' },
            mp3: { mime: 'audio/mpeg', ext: 'mp3' },
            aac: { mime: 'audio/aac', ext: 'aac' },
            ogg: { mime: 'audio/ogg', ext: 'ogg' },
        };
        if (extMap[ext])
            return extMap[ext];
    }
    // ========================================
    // PRIORITY 2: Detect from Cloudinary path
    // ========================================
    if (urlPath.includes('/image/upload/')) {
        // Check f_ parameter for exact format
        const fMatch = urlPath.match(/\/f_([a-z0-9]+)/);
        if (fMatch) {
            const fmt = fMatch[1];
            if (fmt === 'png')
                return { mime: 'image/png', ext: 'png' };
            if (fmt === 'webp')
                return { mime: 'image/webp', ext: 'webp' };
        }
        return { mime: 'image/jpeg', ext: 'jpg' };
    }
    if (urlPath.includes('/video/upload/')) {
        return { mime: 'video/mp4', ext: 'mp4' };
    }
    if (urlPath.includes('/raw/upload/')) {
        // Raw uploads - MUST rely on headerType
        if (upperType === 'DOCUMENT')
            return { mime: 'application/pdf', ext: 'pdf' };
        if (upperType === 'IMAGE')
            return { mime: 'image/jpeg', ext: 'jpg' };
        if (upperType === 'VIDEO')
            return { mime: 'video/mp4', ext: 'mp4' };
        return { mime: 'application/pdf', ext: 'pdf' };
    }
    // ========================================
    // PRIORITY 3: Use fallback if valid
    // ========================================
    if (fallbackMime && META_VALID_MIMES.has(fallbackMime)) {
        const ext = fallbackMime.split('/')[1] || 'bin';
        return { mime: fallbackMime, ext };
    }
    // ========================================
    // PRIORITY 4: Default by headerType
    // ========================================
    const defaults = {
        IMAGE: { mime: 'image/jpeg', ext: 'jpg' },
        VIDEO: { mime: 'video/mp4', ext: 'mp4' },
        DOCUMENT: { mime: 'application/pdf', ext: 'pdf' },
        AUDIO: { mime: 'audio/mpeg', ext: 'mp3' },
    };
    return defaults[upperType] || { mime: 'image/jpeg', ext: 'jpg' };
}
function buildFilename(url, mime, ext) {
    const urlPath = url.split('?')[0];
    const lastSegment = urlPath.split('/').pop() || 'media';
    // If URL already has extension, use it
    if (/\.[a-zA-Z0-9]{2,5}$/.test(lastSegment)) {
        return lastSegment;
    }
    // Otherwise append proper extension
    return `${lastSegment}.${ext}`;
}
/**
 * Resolves scontent.whatsapp URLs to Cloudinary
 */
async function resolveTemplateHeaderMedia(template) {
    const url = template.headerContent;
    if (!url)
        return null;
    if (!url.includes('scontent.whatsapp'))
        return url;
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
        const responseMime = String(response.headers['content-type'] || '')
            .split(';')[0]
            .trim();
        // ✅ FORCE proper MIME based on headerType
        const { mime, ext } = detectMimeType(url, template.headerType, INVALID_MIMES.has(responseMime) ? undefined : responseMime);
        const filename = buildFilename(url, mime, ext);
        const uploadResult = await cloudinary_service_1.cloudinaryService.uploadTemplateMedia(buffer, filename, mime, template.organizationId);
        await database_1.default.template.update({
            where: { id: template.id },
            data: { headerContent: uploadResult.secureUrl },
        });
        console.log(`✅ Resolved to Cloudinary: ${uploadResult.secureUrl.substring(0, 60)}...`);
        return uploadResult.secureUrl;
    }
    catch (err) {
        console.error(`❌ Failed to resolve template media:`, err.message);
        return url;
    }
}
// ✅ Single-flight prevention
const inFlightUploads = new Map();
async function getFreshMediaIdForSending(templateId) {
    const existing = inFlightUploads.get(templateId);
    if (existing) {
        console.log(`⏳ Waiting for in-flight upload: ${templateId}`);
        return existing;
    }
    const uploadPromise = _getFreshMediaId(templateId);
    inFlightUploads.set(templateId, uploadPromise);
    try {
        return await uploadPromise;
    }
    finally {
        setTimeout(() => inFlightUploads.delete(templateId), 5000);
    }
}
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
        console.error(`❌ No WhatsApp account: ${templateId}`);
        return null;
    }
    const headerType = (template.headerType || '').toUpperCase();
    if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
        return null;
    }
    // ✅ STEP 1: Check cached media ID
    const mediaId = template.headerMediaId;
    const uploadedAt = template.headerMediaUploadedAt;
    if (mediaId && /^\d+$/.test(mediaId) && uploadedAt) {
        const ageMs = Date.now() - new Date(uploadedAt).getTime();
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        if (ageMs < MEDIA_TTL_MS) {
            console.log(`✅ Using cached media ID: ${mediaId} (${ageDays} days old)`);
            return mediaId;
        }
        console.log(`⏰ Cached ID expired (${ageDays} days) - refreshing...`);
    }
    // ✅ STEP 2: Get permanent source URL
    let sourceUrl = template.headerContent;
    if (sourceUrl && sourceUrl.includes('scontent.whatsapp')) {
        console.log('🔄 Header has scontent URL - resolving to Cloudinary...');
        sourceUrl = await resolveTemplateHeaderMedia({
            id: template.id,
            organizationId: template.organizationId,
            headerType: template.headerType,
            headerContent: template.headerContent,
        });
    }
    if (!sourceUrl || !sourceUrl.startsWith('http')) {
        console.error(`❌ No valid source URL for ${template.name}`);
        return null;
    }
    // ✅ STEP 3: Download from source
    try {
        const accountWithToken = await meta_service_1.metaService.getAccountWithToken(template.whatsappAccount.id);
        if (!accountWithToken?.accessToken) {
            console.error(`❌ Cannot decrypt token for ${template.whatsappAccount.id}`);
            return null;
        }
        console.log(`📥 Downloading from: ${sourceUrl.substring(0, 80)}...`);
        const response = await axios_1.default.get(sourceUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WabMeta/1.0)',
                Accept: '*/*',
            },
        });
        const buffer = Buffer.from(response.data);
        const responseContentType = String(response.headers['content-type'] || '')
            .split(';')[0]
            .trim()
            .toLowerCase();
        // ✅ CRITICAL FIX: If Cloudinary returned invalid MIME, IGNORE it
        // Use headerType to determine correct MIME
        const responseMimeValid = !INVALID_MIMES.has(responseContentType) &&
            META_VALID_MIMES.has(responseContentType);
        const { mime: finalMime, ext: finalExt } = detectMimeType(sourceUrl, template.headerType, responseMimeValid ? responseContentType : undefined);
        const finalFilename = buildFilename(sourceUrl, finalMime, finalExt);
        // ✅ SAFETY: Verify MIME is in Meta's valid list
        if (!META_VALID_MIMES.has(finalMime)) {
            console.error(`❌ Detected invalid MIME: ${finalMime}. Aborting upload.`);
            return null;
        }
        console.log(`📤 Uploading to Meta:`, {
            filename: finalFilename,
            mime: finalMime,
            size: buffer.length,
            cloudinaryReturned: responseContentType,
            forced: !responseMimeValid,
        });
        const result = await meta_api_1.metaApi.uploadMedia(template.whatsappAccount.phoneNumberId, accountWithToken.accessToken, buffer, finalMime, finalFilename, template.whatsappAccount.wabaId);
        if (!result?.id) {
            console.error('❌ Meta upload returned no ID');
            return null;
        }
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
        if (err.response?.data) {
            console.error('   Meta error:', JSON.stringify(err.response.data.error || err.response.data));
        }
        return null;
    }
}
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
        const hasFreshId = template.headerMediaId &&
            /^\d+$/.test(template.headerMediaId) &&
            template.headerMediaUploadedAt &&
            Date.now() - new Date(template.headerMediaUploadedAt).getTime() < MEDIA_TTL_MS;
        const hasPermanentUrl = template.headerContent &&
            template.headerContent.startsWith('http') &&
            !template.headerContent.includes('scontent.whatsapp');
        if (!hasFreshId && !hasPermanentUrl) {
            return {
                ready: false,
                reason: `Template "${template.name}" has expired media and no source URL. Please re-upload.`,
            };
        }
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