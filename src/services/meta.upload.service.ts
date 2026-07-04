import axios from 'axios';
import { config } from '../config';

export class MetaUploadService {
  /**
   * ✅ CORRECT: App-level Resumable Upload API
   * This is the ONLY way to get a handle for template creation
   * Handle format: "4:V2hh..." (long base64-like string)
   */
  async uploadMediaForTemplate(
    _appIdIgnored: string, // ignored - always use config.meta.appId
    accessToken: string,
    file: Buffer,
    mimeType: string,
    filename: string
  ): Promise<{ handle: string }> {
    try {
      const appId = config.meta.appId;
      
      if (!appId) {
        throw new Error('META_APP_ID not configured in environment');
      }

      // ✅ Meta size limits check
      const MAX_SIZES: Record<string, number> = {
        'image/jpeg': 5 * 1024 * 1024,      // 5MB
        'image/png': 5 * 1024 * 1024,       // 5MB
        'video/mp4': 16 * 1024 * 1024,      // 16MB
        'video/3gpp': 16 * 1024 * 1024,     // 16MB
        'application/pdf': 100 * 1024 * 1024, // 100MB
      };

      const maxSize = MAX_SIZES[mimeType] || 5 * 1024 * 1024;
      if (file.length > maxSize) {
        throw new Error(
          `File too large. ${mimeType} max size is ${(maxSize / 1024 / 1024).toFixed(0)}MB, got ${(file.length / 1024 / 1024).toFixed(2)}MB`
        );
      }

      console.log('📤 Step 1: Creating upload session at app-level...', {
        appId,
        filename,
        size: file.length,
        mimeType,
      });

      // ✅ Step 1: Create session on APP ID
      const sessionResponse = await axios.post(
        `https://graph.facebook.com/${config.meta.graphApiVersion}/${appId}/uploads`,
        null,
        {
          params: {
            file_name: filename,
            file_length: file.length,
            file_type: mimeType,
            access_token: accessToken,
          },
          timeout: 30000,
        }
      );

      const sessionId = sessionResponse.data.id;
      
      if (!sessionId) {
        throw new Error('No session ID returned from Meta');
      }
      
      console.log('✅ Session created:', sessionId);

      // ✅ Step 2: Upload file
      console.log('📤 Step 2: Uploading file to session...');

      const uploadResponse = await axios.post(
        `https://graph.facebook.com/${config.meta.graphApiVersion}/${sessionId}`,
        file,
        {
          headers: {
            'Authorization': `OAuth ${accessToken}`,
            'file_offset': '0',
            'Content-Type': 'application/octet-stream',
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 120000, // 2 min for large files
        }
      );

      const handle = uploadResponse.data.h;

      if (!handle) {
        console.error('❌ Upload response:', uploadResponse.data);
        throw new Error('No handle (h) field in upload response');
      }

      // ✅ Validate handle format (should start with digit followed by colon)
      if (!/^\d+:/.test(handle)) {
        console.warn('⚠️  Unusual handle format:', handle.substring(0, 20));
      }

      console.log('✅ Upload handle received:', handle.substring(0, 40) + '...');
      console.log('   Handle length:', handle.length);

      return { handle };

    } catch (error: any) {
      const metaError = error.response?.data?.error;
      
      console.error('❌ Resumable upload failed:', {
        message: error.message,
        metaError,
        status: error.response?.status,
      });

      // ✅ Better error messages
      if (metaError?.code === 190) {
        throw new Error('Invalid or expired access token. Please reconnect WhatsApp.');
      }
      if (metaError?.code === 100) {
        throw new Error(`Meta rejected upload: ${metaError.message}`);
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Upload timeout. File may be too large or network is slow.');
      }

      throw new Error(
        `Upload failed: ${metaError?.message || error.message}`
      );
    }
  }
}

export const metaUploadService = new MetaUploadService();
