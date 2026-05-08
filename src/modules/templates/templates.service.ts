import axios from 'axios';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { TemplateStatus, Prisma } from '@prisma/client';
import {
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplatesQueryInput,
  TemplateResponse,
  TemplatesListResponse,
  TemplateStats,
  TemplatePreview,
  TemplateButton,
  TemplateVariable,
} from './templates.types';
import { whatsappApi } from '../whatsapp/whatsapp.api';
import { metaService } from '../meta/meta.service';
import { metaApi } from '../meta/meta.api';
import { safeDecryptStrict } from '../../utils/encryption';

// ============================================
// TYPES
// ============================================

interface WhatsAppAccountData {
  id: string;
  phoneNumberId: string;
  wabaId: string;
  phoneNumber: string;
  accessToken: string;
  status: string;
  isDefault?: boolean;
}

// ============================================
// HELPERS
// ============================================

const formatTemplate = (template: any): TemplateResponse => ({
  id: template.id,
  name: template.name,
  language: template.language,
  category: template.category,
  headerType: template.headerType,
  headerContent: template.headerContent,  // ✅ This should have Cloudinary URL
  headerMediaId: template.headerMediaId,  // ✅ This has Meta handle
  bodyText: template.bodyText,
  footerText: template.footerText,
  buttons: (template.buttons as TemplateButton[]) || [],
  variables: (template.variables as TemplateVariable[]) || [],
  status: template.status,
  metaTemplateId: template.metaTemplateId,
  rejectionReason: template.rejectionReason,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
  whatsappAccount: undefined,
  wabaId: template.wabaId || null,
  whatsappAccountId: template.whatsappAccountId || null,
});

/**
 * ✅ NEW: Helper to upload media to Meta during template creation
 */
const uploadMediaToMeta = async (
  cloudinaryUrl: string,
  headerType: string,
  waData: { phoneNumberId: string; accessToken: string; wabaId: string }
): Promise<string> => {
  try {
    console.log('📤 Uploading media to Meta:', { cloudinaryUrl, headerType });

    // Download from Cloudinary
    const response = await axios.get(cloudinaryUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WabMeta/1.0)',
        'Accept': '*/*'
      }
    });

    const buffer = Buffer.from(response.data);
    const mimeType = response.headers['content-type'] || 
      (headerType === 'IMAGE' ? 'image/jpeg' : 
       headerType === 'VIDEO' ? 'video/mp4' : 
       'application/pdf');

    const filename = cloudinaryUrl.split('/').pop()?.split('?')[0] || 
      `media.${mimeType.split('/')[1]}`;

    console.log('📥 Downloaded:', { size: buffer.length, mimeType, filename });

    // Upload to Meta
    const result = await metaApi.uploadMedia(
      waData.phoneNumberId,
      waData.accessToken,
      buffer,
      mimeType,
      filename,
      waData.wabaId
    );

    console.log('✅ Meta upload successful:', result.id);
    return result.id;

  } catch (error: any) {
    console.error('❌ Meta upload failed:', error.message);
    throw new AppError(
      `Failed to upload ${headerType.toLowerCase()} to WhatsApp: ${error.response?.data?.error?.message || error.message}`,
      400
    );
  }
};

const extractVariables = (text: string): number[] => {
  const regex = /\{\{(\d+)\}\}/g;
  const variables: number[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    variables.push(parseInt(match[1], 10));
  }
  return [...new Set(variables)].sort((a, b) => a - b);
};

const replaceVariables = (text: string, values: Record<string, string>): string => {
  return text.replace(/\{\{(\d+)\}\}/g, (match, index) => values[index] || match);
};

const toJsonValue = (value: any): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value));

/**
 * ✅ IMPROVED: Keep language as-is, no forced conversion
 * Meta accepts both formats: "en", "en_US", "hi", "hi_IN"
 */
const toMetaLanguage = (lang?: string): string => {
  const l = String(lang || '').trim();
  if (!l) return 'en_US';

  // If it's already a valid-looking Meta language code (e.g., 'en', 'en_US', 'hi'), use it directly
  if (l.length >= 2 && l.length <= 6 && !l.includes(' ')) {
    return l;
  }

  const mapping: Record<string, string> = {
    'english': 'en_US',
    'hindi': 'hi',
    'spanish': 'es_ES',
    'portuguese': 'pt_BR',
    'french': 'fr_FR',
    'german': 'de_DE',
    'italian': 'it_IT',
  };

  const lower = l.toLowerCase();
  if (mapping[lower]) return mapping[lower];
  return l;
};

/**
 * Normalizes template name to Meta's strict requirements
 */
const normalizeTemplateName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores
};

const normalizeHeaderType = (t?: string | null) => {
  const headerType = String(t || 'NONE').toUpperCase();
  return ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) ? headerType : 'NONE';
};
const buildMetaTemplatePayload = (t: {
  name: string;
  language: string;
  category: string;
  headerType?: string | null;
  headerContent?: string | null;
  headerMediaId?: string | null;
  bodyText: string;
  footerText?: string | null;
  buttons?: TemplateButton[];
  variables?: TemplateVariable[];
}) => {
  const components: any[] = [];
  const headerType = normalizeHeaderType(t.headerType);

  console.log('🔧 Building Meta template payload:', {
    name: t.name,
    language: t.language,
    headerType,
    hasMediaUrl: !!(t.headerMediaId || t.headerContent),
  });

  // ============================================
  // HEADER COMPONENT
  // ============================================
  if (headerType && headerType !== 'NONE') {
    // TEXT Header
    if (headerType === 'TEXT' && t.headerContent) {
      const headerVars = extractVariables(t.headerContent);
      const headerComp: any = {
        type: 'HEADER',
        format: 'TEXT',
        text: t.headerContent,
      };

      if (headerVars.length > 0) {
        const samples = headerVars.map(idx => {
          const v = t.variables?.find(var_item => var_item.index === idx);
          return (v as any)?.example || `Example${idx}`;
        });
        headerComp.example = {
          header_text: samples,
        };
      }

      components.push(headerComp);
      console.log('✅ TEXT header added');
    }
    // ✅ FIXED: MEDIA Headers (IMAGE, VIDEO, DOCUMENT)
    else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
      let mediaId = t.headerMediaId || t.headerContent;

      if (!mediaId) {
        throw new AppError(
          `${headerType} template requires uploaded media. Please upload a file first.`,
          400
        );
      }

      // ✅ Clean up smuggled URLs if present
      if (mediaId.includes(':::')) {
        mediaId = mediaId.split(':::')[0];
      }

      const headerComp: any = {
        type: 'HEADER',
        format: headerType,
      };

      // ✅ CRITICAL: Detect media ID type and use correct field

      if (mediaId.startsWith('4:')) {
        // ✅ TYPE 1: Resumable Upload Handle (e.g., "4:dGVtcGxh...")
        // Meta Template API accepts this in header_handle
        console.log(`✅ Using resumable upload handle for ${headerType}`);
        headerComp.example = {
          header_handle: [mediaId],
        };
      } else if (/^\d+$/.test(mediaId)) {
        // ✅ TYPE 2: Numeric Media ID (e.g., "1234567890")
        // Also valid for template creation via header_handle
        console.log(`✅ Using numeric media ID for ${headerType}:`, mediaId);
        headerComp.example = {
          header_handle: [mediaId],
        };
      } else if (mediaId.startsWith('http')) {
        // ✅ TYPE 3: URL (Cloudinary or other hosted URL)
        // Meta also accepts URLs in some cases
        console.log(`✅ Using media URL for ${headerType}`);
        headerComp.example = {
          header_handle: [mediaId],
        };
      } else {
        // ✅ TYPE 4: Unknown format - try as handle anyway
        console.warn(`⚠️ Unknown media ID format, attempting as handle: ${mediaId.substring(0, 30)}...`);
        headerComp.example = {
          header_handle: [mediaId],
        };
      }

      components.push(headerComp);
      console.log(`✅ ${headerType} header added`);
    }
  }

  // ============================================
  // BODY COMPONENT (unchanged)
  // ============================================
  const bodyVars = extractVariables(t.bodyText);
  const bodyComp: any = { type: 'BODY', text: t.bodyText };

  if (bodyVars.length > 0) {
    const samples = bodyVars.map(idx => {
      const v = t.variables?.find(var_item => var_item.index === idx);
      return (v as any)?.example || `Sample${idx}`;
    });
    bodyComp.example = {
      body_text: [samples],
    };
  }
  components.push(bodyComp);

  // ============================================
  // FOOTER COMPONENT (unchanged)
  // ============================================
  if (t.footerText) {
    components.push({ type: 'FOOTER', text: t.footerText });
  }

  // ============================================
  // BUTTONS COMPONENT (unchanged)
  // ============================================
  if (t.buttons && t.buttons.length > 0) {
    const buttons = t.buttons.slice(0, 10).map((b: any) => {
      const type = String(b.type || '').toUpperCase();
      const btn: any = {
        type: type.includes('PHONE') ? 'PHONE_NUMBER' : (type.includes('URL') ? 'URL' : 'QUICK_REPLY'),
        text: b.text
      };

      if (btn.type === 'URL') {
        if (!b.url) throw new AppError('URL button requires url field', 400);
        btn.url = b.url;
      } else if (btn.type === 'PHONE_NUMBER') {
        btn.phone_number = b.phoneNumber || b.phone_number;
      }

      return btn;
    });

    components.push({ type: 'BUTTONS', buttons });
  }

  const payload = {
    name: t.name,
    language: toMetaLanguage(t.language),
    category: String(t.category || 'UTILITY').toUpperCase(),
    components,
  };

  console.log('📦 Final Meta payload:', JSON.stringify(payload, null, 2));

  return payload;
};

/**
 * ✅ FIXED: Get WhatsApp Account with robust retry logic
 */
const getWhatsAppAccountWithToken = async (
  organizationId: string,
  whatsappAccountId?: string
): Promise<{
  account: WhatsAppAccountData;
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
}> => {
  const MAX_RETRIES = 5;
  const RETRY_DELAYS = [500, 1000, 2000, 3000, 5000]; // Progressive delays

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`🔍 [Attempt ${attempt + 1}/${MAX_RETRIES}] Getting WhatsApp account:`, {
        organizationId,
        whatsappAccountId: whatsappAccountId || 'auto-detect',
      });

      // ============================================
      // METHOD 1: Try WhatsAppAccount table
      // ============================================
      let waAccount = null;

      if (whatsappAccountId) {
        // ✅ Direct ID lookup (most reliable)
        waAccount = await prisma.whatsAppAccount.findFirst({
          where: {
            id: whatsappAccountId,
            organizationId,
          },
        });

        console.log(`   Direct lookup by ID:`, waAccount ? '✅ Found' : '❌ Not found');
      }

      // ✅ Fallback: Find ANY connected account for this org
      if (!waAccount) {
        waAccount = await prisma.whatsAppAccount.findFirst({
          where: {
            organizationId,
            status: 'CONNECTED',
          },
          orderBy: [
            { isDefault: 'desc' },
            { createdAt: 'desc' },
          ],
        });

        console.log(`   Fallback connected lookup:`, waAccount ? '✅ Found' : '❌ Not found');
      }

      // ✅ Last resort: Find ANY account for this org (even pending)
      if (!waAccount) {
        waAccount = await prisma.whatsAppAccount.findFirst({
          where: {
            organizationId,
          },
          orderBy: [
            { status: 'asc' }, // CONNECTED is 'C', DISCONNECTED is 'D', PENDING is 'P'. Sort by status might be tricky.
            { createdAt: 'desc' },
          ],
        });

        console.log(`   Last resort lookup:`, waAccount ? `✅ Found (status: ${waAccount.status})` : '❌ Not found');
      }

      // ============================================
      // METHOD 2: Try MetaConnection table (new structure)
      // ============================================
      if (!waAccount) {
        console.log('📋 Trying MetaConnection table...');

        try {
          const metaConnection = await (prisma as any).metaConnection.findUnique({
            where: { organizationId },
            include: {
              phoneNumbers: {
                where: { isActive: true },
                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
              },
            },
          });

          if (metaConnection && metaConnection.phoneNumbers?.length > 0) {
            const primaryPhone = metaConnection.phoneNumbers[0];

            console.log('✅ Found via MetaConnection:', {
              wabaId: metaConnection.wabaId,
              phone: primaryPhone.phoneNumber,
            });

            // Decrypt token
            const decryptedToken = safeDecryptStrict(metaConnection.accessToken);

            if (!decryptedToken) {
              throw new AppError('Failed to decrypt MetaConnection token', 500);
            }

            return {
              account: {
                id: primaryPhone.id,
                phoneNumberId: primaryPhone.phoneNumberId,
                wabaId: metaConnection.wabaId,
                phoneNumber: primaryPhone.phoneNumber,
                accessToken: decryptedToken,
                status: metaConnection.status,
              },
              accessToken: decryptedToken,
              wabaId: metaConnection.wabaId,
              phoneNumberId: primaryPhone.phoneNumberId,
            };
          }
        } catch (metaError: any) {
          console.log('⚠️ MetaConnection not available:', metaError.message);
        }
      }

      // ============================================
      // Account Found - Validate & Return
      // ============================================
      if (waAccount) {
        console.log('✅ WhatsApp account found:', {
          id: waAccount.id,
          phone: waAccount.phoneNumber,
          status: waAccount.status,
          wabaId: waAccount.wabaId,
        });

        // Check if account has required fields
        if (!waAccount.wabaId) {
          throw new AppError(
            'WhatsApp Business Account ID missing. Please reconnect in Settings → WhatsApp.',
            400
          );
        }

        if (!waAccount.accessToken) {
          throw new AppError(
            'WhatsApp access token missing. Please reconnect in Settings → WhatsApp.',
            400
          );
        }

        // Get decrypted token
        const accountWithToken = await metaService.getAccountWithToken(waAccount.id);

        if (!accountWithToken) {
          throw new AppError(
            'Failed to decrypt token. Please reconnect in Settings → WhatsApp.',
            400
          );
        }

        return {
          account: {
            id: waAccount.id,
            phoneNumberId: waAccount.phoneNumberId,
            wabaId: waAccount.wabaId,
            phoneNumber: waAccount.phoneNumber,
            accessToken: accountWithToken.accessToken,
            status: waAccount.status,
            isDefault: waAccount.isDefault,
          },
          accessToken: accountWithToken.accessToken,
          wabaId: waAccount.wabaId,
          phoneNumberId: waAccount.phoneNumberId,
        };
      }

      // ============================================
      // Account Not Found - Retry or Throw
      // ============================================
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`⏳ Account not found, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // All retries exhausted
      throw new AppError(
        'No WhatsApp account found. Please connect your WhatsApp Business account in Settings → WhatsApp.',
        400
      );

    } catch (error: any) {
      // If it's a retryable error and we have retries left
      if (
        attempt < MAX_RETRIES - 1 &&
        (error.message.includes('not found') || error.message.includes('No WhatsApp'))
      ) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`⏳ Error: ${error.message}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Non-retryable or retries exhausted
      console.error('❌ getWhatsAppAccountWithToken failed:', error);
      throw error;
    }
  }

  // Should never reach here, but TypeScript requires it
  throw new AppError('No WhatsApp account found after all retries.', 400);
};

// ============================================
// SERVICE CLASS
// ============================================

export class TemplatesService {
  /**
   * Validate template before creation/update
   */
  validateTemplate(input: CreateTemplateInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Name validation
    if (!/^[a-z0-9_]+$/.test(input.name)) {
      errors.push('Template name must be lowercase with underscores only (a-z, 0-9, _)');
    }

    if (input.name.length < 1 || input.name.length > 512) {
      errors.push('Template name must be between 1 and 512 characters');
    }

    // Body validation
    if (!input.bodyText || input.bodyText.trim().length === 0) {
      errors.push('Body text is required');
    }

    if (input.bodyText && input.bodyText.length > 1024) {
      errors.push('Body text exceeds 1024 characters');
    }

    // Header validation
    const headerType = normalizeHeaderType(input.headerType);
    if (headerType === 'TEXT' && input.headerContent) {
      if (input.headerContent.length > 60) {
        errors.push('Header text exceeds 60 characters');
      }
    }

    // Footer validation
    if (input.footerText && input.footerText.length > 60) {
      errors.push('Footer text exceeds 60 characters');
    }

    // Buttons validation
    if (input.buttons && input.buttons.length > 3) {
      errors.push('Maximum 3 buttons allowed');
    }

    // Variables validation
    const varsInBody = extractVariables(input.bodyText);
    for (let i = 0; i < varsInBody.length; i++) {
      if (varsInBody[i] !== i + 1) {
        errors.push(`Variables must be sequential starting from {{1}}. Found gap at {{${i + 1}}}`);
        break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * ✅ NEW: Helper to extract smuggled URL from mediaId
   */
  private extractSmuggledMedia(
    mediaId: string | undefined | null,
    existingContent: string | undefined | null
  ): { mediaId: string | null; content: string | null } {

    const isScontent = (url: string | null | undefined) =>
      !!url && url.includes('scontent.whatsapp');

    const isExpiredHandle = (id: string | null | undefined) =>
      !!id && id.startsWith('4:');

    // ✅ CASE 1: Clean format (new upload - no smuggling)
    if (mediaId && !mediaId.includes(':::')) {
      return {
        mediaId: mediaId,
        content: isScontent(existingContent)
          ? null
          : existingContent || null,
      };
    }

    // ✅ CASE 2: Legacy smuggled format "handle:::url"
    if (mediaId?.includes(':::')) {
      const parts = mediaId.split(':::');
      const rawHandle = parts[0] || null;
      const smuggledUrl = parts[1] || null;

      // Clean URL prefer karo
      const content =
        (smuggledUrl && !isScontent(smuggledUrl) ? smuggledUrl : null) ||
        (existingContent && !isScontent(existingContent) ? existingContent : null);

      return { mediaId: rawHandle, content };
    }

    // ✅ CASE 3: No mediaId
    return {
      mediaId: null,
      content: isScontent(existingContent) ? null : existingContent || null,
    };
  }

  /**
   * Create new template
   */
  async create(
    organizationId: string,
    input: CreateTemplateInput & {
      whatsappAccountId?: string;
      headerMediaId?: string;
      headerContent?: string;
      // ✅ NEW: Clean fields from updated upload
      metaNumericId?: string | null;
      cloudinaryUrl?: string | null;
      permanentUrl?: string | null;
    }
  ): Promise<TemplateResponse> {

    const headerType = normalizeHeaderType(input.headerType);

    // ✅ Resolve best media fields
    let finalMetaId: string | null = null;
    let finalCloudinaryUrl: string | null = null;

    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {

      // === Permanent URL resolve karo ===
      // Priority: cloudinaryUrl > permanentUrl > smuggled URL > headerContent
      finalCloudinaryUrl =
        input.cloudinaryUrl ||
        input.permanentUrl ||
        (() => {
          // Legacy: extract from smuggled format
          if (input.headerMediaId?.includes(':::')) {
            const url = input.headerMediaId.split(':::')[1];
            return url && url.startsWith('http') && !url.includes('scontent') 
              ? url 
              : null;
          }
          return null;
        })() ||
        (input.headerContent?.startsWith('http') &&
          !input.headerContent.includes('scontent')
            ? input.headerContent
            : null) ||
        null;

      // === Meta ID resolve karo ===
      // Priority: metaNumericId > numeric from headerMediaId > handle
      finalMetaId =
        (input.metaNumericId || null) ||
        (() => {
          const rawId = input.headerMediaId?.split(':::')[0];
          // Numeric ID = permanent (best choice)
          if (rawId && /^\d+$/.test(rawId)) return rawId;
          return null;
        })() ||
        // Handle (4:xxx) = template creation ke liye ok
        input.headerMediaId?.split(':::')[0] ||
        null;

      console.log('✅ [Create] Media fields resolved:', {
        finalMetaId: finalMetaId
          ? (finalMetaId.length > 20
              ? finalMetaId.substring(0, 20) + '...'
              : finalMetaId)
          : 'none',
        finalCloudinaryUrl: finalCloudinaryUrl
          ? finalCloudinaryUrl.substring(0, 60)
          : 'none',
        hasNumericId: finalMetaId ? /^\d+$/.test(finalMetaId) : false,
      });
    }

    // Text header content
    const mediaHeaderContent =
      ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)
        ? finalCloudinaryUrl    // ✅ Permanent URL DB me store hoga
        : input.headerContent || null;

    // Validate template
    const validation = this.validateTemplate(input);
    if (!validation.valid) {
      throw new AppError(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Check for WhatsApp account first
    let waData: Awaited<ReturnType<typeof getWhatsAppAccountWithToken>> | null = null;
    let canSyncToMeta = false;
    try {
      waData = await getWhatsAppAccountWithToken(organizationId, input.whatsappAccountId);
      canSyncToMeta = true;
    } catch (err) {
      canSyncToMeta = false;
    }

    // Check for duplicates
    const existing = await prisma.template.findFirst({
      where: {
        organizationId,
        name: input.name,
        language: input.language,
      },
    });

    if (existing) {
      throw new AppError('Template with this name and language already exists', 409);
    }

    // Extract variables
    const extractedVars = extractVariables(input.bodyText);
    const finalVariables =
      input.variables && input.variables.length > 0
        ? input.variables
        : extractedVars.map((index) => ({ index, type: 'text' as const }));

    // Create template data
    const templateData: any = {
      organizationId,
      name: normalizeTemplateName(input.name),
      language: input.language,
      category: input.category,
      headerType: input.headerType || null,
      headerContent: mediaHeaderContent,   // ✅ Permanent URL
      headerMediaId: finalMetaId,          // ✅ Numeric ID ya handle
      bodyText: input.bodyText,
      footerText: input.footerText || null,
      buttons: toJsonValue(input.buttons || []),
      variables: toJsonValue(finalVariables),
      status: canSyncToMeta ? 'PENDING' : 'DRAFT',
      metaTemplateId: null,
      rejectionReason: null,
    };

    // Store wabaId and whatsappAccountId if available
    if (waData) {
      if (waData.wabaId) {
        templateData.wabaId = waData.wabaId;
      }
      if (waData.account?.id) {
        templateData.whatsappAccountId = waData.account.id;
      }
    }

    // Create template in database
    const template = await prisma.template.create({
      data: templateData,
    });

    console.log(`✅ Template created: ${template.id} (status: ${template.status})`);

    // ✅ Submit to Meta if account is available
    if (canSyncToMeta && waData) {
      try {
        const metaHeaderMediaId = (() => {
          if (!finalMetaId) return null;
          // Pure numeric = OK for template creation
          if (/^\d+$/.test(finalMetaId)) return finalMetaId;
          // Handle "4:xxx" = OK for CREATION only (header_handle field)
          if (/^\d+:[A-Za-z0-9+/=:_-]+$/.test(finalMetaId)) return finalMetaId;
          return null;
        })();

        const metaPayload = buildMetaTemplatePayload({
          name: normalizeTemplateName(input.name),
          language: input.language,
          category: input.category,
          headerType: input.headerType || null,
          headerContent: finalCloudinaryUrl || input.headerContent || null,
          headerMediaId: metaHeaderMediaId,
          bodyText: input.bodyText,
          footerText: input.footerText || null,
          buttons: (input.buttons || []) as any,
          variables: finalVariables,
        });

        console.log('📤 Submitting template to Meta WABA:', waData.wabaId);
        console.log('📝 Template language:', toMetaLanguage(input.language));

        console.log('📦 Meta Payload:', JSON.stringify(metaPayload, null, 2));

        const metaRes = await (whatsappApi as any).createMessageTemplateByVersion(
          waData.wabaId,
          waData.accessToken,
          metaPayload,
          'v21.0'
        );

        const metaTemplateId = metaRes?.id || metaRes?.template_id;

        if (metaTemplateId) {
          await prisma.template.update({
            where: { id: template.id },
            data: {
              metaTemplateId: String(metaTemplateId),
              status: 'PENDING',
            },
          });
          console.log('✅ Meta template created:', metaTemplateId);
        }
      } catch (e: any) {
        const metaErr = e.metaError || e.response?.data?.error;
        const msg = String(metaErr?.message || e?.message || 'Meta submission failed');

        console.error('❌ Meta template create failed:', {
          code: metaErr?.code,
          message: metaErr?.message,
          error_subcode: metaErr?.error_subcode,
          error_data: metaErr?.error_data,
          templateName: input.name,
          language: toMetaLanguage(input.language),
          message_raw: e.message
        });

        await prisma.template.update({
          where: { id: template.id },
          data: {
            status: 'REJECTED',
            rejectionReason: msg,
          },
        });
      }
    }

    // Fetch latest template state
    const latest = await prisma.template.findUnique({
      where: { id: template.id },
    });

    return formatTemplate(latest);
  }

  /**
   * Get list of templates with filtering
   */
  async getList(
    organizationId: string,
    query: TemplatesQueryInput & { whatsappAccountId?: string; wabaId?: string }
  ): Promise<TemplatesListResponse> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      category,
      language,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      whatsappAccountId,
      wabaId,
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.TemplateWhereInput = { organizationId };

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { bodyText: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (category) where.category = category;
    if (language) where.language = language;

    // Filter by whatsappAccountId or wabaId
    if (whatsappAccountId) {
      (where as any).whatsappAccountId = whatsappAccountId;
    }
    if (wabaId) {
      (where as any).wabaId = wabaId;
    }

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.template.count({ where }),
    ]);

    console.log(`📋 Found ${templates.length} templates (total: ${total})`);

    return {
      templates: templates.map(formatTemplate),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get approved templates only
   */
  async getApprovedTemplates(
    organizationId: string,
    whatsappAccountId?: string,
    wabaId?: string
  ): Promise<TemplateResponse[]> {
    const where: Prisma.TemplateWhereInput = {
      organizationId,
      status: 'APPROVED',
    };

    if (wabaId) {
      (where as any).wabaId = wabaId;
    } else if (whatsappAccountId) {
      (where as any).whatsappAccountId = whatsappAccountId;
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    console.log(`📋 Found ${templates.length} approved templates`);

    return templates.map(formatTemplate);
  }

  /**
   * Sync templates from Meta
   */
  async syncFromMeta(
    organizationId: string,
    whatsappAccountId?: string
  ): Promise<{ message: string; synced: number }> {
    console.log('🔄 Syncing templates from Meta...');

    const waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);

    const metaTemplates = await whatsappApi.listMessageTemplates(
      waData.wabaId,
      waData.accessToken
    );

    console.log(`📥 Found ${metaTemplates.length} templates in Meta`);

    // ✅ Track found names to handle deletions
    const foundMetaKeys = new Set<string>();

    let synced = 0;
    for (const mt of metaTemplates) {
      try {
        const metaId = String(mt.id);
        const metaName = String(mt.name);
        const metaLang = String(mt.language);
        
        // Track this key (name:lang)
        foundMetaKeys.add(`${metaName}:${metaLang}`);

        const metaStatusRaw = String(mt.status || 'PENDING').toUpperCase();
        const mappedStatus: TemplateStatus =
          metaStatusRaw === 'APPROVED'
            ? 'APPROVED'
            : metaStatusRaw === 'REJECTED'
              ? 'REJECTED'
              : 'PENDING';

        const rejectionReason = mt.rejected_reason || mt.rejection_reason || null;

        const bodyComponent = mt.components?.find((c: any) => c.type === 'BODY');
        const headerComponent = mt.components?.find((c: any) => c.type === 'HEADER');
        const footerComponent = mt.components?.find((c: any) => c.type === 'FOOTER');
        const buttonsComponent = mt.components?.find((c: any) => c.type === 'BUTTONS');

          let headerContent: string | null = null;

          // Text header
          if (headerComponent?.text) {
            headerContent = headerComponent.text;
          }

          // Media header - example se URL extract karo
          if (!headerContent && headerComponent?.example) {
            const exampleHandles = headerComponent.example.header_handle || [];
            const exampleTexts = headerComponent.example.header_text || [];
            
            // URL prefer karo, handle skip karo
            for (const handle of exampleHandles) {
              if (handle && handle.startsWith('http') && !handle.includes('scontent')) {
                headerContent = handle; // Valid CDN URL ✅
                break;
              }
              // "4:xxx" handles skip karo - expire ho jaate hain
            }
            
            if (!headerContent && exampleTexts.length > 0) {
              headerContent = exampleTexts[0];
            }
          }

         const existing = await prisma.template.findFirst({
          where: {
            whatsappAccountId: waData.account?.id || waData.account?.id, // Use ID from waData
            name: metaName,
            language: metaLang,
          },
        });

        // ✅ CRITICAL BUG FIX: Don't let Meta's expiring scontent CDN wipe out our permanent Cloudinary URL
        // NEVER save scontent URLs as permanent headerContent.
        const isScontent = (url: string | null | undefined) => !!url && url.includes('scontent.whatsapp');
        
        let finalHeaderContent = isScontent(headerContent) ? null : headerContent;
        
        // If we have an existing record with a good URL, ALWAYS keep it
        if (existing && existing.headerContent && !isScontent(existing.headerContent)) {
          // If the incoming content is bad or missing, preserve the good one we have
          if (!finalHeaderContent) {
            finalHeaderContent = existing.headerContent;
          }
        }

        if (existing) {
            // Update existing
            const updateData: any = {
              organizationId, // ✅ CLAIM ownership (move with account)
              metaTemplateId: metaId,
              status: mappedStatus,
              rejectionReason,
              category: (String(mt.category || 'UTILITY').toUpperCase()) as any,
              headerType: headerComponent?.format || null,
              headerContent: finalHeaderContent,
              bodyText: bodyComponent?.text || existing.bodyText,
              footerText: footerComponent?.text || existing.footerText,
              buttons: toJsonValue(buttonsComponent?.buttons || []),
            };

            if (waData.wabaId) updateData.wabaId = waData.wabaId;
            if (waData.account?.id) updateData.whatsappAccountId = waData.account.id;

            await prisma.template.update({
              where: { id: existing.id },
              data: updateData,
            });
          } else {
            // Create new
            const createData: any = {
              organizationId,
              name: metaName,
              language: metaLang,
              category: (String(mt.category || 'UTILITY').toUpperCase()) as any,
              bodyText: bodyComponent?.text || 'Imported from Meta',
              headerType: headerComponent?.format || null,
              headerContent: finalHeaderContent,
              footerText: footerComponent?.text || null,
              status: mappedStatus,
              metaTemplateId: metaId,
              buttons: toJsonValue(buttonsComponent?.buttons || []),
              variables: toJsonValue([]),
              rejectionReason,
            };

            if (waData.wabaId) createData.wabaId = waData.wabaId;
            if (waData.account?.id) createData.whatsappAccountId = waData.account.id;

            await prisma.template.create({ data: createData });
          }

        synced++;
      } catch (err: any) {
        console.error(`Failed to sync template ${mt.name}:`, err.message);
      }
    }

    // ✅ Handle Ghost Templates (Deleted in Meta)
    // Find templates in DB for this org/waba that were NOT in Meta's response
    const dbTemplates = await prisma.template.findMany({
      where: {
        organizationId,
        wabaId: waData.wabaId,
        status: { in: ['APPROVED', 'PENDING'] } // Only worry about active ones
      }
    });

    let cleaned = 0;
    for (const dt of dbTemplates) {
      if (!foundMetaKeys.has(`${dt.name}:${dt.language}`)) {
        console.log(`⚠️ Marking ghost template as REJECTED (Deleted in Meta): ${dt.name}`);
        await prisma.template.update({
          where: { id: dt.id },
          data: {
            status: 'REJECTED',
            rejectionReason: 'Template deleted from Meta Business Suite.'
          }
        });
        cleaned++;
      }
    }

    console.log(`✅ Synced ${synced} templates. Cleaned ${cleaned} ghosts.`);

    return { message: `Sync complete. ${synced} synced, ${cleaned} cleaned.`, synced };
  }

  /**
   * Get template by ID
   */
  async getById(organizationId: string, templateId: string): Promise<TemplateResponse> {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    return formatTemplate(template);
  }

  /**
   * Update template
   */
  async update(
    organizationId: string,
    templateId: string,
    input: UpdateTemplateInput & { 
      headerMediaId?: string; 
      headerContent?: string;
      whatsappAccountId?: string;
    }
  ): Promise<TemplateResponse> {
    const existing = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!existing) {
      throw new AppError('Template not found', 404);
    }

    // ✅ FIXED: Approved template mein sirf media update allow karo
    const isApproved = existing.status === 'APPROVED' && existing.metaTemplateId;
    
    if (isApproved) {
      // ✅ Check: Kya sirf media update ho raha hai?
      const isMediaOnlyUpdate = 
        (input.headerMediaId || input.headerContent) &&
        !input.name &&
        !input.bodyText &&
        !input.language &&
        !input.category;

      if (!isMediaOnlyUpdate) {
        throw new AppError(
          'Cannot modify approved templates content. ' +
          'You can only re-upload media for expired handles.',
          400
        );
      }

      // ✅ ALLOW: Sirf headerMediaId aur headerContent update karo
      console.log('🔄 Updating media for approved template:', templateId);

      const { mediaId: rawMediaId, content: extractedUrl } = 
        this.extractSmuggledMedia(input.headerMediaId, input.headerContent);

      const updated = await prisma.template.update({
        where: { id: templateId },
        data: {
          headerMediaId: rawMediaId || existing.headerMediaId,
          headerContent: extractedUrl || existing.headerContent,
          // ✅ Status APPROVED rahega - sirf media update hua
        },
      });

      console.log('✅ Media updated for approved template:', templateId);
      return formatTemplate(updated);
    }

    // ✅ Non-approved templates: Full update allow karo
    let finalVariables = input.variables;
    if (input.bodyText) {
      const extracted = extractVariables(input.bodyText);
      if (!finalVariables || finalVariables.length === 0) {
        finalVariables = extracted.map((index) => ({ 
          index, 
          type: 'text' as const 
        }));
      }
    }

    const { mediaId: rawMediaId, content: extractedUrl } = 
      this.extractSmuggledMedia(input.headerMediaId, input.headerContent);

    const updateData: any = {
      name: input.name,
      language: input.language,
      category: input.category,
      headerType: input.headerType,
      headerContent: extractedUrl,
      headerMediaId: rawMediaId,
      bodyText: input.bodyText,
      footerText: input.footerText,
    };

    if (input.buttons !== undefined) {
      updateData.buttons = toJsonValue(input.buttons);
    }
    if (finalVariables !== undefined) {
      updateData.variables = toJsonValue(finalVariables);
    }

    if (input.bodyText || input.headerContent) {
      updateData.status = 'PENDING';
    }

    const updated = await prisma.template.update({
      where: { id: templateId },
      data: updateData,
    });

    console.log('✅ Template updated:', templateId);
    return formatTemplate(updated);
  }

  /**
   * Delete template
   */
  async delete(organizationId: string, templateId: string): Promise<{ message: string }> {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
      include: { whatsappAccount: true },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    // 1. Attempt to delete from Meta if synced
    if (template.metaTemplateId && template.whatsappAccount) {
      try {
        const waData = await getWhatsAppAccountWithToken(
          organizationId,
          template.whatsappAccountId || undefined
        );

        console.log(`📤 Deleting template "${template.name}" from Meta...`);
        await whatsappApi.deleteMessageTemplate(
          waData.wabaId,
          waData.accessToken,
          template.name
        );
        console.log('✅ Deleted from Meta');
      } catch (metaErr: any) {
        console.warn('⚠️ Failed to delete template from Meta:', metaErr.message);
        // We continue even if Meta delete fails (might already be deleted there)
      }
    }

    // 2. Handle DB relations
    // Nullify templateId in message history to preserve chat history but break link
    await prisma.message.updateMany({
      where: { templateId },
      data: { templateId: null },
    });

    // Delete message queue entries for this template
    await prisma.messageQueue.deleteMany({
      where: { templateId },
    });

    // Handle Campaigns - If we want to allow delete, we must handle campaigns.
    // We'll delete related campaigns too to ensure the delete succeeds.
    await prisma.campaign.deleteMany({
      where: { templateId },
    });

    // 3. Final Delete
    await prisma.template.delete({ where: { id: templateId } });

    console.log(`✅ Template completely deleted: ${templateId}`);

    return { message: 'Template deleted successfully' };
  }

  /**
   * Get template statistics
   */
  async getStats(organizationId: string, whatsappAccountId?: string): Promise<TemplateStats> {
    try {
      const where: Prisma.TemplateWhereInput = { organizationId };

      if (whatsappAccountId) {
        (where as any).whatsappAccountId = whatsappAccountId;
      }

      const [total, pending, approved, rejected, marketing, utility, authentication] =
        await Promise.all([
          prisma.template.count({ where }),
          prisma.template.count({ where: { ...where, status: 'PENDING' } }),
          prisma.template.count({ where: { ...where, status: 'APPROVED' } }),
          prisma.template.count({ where: { ...where, status: 'REJECTED' } }),
          prisma.template.count({ where: { ...where, category: 'MARKETING' } }),
          prisma.template.count({ where: { ...where, category: 'UTILITY' } }),
          prisma.template.count({ where: { ...where, category: 'AUTHENTICATION' } }),
        ]);

      return {
        total,
        pending,
        approved,
        rejected,
        byCategory: { marketing, utility, authentication },
      };
    } catch (error: any) {
      console.error('❌ Get template stats error:', error);

      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        byCategory: { marketing: 0, utility: 0, authentication: 0 },
      };
    }
  }

  /**
   * Duplicate template
   */
  async duplicate(
    organizationId: string,
    templateId: string,
    newName: string,
    targetWhatsappAccountId?: string
  ): Promise<TemplateResponse> {
    const original = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!original) {
      throw new AppError('Template not found', 404);
    }

    const dup = await prisma.template.findFirst({
      where: {
        organizationId,
        name: newName,
        language: original.language,
      },
    });

    if (dup) {
      throw new AppError('Template with this name already exists', 409);
    }

    const createData: any = {
      organizationId,
      name: newName,
      language: original.language,
      category: original.category,
      headerType: original.headerType,
      headerContent: original.headerContent,
      bodyText: original.bodyText,
      footerText: original.footerText,
      buttons: original.buttons || toJsonValue([]),
      variables: original.variables || toJsonValue([]),
      status: 'PENDING',
      metaTemplateId: null,
      rejectionReason: null,
    };

    if ((original as any).wabaId) createData.wabaId = (original as any).wabaId;
    if ((original as any).whatsappAccountId)
      createData.whatsappAccountId = (original as any).whatsappAccountId;

    const created = await prisma.template.create({ data: createData });

    console.log(`📋 Template duplicated: ${templateId} -> ${created.id}`);

    return formatTemplate(created);
  }

  /**
   * Preview template with variables
   */
  async preview(
    bodyText: string,
    variables: Record<string, string> = {},
    headerType?: string,
    headerContent?: string,
    footerText?: string,
    buttons?: TemplateButton[]
  ): Promise<TemplatePreview> {
    const preview: TemplatePreview = {
      body: replaceVariables(bodyText, variables),
    };

    const normalizedHeaderType = normalizeHeaderType(headerType);

    if (normalizedHeaderType === 'TEXT' && headerContent) {
      preview.header = replaceVariables(headerContent, variables);
    } else if (normalizedHeaderType !== 'NONE') {
      preview.header = `[${normalizedHeaderType}]`;
    }

    if (footerText) {
      preview.footer = footerText;
    }

    if (buttons && buttons.length > 0) {
      preview.buttons = buttons.map((btn) => ({
        type: btn.type,
        text: btn.text,
      }));
    }

    return preview;
  }

  /**
   * Submit template to Meta
   */
  async submitToMeta(
    organizationId: string,
    templateId: string,
    whatsappAccountId?: string
  ): Promise<{ message: string; metaTemplateId?: string }> {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    const waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);

    const metaPayload = buildMetaTemplatePayload({
      name: template.name,
      language: template.language,
      category: template.category,
      headerType: template.headerType,
      headerContent: template.headerContent,
      bodyText: template.bodyText,
      footerText: template.footerText,
      buttons: (template.buttons as any) || [],
      variables: (template.variables as any) || [],
      headerMediaId: (template as any).headerMediaId || undefined,
    });

    console.log('📤 Submitting template to Meta:', {
      templateId,
      name: template.name,
      language: toMetaLanguage(template.language),
    });

    const metaRes = await (whatsappApi as any).createMessageTemplateByVersion(
      waData.wabaId,
      waData.accessToken,
      metaPayload,
      'v17.0'
    );

    const metaTemplateId = metaRes?.id || metaRes?.template_id;

    const updateData: any = {
      metaTemplateId: metaTemplateId ? String(metaTemplateId) : template.metaTemplateId,
      status: 'PENDING',
      rejectionReason: null,
    };
    if (waData.wabaId) updateData.wabaId = waData.wabaId;
    if (waData.account?.id) updateData.whatsappAccountId = waData.account.id;

    await prisma.template.update({
      where: { id: template.id },
      data: updateData,
    });

    console.log('✅ Template submitted to Meta:', metaTemplateId);

    return {
      message: 'Template submitted to Meta. It will appear as PENDING until approved.',
      metaTemplateId: metaTemplateId ? String(metaTemplateId) : undefined,
    };
  }

  /**
   * Get available languages
   */
  async getLanguages(
    organizationId: string,
    whatsappAccountId?: string
  ): Promise<{ language: string; count: number }[]> {
    const where: Prisma.TemplateWhereInput = { organizationId };

    if (whatsappAccountId) {
      (where as any).whatsappAccountId = whatsappAccountId;
    }

    const templates = await prisma.template.groupBy({
      by: ['language'],
      where,
      _count: { language: true },
      orderBy: { _count: { language: 'desc' } },
    });

    return templates.map((t) => ({
      language: t.language,
      count: t._count.language,
    }));
  }

  /**
   * Update template status (called from webhook)
   */
  async updateStatus(
    metaTemplateId: string,
    status: TemplateStatus,
    rejectionReason?: string
  ): Promise<void> {
    await prisma.template.updateMany({
      where: { metaTemplateId },
      data: {
        status,
        rejectionReason: rejectionReason || null,
      },
    });

    console.log(`✅ Template status updated: ${metaTemplateId} -> ${status}`);
  }

  /**
   * Sync templates for specific account
   */
  async syncTemplatesForAccount(organizationId: string, whatsappAccountId: string) {
    return metaService.syncTemplates(whatsappAccountId, organizationId);
  }
}

export const templatesService = new TemplatesService();
export default templatesService;