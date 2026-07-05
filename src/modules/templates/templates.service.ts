// src/modules/templates/templates.service.ts - FIXED VERSION
// ✅ FIX A1: body_text example format is now [[val1, val2]] not [[val1],[val2]]
//    Meta requires ALL body variables as ONE inner array (one sample set).
//    Previous format caused "Invalid body examples" rejection.
// ✅ FIX A2: header variables are now separately extracted and sent as
//    example.header_text correctly.
// ✅ FIX A3: URL buttons with variables now include example field.
// ✅ FIX C: whatsappAccountId null/undefined now returns a clean 400 error
//    instead of a cryptic Prisma crash.

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
  headerContent: template.headerContent,
  headerMediaId: template.headerMediaId,
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

const uploadMediaToMeta = async (
  cloudinaryUrl: string,
  headerType: string,
  waData: { phoneNumberId: string; accessToken: string; wabaId: string }
): Promise<string> => {
  try {
    console.log('📤 Uploading media to Meta:', { cloudinaryUrl, headerType });

    const detectMimeFromUrl = (url: string, type: string): string => {
      const urlLower = url.toLowerCase();
      const urlPath = url.split('?')[0];

      const fParamMatch = urlLower.match(/[,\/]f_([a-z0-9]+)/);
      if (fParamMatch) {
        const fmtMap: Record<string, string> = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
          'png': 'image/png', 'webp': 'image/webp',
          'gif': 'image/gif', 'mp4': 'video/mp4',
          'pdf': 'application/pdf',
        };
        if (fmtMap[fParamMatch[1]]) return fmtMap[fParamMatch[1]];
      }

      const extMatch = urlPath.match(/\.([a-z0-9]+)$/i);
      if (extMatch) {
        const extMap: Record<string, string> = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
          'png': 'image/png', 'webp': 'image/webp',
          'gif': 'image/gif', 'mp4': 'video/mp4',
          '3gp': 'video/3gpp', '3gpp': 'video/3gpp',
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'txt': 'text/plain',
          'ogg': 'audio/ogg', 'mp3': 'audio/mpeg',
          'aac': 'audio/aac', 'amr': 'audio/amr',
        };
        if (extMap[extMatch[1].toLowerCase()]) return extMap[extMatch[1].toLowerCase()];
      }

      if (urlLower.includes('/image/upload/')) return 'image/jpeg';
      if (urlLower.includes('/video/upload/')) return 'video/mp4';
      if (urlLower.includes('/raw/upload/')) return 'application/pdf';

      const typeDefaults: Record<string, string> = {
        'IMAGE': 'image/jpeg', 'VIDEO': 'video/mp4',
        'DOCUMENT': 'application/pdf', 'AUDIO': 'audio/mpeg',
      };
      return typeDefaults[type.toUpperCase()] || 'image/jpeg';
    };

    const detectFilename = (url: string, mimeType: string): string => {
      const urlPath = url.split('?')[0];
      const lastSegment = urlPath.split('/').pop() || 'media';

      if (/\.[a-z0-9]{2,5}$/i.test(lastSegment)) return lastSegment;

      const mimeToExt: Record<string, string> = {
        'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
        'video/mp4': '.mp4', 'video/3gpp': '.3gp',
        'application/pdf': '.pdf', 'audio/mpeg': '.mp3',
      };
      return `${lastSegment}${mimeToExt[mimeType] || '.jpg'}`;
    };

    const preMime = detectMimeFromUrl(cloudinaryUrl, headerType);
    const preFilename = detectFilename(cloudinaryUrl, preMime);

    const response = await axios.get(cloudinaryUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WabMeta/1.0)', 'Accept': '*/*' }
    });

    const buffer = Buffer.from(response.data);

    const INVALID_MIME_TYPES = ['application/octet-stream', 'binary/octet-stream', 'application/binary'];
    const rawContentType = (response.headers['content-type'] || '').split(';')[0].trim();
    const isValidResponseMime = rawContentType && !INVALID_MIME_TYPES.includes(rawContentType);
    const finalMime = isValidResponseMime ? rawContentType : preMime;
    const finalFilename = detectFilename(cloudinaryUrl, finalMime);

    const result = await metaApi.uploadMedia(
      waData.phoneNumberId,
      waData.accessToken,
      buffer,
      finalMime,
      finalFilename,
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

const toMetaLanguage = (lang?: string): string => {
  const l = String(lang || '').trim();
  if (!l) return 'en_US';
  if (l.length >= 2 && l.length <= 6 && !l.includes(' ')) return l;
  const mapping: Record<string, string> = {
    'english': 'en_US', 'hindi': 'hi', 'spanish': 'es_ES',
    'portuguese': 'pt_BR', 'french': 'fr_FR', 'german': 'de_DE', 'italian': 'it_IT',
  };
  return mapping[l.toLowerCase()] || l;
};

const normalizeTemplateName = (name: string): string => {
  return name.toLowerCase().trim().replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
};

const normalizeHeaderType = (t?: string | null) => {
  const headerType = String(t || 'NONE').toUpperCase();
  return ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) ? headerType : 'NONE';
};

// ============================================
// ✅ FIXED: buildMetaTemplatePayload
// ============================================
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
  // ✅ NEW: header variables separately
  headerVariables?: Record<string, string>;
}) => {
  const components: any[] = [];
  const headerType = normalizeHeaderType(t.headerType);

  console.log('🔧 Building Meta template payload:', {
    name: t.name, language: t.language, headerType,
    hasMediaUrl: !!(t.headerMediaId || t.headerContent),
  });

  // ============================================
  // HEADER COMPONENT
  // ============================================
  if (headerType && headerType !== 'NONE') {
    if (headerType === 'TEXT' && t.headerContent) {
      const headerVars = extractVariables(t.headerContent);
      const headerComp: any = {
        type: 'HEADER',
        format: 'TEXT',
        text: t.headerContent,
      };

      if (headerVars.length > 0) {
        // ✅ FIX A2: header_text must be a flat array of sample strings
        // e.g. ["John"] not [["John"]]
        const samples = headerVars.map(idx => {
          const fromHeaderVars = t.headerVariables?.[String(idx)];
          const fromVariables = t.variables?.find(v => v.index === idx);
          return fromHeaderVars || (fromVariables as any)?.example || `Example${idx}`;
        });
        headerComp.example = { header_text: samples };
      }

      components.push(headerComp);
    }
    else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
      // ✅ Get handle - try headerMediaId first, then headerContent
      let handle = t.headerMediaId || '';

      // ✅ SANITIZE: Remove any concatenation
      if (handle.includes('\n')) {
        handle = handle.split('\n')[0].trim();
      }
      if (handle.includes(',')) {
        handle = handle.split(',')[0].trim();
      }
      if (handle.includes(' ')) {
        handle = handle.split(' ')[0].trim();
      }
      if (handle.includes(':::')) {
        handle = handle.split(':::')[0].trim();
      }

      if (!handle) {
        throw new AppError(
          `${headerType} template requires a Meta upload handle. Please re-upload the media file.`,
          400
        );
      }

      // ✅ Validate: NO URLs allowed as handle
      if (handle.startsWith('http')) {
        throw new AppError(
          `Invalid media handle: URLs cannot be used as handle. Please re-upload.`,
          400
        );
      }

      // ✅ Validate handle format (should be "digit:base64string")
      if (!/^\d+:[A-Za-z0-9+/=:_\-]+/.test(handle)) {
        console.warn(`⚠️ Unusual handle format: ${handle.substring(0, 30)}`);
      }

      const headerComp: any = {
        type: 'HEADER',
        format: headerType,
        example: { 
          header_handle: [handle] // ✅ Array with SINGLE handle
        },
      };

      components.push(headerComp);
      console.log(`✅ ${headerType} header with handle: ${handle.substring(0, 30)}... (length: ${handle.length})`);
    }
  }

  // ============================================
  // ✅ FIXED BODY COMPONENT
  // Meta requires: example.body_text = [["val1", "val2"]]
  // NOT: [["val1"], ["val2"]]
  // One inner array = one sample set, all variables together.
  // ============================================
  const bodyVars = extractVariables(t.bodyText);
  const bodyComp: any = { type: 'BODY', text: t.bodyText };

  if (bodyVars.length > 0) {
    // ✅ FIX A1: All body variable samples in ONE inner array
    const sampleSet = bodyVars.map(idx => {
      const v = t.variables?.find(var_item => var_item.index === idx);
      return (v as any)?.example || `Sample${idx}`;
    });

    // bodyText = [["sample1", "sample2"]] — 2D array, one outer element
    bodyComp.example = { body_text: [sampleSet] };
  }
  components.push(bodyComp);

  // ============================================
  // FOOTER COMPONENT
  // ============================================
  if (t.footerText) {
    components.push({ type: 'FOOTER', text: t.footerText });
  }

  // ============================================
  // ✅ FIXED BUTTONS COMPONENT
  // URL buttons with variables now include example field.
  // ============================================
  if (t.buttons && t.buttons.length > 0) {
    const validButtons = t.buttons.filter((b: any) => b.text?.trim());

    if (validButtons.length > 0) {
      const buttons = validButtons.slice(0, 10).map((b: any) => {
        const rawType = String(b.type || '').toUpperCase().replace(/[^A-Z_]/g, '');

        let metaType: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
        if (rawType.includes('PHONE') || rawType === 'CALL') {
          metaType = 'PHONE_NUMBER';
        } else if (rawType === 'URL' || rawType.includes('URL') || rawType === 'WEBSITE') {
          metaType = 'URL';
        } else {
          metaType = 'QUICK_REPLY';
        }

        const btn: any = {
          type: metaType,
          text: String(b.text || '').trim().substring(0, 25),
        };

        if (metaType === 'URL') {
          const url = b.url || b.website_url || '';
          if (!url || !url.startsWith('http')) {
            throw new AppError(
              `URL button "${btn.text}" requires a valid URL starting with http/https`,
              400
            );
          }
          btn.url = url.trim();

          // ✅ FIX A3: If URL contains {{1}}, add example field
          if (btn.url.includes('{{')) {
            const exampleUrl = btn.url.replace(/\{\{\d+\}\}/g, 'example');
            btn.example = [exampleUrl];
          }
        }

        if (metaType === 'PHONE_NUMBER') {
          const phone = b.phoneNumber || b.phone_number || '';
          if (!phone) {
            throw new AppError(`Phone button "${btn.text}" requires a phone number`, 400);
          }
          const cleanPhone = String(phone).trim();
          if (!cleanPhone.startsWith('+')) {
            throw new AppError(
              `Phone number must be in E.164 format (e.g., +919876543210). Got: ${cleanPhone}`,
              400
            );
          }
          btn.phone_number = cleanPhone;
        }

        return btn;
      });

      components.push({ type: 'BUTTONS', buttons });
      console.log(`✅ BUTTONS component: ${buttons.length} buttons added`);
    }
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

const normalizeButtonsForDB = (buttons: any[]): any[] => {
  return (buttons || []).map((b: any) => ({
    type: b.type,
    text: b.text || '',
    url: b.url || b.website_url || undefined,
    phoneNumber: b.phone_number || b.phoneNumber || undefined,
  }));
};

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
  const RETRY_DELAYS = [500, 1000, 2000, 3000, 5000];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`🔍 [Attempt ${attempt + 1}/${MAX_RETRIES}] Getting WhatsApp account:`, {
        organizationId,
        whatsappAccountId: whatsappAccountId || 'auto-detect',
      });

      let waAccount = null;

      // ✅ FIX C: validate whatsappAccountId before passing to Prisma
      if (whatsappAccountId && typeof whatsappAccountId === 'string' && whatsappAccountId.length > 0) {
        waAccount = await prisma.whatsAppAccount.findFirst({
          where: { id: whatsappAccountId, organizationId },
        });
        console.log(`   Direct lookup by ID:`, waAccount ? '✅ Found' : '❌ Not found');
      }

      if (!waAccount) {
        waAccount = await prisma.whatsAppAccount.findFirst({
          where: { organizationId, status: 'CONNECTED' },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });
        console.log(`   Fallback connected lookup:`, waAccount ? '✅ Found' : '❌ Not found');
      }

      if (!waAccount) {
        waAccount = await prisma.whatsAppAccount.findFirst({
          where: { organizationId },
          orderBy: [{ createdAt: 'desc' }],
        });
        console.log(`   Last resort lookup:`, waAccount ? `✅ Found (status: ${waAccount.status})` : '❌ Not found');
      }

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

      if (waAccount) {
        console.log('✅ WhatsApp account found:', {
          id: waAccount.id, phone: waAccount.phoneNumber,
          status: waAccount.status, wabaId: waAccount.wabaId,
        });

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

      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`⏳ Account not found, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new AppError(
        'No WhatsApp account found. Please connect your WhatsApp Business account in Settings → WhatsApp.',
        400
      );
    } catch (error: any) {
      if (
        attempt < MAX_RETRIES - 1 &&
        (error.message.includes('not found') || error.message.includes('No WhatsApp'))
      ) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`⏳ Error: ${error.message}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      console.error('❌ getWhatsAppAccountWithToken failed:', error);
      throw error;
    }
  }

  throw new AppError('No WhatsApp account found after all retries.', 400);
};

// ============================================
// SERVICE CLASS
// ============================================

export class TemplatesService {
  validateTemplate(input: CreateTemplateInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!/^[a-z0-9_]+$/.test(input.name)) {
      errors.push('Template name must be lowercase with underscores only (a-z, 0-9, _)');
    }
    if (input.name.length < 1 || input.name.length > 512) {
      errors.push('Template name must be between 1 and 512 characters');
    }
    if (!input.bodyText || input.bodyText.trim().length === 0) {
      errors.push('Body text is required');
    }
    if (input.bodyText && input.bodyText.length > 1024) {
      errors.push('Body text exceeds 1024 characters');
    }
    const headerType = normalizeHeaderType(input.headerType);
    if (headerType === 'TEXT' && input.headerContent) {
      if (input.headerContent.length > 60) {
        errors.push('Header text exceeds 60 characters');
      }
    }
    if (input.footerText && input.footerText.length > 60) {
      errors.push('Footer text exceeds 60 characters');
    }
    if (input.buttons && input.buttons.length > 3) {
      errors.push('Maximum 3 buttons allowed');
    }
    const varsInBody = extractVariables(input.bodyText);
    for (let i = 0; i < varsInBody.length; i++) {
      if (varsInBody[i] !== i + 1) {
        errors.push(`Variables must be sequential starting from {{1}}. Found gap at {{${i + 1}}}`);
        break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private extractSmuggledMedia(
    mediaId: string | undefined | null,
    existingContent: string | undefined | null
  ): { mediaId: string | null; content: string | null } {
    const isScontent = (url: string | null | undefined) =>
      !!url && url.includes('scontent.whatsapp');

    if (mediaId && !mediaId.includes(':::')) {
      return {
        mediaId: mediaId,
        content: isScontent(existingContent) ? null : existingContent || null,
      };
    }

    if (mediaId?.includes(':::')) {
      const parts = mediaId.split(':::');
      const rawHandle = parts[0] || null;
      const smuggledUrl = parts[1] || null;

      const content =
        (smuggledUrl && !isScontent(smuggledUrl) ? smuggledUrl : null) ||
        (existingContent && !isScontent(existingContent) ? existingContent : null);

      return { mediaId: rawHandle, content };
    }

    return {
      mediaId: null,
      content: isScontent(existingContent) ? null : existingContent || null,
    };
  }

  async create(
    organizationId: string,
    input: CreateTemplateInput & {
      whatsappAccountId?: string;
      headerMediaId?: string;
      headerContent?: string;
      metaNumericId?: string | null;
      cloudinaryUrl?: string | null;
      permanentUrl?: string | null;
      // ✅ NEW: header variables from frontend
      headerVariables?: Record<string, string>;
    }
  ): Promise<TemplateResponse> {
    const headerType = normalizeHeaderType(input.headerType);

    let finalMetaId: string | null = null;
    let finalCloudinaryUrl: string | null = null;

    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
      // Cloudinary URL extraction (keep your existing logic)
      finalCloudinaryUrl =
        input.cloudinaryUrl ||
        input.permanentUrl ||
        (input.headerContent?.startsWith('http') && 
         !input.headerContent.includes('scontent') 
          ? input.headerContent 
          : null);

      // ✅ CRITICAL FIX: Sanitize handle - remove any concatenation
      let rawHandle = String(
        input.headerMediaId || 
        input.metaNumericId || 
        ''
      ).trim();

      // ✅ Handle multiple handles (from double upload bug)
      if (rawHandle.includes('\n')) {
        console.warn('⚠️ Multiple handles detected in input, taking first');
        rawHandle = rawHandle.split('\n')[0].trim();
      }
      if (rawHandle.includes(',')) {
        rawHandle = rawHandle.split(',')[0].trim();
      }
      if (rawHandle.includes(' ')) {
        rawHandle = rawHandle.split(' ')[0].trim();
      }

      // Remove any URL smuggling
      if (rawHandle.includes(':::')) {
        rawHandle = rawHandle.split(':::')[0].trim();
      }

      finalMetaId = rawHandle || null;

      // ✅ Validation
      if (!finalCloudinaryUrl) {
        throw new AppError(
          'Media must be uploaded first. Cloudinary URL missing.',
          400
        );
      }

      if (!finalMetaId) {
        throw new AppError(
          'Meta media handle missing. Please re-upload the file.',
          400
        );
      }

      // ✅ Validate handle format
      if (finalMetaId.startsWith('http')) {
        throw new AppError(
          'Invalid media handle (URL detected). Please re-upload.',
          400
        );
      }

      console.log('✅ Sanitized media data:', {
        handleLength: finalMetaId.length,
        handlePreview: finalMetaId.substring(0, 40),
        cloudinaryUrl: finalCloudinaryUrl.substring(0, 60),
      });
    }

    const mediaHeaderContent =
      ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)
        ? finalCloudinaryUrl
        : input.headerContent || null;

    const validation = this.validateTemplate(input);
    if (!validation.valid) {
      throw new AppError(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    let waData: Awaited<ReturnType<typeof getWhatsAppAccountWithToken>> | null = null;
    let canSyncToMeta = false;
    try {
      waData = await getWhatsAppAccountWithToken(organizationId, input.whatsappAccountId);
      canSyncToMeta = true;
    } catch (err) {
      canSyncToMeta = false;
    }

    const existing = await prisma.template.findFirst({
      where: { organizationId, name: input.name, language: input.language },
    });

    if (existing) {
      throw new AppError('Template with this name and language already exists', 409);
    }

    const extractedVars = extractVariables(input.bodyText);
    const finalVariables =
      input.variables && input.variables.length > 0
        ? input.variables
        : extractedVars.map((index) => ({ index, type: 'text' as const }));

    const templateData: any = {
      organizationId,
      name: normalizeTemplateName(input.name),
      language: input.language,
      category: input.category,
      headerType: input.headerType || null,
      
      // ✅ CHANGED: Always store Cloudinary URL (permanent)
      headerContent: finalCloudinaryUrl || mediaHeaderContent,
      
      // ✅ CHANGED: Handle stored temporarily (will be null after approval)
      headerMediaId: null, // Don't store handle - it expires
      
      headerMediaUploadedAt: finalMetaId ? new Date() : null,
      headerMediaLastVerified: null,
      bodyText: input.bodyText,
      footerText: input.footerText || null,
      buttons: toJsonValue(input.buttons || []),
      variables: toJsonValue(finalVariables),
      status: canSyncToMeta ? 'PENDING' : 'DRAFT',
      metaTemplateId: null,
      rejectionReason: null,
    };

    if (waData) {
      if (waData.wabaId) templateData.wabaId = waData.wabaId;
      if (waData.account?.id) templateData.whatsappAccountId = waData.account.id;
    }

    const template = await prisma.template.create({ data: templateData });
    console.log(`✅ Template created: ${template.id} (status: ${template.status})`);

    if (canSyncToMeta && waData) {
      try {
        const metaHeaderMediaId = (() => {
          if (!finalMetaId) return null;
          if (/^\d+$/.test(finalMetaId)) return finalMetaId;
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
          // ✅ FIX A2: pass header variables so header example is built correctly
          headerVariables: input.headerVariables,
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
            data: { metaTemplateId: String(metaTemplateId), status: 'PENDING' },
          });
          console.log('✅ Meta template created:', metaTemplateId);
        }
      } catch (e: any) {
        // ✅ FIX: Better error extraction - try multiple paths
        const metaErr = 
          e.metaError || 
          e.response?.data?.error || 
          e.response?.data ||
          e;
        
        const errorCode = metaErr?.code || metaErr?.error_code || e?.code;
        const errorMessage = 
          metaErr?.message || 
          metaErr?.error_user_msg ||
          metaErr?.error_user_title ||
          e?.message || 
          'Meta submission failed';
        
        const errorSubcode = metaErr?.error_subcode;
        const errorData = metaErr?.error_data;
        const fbtraceId = metaErr?.fbtrace_id;

        // ✅ LOG EVERYTHING for debugging
        console.error('❌ Meta template create failed - FULL ERROR:', {
          code: errorCode,
          message: errorMessage,
          error_subcode: errorSubcode,
          error_data: errorData,
          fbtrace_id: fbtraceId,
          templateName: input.name,
          language: toMetaLanguage(input.language),
          fullError: JSON.stringify(e.response?.data || e.message || e, null, 2),
        });

        // ✅ Better user-facing messages
        let friendlyMsg = errorMessage;
        
        if (errorMessage.toLowerCase().includes('handle') || 
            errorMessage.toLowerCase().includes('media')) {
          friendlyMsg = 'Meta rejected the media file. This usually happens when:\n' +
            '1. Media handle is invalid or expired\n' +
            '2. Media file is corrupted\n' +
            '3. Media exceeds size/format limits\n' +
            'Please re-upload the media and try again.';
        } else if (errorCode === 100) {
          if (errorMessage.toLowerCase().includes('example') || 
              errorMessage.toLowerCase().includes('body_text')) {
            friendlyMsg = 'Meta rejected: Variable examples are required for each {{variable}}. Please add sample values.';
          } else if (errorMessage.toLowerCase().includes('header')) {
            friendlyMsg = 'Meta rejected: Header configuration invalid. Check header text/media.';
          } else {
            friendlyMsg = `Meta validation failed: ${errorMessage}`;
          }
        } else if (errorCode === 132000) {
          friendlyMsg = 'Meta rejected: Template content violates WhatsApp policy.';
        } else if (errorCode === 132001) {
          friendlyMsg = 'Meta rejected: Template name already exists. Use a different name.';
        } else if (errorCode === 190) {
          friendlyMsg = 'WhatsApp access token expired. Please reconnect in Settings.';
        }

        await prisma.template.update({
          where: { id: template.id },
          data: { 
            status: 'REJECTED', 
            rejectionReason: friendlyMsg,
          },
        });
      }
    }

    const latest = await prisma.template.findUnique({ where: { id: template.id } });
    return formatTemplate(latest);
  }

  async getList(
    organizationId: string,
    query: TemplatesQueryInput & { whatsappAccountId?: string; wabaId?: string }
  ): Promise<TemplatesListResponse> {
    const {
      page = 1, limit = 20, search, status, category, language,
      sortBy = 'createdAt', sortOrder = 'desc', whatsappAccountId, wabaId,
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

    if (whatsappAccountId) (where as any).whatsappAccountId = whatsappAccountId;
    if (wabaId) (where as any).wabaId = wabaId;

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where, skip, take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.template.count({ where }),
    ]);

    return {
      templates: templates.map(formatTemplate),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getApprovedTemplates(
    organizationId: string,
    whatsappAccountId?: string,
    wabaId?: string
  ): Promise<TemplateResponse[]> {
    const where: Prisma.TemplateWhereInput = { organizationId, status: 'APPROVED' };

    if (wabaId) (where as any).wabaId = wabaId;
    else if (whatsappAccountId) (where as any).whatsappAccountId = whatsappAccountId;

    const templates = await prisma.template.findMany({ where, orderBy: { name: 'asc' } });
    return templates.map(formatTemplate);
  }

  async syncFromMeta(
    organizationId: string,
    whatsappAccountId?: string
  ): Promise<{ message: string; synced: number }> {
    console.log('🔄 Syncing templates from Meta...');

    const waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);

    const metaTemplates = await whatsappApi.listMessageTemplates(waData.wabaId, waData.accessToken);

    console.log(`📥 Found ${metaTemplates.length} templates in Meta`);

    const foundMetaKeys = new Set<string>();

    let synced = 0;
    for (const mt of metaTemplates) {
      try {
        const metaId = String(mt.id);
        const metaName = String(mt.name);
        const metaLang = String(mt.language);

        foundMetaKeys.add(`${metaName}:${metaLang}`);

        const metaStatusRaw = String(mt.status || 'PENDING').toUpperCase();
        const mappedStatus: TemplateStatus =
          metaStatusRaw === 'APPROVED' ? 'APPROVED'
            : metaStatusRaw === 'REJECTED' ? 'REJECTED'
              : 'PENDING';

        const rejectionReason = mt.rejected_reason || mt.rejection_reason || null;

        const bodyComponent = mt.components?.find((c: any) => c.type === 'BODY');
        const headerComponent = mt.components?.find((c: any) => c.type === 'HEADER');
        const footerComponent = mt.components?.find((c: any) => c.type === 'FOOTER');
        const buttonsComponent = mt.components?.find((c: any) => c.type === 'BUTTONS');

        let headerContent: string | null = null;

        if (headerComponent?.text) {
          headerContent = headerComponent.text;
        }

        if (!headerContent && headerComponent?.example) {
          const exampleHandles = headerComponent.example.header_handle || [];
          const exampleTexts = headerComponent.example.header_text || [];

          for (const handle of exampleHandles) {
            if (handle && handle.startsWith('http') && !handle.includes('scontent')) {
              headerContent = handle;
              break;
            }
          }

          if (!headerContent && exampleTexts.length > 0) {
            headerContent = exampleTexts[0];
          }
        }

        const existing = await prisma.template.findFirst({
          where: {
            whatsappAccountId: waData.account?.id,
            name: metaName,
            language: metaLang,
          },
        });

        const isScontent = (url: string | null | undefined) =>
          !!url && url.includes('scontent.whatsapp');

        let finalHeaderContent = isScontent(headerContent) ? null : headerContent;

        if (existing && existing.headerContent && !isScontent(existing.headerContent)) {
          if (!finalHeaderContent) {
            finalHeaderContent = existing.headerContent;
          }
        }

        if (existing) {
          const updateData: any = {
            organizationId,
            metaTemplateId: metaId,
            status: mappedStatus,
            rejectionReason,
            category: (String(mt.category || 'UTILITY').toUpperCase()) as any,
            headerType: headerComponent?.format || null,
            headerContent: finalHeaderContent,
            bodyText: bodyComponent?.text || existing.bodyText,
            footerText: footerComponent?.text || existing.footerText,
            buttons: toJsonValue(normalizeButtonsForDB(buttonsComponent?.buttons || [])),
          };

          if (waData.wabaId) updateData.wabaId = waData.wabaId;
          if (waData.account?.id) updateData.whatsappAccountId = waData.account.id;

          await prisma.template.update({ where: { id: existing.id }, data: updateData });
        } else {
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
            buttons: toJsonValue(normalizeButtonsForDB(buttonsComponent?.buttons || [])),
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

    const dbTemplates = await prisma.template.findMany({
      where: {
        organizationId,
        wabaId: waData.wabaId,
        status: { in: ['APPROVED', 'PENDING'] }
      }
    });

    let cleaned = 0;
    for (const dt of dbTemplates) {
      if (!foundMetaKeys.has(`${dt.name}:${dt.language}`)) {
        console.log(`⚠️ Marking ghost template as REJECTED: ${dt.name}`);
        await prisma.template.update({
          where: { id: dt.id },
          data: { status: 'REJECTED', rejectionReason: 'Template deleted from Meta Business Suite.' }
        });
        cleaned++;
      }
    }

    console.log(`✅ Synced ${synced} templates. Cleaned ${cleaned} ghosts.`);
    return { message: `Sync complete. ${synced} synced, ${cleaned} cleaned.`, synced };
  }

  async getById(organizationId: string, templateId: string): Promise<TemplateResponse> {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!template) throw new AppError('Template not found', 404);
    return formatTemplate(template);
  }

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

    if (!existing) throw new AppError('Template not found', 404);

    const isApproved = existing.status === 'APPROVED' && existing.metaTemplateId;

    if (isApproved) {
      const isMediaOnlyUpdate =
        (input.headerMediaId || input.headerContent) &&
        !input.name && !input.bodyText && !input.language && !input.category;

      if (!isMediaOnlyUpdate) {
        throw new AppError(
          'Cannot modify approved templates content. You can only re-upload media for expired handles.',
          400
        );
      }

      const { mediaId: rawMediaId, content: extractedUrl } =
        this.extractSmuggledMedia(input.headerMediaId, input.headerContent);

      const updated = await prisma.template.update({
        where: { id: templateId },
        data: {
          headerMediaId: rawMediaId || existing.headerMediaId,
          headerContent: extractedUrl || existing.headerContent,
        },
      });

      return formatTemplate(updated);
    }

    let finalVariables = input.variables;
    if (input.bodyText) {
      const extracted = extractVariables(input.bodyText);
      if (!finalVariables || finalVariables.length === 0) {
        finalVariables = extracted.map((index) => ({ index, type: 'text' as const }));
      }
    }

    const { mediaId: rawMediaId, content: extractedUrl } =
      this.extractSmuggledMedia(input.headerMediaId, input.headerContent);

    const updateData: any = {
      name: input.name, language: input.language, category: input.category,
      headerType: input.headerType, headerContent: extractedUrl,
      headerMediaId: rawMediaId, bodyText: input.bodyText, footerText: input.footerText,
    };

    if (input.buttons !== undefined) updateData.buttons = toJsonValue(input.buttons);
    if (finalVariables !== undefined) updateData.variables = toJsonValue(finalVariables);
    if (input.bodyText || input.headerContent) updateData.status = 'PENDING';

    const updated = await prisma.template.update({ where: { id: templateId }, data: updateData });
    return formatTemplate(updated);
  }

  async delete(organizationId: string, templateId: string): Promise<{ message: string }> {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
      include: { whatsappAccount: true },
    });

    if (!template) throw new AppError('Template not found', 404);

    if (template.metaTemplateId && template.whatsappAccount) {
      try {
        const waData = await getWhatsAppAccountWithToken(
          organizationId, template.whatsappAccountId || undefined
        );
        await whatsappApi.deleteMessageTemplate(waData.wabaId, waData.accessToken, template.name);
      } catch (metaErr: any) {
        console.warn('⚠️ Failed to delete template from Meta:', metaErr.message);
      }
    }

    await prisma.message.updateMany({ where: { templateId }, data: { templateId: null } });
    await prisma.messageQueue.deleteMany({ where: { templateId } });
    await prisma.campaign.deleteMany({ where: { templateId } });
    await prisma.template.delete({ where: { id: templateId } });

    return { message: 'Template deleted successfully' };
  }

  async getStats(organizationId: string, whatsappAccountId?: string): Promise<TemplateStats> {
    try {
      const where: Prisma.TemplateWhereInput = { organizationId };
      if (whatsappAccountId) (where as any).whatsappAccountId = whatsappAccountId;

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

      return { total, pending, approved, rejected, byCategory: { marketing, utility, authentication } };
    } catch (error: any) {
      console.error('❌ Get template stats error:', error);
      return { total: 0, pending: 0, approved: 0, rejected: 0, byCategory: { marketing: 0, utility: 0, authentication: 0 } };
    }
  }

  async duplicate(
    organizationId: string,
    templateId: string,
    newName: string,
    targetWhatsappAccountId?: string
  ): Promise<TemplateResponse> {
    const original = await prisma.template.findFirst({ where: { id: templateId, organizationId } });
    if (!original) throw new AppError('Template not found', 404);

    const dup = await prisma.template.findFirst({
      where: { organizationId, name: newName, language: original.language },
    });
    if (dup) throw new AppError('Template with this name already exists', 409);

    const createData: any = {
      organizationId, name: newName, language: original.language,
      category: original.category, headerType: original.headerType,
      headerContent: original.headerContent, bodyText: original.bodyText,
      footerText: original.footerText,
      buttons: original.buttons || toJsonValue([]),
      variables: original.variables || toJsonValue([]),
      status: 'PENDING', metaTemplateId: null, rejectionReason: null,
    };

    if ((original as any).wabaId) createData.wabaId = (original as any).wabaId;
    if ((original as any).whatsappAccountId) createData.whatsappAccountId = (original as any).whatsappAccountId;

    const created = await prisma.template.create({ data: createData });
    return formatTemplate(created);
  }

  async preview(
    bodyText: string,
    variables: Record<string, string> = {},
    headerType?: string,
    headerContent?: string,
    footerText?: string,
    buttons?: TemplateButton[]
  ): Promise<TemplatePreview> {
    const preview: TemplatePreview = { body: replaceVariables(bodyText, variables) };

    const normalizedHeaderType = normalizeHeaderType(headerType);

    if (normalizedHeaderType === 'TEXT' && headerContent) {
      preview.header = replaceVariables(headerContent, variables);
    } else if (normalizedHeaderType !== 'NONE') {
      preview.header = `[${normalizedHeaderType}]`;
    }

    if (footerText) preview.footer = footerText;

    if (buttons && buttons.length > 0) {
      preview.buttons = buttons.map((btn) => ({ type: btn.type, text: btn.text }));
    }

    return preview;
  }

  async submitToMeta(
    organizationId: string,
    templateId: string,
    whatsappAccountId?: string
  ): Promise<{ message: string; metaTemplateId?: string }> {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!template) throw new AppError('Template not found', 404);

    const waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);

    const normalizedButtons = ((template.buttons as any[]) || []).map((b: any) => ({
      type: b.type, text: b.text,
      url: b.url || b.website_url,
      phoneNumber: b.phoneNumber || b.phone_number,
      phone_number: b.phone_number || b.phoneNumber,
    }));

    const metaPayload = buildMetaTemplatePayload({
      name: template.name, language: template.language, category: template.category,
      headerType: template.headerType, headerContent: template.headerContent,
      bodyText: template.bodyText, footerText: template.footerText,
      buttons: normalizedButtons as any,
      variables: (template.variables as any) || [],
      headerMediaId: (template as any).headerMediaId || undefined,
    });

    const metaRes = await (whatsappApi as any).createMessageTemplateByVersion(
      waData.wabaId, waData.accessToken, metaPayload, 'v21.0'
    );

    const metaTemplateId = metaRes?.id || metaRes?.template_id;

    const updateData: any = {
      metaTemplateId: metaTemplateId ? String(metaTemplateId) : template.metaTemplateId,
      status: 'PENDING', rejectionReason: null,
    };
    if (waData.wabaId) updateData.wabaId = waData.wabaId;
    if (waData.account?.id) updateData.whatsappAccountId = waData.account.id;

    await prisma.template.update({ where: { id: template.id }, data: updateData });

    return {
      message: 'Template submitted to Meta. It will appear as PENDING until approved.',
      metaTemplateId: metaTemplateId ? String(metaTemplateId) : undefined,
    };
  }

  async getLanguages(
    organizationId: string,
    whatsappAccountId?: string
  ): Promise<{ language: string; count: number }[]> {
    const where: Prisma.TemplateWhereInput = { organizationId };
    if (whatsappAccountId) (where as any).whatsappAccountId = whatsappAccountId;

    const templates = await prisma.template.groupBy({
      by: ['language'], where,
      _count: { language: true },
      orderBy: { _count: { language: 'desc' } },
    });

    return templates.map((t) => ({ language: t.language, count: t._count.language }));
  }

  async updateStatus(
    metaTemplateId: string, status: TemplateStatus, rejectionReason?: string
  ): Promise<void> {
    await prisma.template.updateMany({
      where: { metaTemplateId },
      data: { status, rejectionReason: rejectionReason || null },
    });
    console.log(`✅ Template status updated: ${metaTemplateId} -> ${status}`);
  }

  async syncTemplatesForAccount(organizationId: string, whatsappAccountId: string) {
    return metaService.syncTemplates(whatsappAccountId, organizationId);
  }
}

export const templatesService = new TemplatesService();
export default templatesService;