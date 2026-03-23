// src/services/cloudinary.service.ts

import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

export class CloudinaryService {
  isConfigured(): boolean {
    return !!(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);
  }

  /**
   * Upload template media to Cloudinary
   */
  async uploadTemplateMedia(
    file: Buffer,
    filename: string,
    mimeType: string,
    organizationId: string
  ): Promise<{
    url: string;
    secureUrl: string;
    publicId: string;
    format: string;
    resourceType: string;
  }> {
    if (!this.isConfigured()) {
      throw new Error('Cloudinary is not configured.');
    }

    return new Promise((resolve, reject) => {
      const folder = `${config.cloudinary.folder}/${organizationId}`;
      
      // Determine resource type
      let resourceType: 'image' | 'video' | 'raw' = 'image';
      if (mimeType.startsWith('video/')) {
        resourceType = 'video';
      } else if (mimeType === 'application/pdf') {
        resourceType = 'raw';
      }

      console.log('☁️ Uploading to Cloudinary:', {
        folder,
        resourceType,
        size: file.length,
      });

      // Upload stream
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          // ✅ Shorter public_id
          public_id: `${Date.now()}`,
          overwrite: false,
          unique_filename: true,
          // ✅ Ensure public access
          type: 'upload',
          access_mode: 'public',
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else if (result) {
            // ✅ Get optimized URL for WhatsApp
            let finalUrl = result.secure_url;

            // For images, create optimized transformation
            if (resourceType === 'image') {
              finalUrl = cloudinary.url(result.public_id, {
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
              secureUrl: finalUrl,  // ✅ Optimized URL
              publicId: result.public_id,
              format: result.format || '',
              resourceType: result.resource_type || resourceType,
            });
          } else {
            reject(new Error('No result from Cloudinary'));
          }
        }
      );

      // Write buffer to stream
      uploadStream.end(file);
    });
  }

  /**
   * Delete media from Cloudinary
   */
  async deleteMedia(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      console.log('✅ Deleted from Cloudinary:', publicId);
    } catch (error: any) {
      console.error('❌ Cloudinary delete failed:', error);
      throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
    }
  }
}

export const cloudinaryService = new CloudinaryService();
