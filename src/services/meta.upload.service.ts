// src/services/meta.upload.service.ts

import axios from 'axios';
import { config } from '../config';

export class MetaUploadService {
  /**
   * Upload media to Meta using App-level Resumable Upload API
   * This returns a handle usable for template creation
   */
  async uploadMediaForTemplate(
    appId: string,
    accessToken: string,
    file: Buffer,
    mimeType: string,
    filename: string
  ): Promise<{ handle: string }> {
    try {
      console.log('📤 Step 1: Creating upload session...');

      // ✅ Use APP ID, not WABA ID
      const sessionResponse = await axios.post(
        `https://graph.facebook.com/${config.meta.graphApiVersion}/app/uploads`,
        null,
        {
          params: {
            file_name: filename,
            file_length: file.length,
            file_type: mimeType,
            access_token: accessToken,
          },
        }
      );

      const sessionId = sessionResponse.data.id;
      console.log('✅ Session created:', sessionId);

      // ✅ Step 2: Upload file
      console.log('📤 Step 2: Uploading file...');

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
        }
      );

      const handle = uploadResponse.data.h;

      if (!handle) {
        throw new Error('No handle in upload response');
      }

      console.log('✅ Upload handle received:', handle.substring(0, 50) + '...');

      return { handle };

    } catch (error: any) {
      console.error('❌ Resumable upload failed:', {
        message: error.message,
        data: error.response?.data,
      });

      throw new Error(
        `Upload failed: ${error.response?.data?.error?.message || error.message}`
      );
    }
  }

  /**
   * Simple: Upload to Phone Number ID and get media ID
   */
  async uploadMediaSimple(
    phoneNumberId: string,
    accessToken: string,
    file: Buffer,
    mimeType: string,
    filename: string
  ): Promise<{ id: string }> {
    try {
      console.log('📤 Simple upload to Phone Number:', phoneNumberId);

      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('file', file, {
        filename,
        contentType: mimeType,
      });

      const response = await axios.post(
        `https://graph.facebook.com/${config.meta.graphApiVersion}/${phoneNumberId}/media`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${accessToken}`,
          },
          maxBodyLength: Infinity,
        }
      );

      console.log('✅ Simple upload response:', response.data);

      return { id: response.data.id };

    } catch (error: any) {
      console.error('❌ Simple upload failed:', {
        message: error.message,
        data: error.response?.data,
      });

      throw new Error(
        `Upload failed: ${error.response?.data?.error?.message || error.message}`
      );
    }
  }
}

export const metaUploadService = new MetaUploadService();
