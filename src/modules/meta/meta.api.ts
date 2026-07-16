// 📁 src/modules/meta/meta.api.ts - FIXED VERSION
// ✅ FIX 1: isRetryable no longer retries on timeouts. A timeout doesn't mean
//    Meta didn't process the message — it may have sent it AND billed us. Retrying
//    would cause duplicate messages to end-users and duplicate wallet charges.
// ✅ FIX 2: registerPhoneNumber now takes a per-account PIN instead of hardcoded
//    '000000'. A universal PIN across all customers was a two-step-verification
//    security hole.

import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
import { config } from '../../config';
import {
  TokenExchangeResponse,
  DebugTokenResponse,
  SharedWABAInfo,
  PhoneNumberInfo,
  MetaApiError,
  WebhookSubscribeResponse,
} from './meta.types';

/**
 * ✅ NEW: Generate a cryptographically random 6-digit PIN for
 * WhatsApp two-step verification. Each account gets its own PIN.
 */
export function generatePhonePin(): string {
  // 6 random digits, uniformly distributed
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

class MetaApiClient {
  private client: AxiosInstance;
  private graphVersion: string;

  constructor() {
    this.graphVersion = config.meta.graphApiVersion || 'v22.0';

    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${this.graphVersion}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (reqConfig) => {
        const url = reqConfig.url || '';
        const method = reqConfig.method?.toUpperCase() || 'GET';
        console.log(`[Meta API] ${method} ${url}`);
        return reqConfig;
      },
      (error) => {
        console.error('[Meta API] Request setup error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[Meta API] ✅ Response: ${response.status}`);
        return response;
      },
      (error: AxiosError<MetaApiError>) => {
        const metaError = error.response?.data?.error;

        const isRestricted = metaError?.code === 100 && metaError?.error_subcode === 33;
        const isSmbRestriction = metaError?.code === 100 && metaError?.message?.includes('SMB');
        const isHandledError = isRestricted || isSmbRestriction;

        if (metaError) {
          if (isHandledError) {
            console.warn(`[Meta API] ℹ️  Note: ${metaError.message}`);
          } else {
            console.error('[Meta API] ❌ Error:', {
              message: metaError.message,
              code: metaError.code,
              subcode: metaError.error_subcode,
              type: metaError.type,
              fbtrace_id: metaError.fbtrace_id,
            });
          }
        } else {
          console.error('[Meta API] ❌ Error:', error.message);
        }
        return Promise.reject(error);
      }
    );

    console.log(`✅ Meta API Client initialized (${this.graphVersion})`);
  }

  // ============================================
  // TOKEN MANAGEMENT
  // ============================================

  async exchangeCodeForToken(code: string, skipRedirectUri = false): Promise<TokenExchangeResponse> {
    try {
      console.log('[Meta API] Exchanging code for token...');

      const params: Record<string, string> = {
        client_id: config.meta.appId,
        client_secret: config.meta.appSecret,
        code: code,
      };

      if (!skipRedirectUri) {
        params.redirect_uri = config.meta.redirectUri;
        console.log('[Meta API] Redirect URI:', config.meta.redirectUri);
      } else {
        console.log('[Meta API] ⚠️  Skipping redirect_uri (FB.login Embedded Signup flow)');
      }

      const response = await this.client.get('/oauth/access_token', { params });

      console.log('[Meta API] ✅ Token exchange successful');

      return {
        accessToken: response.data.access_token,
        tokenType: response.data.token_type || 'bearer',
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      console.error('[Meta API] ❌ Token exchange failed');
      throw this.handleError(error, 'Failed to exchange code for token');
    }
  }

  async getLongLivedToken(shortLivedToken: string): Promise<TokenExchangeResponse> {
    try {
      console.log('[Meta API] Getting long-lived token...');

      const response = await this.client.get('/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          fb_exchange_token: shortLivedToken,
        },
      });

      console.log('[Meta API] ✅ Long-lived token obtained');

      return {
        accessToken: response.data.access_token,
        tokenType: response.data.token_type || 'bearer',
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      console.error('[Meta API] ⚠️ Could not get long-lived token');
      throw this.handleError(error, 'Failed to get long-lived token');
    }
  }

  async debugToken(accessToken: string): Promise<DebugTokenResponse> {
    try {
      console.log('[Meta API] Debugging token...');

      const appToken = `${config.meta.appId}|${config.meta.appSecret}`;

      const response = await this.client.get('/debug_token', {
        params: {
          input_token: accessToken,
          access_token: appToken,
        },
      });

      const data = response.data.data;
      console.log('[Meta API] ✅ Token debug info:', {
        app_id: data.app_id,
        is_valid: data.is_valid,
        scopes: data.scopes?.join(', ') || 'none',
        expires_at: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : 'never',
      });

      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to debug token');
    }
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const debugResult = await this.debugToken(accessToken);
      return debugResult.data.is_valid;
    } catch (error) {
      console.error('[Meta API] Token validation failed:', error);
      return false;
    }
  }

  // ============================================
  // WABA METHODS
  // ============================================

  async getSharedWABAs(accessToken: string): Promise<SharedWABAInfo[]> {
    try {
      console.log('[Meta API] Fetching shared WABAs...');

      const meResponse = await this.client.get('/me', {
        params: { access_token: accessToken, fields: 'id,name' },
      });

      console.log('[Meta API] User:', meResponse.data.name || meResponse.data.id);

      const businessResponse = await this.client.get(`/${meResponse.data.id}/businesses`, {
        params: { access_token: accessToken, fields: 'id,name' },
      });

      const businesses = businessResponse.data.data || [];
      console.log('[Meta API] Found businesses:', businesses.length);

      const wabas: SharedWABAInfo[] = [];

      for (const business of businesses) {
        try {
          const clientWabaResponse = await this.client.get(
            `/${business.id}/client_whatsapp_business_accounts`,
            {
              params: {
                access_token: accessToken,
                fields: 'id,name,currency,timezone_id,message_template_namespace',
              },
            }
          );

          if (clientWabaResponse.data.data?.length) {
            wabas.push(...clientWabaResponse.data.data);
          }
        } catch (e) {
          try {
            const ownedWabaResponse = await this.client.get(
              `/${business.id}/owned_whatsapp_business_accounts`,
              {
                params: {
                  access_token: accessToken,
                  fields: 'id,name,currency,timezone_id,message_template_namespace',
                },
              }
            );

            if (ownedWabaResponse.data.data?.length) {
              wabas.push(...ownedWabaResponse.data.data);
            }
          } catch (e2) {
            console.log(`[Meta API] No WABAs for business ${business.id}`);
          }
        }
      }

      try {
        const debugToken = await this.debugToken(accessToken);
        const granularScopes = debugToken.data.granular_scopes || [];

        for (const scope of granularScopes) {
          if (scope.scope === 'whatsapp_business_management' && scope.target_ids) {
            for (const wabaId of scope.target_ids) {
              if (!wabas.find((w) => w.id === wabaId)) {
                try {
                  const wabaDetails = await this.getWABADetails(wabaId, accessToken);
                  if (wabaDetails) {
                    wabas.push(wabaDetails);
                  }
                } catch (e) {
                  console.log(`[Meta API] Could not fetch WABA ${wabaId}`);
                }
              }
            }
          }
        }
      } catch (e) {
        console.log('[Meta API] Could not get WABAs from debug token');
      }

      console.log(`[Meta API] ✅ Total WABAs found: ${wabas.length}`);
      return wabas;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to get shared WABAs');
    }
  }

  async getWABADetails(wabaId: string, accessToken: string): Promise<SharedWABAInfo> {
    try {
      console.log(`[Meta API] Fetching WABA details for ${wabaId}...`);

      const response = await this.client.get(`${wabaId}`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,currency,timezone_id,message_template_namespace',
        },
      });

      console.log(`[Meta API] ✅ WABA: ${response.data.name}`);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to get WABA details');
    }
  }

  // ============================================
  // PHONE NUMBER METHODS
  // ============================================

  async getPhoneNumbers(wabaId: string, accessToken: string): Promise<PhoneNumberInfo[]> {
    try {
      console.log(`[Meta API] Fetching phone numbers for WABA ${wabaId}...`);

      const response = await this.client.get(`${wabaId}/phone_numbers`, {
        params: {
          access_token: accessToken,
          fields: 'id,verified_name,display_phone_number,quality_rating,code_verification_status,platform_type,throughput,status,name_status,messaging_limit_tier',
        },
      });

      const phoneNumbers = (response.data.data || []).map((phone: any): PhoneNumberInfo => ({
        id: phone.id,
        verifiedName: phone.verified_name,
        displayPhoneNumber: phone.display_phone_number,
        qualityRating: phone.quality_rating,
        codeVerificationStatus: phone.code_verification_status,
        nameStatus: phone.name_status,
        messagingLimitTier: phone.messaging_limit_tier,
        platformType: phone.platform_type,
        throughput: phone.throughput,
        status: phone.status,
      }));

      console.log(`[Meta API] ✅ Found ${phoneNumbers.length} phone numbers`);
      return phoneNumbers;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to get phone numbers');
    }
  }

  async getPhoneNumberDetails(
    phoneNumberId: string,
    accessToken: string
  ): Promise<{
    id: string;
    verifiedName: string;
    displayPhoneNumber: string;
    qualityRating: string;
    codeVerificationStatus?: string;
    nameStatus?: string;
  }> {
    try {
      console.log(`[Meta API] Fetching phone number details for ${phoneNumberId}...`);

      const response = await this.client.get(`${phoneNumberId}`, {
        params: {
          access_token: accessToken,
          fields: 'id,verified_name,display_phone_number,quality_rating,code_verification_status,name_status',
        },
      });

      const data = response.data;

      return {
        id: data.id,
        verifiedName: data.verified_name,
        displayPhoneNumber: data.display_phone_number,
        qualityRating: data.quality_rating,
        codeVerificationStatus: data.code_verification_status,
        nameStatus: data.name_status,
      };
    } catch (error: any) {
      throw this.handleError(error, 'Failed to get phone number details');
    }
  }

  /**
   * ✅ FIX: Register phone number with a caller-supplied PIN.
   * Previously the PIN was hardcoded to '000000' across every customer, which
   * is a serious security hole — a universal known two-step verification PIN
   * means any adversary who can transfer the number (SIM swap, carrier access)
   * can immediately deregister/re-register on WhatsApp on any customer's account.
   *
   * Caller MUST pass a random, per-account PIN (see generatePhonePin()) and
   * persist it encrypted so it can be reused on future re-registrations.
   */
  async registerPhone(
    phoneNumberId: string,
    pin:           string,
    accessToken:   string
  ): Promise<{
    success:            boolean;
    alreadyRegistered?: boolean;
    error?:             string;
    requiresAction?:    boolean;
  }> {
    try {
      await this.client.post(
        `${phoneNumberId}/register`,
        {
          messaging_product: 'whatsapp',
          pin,
        },
        {
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return { success: true };

    } catch (err: any) {
      const errorData = err.response?.data?.error || {};
      const code      = errorData.code;
      const subcode   = errorData.error_subcode;
      const message   = errorData.message || err.message;

      console.error('[Meta API] Register error:', {
        code, subcode, message, phoneNumberId,
      });

      // ✅ Already registered - OK
      if (
        code === 133005 ||
        code === 133006 ||
        message?.toLowerCase().includes('already registered')
      ) {
        return { success: true, alreadyRegistered: true };
      }

      // ✅ 2FA PIN issue
      if (
        code === 100 &&
        (message?.toLowerCase().includes('pin') ||
         subcode === 2388006)
      ) {
        return {
          success:        false,
          error:          '2FA PIN required or incorrect',
          requiresAction: true,
        };
      }

      // ✅ Payment method missing
      if (code === 133008 || message?.includes('payment')) {
        return {
          success:        false,
          error:          'Payment method not added in Meta Business Manager',
          requiresAction: true,
        };
      }

      // ✅ Number pending verification
      if (
        code === 133006 ||
        message?.toLowerCase().includes('not verified') ||
        message?.toLowerCase().includes('pending verification')
      ) {
        return {
          success:        false,
          error:          'Phone number verification pending in Meta Business Manager',
          requiresAction: true,
        };
      }

      // Generic failure
      return {
        success: false,
        error:   message,
      };
    }
  }

  // ============================================
  // WHATSAPP PROFILE METHODS
  // ============================================

  extractProfileFromWebhook(webhookData: any): {
    waId: string;
    profileName: string;
    phone: string;
  } | null {
    try {
      const entry = webhookData.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value) return null;

      if (value.messages?.[0]) {
        const message = value.messages[0];
        const contact = value.contacts?.[0];

        return {
          waId: message.from,
          profileName: contact?.profile?.name || 'Unknown',
          phone: message.from.startsWith('+') ? message.from : '+' + message.from,
        };
      }

      if (value.statuses?.[0]) {
        const status = value.statuses[0];
        const contact = value.contacts?.[0];

        if (contact) {
          return {
            waId: status.recipient_id,
            profileName: contact?.profile?.name || 'Unknown',
            phone: status.recipient_id.startsWith('+')
              ? status.recipient_id
              : '+' + status.recipient_id,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[Meta API] Error extracting profile from webhook:', error);
      return null;
    }
  }

  async getContactProfile(
    phoneNumberId: string,
    accessToken: string,
    phone: string
  ): Promise<{
    exists: boolean;
    waId?: string;
    profileName?: string;
    status?: string;
  }> {
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '');

      console.log(`[Meta API] Fetching profile for: ${cleanPhone.substring(0, 5)}...`);

      const response = await this.client.post(
        `${phoneNumberId}/contacts`,
        {
          messaging_product: 'whatsapp',
          blocking: 'wait',
          force_check: true,
          contacts: [cleanPhone],
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const contact = response.data.contacts?.[0];

      if (!contact) {
        return { exists: false };
      }

      const result = {
        exists: contact.status === 'valid',
        waId: contact.wa_id,
        status: contact.status,
        profileName: undefined as string | undefined,
      };

      console.log(`[Meta API] Contact ${contact.status}: ${contact.wa_id}`);

      return result;
    } catch (error: any) {
      const metaError = error.response?.data?.error;
      if (metaError?.code === 100 && metaError?.error_subcode === 33) {
        return { exists: true, waId: phone.replace(/[^0-9]/g, ''), status: 'valid' };
      }
      console.error('[Meta API] Failed to get contact profile:', error.response?.data || error.message);
      return { exists: false };
    }
  }

  async batchCheckContacts(
    phoneNumberId: string,
    accessToken: string,
    phones: string[]
  ): Promise<Array<{
    input: string;
    waId?: string;
    status: 'valid' | 'invalid';
  }>> {
    try {
      const cleanPhones = phones
        .map(p => p.replace(/[^0-9]/g, ''))
        .filter(p => p.length >= 10)
        .slice(0, 50);

      if (cleanPhones.length === 0) {
        return [];
      }

      console.log(`[Meta API] Batch checking ${cleanPhones.length} contacts...`);

      const response = await this.client.post(
        `${phoneNumberId}/contacts`,
        {
          messaging_product: 'whatsapp',
          blocking: 'wait',
          force_check: true,
          contacts: cleanPhones,
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const contacts = response.data.contacts || [];

      console.log(`[Meta API] ✅ Checked ${contacts.length} contacts`);

      return contacts.map((contact: any) => ({
        input: contact.input,
        waId: contact.wa_id,
        status: contact.status,
      }));
    } catch (error: any) {
      const metaError = error.response?.data?.error;
      if (metaError?.code === 100 && metaError?.error_subcode === 33) {
        return phones.map(p => ({
          input: p.replace(/[^0-9]/g, ''),
          waId: p.replace(/[^0-9]/g, ''),
          status: 'valid' as const
        }));
      }
      console.error('[Meta API] Batch contact check failed:', error.response?.data || error.message);
      throw this.handleError(error, 'Failed to batch check contacts');
    }
  }

  extractContactFromMessageResponse(messageResponse: any): {
    waId: string;
    input: string;
  } | null {
    try {
      const contact = messageResponse.contacts?.[0];

      if (!contact) {
        return null;
      }

      return {
        waId: contact.wa_id,
        input: contact.input,
      };
    } catch (error) {
      console.error('[Meta API] Failed to extract contact from message response');
      return null;
    }
  }

  async getProfilePictureUrl(
    phoneNumberId: string,
    accessToken: string,
    waId: string
  ): Promise<string | null> {
    try {
      console.log(`[Meta API] Attempting to get profile picture for ${waId}...`);

      const response = await this.client.get(`${waId}/profile_picture`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data.url || null;
    } catch (error: any) {
      console.warn('[Meta API] Profile picture not accessible:', error.response?.data?.error?.message);
      return null;
    }
  }

  // ============================================
  // CONTACT VALIDATION
  // ============================================

  async checkContact(phoneNumberId: string, accessToken: string, phone: string): Promise<{
    contacts: Array<{
      input: string;
      wa_id: string;
      status: string;
    }>;
  }> {
    try {
      const clean = phone.replace(/[^0-9]/g, '');

      console.log(`📞 Checking contact: ${clean}`);

      const response = await this.client.post(
        `${phoneNumberId}/contacts`,
        {
          messaging_product: 'whatsapp',
          blocking: 'wait',
          force_check: true,
          contacts: [clean],
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const result = response.data;
      const status = result.contacts?.[0]?.status;

      console.log(`📞 Contact check result: ${status}`);

      return result;
    } catch (error: any) {
      const metaError = error.response?.data?.error;
      if (metaError?.code === 100 && metaError?.error_subcode === 33) {
        console.warn(`[Meta API] Contact check not supported for ID ${phoneNumberId}. Bypassing.`);
        return {
          contacts: [{
            input: phone.replace(/[^0-9]/g, ''),
            wa_id: phone.replace(/[^0-9]/g, ''),
            status: 'valid'
          }]
        };
      }
      console.error('[Meta API] Contact check failed:', error.response?.data || error.message);
      throw this.handleError(error, 'Failed to check contact');
    }
  }

  // ============================================
  // WEBHOOK METHODS
  // ============================================

  async subscribeToWebhooks(wabaId: string, accessToken: string): Promise<boolean> {
    try {
      console.log(`[Meta API] Subscribing to webhooks for WABA ${wabaId}...`);

      const response = await this.client.post<WebhookSubscribeResponse>(
        `${wabaId}/subscribed_apps`,
        null,
        {
          params: {
            access_token: accessToken,
          },
        }
      );

      const success = response.data.success === true;
      console.log(`[Meta API] ${success ? '✅' : '❌'} Webhook subscription: ${success}`);
      return success;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to subscribe to webhooks');
    }
  }

  async unsubscribeFromWebhooks(wabaId: string, accessToken: string): Promise<boolean> {
    try {
      console.log(`[Meta API] Unsubscribing from webhooks for WABA ${wabaId}...`);

      const response = await this.client.delete(`${wabaId}/subscribed_apps`, {
        params: {
          access_token: accessToken,
        },
      });

      return response.data.success === true;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to unsubscribe from webhooks');
    }
  }

  // ============================================
  // BUSINESS PROFILE
  // ============================================

  async getBusinessProfile(phoneNumberId: string, accessToken: string): Promise<any> {
    try {
      console.log(`[Meta API] Fetching business profile for ${phoneNumberId}...`);

      const response = await this.client.get(
        `${phoneNumberId}/whatsapp_business_profile`,
        {
          params: {
            access_token: accessToken,
            fields: 'about,address,description,email,profile_picture_url,websites,vertical',
          },
        }
      );

      return response.data.data?.[0] || {};
    } catch (error: any) {
      throw this.handleError(error, 'Failed to get business profile');
    }
  }

  async updateBusinessProfile(
    phoneNumberId: string,
    accessToken: string,
    profile: {
      about?: string;
      address?: string;
      description?: string;
      email?: string;
      websites?: string[];
      vertical?: string;
    }
  ): Promise<boolean> {
    try {
      console.log(`[Meta API] Updating business profile for ${phoneNumberId}...`);

      const response = await this.client.post(
        `${phoneNumberId}/whatsapp_business_profile`,
        {
          messaging_product: 'whatsapp',
          ...profile,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data.success === true;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to update business profile');
    }
  }

  // ============================================
  // MESSAGING
  // ============================================

  async sendMessage(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    message: any
  ): Promise<{ messageId: string; contacts?: any[] }> {
    const cleanTo = to.replace(/[^0-9]/g, '');
    console.log(`[Meta API] Sending message to ${cleanTo.substring(0, 5)}...`);

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      ...message,
    };

    try {
      const response = await this.withRetry(
        () => this.client.post(`${phoneNumberId}/messages`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }),
        { label: 'sendMessage' }
      );

      const messageId = response.data.messages?.[0]?.id;
      console.log(`[Meta API] ✅ Message sent: ${messageId}`);
      return { messageId, contacts: response.data.contacts };
    } catch (error: any) {
      console.error('[Meta API] ❌ Failed to send message (after retries)');
      throw this.handleError(error, 'Failed to send message');
    }
  }

  async getPhoneNumberInfo(
    phoneNumberId: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await this.client.get(
        `/${phoneNumberId}`,
        {
          params: {
            // ✅ FIX: name_status add kiya + status field
            fields:
              'verified_name,code_verification_status,display_phone_number,' +
              'quality_rating,messaging_limit_tier,platform_type,throughput,' +
              'name_status,status,id',
            access_token: accessToken,
          },
          timeout: 30000,
        }
      );

      console.log('📊 Phone Info from Meta:', {
        verified_name: response.data?.verified_name,
        quality_rating: response.data?.quality_rating,
        messaging_limit_tier: response.data?.messaging_limit_tier,
        code_verification_status: response.data?.code_verification_status,
        name_status: response.data?.name_status,
      });

      return response.data;
    } catch (error: any) {
      console.error('Failed to get phone info:', error?.response?.data);
      throw error;
    }
  }

  async sendMessageWithContactInfo(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    message: any
  ): Promise<{
    messageId: string;
    contact?: {
      waId: string;
      input: string;
    };
  }> {
    const cleanTo = to.replace(/[^0-9]/g, '');
    console.log(`[Meta API] Sending message to ${cleanTo.substring(0, 5)}...`);

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      ...message,
    };

    try {
      const response = await this.withRetry(
        () => this.client.post(`/${phoneNumberId}/messages`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }),
        { label: 'sendMessageWithContactInfo' }
      );

      const messageId = response.data.messages?.[0]?.id;
      const contact = this.extractContactFromMessageResponse(response.data);

      console.log(`[Meta API] ✅ Message sent: ${messageId}`);

      return {
        messageId,
        contact: contact || undefined,
      };
    } catch (error: any) {
      console.error('[Meta API] ❌ Failed to send message (after retries)');
      throw this.handleError(error, 'Failed to send message');
    }
  }

  async markMessageAsRead(
    phoneNumberId: string,
    accessToken: string,
    messageId: string,
    typing: boolean = false
  ): Promise<boolean> {
    const payload: any = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };
    if (typing) payload.typing_indicator = { type: 'text' };

    try {
      const response = await this.withRetry(
        () => this.client.post(`/${phoneNumberId}/messages`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }),
        { label: 'markMessageAsRead', maxRetries: 1 }
      );
      return response.data.success === true;
    } catch (error: any) {
      console.warn('[Meta API] markMessageAsRead failed (non-fatal):', error.message);
      return false;
    }
  }

  // ============================================
  // TEMPLATES
  // ============================================

  async getTemplates(wabaId: string, accessToken: string): Promise<any[]> {
    try {
      console.log(`[Meta API] Fetching templates for WABA ${wabaId}...`);

      const allTemplates: any[] = [];
      let url = `/${wabaId}/message_templates`;
      let hasMore = true;

      while (hasMore) {
        const response = await this.client.get(url, {
          params: {
            access_token: accessToken,
            fields: 'id,name,status,category,language,components,quality_score,rejected_reason',
            limit: 100,
          },
        });

        const templates = response.data.data || [];
        allTemplates.push(...templates);

        if (response.data.paging?.next) {
          url = response.data.paging.next;
        } else {
          hasMore = false;
        }
      }

      console.log(`[Meta API] ✅ Found ${allTemplates.length} templates`);
      return allTemplates;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to get templates');
    }
  }

  async getTemplate(templateId: string, accessToken: string): Promise<any> {
    try {
      const response = await this.client.get(`/${templateId}`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,status,category,language,components,quality_score,rejected_reason',
        },
      });

      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to get template');
    }
  }

  async createTemplate(
    wabaId: string,
    accessToken: string,
    template: {
      name: string;
      category: string;
      language: string;
      components: any[];
      allow_category_change?: boolean;
    }
  ): Promise<{ id: string; status: string }> {
    try {
      console.log(`[Meta API] Creating template: ${template.name}...`);

      const response = await this.client.post(
        `/${wabaId}/message_templates`,
        {
          ...template,
          allow_category_change: template.allow_category_change ?? true,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      console.log(`[Meta API] ✅ Template created: ${response.data.id}`);

      return {
        id: response.data.id,
        status: response.data.status,
      };
    } catch (error: any) {
      throw this.handleError(error, 'Failed to create template');
    }
  }

  async deleteTemplate(
    wabaId: string,
    accessToken: string,
    templateName: string
  ): Promise<boolean> {
    try {
      console.log(`[Meta API] Deleting template: ${templateName}...`);

      const response = await this.client.delete(`/${wabaId}/message_templates`, {
        params: {
          access_token: accessToken,
          name: templateName,
        },
      });

      console.log(`[Meta API] ✅ Template deleted: ${templateName}`);
      return response.data.success === true;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to delete template');
    }
  }

  // ============================================
  // MEDIA
  // ============================================

  async uploadMedia(
    phoneNumberId: string,
    accessToken: string,
    file: Buffer,
    mimeType: string,
    filename: string,
    wabaId?: string
  ): Promise<{ id: string }> {
    try {
      console.log(`[Meta API] Uploading media:`, {
        filename,
        size: file.length,
        mimeType,
        phoneNumberId,
      });

      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('file', file, {
        filename: filename,
        contentType: mimeType,
      });

      const response = await this.client.post(`/${phoneNumberId}/media`, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 60000,
      });

      console.log('[Meta API] Upload response:', {
        status: response.status,
        data: JSON.stringify(response.data),
      });

      let mediaId = null;

      if (response.data?.id) {
        mediaId = response.data.id;
      } else if (response.data?.h) {
        mediaId = response.data.h;
      } else if (response.data?.media_id) {
        mediaId = response.data.media_id;
      }

      if (!mediaId) {
        console.error('❌ No media ID found in response:', response.data);
        throw new Error('No media ID in Meta upload response');
      }

      const mediaIdStr = String(mediaId);

      if (mediaIdStr.startsWith('92') && mediaIdStr.length === 12) {
        console.error('❌ Received phone number instead of media ID:', mediaIdStr);
        throw new Error('Invalid media ID - received phone number');
      }

      console.log(`[Meta API] ✅ Media uploaded successfully:`, {
        mediaId: mediaIdStr,
        length: mediaIdStr.length,
      });

      return { id: mediaIdStr };
    } catch (error: any) {
      console.error('[Meta API] ❌ Upload failed:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw this.handleError(error, 'Failed to upload media');
    }
  }

  async getMediaUrl(mediaId: string, accessToken: string): Promise<string> {
    try {
      const response = await this.client.get(`/${mediaId}`, {
        params: {
          access_token: accessToken,
        },
      });

      return response.data.url;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to get media URL');
    }
  }

  async downloadMedia(mediaUrl: string, accessToken: string): Promise<Buffer> {
    try {
      const response = await axios.get(mediaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      throw this.handleError(error, 'Failed to download media');
    }
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getAnalytics(
    wabaId: string,
    accessToken: string,
    params: {
      start: number;
      end: number;
      granularity: 'HALF_HOUR' | 'DAILY' | 'MONTHLY';
      metrics?: string[];
    }
  ): Promise<any> {
    try {
      console.log(`[Meta API] Fetching analytics for WABA ${wabaId}...`);

      const response = await this.client.get(`${wabaId}/analytics`, {
        params: {
          access_token: accessToken,
          start: params.start,
          end: params.end,
          granularity: params.granularity,
          metric_types: params.metrics?.join(',') || 'sent,delivered,read',
        },
      });

      return response.data;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to get analytics');
    }
  }

  // ============================================
  // ERROR HANDLING
  // ============================================

  private handleError(error: any, defaultMessage: string): Error {
    const err = error.response?.data?.error;

    if (err) {
      const msg = err.message || defaultMessage;
      const apiErr = new Error(msg);
      (apiErr as any).response = error.response;
      (apiErr as any).metaError = err;
      return apiErr;
    }

    if (error.code === 'ECONNABORTED') {
      const timeoutErr = new Error('Request timeout - Meta API took too long to respond');
      (timeoutErr as any).response = error.response;
      return timeoutErr;
    }

    if (error.code === 'ENOTFOUND') {
      const networkErr = new Error('Network error - Could not reach Meta API');
      (networkErr as any).response = error.response;
      return networkErr;
    }

    const standardErr = new Error(error.message || defaultMessage);
    (standardErr as any).response = error.response;
    return standardErr;
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    opts: { label?: string; maxRetries?: number } = {}
  ): Promise<T> {
    const label = opts.label ?? 'request';
    const maxRetries = opts.maxRetries ?? 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        if (attempt === maxRetries || !this.isRetryable(error)) throw error;

        const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 300);
        const code = error?.response?.data?.error?.code ?? error?.code;
        console.warn(`[Meta API] ⏳ ${label} transient fail (code ${code}); retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  /**
   * ✅ FIX: Timeout errors on POST /messages are NO LONGER retried.
   *
   * A timeout from Meta means: we don't know if the message went through.
   * If it DID go through, retrying will:
   *   - Send the same WhatsApp message to the end-user twice
   *   - Charge the wallet twice (since fire-and-forget deduction runs per API "success")
   *
   * We prefer a failed-send that the caller sees over a silent duplicate.
   * ECONNRESET is also risky on POST for the same reason.
   *
   * Only retry on true "we never sent it" conditions:
   *   - DNS failures (ENOTFOUND)
   *   - HTTP 5xx from Meta (server errored BEFORE processing)
   *   - Meta transient error codes 131000, 131016
   */
  private isRetryable(error: any): boolean {
    // ✅ CHANGED: no longer includes ECONNABORTED (timeout) or ECONNRESET
    if (['ETIMEDOUT', 'ENOTFOUND'].includes(error?.code)) return true;

    const status = error?.response?.status;
    const code = error?.response?.data?.error?.code;

    if (code === 131000 || code === 131016) return true;

    if (status && status >= 500) return true;

    return false;
  }

  // ============================================
  // CALLING API METHODS
  // ============================================

  async enableCalling(
    phoneNumberId: string,
    accessToken: string,
    options: {
      callingEnabled: boolean;
      inboundCallsEnabled?: boolean;
      callbackEnabled?: boolean;
      restrictToCountries?: string[];
      callHoursEnabled?: boolean;
      timezone?: string;
      weeklyHours?: Array<{
        day: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
        openTime: string;
        closeTime: string;
      }>;
      holidaySchedule?: Array<{
        date: string;
        startTime: string;
        endTime: string;
      }>;
    } = { callingEnabled: true }
  ): Promise<{ success: boolean; data?: any }> {
    try {
      console.log(`[Meta API] Enabling calling for ${phoneNumberId}...`);

      const callingSettings: any = {
        status: options.callingEnabled ? 'ENABLED' : 'DISABLED',
        callback_permission_status: options.callbackEnabled !== false ? 'ENABLED' : 'DISABLED',
        sip: { status: 'DISABLED' },
      };

      if (options.restrictToCountries && options.restrictToCountries.length > 0) {
        callingSettings.call_icons = {
          restrict_to_user_countries: options.restrictToCountries,
        };
      }

      if (options.callHoursEnabled && options.weeklyHours && options.weeklyHours.length > 0) {
        callingSettings.call_hours = {
          status: 'ENABLED',
          timezone_id: options.timezone || 'Asia/Kolkata',
          weekly_operating_hours: options.weeklyHours.map((h) => ({
            day_of_week: h.day,
            open_time: h.openTime,
            close_time: h.closeTime,
          })),
          holiday_schedule: options.holidaySchedule?.map((h) => ({
            date: h.date,
            start_time: h.startTime,
            end_time: h.endTime,
          })) || [],
        };
      }

      const response = await this.client.post(
        `/${phoneNumberId}/settings`,
        { calling: callingSettings },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      console.log('[Meta API] ✅ Calling settings updated');
      return { success: true, data: response.data };

    } catch (error: any) {
      console.error('[Meta API] ❌ Enable calling failed:', error.response?.data);
      throw this.handleError(error, 'Failed to enable calling');
    }
  }

  async getCallingSettings(
    phoneNumberId: string,
    accessToken: string
  ): Promise<{
    callingEnabled: boolean;
    inboundCallsEnabled: boolean;
    callbackEnabled: boolean;
    callHoursEnabled: boolean;
  }> {
    try {
      console.log(`[Meta API] Fetching call settings for ${phoneNumberId}...`);

      const response = await this.client.get(
        `/${phoneNumberId}/settings`,
        {
          params: {
            access_token: accessToken,
            fields: 'calling,calling_settings',
          }
        }
      );

      const calling = response.data?.calling || response.data?.calling_settings || {};

      return {
        callingEnabled: calling.status === 'ENABLED' || calling.calling_enabled === true || false,
        inboundCallsEnabled: calling.inbound_calls_enabled ?? true,
        callbackEnabled:
          calling.callback_permission_status === 'ENABLED' ||
          calling.callback_enabled === true ||
          true,
        callHoursEnabled:
          calling.call_hours?.status === 'ENABLED' ||
          calling.call_hours_enabled === true ||
          false,
      };

    } catch (error: any) {
      console.error('[Meta API] ❌ Get calling settings failed');
      return {
        callingEnabled: false,
        inboundCallsEnabled: false,
        callbackEnabled: false,
        callHoursEnabled: false,
      };
    }
  }

  async initiateCall(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    options?: {
      callbackData?: string;
      bodyText?: string;
      buttonText?: string;
      businessPhoneNumber?: string;
    }
  ): Promise<{
    messageId: string;
    status: string;
  }> {
    try {
      const cleanTo = to.replace(/[^0-9]/g, '');
      console.log(`[Meta API] Sending call CTA to ${cleanTo.substring(0, 5)}...`);

      const rawBusinessPhone = (options?.businessPhoneNumber || '').replace(/[^0-9]/g, '');
      const isRealPhone = rawBusinessPhone.length >= 7 && rawBusinessPhone.length <= 15;

      let callUrl: string;
      let bodyText: string;
      let buttonText: string;

      if (isRealPhone) {
        callUrl = `https://wa.me/${rawBusinessPhone}?call=true`;
        bodyText = options?.bodyText || '📞 Aap hamse WhatsApp Call ke zariye baat kar sakte hain. Niche button dabayein.';
        buttonText = options?.buttonText || '📞 Call Now';
      } else {
        console.warn('[Meta API] ⚠️ No valid business phone number for wa.me URL — sending text-only call invite');
        callUrl = 'https://wa.me/';
        bodyText = options?.bodyText || '📞 Please call us back on WhatsApp to connect with our team.';
        buttonText = options?.buttonText || '📞 Call Us';
      }

      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: {
            text: bodyText,
          },
          action: {
            name: 'cta_url',
            parameters: {
              display_text: buttonText,
              url: callUrl,
            },
          },
        },
      };

      if (options?.callbackData) {
        payload.biz_opaque_callback_data = options.callbackData;
      }

      const response = await this.client.post(
        `/${phoneNumberId}/messages`,
        payload,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      const messageId = response.data?.messages?.[0]?.id;
      console.log('[Meta API] ✅ Call CTA message sent:', messageId);

      return {
        messageId,
        status: response.data?.messages?.[0]?.message_status || 'sent',
      };

    } catch (error: any) {
      console.error('[Meta API] ❌ Call initiation failed:', error.response?.data);
      throw this.handleError(error, 'Failed to initiate call');
    }
  }

  async requestCallPermission(
    phoneNumberId: string,
    accessToken: string,
    to: string
  ): Promise<{
    permitted: boolean;
    permissionId?: string;
  }> {
    try {
      const cleanTo = to.replace(/[^0-9]/g, '');

      const response = await this.client.post(
        `/${phoneNumberId}/call_permissions`,
        {
          messaging_product: 'whatsapp',
          to: cleanTo,
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      return {
        permitted: true,
        permissionId: response.data?.id,
      };

    } catch (error: any) {
      const metaErr = error.response?.data?.error;
      if (metaErr?.code === 131056) {
        return { permitted: false };
      }
      throw this.handleError(error, 'Failed to request call permission');
    }
  }

  async subscribeToCallsWebhook(
    wabaId: string,
    accessToken: string
  ): Promise<boolean> {
    try {
      console.log('[Meta API] Subscribing to calls webhook...');

      const response = await this.client.post(
        `/${wabaId}/subscribed_apps`,
        {
          subscribed_fields: ['messages', 'calls', 'call_logs'],
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      console.log('[Meta API] ✅ Calls webhook subscribed');
      return response.data?.success === true;

    } catch (error: any) {
      console.error('[Meta API] ❌ Calls webhook subscription failed');
      throw this.handleError(error, 'Failed to subscribe to calls webhook');
    }
  }

  async getCallLogs(
    phoneNumberId: string,
    accessToken: string,
    limit: number = 20
  ): Promise<Array<{
    callId: string;
    direction: 'inbound' | 'outbound';
    status: string;
    duration?: number;
    startTime: string;
    endTime?: string;
    from: string;
    to: string;
  }>> {
    try {
      const response = await this.client.get(
        `/${phoneNumberId}/call_logs`,
        {
          params: {
            access_token: accessToken,
            limit,
            fields: 'id,direction,status,duration,start_time,end_time,from,to',
          }
        }
      );

      const logs = response.data?.data || [];

      return logs.map((log: any) => ({
        callId: log.id,
        direction: log.direction,
        status: log.status,
        duration: log.duration,
        startTime: log.start_time,
        endTime: log.end_time,
        from: log.from,
        to: log.to,
      }));

    } catch (error: any) {
      console.error('[Meta API] ❌ Get call logs failed');
      return [];
    }
  }

  // ============================================
  // UTILITY
  // ============================================

  async isTokenValid(accessToken: string): Promise<boolean> {
    try {
      const debugInfo = await this.debugToken(accessToken);
      return debugInfo.data.is_valid === true;
    } catch {
      return false;
    }
  }

  async getTokenExpiry(accessToken: string): Promise<Date | null> {
    try {
      const debugInfo = await this.debugToken(accessToken);
      if (debugInfo.data.expires_at) {
        return new Date(debugInfo.data.expires_at * 1000);
      }
      return null;
    } catch {
      return null;
    }
  }

  getGraphVersion(): string {
    return this.graphVersion;
  }
}

export const metaApi = new MetaApiClient();
export default metaApi;