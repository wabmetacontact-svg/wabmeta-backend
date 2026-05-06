"use strict";
// src/services/cloudinary.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinaryService = exports.CloudinaryService = void 0;
const cloudinary_1 = require("cloudinary");
const config_1 = require("../config");
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: config_1.config.cloudinary.cloudName,
    api_key: config_1.config.cloudinary.apiKey,
    api_secret: config_1.config.cloudinary.apiSecret,
    secure: true,
});
class CloudinaryService {
    isConfigured() {
        return !!(config_1.config.cloudinary.cloudName && config_1.config.cloudinary.apiKey && config_1.config.cloudinary.apiSecret);
    }
    /**
     * Upload template media to Cloudinary
     */
    async uploadTemplateMedia(file, filename, mimeType, organizationId) {
        if (!this.isConfigured()) {
            throw new Error('Cloudinary is not configured.');
        }
        return new Promise((resolve, reject) => {
            const folder = `${config_1.config.cloudinary.folder}/${organizationId}`;
            // Determine resource type
            let resourceType = 'image';
            if (mimeType.startsWith('video/')) {
                resourceType = 'video';
            }
            else if (mimeType === 'application/pdf') {
                resourceType = 'raw';
            }
            console.log('☁️ Uploading to Cloudinary:', {
                folder,
                resourceType,
                size: file.length,
            });
            // Upload stream
            const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                folder,
                resource_type: resourceType,
                // ✅ Shorter public_id
                public_id: `${Date.now()}`,
                overwrite: false,
                unique_filename: true,
                // ✅ Ensure public access
                type: 'upload',
                access_mode: 'public',
            }, (error, result) => {
                if (error) {
                    console.error('❌ Cloudinary upload error:', error);
                    reject(new Error(`Cloudinary upload failed: ${error.message}`));
                }
                else if (result) {
                    // ✅ Get optimized URL for WhatsApp
                    let finalUrl = result.secure_url;
                    // For images, create optimized transformation
                    if (resourceType === 'image') {
                        finalUrl = cloudinary_1.v2.url(result.public_id, {
                            transformation: [
                                { width: 800, height: 600, crop: 'limit' },
                                { quality: 'auto:good' },
                            ],
                            secure: true,
                            format: result.format || 'jpg',
                        });
                    }
                    console.log('✅ Cloudinary upload success:', {
                        originalUrl: result.secure_url,
                        optimizedUrl: finalUrl,
                        publicId: result.public_id,
                    });
                    resolve({
                        url: result.url,
                        secureUrl: finalUrl, // ✅ Optimized URL
                        publicId: result.public_id,
                        format: result.format || '',
                        resourceType: result.resource_type || resourceType,
                    });
                }
                else {
                    reject(new Error('No result from Cloudinary'));
                }
            });
            // Write buffer to stream
            uploadStream.end(file);
        });
    }
    /**
     * Delete media from Cloudinary
     */
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