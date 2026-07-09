"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTemplateHeaderMedia = resolveTemplateHeaderMedia;
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../config/database"));
const cloudinary_service_1 = require("../services/cloudinary.service");
/**
 * Resolves a template's header media. If the headerContent is a short-lived Meta CDN URL
 * (scontent.whatsapp.net), it downloads the media, uploads it to Cloudinary, updates the
 * template database record with the new Cloudinary URL, and returns the new URL.
 *
 * If it's already a permanent URL (like Cloudinary), it returns it as-is.
 */
async function resolveTemplateHeaderMedia(template) {
    const url = template.headerContent;
    if (!url) {
        return null;
    }
    // If it's already a permanent URL (e.g. Cloudinary, custom domain), return it as-is
    if (!url.includes('scontent.whatsapp')) {
        return url;
    }
    // Verify Cloudinary is configured
    if (!cloudinary_service_1.cloudinaryService.isConfigured()) {
        console.warn('⚠️ Cloudinary is not configured. Cannot resolve WhatsApp CDN media.');
        return url;
    }
    try {
        console.log(`🔄 Resolving WhatsApp CDN media to Cloudinary for template: ${template.id}`);
        // Download media from Meta CDN
        const response = await axios_1.default.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
        });
        const buffer = Buffer.from(response.data);
        const mimeType = response.headers['content-type']?.split(';')[0]?.trim() ||
            (template.headerType?.toUpperCase() === 'IMAGE'
                ? 'image/jpeg'
                : template.headerType?.toUpperCase() === 'VIDEO'
                    ? 'video/mp4'
                    : 'application/pdf');
        const filename = url.split('/').pop()?.split('?')[0] || 'media';
        // Upload to Cloudinary
        const uploadResult = await cloudinary_service_1.cloudinaryService.uploadTemplateMedia(buffer, filename, mimeType, template.organizationId);
        const secureUrl = uploadResult.secureUrl;
        // Update database record
        await database_1.default.template.update({
            where: { id: template.id },
            data: {
                headerContent: secureUrl,
            },
        });
        console.log(`✅ Successfully resolved template media. New URL: ${secureUrl}`);
        return secureUrl;
    }
    catch (err) {
        console.error(`❌ Failed to resolve template media for template ${template.id}:`, err.message);
        // Return original URL as fallback so we don't block the message, even if it might fail later
        return url;
    }
}
//# sourceMappingURL=templateMediaResolver.js.map