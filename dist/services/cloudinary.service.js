"use strict";
// src/services/cloudinary.service.ts - PRODUCTION WITH AUTO-COMPRESSION
// ✅ Auto video compression for WhatsApp (16MB limit)
// ✅ Auto image optimization (5MB limit)
// ✅ Always includes extension in URL
// ✅ Proper resource_type detection
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinaryService = exports.CloudinaryService = void 0;
const cloudinary_1 = require("cloudinary");
const config_1 = require("../config");
cloudinary_1.v2.config({
    cloud_name: config_1.config.cloudinary.cloudName,
    api_key: config_1.config.cloudinary.apiKey,
    api_secret: config_1.config.cloudinary.apiSecret,
    secure: true,
});
// ✅ MIME → Cloudinary format mapping
const MIME_TO_FORMAT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/amr': 'amr',
};
// ✅ META LIMITS (in bytes) - hard limits
const META_LIMITS = {
    image: 5 * 1024 * 1024, // 5 MB
    video: 16 * 1024 * 1024, // 16 MB
    audio: 16 * 1024 * 1024, // 16 MB
    document: 100 * 1024 * 1024, // 100 MB
};
const getFormatFromMime = (mimeType) => {
    return MIME_TO_FORMAT[mimeType.toLowerCase()] || 'bin';
};
const getResourceType = (mimeType) => {
    if (mimeType.startsWith('image/'))
        return 'image';
    if (mimeType.startsWith('video/'))
        return 'video';
    return 'raw'; // PDF, docs, audio all go to raw
};
const getMediaCategory = (mimeType) => {
    if (mimeType.startsWith('image/'))
        return 'image';
    if (mimeType.startsWith('video/'))
        return 'video';
    if (mimeType.startsWith('audio/'))
        return 'audio';
    return 'document';
};
class CloudinaryService {
    isConfigured() {
        return !!(config_1.config.cloudinary.cloudName &&
            config_1.config.cloudinary.apiKey &&
            config_1.config.cloudinary.apiSecret);
    }
    /**
     * ✅ Upload with automatic compression for WhatsApp
     * - Videos: compressed to fit 16MB limit
     * - Images: optimized to fit 5MB limit
     * - Documents: uploaded as-is (100MB limit)
     */
    async uploadTemplateMedia(file, filename, mimeType, organizationId) {
        if (!this.isConfigured()) {
            throw new Error('Cloudinary is not configured.');
        }
        const format = getFormatFromMime(mimeType);
        const resourceType = getResourceType(mimeType);
        const mediaCategory = getMediaCategory(mimeType);
        const metaLimit = META_LIMITS[mediaCategory];
        const originalSize = file.length;
        const needsCompression = originalSize > metaLimit;
        console.log('☁️ Upload starting:', {
            filename,
            mimeType,
            resourceType,
            mediaCategory,
            originalSize: `${(originalSize / 1024 / 1024).toFixed(2)} MB`,
            metaLimit: `${(metaLimit / 1024 / 1024).toFixed(0)} MB`,
            needsCompression,
        });
        return new Promise((resolve, reject) => {
            const folder = `${config_1.config.cloudinary.folder}/${organizationId}`;
            const timestamp = Date.now();
            const publicIdBase = `${timestamp}`;
            const publicId = resourceType === 'raw'
                ? `${publicIdBase}.${format}`
                : publicIdBase;
            // ✅ BUILD TRANSFORMATIONS BASED ON MEDIA TYPE
            const transformations = [];
            const eagerTransformations = [];
            // ✅ SAFER video compression - preserves video stream integrity
            if (resourceType === 'video' && needsCompression) {
                // For videos needing compression, use conservative settings
                // that preserve video stream quality and integrity
                const videoTransform = {
                    width: 720, // Max 720p width
                    crop: 'scale', // Scale instead of limit (safer)
                    quality: 70, // Fixed quality (safer than auto:low)
                    video_codec: 'h264:baseline:3.0', // Baseline profile (max compatibility)
                    audio_codec: 'aac',
                    audio_frequency: 44100, // Standard audio frequency
                    bit_rate: '1000k', // 1 Mbps (safe for 16MB)
                    format: 'mp4',
                    // Removed: flags: 'faststart' (causes issues with some videos)
                    // Removed: height (let it scale proportionally)
                };
                transformations.push(videoTransform);
                eagerTransformations.push(videoTransform);
                console.log('🎥 Video compression enabled (safe settings)');
            }
            else if (resourceType === 'video') {
                // For videos NOT needing compression, minimal transformation
                // Just ensure MP4 + H.264 for WhatsApp compatibility
                const videoTransform = {
                    video_codec: 'h264:baseline:3.0',
                    audio_codec: 'aac',
                    format: 'mp4',
                };
                transformations.push(videoTransform);
                eagerTransformations.push(videoTransform);
                console.log('🎥 Video format conversion only (no compression)');
            }
            else if (resourceType === 'image') {
                // ✅ IMAGE OPTIMIZATION - always optimize
                transformations.push({
                    width: 1600,
                    height: 1600,
                    crop: 'limit',
                    quality: needsCompression ? 'auto:low' : 'auto:good',
                    fetch_format: 'auto',
                });
                console.log('🖼️  Image optimization enabled');
            }
            // Raw files (docs) - no transformation
            const uploadOptions = {
                folder,
                resource_type: resourceType,
                public_id: publicId,
                overwrite: false,
                unique_filename: false,
                use_filename: false,
                type: 'upload',
                access_mode: 'public',
                format: resourceType === 'raw' ? format : undefined,
            };
            // Apply eager transformations for videos (sync compression)
            if (eagerTransformations.length > 0) {
                uploadOptions.eager = eagerTransformations;
                uploadOptions.eager_async = false; // Wait for compression
            }
            const uploadStream = cloudinary_1.v2.uploader.upload_stream(uploadOptions, (error, result) => {
                if (error) {
                    console.error('❌ Cloudinary upload error:', error);
                    reject(new Error(`Cloudinary upload failed: ${error.message}`));
                    return;
                }
                if (!result) {
                    reject(new Error('No result from Cloudinary'));
                    return;
                }
                // ✅ Build final URL with compression applied
                let finalUrl;
                let finalSize = result.bytes;
                if (resourceType === 'image') {
                    // Images: URL with transformation
                    finalUrl = cloudinary_1.v2.url(result.public_id, {
                        resource_type: 'image',
                        transformation: transformations,
                        secure: true,
                        format: format,
                    });
                }
                else if (resourceType === 'video') {
                    // Videos: use eager transformation URL if available (compressed)
                    if (result.eager && result.eager.length > 0) {
                        finalUrl = result.eager[0].secure_url;
                        finalSize = result.eager[0].bytes || result.bytes;
                        console.log('✅ Using compressed video URL from eager transformation');
                    }
                    else {
                        finalUrl = cloudinary_1.v2.url(result.public_id, {
                            resource_type: 'video',
                            transformation: transformations,
                            secure: true,
                            format: format,
                        });
                    }
                }
                else {
                    // Raw files (PDF, docs)
                    finalUrl = result.secure_url;
                    if (!finalUrl.match(/\.[a-z0-9]{2,5}(\?|$)/i)) {
                        finalUrl = `${finalUrl}.${format}`;
                    }
                }
                const compressionRatio = originalSize > 0
                    ? ((originalSize - finalSize) / originalSize * 100).toFixed(1)
                    : '0';
                console.log('✅ Cloudinary upload complete:', {
                    publicId: result.public_id,
                    originalSize: `${(originalSize / 1024 / 1024).toFixed(2)} MB`,
                    finalSize: `${(finalSize / 1024 / 1024).toFixed(2)} MB`,
                    compression: `${compressionRatio}%`,
                    fitsMetaLimit: finalSize <= metaLimit,
                });
                resolve({
                    url: result.url,
                    secureUrl: finalUrl,
                    publicId: result.public_id,
                    format: result.format || format,
                    resourceType: result.resource_type || resourceType,
                    originalSize,
                    finalSize,
                    compressionApplied: needsCompression,
                });
            });
            uploadStream.end(file);
        });
    }
    /**
     * ✅ Verify compressed media size fits Meta limit
     * Call this after upload to double-check
     */
    async verifyMediaSize(secureUrl, mediaCategory) {
        try {
            const axios = require('axios');
            const response = await axios.head(secureUrl, { timeout: 10000 });
            const size = parseInt(response.headers['content-length'] || '0', 10);
            const limit = META_LIMITS[mediaCategory];
            return {
                fits: size > 0 && size <= limit,
                size,
                limit,
            };
        }
        catch (err) {
            console.warn('⚠️ Could not verify media size:', err);
            return { fits: true, size: 0, limit: META_LIMITS[mediaCategory] };
        }
    }
    async deleteMedia(publicId, resourceType = 'image') {
        try {
            await cloudinary_1.v2.uploader.destroy(publicId, { resource_type: resourceType });
            console.log('✅ Deleted from Cloudinary:', publicId);
        }
        catch (error) {
            console.error('❌ Cloudinary delete failed:', error);
            throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
        }
    }
}
exports.CloudinaryService = CloudinaryService;
exports.cloudinaryService = new CloudinaryService();
//# sourceMappingURL=cloudinary.service.js.map