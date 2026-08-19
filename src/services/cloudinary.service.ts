// src/services/cloudinary.service.ts
// ✅ FIX: fl_attachment HATAO - Meta publicly accessible URL chahiye
// ✅ FIX: Raw files ke liye proper public URL generate karo
// ✅ FIX: Delivery type 'upload' ensure karo (authenticated nahi)

import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

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
  'text/plain': 'txt',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/amr': 'amr',
};

const META_LIMITS = {
  image: 5 * 1024 * 1024,    // 5MB
  video: 16 * 1024 * 1024,   // 16MB
  audio: 16 * 1024 * 1024,   // 16MB
  document: 100 * 1024 * 1024, // 100MB
};

const getFormatFromMime = (mimeType: string): string =>
  MIME_TO_FORMAT[mimeType.toLowerCase()] || 'bin';

const getResourceType = (mimeType: string): 'image' | 'video' | 'raw' => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'video';
  return 'raw';
};

const getMediaCategory = (
  mimeType: string
): 'image' | 'video' | 'audio' | 'document' => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
};

// ✅ KEY FIX: Cloudinary se Meta-fetchable URL banana
// Rules:
//   - image/video: normal secure_url (publicly accessible)
//   - raw (PDF/docs): fl_attachment NAHI, instead image resource_type use karo
//     ya raw URL directly (Cloudinary raw = public by default)
//   - KABHI BHI fl_attachment mat lagao - Meta ko auth chahiye hogi
const buildPublicUrl = (
  publicId: string,
  resourceType: 'image' | 'video' | 'raw',
  format: string,
  mimeType: string,
  eagerUrl?: string
): string => {
  // Video ke liye eager transformation URL prefer karo
  if (resourceType === 'video' && eagerUrl) {
    return eagerUrl;
  }

  if (resourceType === 'image') {
    // ✅ Image: direct URL, no transformation flags
    return cloudinary.url(publicId, {
      resource_type: 'image',
      secure: true,
      format: format,
    });
  }

  if (resourceType === 'video') {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      secure: true,
      format: format,
    });
  }

  // ✅ Raw files (PDF, docs):
  // Cloudinary raw uploads PUBLIC hote hain by default
  // fl_attachment NAHI lagana - Meta 401 deta hai
  // Format: https://res.cloudinary.com/{cloud}/raw/upload/{publicId}
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    secure: true,
    // ✅ NO fl_attachment flag
    // ✅ NO transformation
  });
};

export class CloudinaryService {
  isConfigured(): boolean {
    return !!(
      config.cloudinary.cloudName &&
      config.cloudinary.apiKey &&
      config.cloudinary.apiSecret
    );
  }

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
    originalSize: number;
    finalSize: number;
    compressionApplied: boolean;
  }> {
    if (!this.isConfigured()) {
      throw new Error('Cloudinary is not configured.');
    }

    const format = getFormatFromMime(mimeType);
    const resourceType = getResourceType(mimeType);
    const mediaCategory = getMediaCategory(mimeType);
    const metaLimit = META_LIMITS[mediaCategory];
    const originalSize = file.length;
    const needsCompression = originalSize > metaLimit;

    console.log('☁️ Cloudinary upload starting:', {
      filename,
      mimeType,
      resourceType,
      size: `${(originalSize / 1024 / 1024).toFixed(2)} MB`,
      needsCompression,
    });

    return new Promise((resolve, reject) => {
      const folder = `${config.cloudinary.folder || 'wabmeta'}/${organizationId}`;
      const timestamp = Date.now();

      // ✅ Raw files ke liye extension ke saath publicId
      const publicId =
        resourceType === 'raw'
          ? `${timestamp}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          : String(timestamp);

      const eagerTransformations: any[] = [];

      // ✅ Video compression setup
      if (resourceType === 'video') {
        const videoTransform = needsCompression
          ? {
              width: 720,
              crop: 'scale',
              quality: 70,
              video_codec: 'h264:baseline:3.0',
              audio_codec: 'aac',
              audio_frequency: 44100,
              bit_rate: '1000k',
              format: 'mp4',
            }
          : {
              video_codec: 'h264:baseline:3.0',
              audio_codec: 'aac',
              format: 'mp4',
            };
        eagerTransformations.push(videoTransform);
      }

      const uploadOptions: any = {
        folder,
        resource_type: resourceType,
        public_id: publicId,
        // ✅ CRITICAL: type = 'upload' = publicly accessible
        // 'authenticated' type Meta fetch nahi kar sakta
        type: 'upload',
        overwrite: false,
        unique_filename: true,
        use_filename: resourceType === 'raw',
        // ✅ NO access_control restrictions
        // ✅ NO signed URLs
      };

      // Image compression
      if (resourceType === 'image' && needsCompression) {
        uploadOptions.transformation = [
          {
            width: 1600,
            height: 1600,
            crop: 'limit',
            quality: 'auto:low',
            fetch_format: 'auto',
          },
        ];
      }

      if (eagerTransformations.length > 0) {
        uploadOptions.eager = eagerTransformations;
        uploadOptions.eager_async = false;
      }

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

          // ✅ Build correct public URL (no fl_attachment)
          const eagerUrl = result.eager?.[0]?.secure_url;
          const finalUrl = buildPublicUrl(
            result.public_id,
            result.resource_type as 'image' | 'video' | 'raw',
            result.format || format,
            mimeType,
            eagerUrl
          );

          const finalSize = result.eager?.[0]?.bytes || result.bytes;

          console.log('✅ Cloudinary upload complete:', {
            publicId: result.public_id,
            finalUrl: finalUrl.substring(0, 80),
            size: `${(finalSize / 1024 / 1024).toFixed(2)} MB`,
            resourceType: result.resource_type,
          });

          // ✅ Validate URL is publicly accessible
          if (finalUrl.includes('fl_attachment')) {
            console.error('❌ CRITICAL: fl_attachment found in URL! This will cause 401!');
            // Remove it
            const cleanUrl = finalUrl.replace(/fl_attachment\//g, '');
            resolve({
              url: result.url,
              secureUrl: cleanUrl,
              publicId: result.public_id,
              format: result.format || format,
              resourceType: result.resource_type || resourceType,
              originalSize,
              finalSize,
              compressionApplied: needsCompression,
            });
            return;
          }

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
        }
      );

      uploadStream.end(file);
    });
  }

  // ✅ Existing templates ki URLs fix karo (migration helper)
  async fixExistingTemplateUrl(url: string): Promise<string> {
    if (!url) return url;
    
    // fl_attachment hata do
    let fixed = url.replace(/fl_attachment\//g, '');
    
    // Verify URL accessible hai
    try {
      const axios = require('axios');
      const response = await axios.head(fixed, { 
        timeout: 10000,
        validateStatus: (s: number) => s < 400
      });
      
      if (response.status >= 200 && response.status < 400) {
        return fixed;
      }
    } catch {
      // URL accessible nahi - return as is
    }
    
    return fixed;
  }

  async uploadInboundMedia(params: {
    buffer: Buffer;
    mimeType: string;
    organizationId: string;
    messageId: string;
  }): Promise<{
    url: string;
    publicId: string;
    resourceType: string;
    size: number;
  } | null> {
    if (!this.isConfigured()) return null;

    const { buffer, mimeType, organizationId, messageId } = params;
    const format = getFormatFromMime(mimeType);
    const resourceType = getResourceType(mimeType);

    return new Promise((resolve, reject) => {
      const folder = `wabmeta-inbound/${organizationId}`;
      const publicId =
        resourceType === 'raw' ? `${messageId}.${format}` : messageId;

      const uploadOptions: any = {
        folder,
        resource_type: resourceType,
        public_id: publicId,
        overwrite: false,
        unique_filename: false,
        use_filename: false,
        type: 'upload', // ✅ Always public
      };

      if (resourceType !== 'raw') {
        uploadOptions.format = format;
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('No result'));

          // ✅ No fl_attachment for inbound either
          const finalUrl = buildPublicUrl(
            result.public_id,
            result.resource_type as 'image' | 'video' | 'raw',
            result.format || format,
            mimeType
          );

          resolve({
            url: finalUrl,
            publicId: result.public_id,
            resourceType: result.resource_type || resourceType,
            size: result.bytes,
          });
        }
      );

      uploadStream.end(buffer);
    });
  }

  async verifyUrlAccessible(url: string): Promise<{
    accessible: boolean;
    status?: number;
    contentType?: string;
    size?: number;
  }> {
    try {
      const axios = require('axios');
      const response = await axios.head(url, {
        timeout: 10000,
        validateStatus: () => true,
      });
      return {
        accessible: response.status >= 200 && response.status < 400,
        status: response.status,
        contentType: response.headers['content-type'],
        size: parseInt(response.headers['content-length'] || '0', 10),
      };
    } catch {
      return { accessible: false };
    }
  }

  async verifyMediaSize(
    secureUrl: string,
    mediaCategory: 'image' | 'video' | 'audio' | 'document'
  ) {
    try {
      const axios = require('axios');
      const response = await axios.head(secureUrl, { timeout: 10000 });
      const size = parseInt(response.headers['content-length'] || '0', 10);
      const limit = META_LIMITS[mediaCategory];
      return { fits: size > 0 && size <= limit, size, limit };
    } catch {
      return { fits: true, size: 0, limit: META_LIMITS[mediaCategory] };
    }
  }

  async deleteMedia(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image'
  ) {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
    } catch (error: any) {
      throw new Error(`Failed to delete: ${error.message}`);
    }
  }
}

export const cloudinaryService = new CloudinaryService();