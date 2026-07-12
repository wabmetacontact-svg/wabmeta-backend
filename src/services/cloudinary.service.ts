// src/services/cloudinary.service.ts - PRODUCTION FIXED
// ✅ Always includes extension in URL
// ✅ Proper resource_type detection
// ✅ Format preserved in URL

import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

// ✅ MIME → Cloudinary format mapping
const MIME_TO_FORMAT: Record<string, string> = {
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

const getFormatFromMime = (mimeType: string): string => {
  return MIME_TO_FORMAT[mimeType.toLowerCase()] || 'bin';
};

const getResourceType = (mimeType: string): 'image' | 'video' | 'raw' => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw'; // PDF, docs, audio all go to raw
};

export class CloudinaryService {
  isConfigured(): boolean {
    return !!(
      config.cloudinary.cloudName &&
      config.cloudinary.apiKey &&
      config.cloudinary.apiSecret
    );
  }

  /**
   * ✅ FIXED: Always builds URL with proper extension
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

    const format = getFormatFromMime(mimeType);
    const resourceType = getResourceType(mimeType);

    return new Promise((resolve, reject) => {
      const folder = `${config.cloudinary.folder}/${organizationId}`;

      // ✅ CRITICAL: public_id includes format extension for RAW files
      // For images/videos, Cloudinary auto-appends format
      // For raw files, we MUST include extension in public_id
      const timestamp = Date.now();
      const publicIdBase = `${timestamp}`;
      const publicId = resourceType === 'raw'
        ? `${publicIdBase}.${format}`  // ✅ FORCE extension in URL
        : publicIdBase;

      console.log('☁️ Uploading to Cloudinary:', {
        folder,
        resourceType,
        format,
        publicId,
        mimeType,
        size: file.length,
      });

      const uploadOptions: any = {
        folder,
        resource_type: resourceType,
        public_id: publicId,
        overwrite: false,
        unique_filename: false, // ✅ We control the filename
        use_filename: false,
        type: 'upload',
        access_mode: 'public',
        // ✅ CRITICAL: Force format for raw files
        format: resourceType === 'raw' ? format : undefined,
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
            return;
          }

          if (!result) {
            reject(new Error('No result from Cloudinary'));
            return;
          }

          // ✅ Build final URL with extension GUARANTEED
          let finalUrl: string;

          if (resourceType === 'image') {
            // Images: use transformation with explicit format
            finalUrl = cloudinary.url(result.public_id, {
              resource_type: 'image',
              transformation: [
                { width: 1600, height: 1200, crop: 'limit' },
                { quality: 'auto:good' },
              ],
              secure: true,
              format: format, // ✅ FORCE format in URL
            });
          } else if (resourceType === 'video') {
            // Videos: direct URL with format
            finalUrl = cloudinary.url(result.public_id, {
              resource_type: 'video',
              secure: true,
              format: format, // ✅ FORCE format
            });
          } else {
            // Raw files (PDF, docs): result URL already has extension in public_id
            finalUrl = result.secure_url;
            
            // ✅ Safety check: ensure URL has extension
            if (!finalUrl.match(/\.[a-z0-9]{2,5}(\?|$)/i)) {
              // Extension missing - append it
              finalUrl = `${finalUrl}.${format}`;
              console.warn('⚠️ Appended missing extension to URL');
            }
          }

          console.log('✅ Cloudinary upload success:', {
            publicId: result.public_id,
            resourceType: result.resource_type,
            format: result.format,
            finalUrl: finalUrl.substring(0, 80) + '...',
            hasExtension: /\.[a-z0-9]{2,5}(\?|$)/i.test(finalUrl),
          });

          resolve({
            url: result.url,
            secureUrl: finalUrl,
            publicId: result.public_id,
            format: result.format || format,
            resourceType: result.resource_type || resourceType,
          });
        }
      );

      uploadStream.end(file);
    });
  }

  async deleteMedia(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image'
  ): Promise<void> {
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
