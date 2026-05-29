// 📁 src/modules/whatsapp/whatsapp.api.ts - COMPLETE WHATSAPP API CLIENT

import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
import { config } from '../../config';

const META_API_VERSION = config.meta.graphApiVersion || 'v22.0';
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// ============================================
// TYPES
// ============================================

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface SendMessageResponse {
  messages: Array<{
    id: string;
  }>;
  contacts?: Array<{
    input: string;
    wa_id: string;
  }>;
}

export interface TemplateParams {
  header?: any;
  body?: any[];
  buttons?: Array<{
    type?: string;
    text?: string;
    payload?: string;
  }>;
}

export interface MediaParams {
  type: 'image' | 'video' | 'document' | 'audio';
  url?: string;
  id?: string;
  caption?: string;
  filename?: string;
}

// ============================================
// WHATSAPP API CLASS
// ============================================

class WhatsAppAPI {
  private client: AxiosInstance;
  private clientUnversioned: AxiosInstance;

  constructor() {
    // Versioned client (for most endpoints)
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Unversioned client (for debug_token)
    this.clientUnversioned = axios.create({
      baseURL: 'https://graph.facebook.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ WhatsApp API Client initialized (${META_API_VERSION})`);
  }

  // ============================================
  // OAUTH & TOKEN MANAGEMENT
  // ============================================

  /**
   * Exchange OAuth code for short-lived access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<AccessTokenResponse> {
    try {
      console.log('[WhatsApp API] Exchanging code for token...');

      const response = await this.client.get('/oauth/access_token', {
        params: {
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          redirect_uri: redirectUri,
          code,
        },
      });

      console.log('[WhatsApp API] ✅ Token obtained');
      return response.data;
    } catch (error: any) {
      console.error('[WhatsApp API] ❌ Token exchange failed:', this.formatError(error));
      throw this.handleError(error, 'Failed to exchange code for token');
    }
  }

  /**
   * Exchange short-lived token for long-lived token (60 days)
   */
  async exchangeForLongLivedToken(shortLivedToken: string): Promise<AccessTokenResponse> {
    try {
      console.log('[WhatsApp API] Getting long-lived token...');

      const response = await this.client.get('/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          fb_exchange_token: shortLivedToken,
        },
      });

      console.log('[WhatsApp API] ✅ Long-lived token obtained');
      return response.data;
    } catch (error: any) {
      console.error('[WhatsApp API] ❌ Long-lived token failed:', this.formatError(error));
      throw this.handleError(error, 'Failed to get long-lived token');
    }
  }

  /**
   * Debug token - check validity, scopes, expiry
   */
  async debugToken(inputToken: string): Promise<any> {
    try {
      const appAccessToken = `${config.meta.appId}|${config.meta.appSecret}`;

      const response = await this.clientUnversioned.get('/debug_token', {
        params: {
          input_token: inputToken,
          access_token: appAccessToken,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('[WhatsApp API] ❌ Debug token failed:', this.formatError(error));
      throw this.handleError(error, 'Failed to debug token');
    }
  }

  /**
   * Get current user info
   */
  async getMe(accessToken: string): Promise<any> {
    try {
      const response = await this.client.get('/me', {
        params: {
          access_token: accessToken,
          fields: 'id,name',
          appsecret_proof: this.generateAppSecretProof(accessToken),
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('[WhatsApp API] ❌ Get me failed:', this.formatError(error));
      throw this.handleError(error, 'Failed to get user info');
    }
  }

  // ============================================
  // BUSINESS & WABA
  // ============================================

  /**
   * Get businesses owned by the user
   */
  async getUserBusinesses(accessToken: string): Promise<any[]> {
    try {
      const response = await this.client.get('/me/businesses', {
        params: {
          access_token: accessToken,
          limit: 50,
          appsecret_proof: this.generateAppSecretProof(accessToken),
        },
      });

      return response.data?.data || [];
    } catch (error: any) {
      console.error('[WhatsApp API] ❌ Get businesses failed:', this.formatError(error));
      throw this.handleError(error, 'Failed to get businesses');
    }
  }

  /**
   * Get WhatsApp Business Accounts owned by a business
   */
  async getOwnedWabas(businessId: string, accessToken: string): Promise<any[]> {
    try {
      const response = await this.client.get(`${businessId}/owned_whatsapp_business_accounts`, {
        params: {
          access_token: accessToken,
          limit: 50,
          appsecret_proof: this.generateAppSecretProof(accessToken),
        },
      });

      return response.data?.data || [];
    } catch (error: any) {
      console.error('[WhatsApp API] ❌ Get WABAs failed:', this.formatError(error));
      throw this.handleError(error, 'Failed to get WABAs');
    }
  }

  /**
   * Get phone numbers under a WABA
   */
  async getWabaPhoneNumbers(wabaId: string, accessToken: string): Promise<any[]> {
    try {
      const response = await this.client.get(`${wabaId}/phone_numbers`, {
        params: {
          access_token: accessToken,
          limit: 50,
          fields: 'id,verified_name,display_phone_number,quality_rating,code_verification_status,platform_type,throughput',
          appsecret_proof: this.generateAppSecretProof(accessToken),
        },
      });

      return response.data?.data || [];
    } catch (error: any) {
      console.error('[WhatsApp API] ❌ Get phone numbers failed:', this.formatError(error));
      throw this.handleError(error, 'Failed to get phone numbers');
    }
  }

  /**
   * Get phone number details
   */
  async getPhoneNumberInfo(phoneNumberId: string, accessToken: string): Promise<any> {
    try {
      const response = await this.client.get(`${phoneNumberId}`, {
        params: {
          access_token: accessToken,
          fields: 'verified_name,code_verification_status,display_phone_number,quality_rating,platform_type,throughput,id',
          appsecret_proof: this.generateAppSecretProof(accessToken),
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('[WhatsApp API] ❌ Get phone info failed:', this.formatError(error));
      throw this.handleError(error, 'Failed to get phone number info');
    }
  }

  /**
   * Register phone number for WhatsApp
   */
  async registerPhoneNumber(phoneNumberId: string, accessToken: string, pin: string): Promise<any> {
    try {
      const response = await this.client.post(
        `${phoneNumberId}/register`,
        {
          messaging_product: 'whatsapp',
          pin,
        },
        {
          params: {
            access_token: accessToken,
            appsecret_proof: this.generateAppSecretProof(accessToken),
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('[WhatsApp API] ❌ Register phone failed:', this.formatError(error));
      throw this.handleError(error, 'Failed to register phone number');
    }
  }

  /**
   * Subscribe app to WABA webhooks
   */
  async subscribeAppToWaba(wabaId: string, accessToken: string): Promise<any> {
    try {
      const response = await this.client.post(
        `${wabaId}/subscribed_apps`,
        {},
        {
          params: {
            access_token: accessToken,
            appsecret_proof: this.generateAppSecretProof(accessToken),
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('[WhatsApp API] ❌ Subscribe webhook failed:', this.formatError(error));
      throw this.handleError(error, 'Failed to subscribe to webhooks');
    }
  }

  // ============================================
  // MESSAGING
  // ============================================

  /**
   * Send template message
   */
  async sendTemplateMessage(
    phoneNumberId: string,
    to: string,
    templateName: string,
    language: string,
    components?: TemplateParams,
    accessToken?: string
  ): Promise<{ waMessageId: string }> {
    try {
      console.log(`📤 Sending template message:`);
      console.log(`   Phone Number ID: ${phoneNumberId}`);
      console.log(`   To: ${to}`);
      console.log(`   Template: ${templateName} (${language})`);

      const cleanTo = to.replace(/\D/g, '');

      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: language,
          },
        },
      };

      if (components && Object.keys(components).length > 0) {
        payload.template.components = this.buildTemplateComponents(components);
      }

      const response = await this.client.post<SendMessageResponse>(
        `${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const waMessageId = response.data.messages?.[0]?.id;

      if (!waMessageId) {
        throw new Error('No message ID returned from WhatsApp API');
      }

      console.log(`✅ Template message sent: ${waMessageId}`);

      return { waMessageId };
    } catch (error: any) {
      console.error('❌ Error sending template message:', this.formatError(error));
      throw this.handleError(error, 'Failed to send template message');
    }
  }

  /**
   * Send text message
   */
  async sendTextMessage(
    phoneNumberId: string,
    to: string,
    message: string,
    accessToken: string,
    previewUrl: boolean = false
  ): Promise<{ waMessageId: string }> {
    try {
      const cleanTo = to.replace(/\D/g, '');

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: {
          preview_url: previewUrl,
          body: message,
        },
      };

      const response = await this.client.post<SendMessageResponse>(
        `${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const waMessageId = response.data.messages?.[0]?.id;

      if (!waMessageId) {
        throw new Error('No message ID returned');
      }

      console.log(`✅ Text message sent: ${waMessageId}`);

      return { waMessageId };
    } catch (error: any) {
      console.error('❌ Error sending text message:', this.formatError(error));
      throw this.handleError(error, 'Failed to send text message');
    }
  }

  /**
   * Send media message
   */
  async sendMediaMessage(
    phoneNumberId: string,
    to: string,
    media: MediaParams,
    accessToken: string
  ): Promise<{ waMessageId: string }> {
    try {
      const cleanTo = to.replace(/\D/g, '');

      const mediaPayload: any = {};

      if (media.id) {
        mediaPayload.id = media.id;
      } else if (media.url) {
        mediaPayload.link = media.url;
      } else {
        throw new Error('Either media ID or URL must be provided');
      }

      if (media.caption && ['image', 'video', 'document'].includes(media.type)) {
        mediaPayload.caption = media.caption;
      }

      if (media.type === 'document' && media.filename) {
        mediaPayload.filename = media.filename;
      }

      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: media.type,
        [media.type]: mediaPayload,
      };

      const response = await this.client.post<SendMessageResponse>(
        `${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const waMessageId = response.data.messages?.[0]?.id;

      if (!waMessageId) {
        throw new Error('No message ID returned');
      }

      console.log(`✅ ${media.type} message sent: ${waMessageId}`);

      return { waMessageId };
    } catch (error: any) {
      console.error('❌ Error sending media message:', this.formatError(error));
      throw this.handleError(error, 'Failed to send media message');
    }
  }

  /**
   * Send message (generic) - with Authorization header, not query param
   */
  async sendMessage(
    phoneNumberId: string,
    accessToken:   string,
    to:            string,
    payload:       any
  ): Promise<any> {
    try {
      const response = await this.client.post(
        `${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000, // 15s timeout
        }
      );

      const messageId = response.data?.messages?.[0]?.id;

      if (!messageId) {
        throw new Error('No message ID returned from WhatsApp API');
      }

      return {
        messageId,
        messages: response.data.messages,
        contacts: response.data.contacts,
      };
    } catch (error: any) {
      console.error('❌ sendMessage API error:', this.formatError(error));
      throw this.handleError(error, 'Failed to send message');
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(
    phoneNumberId: string,
    messageId:     string,
    accessToken:   string
  ): Promise<boolean> {
    try {
      await this.client.post(
        `${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status:            'read',
          message_id:        messageId,
        },
        {
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`✅ Message marked as read: ${messageId}`);
      return true;
    } catch (error: any) {
      console.warn('markAsRead failed:', error.message);
      return false;
    }
  }

  /**
   * Mark message as read (alias for whatsapp.service.ts compatibility)
   */
  async markMessageAsRead(
    phoneNumberId: string,
    accessToken:   string,
    messageId:     string
  ): Promise<boolean> {
    return this.markAsRead(phoneNumberId, messageId, accessToken);
  }

  // ============================================
  // TEMPLATES
  // ============================================

  /**
   * Create message template with specific API version
   */
  async createMessageTemplateByVersion(wabaId: string, accessToken: string, payload: any, version: string = 'v22.0'): Promise<any> {
    try {
      const response = await this.clientUnversioned.post(`/${version}/${wabaId}/message_templates`, payload, {
        params: {
          access_token: accessToken,
          appsecret_proof: this.generateAppSecretProof(accessToken),
        },
      });

      return response.data;
    } catch (error: any) {
      console.error(`❌ Error creating template (${version}):`, this.formatError(error));
      throw this.handleError(error, `Failed to create template with ${version}`);
    }
  }

  /**
   * Create message template
   */
  async createMessageTemplate(wabaId: string, accessToken: string, payload: any): Promise<any> {
    try {
      const response = await this.client.post(`${wabaId}/message_templates`, payload, {
        params: {
          access_token: accessToken,
          appsecret_proof: this.generateAppSecretProof(accessToken),
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Error creating template:', this.formatError(error));
      throw this.handleError(error, 'Failed to create template');
    }
  }

  /**
   * List message templates
   */
  async listMessageTemplates(wabaId: string, accessToken: string): Promise<any[]> {
    try {
      const response = await this.client.get(`${wabaId}/message_templates`, {
        params: {
          access_token: accessToken,
          limit: 200,
          appsecret_proof: this.generateAppSecretProof(accessToken),
        },
      });

      return response.data?.data || [];
    } catch (error: any) {
      console.error('❌ Error listing templates:', this.formatError(error));
      throw this.handleError(error, 'Failed to list templates');
    }
  }

  /**
   * Get single template
   */
  async getMessageTemplate(templateId: string, accessToken: string): Promise<any> {
    try {
      const response = await this.client.get(`${templateId}`, {
        params: {
          access_token: accessToken,
          appsecret_proof: this.generateAppSecretProof(accessToken),
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Error getting template:', this.formatError(error));
      throw this.handleError(error, 'Failed to get template');
    }
  }

  /**
   * Delete message template
   */
  async deleteMessageTemplate(wabaId: string, accessToken: string, templateName: string): Promise<any> {
    try {
      const response = await this.client.delete(`${wabaId}/message_templates`, {
        params: {
          access_token: accessToken,
          name: templateName,
          appsecret_proof: this.generateAppSecretProof(accessToken),
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Error deleting template:', this.formatError(error));
      throw this.handleError(error, 'Failed to delete template');
    }
  }

  // ============================================
  // MEDIA
  // ============================================

  /**
   * Upload media
   */
  async uploadMedia(phoneNumberId: string, accessToken: string, formData: any): Promise<any> {
    try {
      const response = await this.client.post(`${phoneNumberId}/media`, formData, {
        params: {
          access_token: accessToken,
          appsecret_proof: this.generateAppSecretProof(accessToken),
        },
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Error uploading media:', this.formatError(error));
      throw this.handleError(error, 'Failed to upload media');
    }
  }

  /**
   * Get media URL
   */
  async getMediaUrl(mediaId: string, accessToken: string): Promise<any> {
    try {
      const response = await this.client.get(`${mediaId}`, {
        params: {
          access_token: accessToken,
          appsecret_proof: this.generateAppSecretProof(accessToken),
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Error getting media URL:', this.formatError(error));
      throw this.handleError(error, 'Failed to get media URL');
    }
  }

  /**
   * Download media
   */
  async downloadMedia(mediaUrl: string, accessToken: string): Promise<any> {
    try {
      const response = await axios.get(mediaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: 'arraybuffer',
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Error downloading media:', this.formatError(error));
      throw this.handleError(error, 'Failed to download media');
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Generate app secret proof for secure API calls
   */
  private generateAppSecretProof(userAccessToken: string): string | undefined {
    if (!config.meta.appSecret) return undefined;

    return crypto
      .createHmac('sha256', config.meta.appSecret)
      .update(userAccessToken)
      .digest('hex');
  }

  /**
   * Build template components
   */
  private buildTemplateComponents(params: TemplateParams): any[] {
    const components: any[] = [];

    if (params.header) {
      const headerParams = Array.isArray(params.header) ? params.header : [params.header];
      components.push({
        type: 'header',
        parameters: headerParams.map((value: any) => {
          if (typeof value === 'string') {
            return { type: 'text', text: value };
          }
          return value;
        }),
      });
    }

    if (params.body && params.body.length > 0) {
      components.push({
        type: 'body',
        parameters: params.body.map((value: any) => {
          if (typeof value === 'string') {
            return { type: 'text', text: value };
          }
          return value;
        }),
      });
    }

    if (params.buttons && params.buttons.length > 0) {
      params.buttons.forEach((button, index) => {
        components.push({
          type: 'button',
          sub_type: button.type || 'quick_reply',
          index: index,
          parameters: [
            {
              type: 'payload',
              payload: button.payload || button.text || '',
            },
          ],
        });
      });
    }

    return components;
  }

  /**
   * Format error for logging
   */
  private formatError(error: any): any {
    return {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
    };
  }

  /**
   * Handle and format errors
   */
  private handleError(error: any, defaultMessage: string): Error {
    const err = error.response?.data?.error;
    if (err) {
      let msg = err.message || defaultMessage;
      if (err.code) msg += ` (Code: ${err.code})`;
      if (err.error_subcode) msg += ` (Subcode: ${err.error_subcode})`;

      const apiErr = new Error(msg);
      (apiErr as any).response = error.response;
      (apiErr as any).metaError = err;
      return apiErr;
    }

    const standardErr = new Error(error.message || defaultMessage);
    (standardErr as any).response = error.response;
    return standardErr;
  }
}

export const whatsappApi = new WhatsAppAPI();
export default whatsappApi;