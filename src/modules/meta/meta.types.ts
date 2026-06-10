// 📁 src/modules/meta/meta.types.ts - COMPLETE META TYPES

// ============================================
// CONFIGURATION
// ============================================

export interface MetaConfig {
  appId: string;
  appSecret: string;
  configId: string; // Embedded Signup Config ID
  graphApiVersion: string;
  webhookVerifyToken: string;
  redirectUri: string;
}

// ============================================
// OAUTH & TOKEN TYPES
// ============================================

export interface TokenExchangeRequest {
  code: string;
  organizationId: string;
}

export interface TokenExchangeResponse {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
}

export interface EmbeddedSignupResponse {
  accessToken: string;
  dataAccessExpirationTime: number;
  expiresIn: number;
  longLivedToken?: string;
}

export interface DebugTokenResponse {
  data: {
    app_id: string;
    type: string;
    application: string;
    data_access_expires_at: number;
    expires_at: number;
    is_valid: boolean;
    scopes: string[];
    granular_scopes?: Array<{
      scope: string;
      target_ids?: string[];
    }>;
    user_id?: string;
  };
}

export interface MetaOAuthState {
  state: string;
  organizationId: string;
  userId: string;
  expiresAt: Date;
}

// ============================================
// WABA (WhatsApp Business Account) TYPES
// ============================================

export interface WABAInfo {
  wabaId: string;
  name: string;
  timezone: string;
  messageTemplateNamespace: string;
  ownerBusinessId: string;
  phoneNumbers: PhoneNumberInfo[];
}

export interface SharedWABAInfo {
  id: string;
  name: string;
  currency: string;
  timezone_id: string;
  message_template_namespace?: string;
  owner_business_info?: {
    id: string;
    name: string;
  };
  on_behalf_of_business_info?: {
    id: string;
    name: string;
  };
  account_review_status?: string;
}

// ============================================
// PHONE NUMBER TYPES
// ============================================

export interface PhoneNumberInfo {
  id: string;
  verifiedName: string;
  displayPhoneNumber: string;
  qualityRating: string;
  status?: string;
  codeVerificationStatus?: string;
  nameStatus?: string;
  messagingLimitTier?: string;
  platformType?: string;
  throughput?: {
    level: string;
  };
}

// ============================================
// WEBHOOK TYPES
// ============================================

export interface WebhookSubscribeResponse {
  success: boolean;
}

export interface SubscribedApps {
  data: Array<{
    whatsapp_business_api_data: {
      id: string;
      link: string;
      name: string;
    };
  }>;
}

// ============================================
// CONNECTION FLOW TYPES
// ============================================

export interface ConnectionProgress {
  step:
  | 'TOKEN_EXCHANGE'
  | 'FETCHING_WABA'
  | 'FETCHING_PHONE'
  | 'SUBSCRIBE_WEBHOOK'
  | 'REGISTER_PHONE'
  | 'SAVING'
  | 'COMPLETED';
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  message: string;
  data?: any;
}

export interface MetaConnectionResult {
  success: boolean;
  account?: any;
  error?: string;
}

// ============================================
// BUSINESS PROFILE TYPES
// ============================================

export interface BusinessProfile {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  profile_picture_url?: string;
  websites?: string[];
  vertical?: string;
}

// ============================================
// MESSAGING TYPES
// ============================================

export interface SendMessageResponse {
  messageId: string;
  contacts?: Array<{
    input: string;
    wa_id: string;
  }>;
}

export interface MessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text' | 'template' | 'image' | 'video' | 'document' | 'audio';
  text?: {
    body: string;
    preview_url?: boolean;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
  image?: {
    id?: string;
    link?: string;
    caption?: string;
  };
  video?: {
    id?: string;
    link?: string;
    caption?: string;
  };
  document?: {
    id?: string;
    link?: string;
    filename?: string;
    caption?: string;
  };
  audio?: {
    id?: string;
    link?: string;
  };
}

// ============================================
// TEMPLATE TYPES
// ============================================

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

export interface Template {
  id: string;
  name: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components: TemplateComponent[];
  quality_score?: {
    score: string;
    date: number;
  };
  rejected_reason?: string;
}

export interface CreateTemplateRequest {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: TemplateComponent[];
  allow_category_change?: boolean;
}

// ============================================
// MEDIA TYPES
// ============================================

export interface MediaUploadResponse {
  id: string;
}

export interface MediaInfo {
  id: string;
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface AnalyticsParams {
  start: number; // Unix timestamp
  end: number; // Unix timestamp
  granularity: 'HALF_HOUR' | 'DAILY' | 'MONTHLY';
  metrics?: string[];
}

export interface AnalyticsResponse {
  data: Array<{
    data_points: Array<{
      start: number;
      end: number;
      sent: number;
      delivered: number;
    }>;
  }>;
}

// ============================================
// ERROR TYPES
// ============================================

export interface MetaApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
    fbtrace_id: string;
  };
}

export interface MetaErrorResponse {
  success: false;
  error: {
    message: string;
    code: number;
    subcode?: number;
    type: string;
    fbtrace_id?: string;
  };
}

// ============================================
// WEBHOOK PAYLOAD TYPES
// ============================================

export interface WebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: 'whatsapp';
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: {
          name: string;
        };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'location' | 'contacts';
        text?: {
          body: string;
        };
        image?: {
          id: string;
          mime_type: string;
          sha256: string;
        };
        video?: {
          id: string;
          mime_type: string;
          sha256: string;
        };
        document?: {
          id: string;
          filename: string;
          mime_type: string;
          sha256: string;
        };
        audio?: {
          id: string;
          mime_type: string;
          sha256: string;
        };
        location?: {
          latitude: number;
          longitude: number;
          name?: string;
          address?: string;
        };
        contacts?: Array<{
          name: {
            formatted_name: string;
            first_name?: string;
            last_name?: string;
          };
          phones?: Array<{
            phone: string;
            type?: string;
          }>;
        }>;
        context?: {
          from: string;
          id: string;
        };
      }>;
      statuses?: Array<{
        id: string;
        status: 'sent' | 'delivered' | 'read' | 'failed';
        timestamp: string;
        recipient_id: string;
        conversation?: {
          id: string;
          origin: {
            type: string;
          };
        };
        pricing?: {
          billable: boolean;
          pricing_model: string;
          category: string;
        };
        errors?: Array<{
          code: number;
          title: string;
          message: string;
          error_data: {
            details: string;
          };
        }>;
      }>;
      errors?: Array<{
        code: number;
        title: string;
        message: string;
        error_data: {
          details: string;
        };
      }>;
    };
    field: string;
  }>;
}

export interface WebhookPayload {
  object: 'whatsapp_business_account';
  entry: WebhookEntry[];
}

// ============================================
// UTILITY TYPES
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
    next?: string;
    previous?: string;
  };
}

export interface SuccessResponse {
  success: true;
}

export type MetaResponse<T> = T | MetaErrorResponse;

// ============================================
// TYPE GUARDS
// ============================================

export function isMetaError(response: any): response is MetaErrorResponse {
  return response && response.success === false && response.error !== undefined;
}

export function isWebhookMessage(entry: WebhookEntry): boolean {
  return entry.changes.some((change) => change.value.messages !== undefined);
}

export function isWebhookStatus(entry: WebhookEntry): boolean {
  return entry.changes.some((change) => change.value.statuses !== undefined);
}