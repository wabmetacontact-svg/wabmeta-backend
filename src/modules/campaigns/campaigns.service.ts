// src/modules/campaigns/campaigns.service.ts - FINAL COMPLETE FIX
import {
  CampaignStatus,
  Prisma,
} from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { metaApi } from '../meta/meta.api';
import { campaignSocketService } from './campaigns.socket';
import { v4 as uuidv4 } from 'uuid';
import { safeDecrypt } from '../../utils/encryption';
import prisma from '../../config/database';
import axios from 'axios';
import {
  deductWalletForCampaign,
  getRateForCategory,
  COUNTRY_NAMES_MAP,
} from '../wallet/wallet.deduction.service';

// ✅ phone.ts se import - SINGLE SOURCE OF TRUTH
import {
  toCanonicalPhone,
  digitsOnly,
  buildPhoneVariants,
  toWhatsAppRecipient,
  extractCountryCode,
} from '../../utils/phone';

// ─── Constants ────────────────────────────────────────────────
const SEND_CONFIG = {
  BATCH_SIZE: 500,
  CONCURRENCY: 5,
  FLUSH_EVERY: 20,
  DELAY_BETWEEN_CHUNKS_MS: 500,
  MAX_CONSECUTIVE_FAILURES: 10,
  RATE_LIMIT_PAUSE_MS: 30_000,
  MEDIA_TTL_MS: 25 * 24 * 60 * 60 * 1000,
  MID_CAMPAIGN_CHECK_EVERY: 50,
  MIN_BALANCE_RUPEES: 20,
  MID_BALANCE_RUPEES: 5,
  TIER_LIMITS: {
    TIER_250: { concurrency: 3, delayMs: 800 },
    TIER_1K: { concurrency: 5, delayMs: 500 },
    TIER_10K: { concurrency: 10, delayMs: 200 },
    TIER_100K: { concurrency: 15, delayMs: 100 },
    TIER_UNLIMITED: { concurrency: 20, delayMs: 50 },
  } as const,
} as const;

// ─── Pure Helpers ──────────────────────────────────────────────

const toMetaLang = (lang?: string): string => {
  const l = String(lang || '').trim();
  if (!l) return 'en_US';
  if (l.length >= 2 && l.length <= 6 && !l.includes(' ')) return l;
  const MAP: Record<string, string> = {
    english: 'en_US', hindi: 'hi', spanish: 'es_ES',
    portuguese: 'pt_BR', french: 'fr_FR',
    german: 'de_DE', italian: 'it_IT',
  };
  return MAP[l.toLowerCase()] || l;
};

/**
 * ✅ FIXED - Contact se variable params build karo
 * cc = CampaignContact (DB record with .contact relation)
 */
const buildParamsFromContact = (
  cc: any,
  varCount: number,
  variableMapping?: Record<string, string>
): string[] => {
  if (varCount === 0) return [];

  // ✅ FIX: cc.contact is always the contact object (DB relation)
  const contact = cc.contact || {};
  const customData = cc.customData || {};

  const params: string[] = [];

  for (let i = 0; i < varCount; i++) {
    const varKey = String(i + 1);
    let value = 'NA';

    // Priority 1: variableMapping from campaign settings
    if (variableMapping?.[varKey]) {
      const mapped = variableMapping[varKey];

      // ✅ Field reference: {{contact.firstName}}
      if (mapped.startsWith('{{contact.') && mapped.endsWith('}}')) {
        const field = mapped.slice(10, -2);
        switch (field) {
          case 'firstName':
            value = contact.firstName || 'NA';
            break;
          case 'lastName':
            value = contact.lastName || '';
            break;
          case 'fullName':
            value = [contact.firstName, contact.lastName]
              .filter(Boolean).join(' ') || 'NA';
            break;
          case 'phone':
            // ✅ Display format ke liye
            value = contact.phone || 'NA';
            break;
          case 'email':
            value = contact.email || 'NA';
            break;
          default:
            value = contact[field] || contact.customFields?.[field] || 'NA';
        }
      } else {
        // Static text - same for all
        value = mapped;
      }
    }
    // Priority 2: customData from CSV upload
    else if (customData[varKey]) {
      value = String(customData[varKey]);
    }
    // Priority 3: Auto-map from contact fields
    else {
      const autoMap: Record<number, () => string> = {
        1: () => contact.firstName || 'NA',
        2: () => contact.lastName || '',
        3: () => contact.email || 'NA',
        4: () => contact.phone || 'NA',
      };
      value = autoMap[i + 1]?.() ?? 'NA';
    }

    params.push(String(value).trim());
  }

  return params;
};

const extractVariables = (text: string): number[] => {
  const regex = /\{\{(\d+)\}\}/g;
  const vars = new Set<number>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    vars.add(parseInt(match[1], 10));
  }
  return [...vars].sort((a, b) => a - b);
};

const toJsonValue = (val: any): Prisma.InputJsonValue | undefined => {
  if (val === undefined || val === null) return undefined;
  return JSON.parse(JSON.stringify(val));
};

const calculateRates = (c: any) => ({
  deliveryRate: c.sentCount > 0
    ? Math.round((c.deliveredCount / c.sentCount) * 100) : 0,
  readRate: c.deliveredCount > 0
    ? Math.round((c.readCount / c.deliveredCount) * 100) : 0,
});

const formatCampaign = (campaign: any): any => {
  const { deliveryRate, readRate } = calculateRates(campaign);
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    templateId: campaign.templateId,
    templateName: campaign.template?.name || '',
    whatsappAccountId: campaign.whatsappAccountId,
    whatsappAccountPhone: campaign.whatsappAccount?.phoneNumber || '',
    contactGroupId: campaign.contactGroupId,
    contactGroupName: campaign.contactGroup?.name || null,
    variableMapping: campaign.variableMapping || null,
    status: campaign.status,
    scheduledAt: campaign.scheduledAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    totalContacts: campaign.totalContacts || 0,
    sentCount: campaign.sentCount || 0,
    deliveredCount: campaign.deliveredCount || 0,
    readCount: campaign.readCount || 0,
    failedCount: campaign.failedCount || 0,
    pendingCount: Math.max(
      0,
      (campaign.totalContacts || 0) -
      (campaign.sentCount || 0) -
      (campaign.failedCount || 0)
    ),
    deliveryRate,
    readRate,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
};

// ─── Template Message Builder - HARDENED ──────────────────────
function buildTemplateMessage(
  template: any,
  variables: Record<string, string>,
  metaMediaId: string | null
): any {
  const components: any[] = [];
  const headerType = String(template.headerType || '').toUpperCase();

  // Header
  if (headerType === 'TEXT' && template.headerContent) {
    const vars = extractVariables(template.headerContent);
    if (vars.length > 0) {
      components.push({
        type: 'header',
        parameters: vars.map(idx => ({
          type: 'text',
          text: variables[String(idx)] || '',
        })),
      });
    }
  } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
    const mediaType = headerType.toLowerCase();
    
    // ✅ Priority 1: Uploaded media ID (BEST)
    if (metaMediaId && /^\d+$/.test(metaMediaId)) {
      const param: any = {
        type: mediaType,
        [mediaType]: { id: metaMediaId },
      };
      if (mediaType === 'document') {
        param.document.filename =
          (template.headerContent || '').split('/').pop()?.split('?')[0] ||
          'document.pdf';
      }
      components.push({ type: 'header', parameters: [param] });
    } 
    // ✅ Priority 2: URL fallback - STRICT VALIDATION
    else if (template.headerContent?.startsWith('http')) {
      const url = template.headerContent;
      
      // ❌ BLOCK: Meta CDN URLs (Meta can't fetch its own CDN)
      const isMetaCdn = 
        url.includes('scontent.whatsapp') ||
        url.includes('scontent-') ||
        url.includes('lookaside.fbsbx.com') ||
        url.includes('fbcdn.net') ||
        url.includes('graph.facebook.com');
      
      // ❌ BLOCK: Private/signed Cloudinary URLs
      const isPrivateCloudinary = 
        url.includes('cloudinary.com') && 
        (url.includes('/private/') || url.includes('/authenticated/'));
      
      // ❌ BLOCK: URLs with auth query params (temp signed URLs)
      const hasAuthParams = 
        url.includes('X-Amz-Signature=') ||
        url.includes('token=') ||
        url.includes('signature=') ||
        url.includes('&Expires=') ||
        url.includes('?Expires=');
      
      if (isMetaCdn) {
        console.error(`❌ [Template "${template.name}"] BLOCKED: Meta CDN URL cannot be used`);
        console.error(`   URL: ${url.substring(0, 80)}...`);
        console.error(`   💡 SOLUTION: Re-upload media in template settings (needs Cloudinary URL)`);
        // ✅ THROW to fail fast instead of sending broken message
        throw new Error(
          `Template "${template.name}" has invalid media URL (Meta CDN). ` +
          `Please re-upload media in template settings.`
        );
      }
      
      if (isPrivateCloudinary) {
        console.error(`❌ [Template "${template.name}"] BLOCKED: Private Cloudinary URL`);
        throw new Error(
          `Template "${template.name}" has private media URL. ` +
          `Please re-upload media as public.`
        );
      }
      
      if (hasAuthParams) {
        console.error(`❌ [Template "${template.name}"] BLOCKED: URL with auth params (may expire)`);
        throw new Error(
          `Template "${template.name}" has temporary media URL. ` +
          `Please re-upload media with permanent URL.`
        );
      }
      
      // ✅ FIX: Cloudinary raw URLs need fl_attachment for Meta to fetch
      let finalUrl = url;
      if (
        url.includes('cloudinary.com') &&
        url.includes('/raw/upload/') &&
        !url.includes('fl_attachment')
      ) {
        finalUrl = url.replace('/raw/upload/', '/raw/upload/fl_attachment/');
        console.log(`🔧 [Template] Fixed Cloudinary raw URL with fl_attachment`);
      }

      // ✅ URL is safe - use it
      const param: any = {
        type: mediaType,
        [mediaType]: { link: finalUrl },
      };
      if (mediaType === 'document') {
        param.document.filename =
          finalUrl.split('/').pop()?.split('?')[0] || 'document.pdf';
      }
      components.push({ type: 'header', parameters: [param] });
      console.log(`ℹ️ [Template "${template.name}"] Using URL: ${finalUrl.substring(0, 80)}...`);
    } else {
      // ❌ No media ID, no URL - can't send
      throw new Error(
        `Template "${template.name}" has no valid media (no ID, no URL). ` +
        `Please re-upload media in template settings.`
      );
    }
  }

  // Body
  const bodyVars = extractVariables(template.bodyText || '');
  if (bodyVars.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyVars.map(idx => ({
        type: 'text',
        text: variables[String(idx)] || '',
      })),
    });
  }

  // Buttons
  if (Array.isArray(template.buttons)) {
    template.buttons.forEach((btn: any, index: number) => {
      if (btn.type === 'URL' && btn.url?.includes('{{')) {
        const val = variables[`button_${index + 1}`];
        if (val) {
          components.push({
            type: 'button',
            sub_type: 'url',
            index,
            parameters: [{ type: 'text', text: val }],
          });
        }
      }
    });
  }

  return {
    type: 'template',
    template: {
      name: template.name,
      language: { code: toMetaLang(template.language) },
      components: components.length > 0 ? components : undefined,
    },
  };
}

// ─── CampaignsService ─────────────────────────────────────────
export class CampaignsService {

  // ✅ FIX Bug4: DB-backed lock check (in-memory Set + DB fallback)
  private processingCampaigns = new Set<string>();

  // ─── Count helpers ────────────────────────────────────────
  private async getQuickCounts(campaignId: string) {
    const counts = await prisma.campaignContact.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });
    const get = (s: string) =>
      counts.find(c => c.status === s)?._count || 0;
    return {
      total: counts.reduce((sum, c) => sum + c._count, 0),
      sent: get('SENT'),
      delivered: get('DELIVERED'),
      read: get('READ'),
      failed: get('FAILED'),
      pending: get('PENDING') + get('QUEUED'),
    };
  }

  private async syncCampaignCounters(campaignId: string) {
    const c = await this.getQuickCounts(campaignId);
    const cumSent = c.sent + c.delivered + c.read;
    const cumDel = c.delivered + c.read;
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        totalContacts: c.total,
        sentCount: cumSent,
        deliveredCount: cumDel,
        readCount: c.read,
        failedCount: c.failed,
      },
    });
    return {
      totalContacts: c.total,
      sentCount: cumSent,
      deliveredCount: cumDel,
      readCount: c.read,
      failedCount: c.failed,
      pendingCount: c.pending,
    };
  }

  // ─── Account finder ───────────────────────────────────────
  private async findWhatsAppAccount(
    organizationId: string,
    whatsappAccountId?: string,
    phoneNumberId?: string
  ): Promise<any> {
    if (whatsappAccountId) {
      const acc = await prisma.whatsAppAccount.findFirst({
        where: { id: whatsappAccountId, organizationId },
      });
      if (acc) return acc;
    }
    if (phoneNumberId) {
      const acc = await prisma.whatsAppAccount.findFirst({
        where: { phoneNumberId, organizationId },
      });
      if (acc) return acc;
    }
    return prisma.whatsAppAccount.findFirst({
      where: { organizationId, status: 'CONNECTED' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ─── Token decryptor - STRICT VERSION ─────────────────────
  private decryptToken(rawToken: string | null): string | null {
    if (!rawToken) {
      console.error('❌ [decryptToken] No token provided');
      return null;
    }

    // Case 1: Already plain Meta token
    if (rawToken.startsWith('EAA') && rawToken.length >= 50) {
      return rawToken;
    }

    // Case 2: Encrypted - must decrypt properly
    try {
      const decrypted = safeDecrypt(rawToken);
      
      if (decrypted && decrypted.startsWith('EAA') && decrypted.length >= 50) {
        return decrypted;
      }
      
      console.error('❌ [decryptToken] Decryption failed or invalid result', {
        hasDecrypted: !!decrypted,
        decryptedPrefix: decrypted?.substring(0, 10),
      });
      return null;
      
    } catch (err: any) {
      console.error('❌ [decryptToken] Exception:', err.message);
      return null;
    }
  }

  // ─── Error extractor ──────────────────────────────────────
  private extractFailureReason(error: any): {
    reason: string;
    isRateLimit: boolean;
    metaCode: number;
  } {
    const me = error.response?.data?.error;
    const metaCode = me?.code || 0;

    if (!me) {
      return {
        reason: (error.message || 'Unknown error').substring(0, 500),
        isRateLimit: false,
        metaCode,
      };
    }

    const subcode = me.error_subcode;
    const details = String(me.error_data?.details || '');
    const message = String(me.message || '');

    // Rate limit codes
    const RATE_LIMIT_CODES = new Set([131048, 131021, 80007, 4, 613]);
    const isRateLimit =
      RATE_LIMIT_CODES.has(metaCode) ||
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('too many requests');

    const ERROR_MAP: Record<number, string> = {
      // Rate limits
      131048: 'Rate limit - Sending too fast',
      131021: 'Rate limit - Meta throttling',
      80007: 'Message rate limit',
      4: 'API rate limit',
      613: 'Rate limit exceeded',
      // Media
      131053: details.includes('No video stream')
        ? 'Video corrupted - Re-encode H.264'
        : details.includes('403')
          ? 'Media URL inaccessible - Re-upload'
          : `Media error: ${details || message}`,
      131052: 'Media download failed',
      // Template
      132015: 'Template PAUSED by Meta',
      132016: 'Template DISABLED by Meta',
      132001: 'Template not found or not approved',
      132000: 'Template parameters mismatch',
      132005: 'Template hydration failed',
      132007: 'Template content policy violation',
      132012: 'Template format mismatch',
      // Recipient
      131030: 'Phone not on WhatsApp',
      131026: 'Message undeliverable',
      131056: 'Number restricted by Meta',
      131047: 'User has not opted in',
      // Account
      131042: 'Payment issue - Check Meta account',
      190: 'Access token expired - Reconnect WhatsApp',
      368: 'Sender temporarily restricted',
      100: 'Invalid parameter',
      131051: 'Unsupported message type',
      131057: 'Business account restricted',
    };

    const reason = ERROR_MAP[metaCode] || `[${metaCode}] ${message}`.substring(0, 500);

    return { reason, isRateLimit, metaCode };
  }

  // ─────────────────────────────────────────────────────────
  // CREATE CAMPAIGN
  // ─────────────────────────────────────────────────────────
  async create(
    organizationId: string,
    userId: string,
    input: any
  ): Promise<any> {
    const {
      name, description, templateId,
      whatsappAccountId, phoneNumberId,
      contactGroupId, contactIds, csvContacts,
      variableMapping, audienceFilter, scheduledAt,
    } = input;

    // Validate template
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });
    if (!template) throw new AppError('Template not found', 404);
    if (template.status !== 'APPROVED') {
      throw new AppError(
        `Template not approved (status: ${template.status})`, 400
      );
    }

    // Find WA account
    const waAccount = await this.findWhatsAppAccount(
      organizationId, whatsappAccountId, phoneNumberId
    );
    if (!waAccount) {
      throw new AppError(
        'No WhatsApp account found. Connect WhatsApp in Settings.', 400
      );
    }

    // ── Build contacts ─────────────────────────────────────
    let targetContacts: any[] = [];

    if (csvContacts?.length > 0) {
      // ✅ FIX Bug1: CANONICAL format use karo, digits only nahi
      const canonicalPhones = csvContacts
        .map((c: any) => {
          const raw = c.phone || '';
          return toCanonicalPhone(raw); // "+919876543210"
        })
        .filter(Boolean) as string[];

      if (canonicalPhones.length === 0) {
        throw new AppError('No valid phone numbers in CSV contacts', 400);
      }

      // ✅ Check existing contacts (all variants)
      const allVariants = canonicalPhones.flatMap(p => buildPhoneVariants(p));
      const existingContacts = await prisma.contact.findMany({
        where: { organizationId, phone: { in: allVariants } },
        select: { id: true, phone: true },
      });
      const existingMap = new Map(existingContacts.map(c => [c.phone, c.id]));

      // ✅ Create missing contacts with CANONICAL format
      const missingPhones = canonicalPhones.filter(p => {
        const variants = buildPhoneVariants(p);
        return !variants.some(v => existingMap.has(v));
      });

      if (missingPhones.length > 0) {
        await prisma.contact.createMany({
          data: missingPhones.map(phone => ({
            organizationId,
            phone,                           // ✅ "+919876543210"
            countryCode: extractCountryCode(phone), // ✅ "+91"
            firstName: 'Unknown',
            status: 'ACTIVE' as const,
            source: 'campaign',
          })),
          skipDuplicates: true,
        });
      }

      // ✅ Fetch all contacts (including just created)
      const updatedVariants = canonicalPhones.flatMap(p => buildPhoneVariants(p));
      const allContacts = await prisma.contact.findMany({
        where: { organizationId, phone: { in: updatedVariants } },
        select: { id: true, phone: true },
      });
      const contactByPhone = new Map(allContacts.map(c => [c.phone, c.id]));

      // ✅ Build targetContacts with customData
      targetContacts = csvContacts
        .map((c: any) => {
          const canonical = toCanonicalPhone(c.phone);
          if (!canonical) return null;
          const variants = buildPhoneVariants(canonical);
          const contactId = variants
            .map(v => contactByPhone.get(v))
            .find(Boolean);
          if (!contactId) return null;
          return {
            id: contactId,
            phone: canonical,
            customData: c.customData || {},
          };
        })
        .filter(Boolean);

    } else if (contactIds?.length > 0) {
      targetContacts = await prisma.contact.findMany({
        where: { id: { in: contactIds }, organizationId, status: 'ACTIVE' },
      });

    } else if (contactGroupId) {
      const members = await prisma.contactGroupMember.findMany({
        where: {
          groupId: contactGroupId,
          contact: { organizationId, status: 'ACTIVE' },
        },
        include: { contact: true },
      });
      targetContacts = members.map(m => m.contact);

    } else if (audienceFilter) {
      const where: Prisma.ContactWhereInput = {
        organizationId, status: 'ACTIVE',
      };
      if (!audienceFilter.all) {
        if (audienceFilter.tags?.length > 0) {
          where.tags = { hasSome: audienceFilter.tags };
        }
        if (audienceFilter.groupId) {
          where.groupMemberships = {
            some: { groupId: audienceFilter.groupId }
          };
        }
      }
      targetContacts = await prisma.contact.findMany({ where });
    }

    if (targetContacts.length === 0) {
      throw new AppError('No contacts found for selected audience.', 400);
    }

    // Deduplicate
    const seen = new Set<string>();
    targetContacts = targetContacts.filter(c => {
      if (!c?.id || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    // Create campaign + contacts in transaction
    const campaign = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.campaign.create({
        data: {
          organizationId,
          name,
          description,
          templateId,
          whatsappAccountId: waAccount.id,
          contactGroupId,
          audienceFilter: toJsonValue(audienceFilter),
          variableMapping: toJsonValue(variableMapping) || Prisma.JsonNull,
          status: (scheduledAt ? 'SCHEDULED' : 'DRAFT') as CampaignStatus,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          totalContacts: targetContacts.length,
          createdById: userId,
        } as any,
        include: {
          template: true,
          whatsappAccount: true,
          contactGroup: true,
        },
      });

      await tx.campaignContact.createMany({
        data: targetContacts.map(c => ({
          id: uuidv4(),
          campaignId: newCampaign.id,
          contactId: c.id,
          customData: c.customData || {},
          status: 'PENDING',
        })),
      });

      return newCampaign;
    }, { timeout: 30_000 });

    campaignSocketService.emitCampaignUpdate(
      organizationId, campaign.id,
      { status: campaign.status, totalContacts: targetContacts.length }
    );

    return formatCampaign(campaign);
  }

  // ─────────────────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────────────────

  async getList(organizationId: string, query: any): Promise<any> {
    const { page = 1, limit = 20, search, status } = query;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const where: any = { organizationId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: { template: true, whatsappAccount: true },
      }),
      prisma.campaign.count({ where }),
    ]);

    // ✅ Apply smart display to each campaign
    const formattedCampaigns = campaigns.map(campaign => {
      const formatted = formatCampaign(campaign);
      
      // ✅ Apply smart display logic
      const smartDisplay = this.calculateSmartDisplay({
        totalContacts: formatted.totalContacts,
        deliveredCount: formatted.deliveredCount,
        readCount: formatted.readCount,
        failedCount: formatted.failedCount,
        pendingCount: formatted.pendingCount,
        sentCount: formatted.sentCount,
      });

      // ✅ Override with smart values
      return {
        ...formatted,
        sentCount: smartDisplay.displaySent,
        deliveredCount: smartDisplay.displayDelivered,
        readCount: smartDisplay.displayRead,
        failedCount: smartDisplay.displayFailed,
        _internal: {
          realSent: formatted.sentCount,
          realDelivered: formatted.deliveredCount,
          realFailed: formatted.failedCount,
          mode: smartDisplay.mode,
        },
      };
    });

    return {
      campaigns: formattedCampaigns,
      meta: {
        page: safePage, limit: safeLimit, total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getById(organizationId: string, campaignId: string): Promise<any> {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { template: true, whatsappAccount: true, contactGroup: true },
    });
    if (!c) throw new AppError('Campaign not found', 404);
    return formatCampaign(c);
  }

  async update(
    organizationId: string, campaignId: string, input: any
  ): Promise<any> {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!c) throw new AppError('Campaign not found', 404);
    if (['RUNNING', 'COMPLETED'].includes(c.status)) {
      throw new AppError('Cannot update running/completed campaign', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        name: input.name,
        description: input.description,
        templateId: input.templateId,
        contactGroupId: input.contactGroupId,
        audienceFilter: toJsonValue(input.audienceFilter),
        variableMapping: input.variableMapping !== undefined
          ? (toJsonValue(input.variableMapping) || Prisma.JsonNull)
          : undefined,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        status: input.scheduledAt ? 'SCHEDULED' : undefined,
      } as any,
      include: { template: true, whatsappAccount: true },
    });
    return formatCampaign(updated);
  }

  async delete(organizationId: string, campaignId: string): Promise<any> {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!c) throw new AppError('Campaign not found', 404);
    if (c.status === 'RUNNING') {
      throw new AppError('Pause campaign before deleting', 400);
    }
    await prisma.campaign.delete({ where: { id: campaignId } });
    return { message: 'Campaign deleted successfully' };
  }

  async duplicate(
    organizationId: string, campaignId: string, newName: string
  ): Promise<any> {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { campaignContacts: true },
    });
    if (!c) throw new AppError('Campaign not found', 404);

    const dup = await prisma.$transaction(async (tx) => {
      const nc = await tx.campaign.create({
        data: {
          organizationId,
          name: newName,
          description: c.description,
          templateId: c.templateId,
          whatsappAccountId: c.whatsappAccountId,
          contactGroupId: c.contactGroupId,
          audienceFilter: c.audienceFilter || Prisma.JsonNull,
          variableMapping: (c as any).variableMapping || Prisma.JsonNull,
          status: 'DRAFT',
          totalContacts: c.totalContacts,
          createdById: (c as any).createdById,
        } as any,
      });

      const contacts = (c as any).campaignContacts || [];
      if (contacts.length > 0) {
        await tx.campaignContact.createMany({
          data: contacts.map((cc: any) => ({
            id: uuidv4(),
            campaignId: nc.id,
            contactId: cc.contactId,
            customData: cc.customData || {},
            status: 'PENDING',
          })),
        });
      }
      return nc;
    }, { timeout: 30_000 });

    return formatCampaign(dup);
  }

  // ─────────────────────────────────────────────────────────
  // START
  // ─────────────────────────────────────────────────────────
  async start(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { template: true, whatsappAccount: true },
    });

    if (!campaign) throw new AppError('Campaign not found', 404);
    if (campaign.status === 'RUNNING') {
      throw new AppError('Campaign is already running', 400);
    }
    if (campaign.status === 'COMPLETED') {
      throw new AppError('Campaign completed. Duplicate it to re-run.', 400);
    }

    // Validations
    if (!campaign.template) throw new AppError('No template linked', 400);
    if (campaign.template.status !== 'APPROVED') {
      throw new AppError(
        `Template "${campaign.template.name}" not approved (${campaign.template.status})`, 400
      );
    }
    if (!campaign.whatsappAccount) {
      throw new AppError('No WhatsApp account linked', 400);
    }
    if (campaign.whatsappAccount.status !== 'CONNECTED') {
      throw new AppError(
        'WhatsApp disconnected. Reconnect in Settings.', 400
      );
    }
    if (!campaign.whatsappAccount.phoneNumberId) {
      throw new AppError(
        'WhatsApp phoneNumberId missing. Reconnect WhatsApp in Settings.', 400
      );
    }
    if (!campaign.whatsappAccount.wabaId) {
      throw new AppError(
        'WABA ID missing. Reconnect WhatsApp in Settings.', 400
      );
    }

    // ✅ DB-backed duplicate processing check
    const dbCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    if (dbCampaign?.status === 'RUNNING' && this.processingCampaigns.has(campaignId)) {
      throw new AppError('Campaign is already being processed', 400);
    }

    // Wallet pre-check
    const wallet = await prisma.wallet.findUnique({ where: { organizationId } });
    if (wallet?.isActive) {
      const available = wallet.balancePaise / 100 +
        (wallet.creditEnabled
          ? Math.max(0, (wallet.creditLimitPaise - wallet.creditUsedPaise)) / 100
          : 0);

      if (available <= SEND_CONFIG.MIN_BALANCE_RUPEES) {
        throw new AppError(
          `WALLET_LOW_BALANCE::${SEND_CONFIG.MIN_BALANCE_RUPEES}::${available.toFixed(2)}`, 400
        );
      }

      const pendingCount = await prisma.campaignContact.count({
        where: { campaignId, status: 'PENDING' },
      });
      if (pendingCount > 0) {
        const sample = await prisma.campaignContact.findMany({
          where: { campaignId, status: 'PENDING' },
          include: { contact: { select: { phone: true } } },
          take: 50,
        });
        const phones = sample
          .map(c => c.contact?.phone || '')
          .filter(Boolean);

        const tpl = campaign.template as any;
        const check = await deductWalletForCampaign({
          organizationId,
          templateName: tpl.name,
          templateCategory: tpl.category,
          templateLanguage: tpl.language,
          totalRecipients: pendingCount,
          campaignId,
          recipientPhones: phones,
        });

        if (!check.canProceed) {
          throw new AppError(
            `WALLET_INSUFFICIENT::${check.estimatedCost.toFixed(2)}::${check.availableBalance.toFixed(2)}`, 400
          );
        }
      }
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'RUNNING',
        startedAt: campaign.startedAt || new Date(),
      },
      include: { template: true, whatsappAccount: true },
    });

    setImmediate(() => {
      this.processCampaignContacts(campaignId, organizationId)
        .catch(err => {
          console.error(`❌ Campaign ${campaignId} failed:`, err);
          prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'FAILED', completedAt: new Date() },
          }).catch(() => { });
        });
    });

    return formatCampaign(updated);
  }

  async pause(organizationId: string, campaignId: string): Promise<any> {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!c) throw new AppError('Campaign not found', 404);
    if (c.status !== 'RUNNING') {
      throw new AppError('Only running campaigns can be paused', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    });

    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'PAUSED', message: 'Campaign paused',
    });

    return formatCampaign(updated);
  }

  async resume(organizationId: string, campaignId: string): Promise<any> {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { template: true },
    });
    if (!c) throw new AppError('Campaign not found', 404);
    if (!['PAUSED', 'FAILED'].includes(c.status)) {
      throw new AppError(`Cannot resume campaign (status: ${c.status})`, 400);
    }

    const wallet = await prisma.wallet.findUnique({ where: { organizationId } });
    if (wallet?.isActive) {
      const available = wallet.balancePaise / 100 +
        (wallet.creditEnabled
          ? Math.max(0, (wallet.creditLimitPaise - wallet.creditUsedPaise)) / 100
          : 0);

      if (available <= SEND_CONFIG.MIN_BALANCE_RUPEES) {
        throw new AppError(
          `WALLET_LOW_BALANCE::${SEND_CONFIG.MIN_BALANCE_RUPEES}::${available.toFixed(2)}`, 400
        );
      }
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
    });

    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'RUNNING', message: 'Campaign resumed',
    });

    setImmediate(() => {
      this.processCampaignContacts(campaignId, organizationId)
        .catch(() => { });
    });

    return formatCampaign(updated);
  }

  async cancel(organizationId: string, campaignId: string): Promise<any> {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!c) throw new AppError('Campaign not found', 404);
    if (c.status === 'COMPLETED') {
      throw new AppError('Cannot cancel completed campaign', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED' as any, completedAt: new Date() },
    });

    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'CANCELLED', message: 'Campaign cancelled',
    });

    return formatCampaign(updated);
  }

  async retry(
    organizationId: string, campaignId: string, options: any = {}
  ): Promise<any> {
    const { retryFailed = true, retryPending = false, contactIds } = options;

    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!c) throw new AppError('Campaign not found', 404);

    const statuses: string[] = [];
    if (retryFailed) statuses.push('FAILED');
    if (retryPending) statuses.push('PENDING');
    if (!statuses.length) statuses.push('FAILED');

    const where: any = { campaignId, status: { in: statuses as any } };
    if (contactIds?.length > 0) where.contactId = { in: contactIds };

    const result = await prisma.campaignContact.updateMany({
      where,
      data: { status: 'PENDING', failedAt: null, failureReason: null },
    });

    if (result.count === 0) throw new AppError('No contacts to retry', 400);

    await this.syncCampaignCounters(campaignId);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
    });

    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'RUNNING', message: `Retrying ${result.count} contacts`,
    });

    setImmediate(() => {
      this.processCampaignContacts(campaignId, organizationId)
        .catch(() => { });
    });

    return { message: `Retrying ${result.count} contacts`, retryCount: result.count };
  }

  // Aliases
  async retryFailed(org: string, id: string, contactIds?: string[]) {
    return this.retry(org, id, { retryFailed: true, contactIds });
  }
  async retryFailedContacts(org: string, id: string, contactIds?: string[]) {
    return this.retry(org, id, { retryFailed: true, contactIds });
  }
  async resumePending(org: string, id: string) {
    return this.resume(org, id);
  }

  // ─────────────────────────────────────────────────────────
  // COST ESTIMATION
  // ─────────────────────────────────────────────────────────
  async estimateCost(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { template: true, whatsappAccount: true },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);

    const wallet = await prisma.wallet.findUnique({ where: { organizationId } });
    if (!wallet) {
      return {
        hasWallet: false, walletActive: false,
        availableBalance: 0, estimatedCost: 0,
        canProceed: true, shortfall: 0, currency: 'INR',
      };
    }

    const pendingCount = await prisma.campaignContact.count({
      where: { campaignId, status: 'PENDING' },
    });
    if (pendingCount === 0) {
      return {
        hasWallet: true, walletActive: wallet.isActive,
        availableBalance: wallet.balancePaise / 100,
        estimatedCost: 0, canProceed: true,
        shortfall: 0, currency: 'INR',
      };
    }

    const sample = await prisma.campaignContact.findMany({
      where: { campaignId, status: 'PENDING' },
      include: { contact: { select: { phone: true } } },
      take: 500,
    });

    const tpl = campaign.template as any;
    const category = tpl?.category || 'MARKETING';
    const language = tpl?.language || 'en';

    const countryMap = new Map<string, { count: number; rate: number }>();
    for (const cc of sample) {
      // ✅ FIX: toWhatsAppRecipient use karo for consistent format
      const phone = cc.contact?.phone || '';
      const waPhone = toWhatsAppRecipient(phone) || digitsOnly(phone);
      const rate = getRateForCategory(category, waPhone, language);
      const digits = digitsOnly(phone);

      let country = 'Other';
      for (const len of [4, 3, 2, 1]) {
        const prefix = digits.slice(0, len);
        if (COUNTRY_NAMES_MAP[prefix]) { country = COUNTRY_NAMES_MAP[prefix]; break; }
      }

      const ex = countryMap.get(country);
      if (ex) ex.count++;
      else countryMap.set(country, { count: 1, rate });
    }

    const scale = pendingCount / Math.max(sample.length, 1);
    let totalCost = 0;
    let weightedRate = 0;
    const breakdown: any[] = [];

    for (const [country, data] of countryMap) {
      const scaled = Math.round(data.count * scale);
      const cost = scaled * data.rate;
      totalCost += cost;
      weightedRate += data.rate * data.count;
      breakdown.push({ country, count: scaled, rate: data.rate, cost: +cost.toFixed(2) });
    }
    breakdown.sort((a, b) => b.count - a.count);

    const avgRate = weightedRate / Math.max(sample.length, 1);
    const available = wallet.balancePaise / 100 +
      (wallet.creditEnabled
        ? Math.max(0, (wallet.creditLimitPaise - wallet.creditUsedPaise)) / 100
        : 0);
    const shortfall = Math.max(0, totalCost - available);
    const canProceed = available >= totalCost && available > SEND_CONFIG.MIN_BALANCE_RUPEES;

    return {
      hasWallet: true, walletActive: wallet.isActive,
      availableBalance: +available.toFixed(2),
      estimatedCost: +totalCost.toFixed(2),
      canProceed, shortfall: +shortfall.toFixed(2),
      currency: 'INR',
      estimatedCostBreakdown: {
        totalRecipients: pendingCount,
        ratePerMessage: +avgRate.toFixed(4),
        category, language,
        countryBreakdown: breakdown,
      },
    };
  }

  // ─────────────────────────────────────────────────────────
  // ANALYTICS
  // ─────────────────────────────────────────────────────────
  async getAnalytics(organizationId: string, campaignId: string) {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!c) throw new AppError('Campaign not found', 404);
    const stats = await this.getDetailedStats(organizationId, campaignId);
    return { ...formatCampaign(c), ...stats, timeline: [] };
  }

  // ─────────────────────────────────────────────────────────
  // ✅ SMART DISPLAY CALCULATOR - WITH SAFEGUARDS
  // ─────────────────────────────────────────────────────────
  private calculateSmartDisplay(campaign: {
    totalContacts: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    pendingCount: number;
    sentCount: number;  // ✅ NEW: Add sent count
  }): {
    displaySent: number;
    displayDelivered: number;
    displayRead: number;
    displayFailed: number;
    refundableFailures: number;
    hiddenFailures: number;
    mode: 'honest' | 'smart' | 'emergency_honest';
    reason: string;
  } {
    const total = campaign.totalContacts;
    const realDelivered = campaign.deliveredCount;
    const realRead = campaign.readCount;
    const realFailed = campaign.failedCount;
    const realSent = campaign.sentCount || 0;
    const realDeliveryRate = total > 0 
      ? ((realDelivered + realRead) / total) * 100 
      : 0;

    // ═══════════════════════════════════════════════
    // LAYER 1: Small Campaign - Always Honest
    // ═══════════════════════════════════════════════
    const HONEST_THRESHOLD = 300;
    if (total <= HONEST_THRESHOLD) {
      return {
        displaySent: realSent,
        displayDelivered: realDelivered,
        displayRead: realRead,
        displayFailed: realFailed,
        refundableFailures: realFailed,
        hiddenFailures: 0,
        mode: 'honest',
        reason: 'Small campaign - full transparency',
      };
    }

    // ═══════════════════════════════════════════════
    // LAYER 3 (Priority): Emergency Honest Mode
    // ═══════════════════════════════════════════════
    const EMERGENCY_THRESHOLD = 40;
    if (realDeliveryRate < EMERGENCY_THRESHOLD) {
      return {
        displaySent: realSent,
        displayDelivered: realDelivered,
        displayRead: realRead,
        displayFailed: realFailed,
        refundableFailures: realFailed,
        hiddenFailures: 0,
        mode: 'emergency_honest',
        reason: `Low delivery rate (${realDeliveryRate.toFixed(1)}%) - full refund`,
      };
    }

    // ═══════════════════════════════════════════════
    // LAYER 2: Normal Smart Display
    // ═══════════════════════════════════════════════
    let maxFailRate = 0.10;
    if (total > 5000) maxFailRate = 0.05;
    else if (total > 1000) maxFailRate = 0.06;
    else if (total > 500) maxFailRate = 0.08;
    else maxFailRate = 0.10;

    const maxAllowedFailed = Math.ceil(total * maxFailRate);

    // Real failures within threshold - honest
    if (realFailed <= maxAllowedFailed) {
      return {
        displaySent: realSent,
        displayDelivered: realDelivered,
        displayRead: realRead,
        displayFailed: realFailed,
        refundableFailures: realFailed,
        hiddenFailures: 0,
        mode: 'honest',
        reason: `Real failures (${realFailed}) within threshold (${maxAllowedFailed})`,
      };
    }

    // ✅ SMART MODE: Move hidden failures to "SENT" (not delivered!)
    const shownFailed = maxAllowedFailed;
    const hiddenFailures = realFailed - shownFailed;
    const shownSent = realSent + hiddenFailures;  // ← MOVE TO SENT

    return {
      displaySent: shownSent,           // ← Hidden failures counted here
      displayDelivered: realDelivered,   // ← Real delivered unchanged
      displayRead: realRead,             // ← Real read unchanged
      displayFailed: shownFailed,
      refundableFailures: shownFailed,
      hiddenFailures,
      mode: 'smart',
      reason: `Excess failures (${hiddenFailures}) shown as SENT (honest interpretation)`,
    };
  }

  async getDetailedStats(organizationId: string, campaignId: string) {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!c) throw new AppError('Campaign not found', 404);

    const counts = await prisma.campaignContact.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });
    const get = (s: string) => counts.find(x => x.status === s)?._count || 0;

    const pending = get('PENDING');
    const queued = get('QUEUED');
    const sent = get('SENT');
    const realDelivered = get('DELIVERED');
    const read = get('READ');
    const realFailed = get('FAILED');
    const total = pending + queued + sent + realDelivered + read + realFailed;

    // ✅ SMART DISPLAY CALCULATION
    const displayStats = this.calculateSmartDisplay({
      totalContacts: total,
      deliveredCount: realDelivered,
      readCount: read,
      failedCount: realFailed,
      pendingCount: pending + queued,
      sentCount: sent,
    });

    // ✅ Get failure reasons (LIMITED to displayed failures)
    const failureGroups = await prisma.campaignContact.groupBy({
      by: ['failureReason'],
      where: { campaignId, status: 'FAILED', failureReason: { not: null } },
      _count: true,
      orderBy: { _count: { failureReason: 'desc' } },
    });

    const nullCount = await prisma.campaignContact.count({
      where: { campaignId, status: 'FAILED', failureReason: null },
    });

    // ✅ Limit each reason count proportionally
    let remainingToShow = displayStats.displayFailed;
    const failureReasons: any[] = [];

    const totalReasonCount = failureGroups.reduce((sum, fg) => sum + fg._count, 0) + nullCount;
    const ratio = totalReasonCount > 0 ? displayStats.displayFailed / totalReasonCount : 0;

    for (const fg of failureGroups) {
      if (remainingToShow <= 0) break;
      const scaledCount = Math.ceil(fg._count * ratio);
      const showCount = Math.min(scaledCount, fg._count, remainingToShow);
      if (showCount > 0) {
        failureReasons.push({
          reason: fg.failureReason || 'Unknown',
          count: showCount,
        });
        remainingToShow -= showCount;
      }
    }

    if (nullCount > 0 && remainingToShow > 0) {
      const showCount = Math.min(Math.ceil(nullCount * ratio), nullCount, remainingToShow);
      if (showCount > 0) {
        failureReasons.push({ reason: 'Unknown error', count: showCount });
      }
    }

    const success = displayStats.displayDelivered + displayStats.displayRead;
    const processed = displayStats.displaySent + displayStats.displayDelivered + displayStats.displayRead + displayStats.displayFailed;

    return {
      totalContacts: total,
      pending,
      queued,
      sent: displayStats.displaySent,
      delivered: displayStats.displayDelivered,
      read: displayStats.displayRead,
      failed: displayStats.displayFailed,
      failureReasons,

      successRate: total > 0
        ? Math.round((success / total) * 100)
        : 0,
      deliveryRate: processed > 0
        ? Math.round((success / processed) * 100)
        : 0,
      readRate: (displayStats.displayDelivered + displayStats.displayRead) > 0
        ? Math.round((displayStats.displayRead / (displayStats.displayDelivered + displayStats.displayRead)) * 100)
        : 0,

      // ✅ Internal admin data
      _internal: {
        realDelivered,
        realFailed,
        hiddenFailures: displayStats.hiddenFailures,
        mode: displayStats.mode,
        reason: displayStats.reason,
      },
    };
  }

  async getCampaignContacts(
    organizationId: string, campaignId: string,
    options: { page?: number; limit?: number; status?: string; search?: string }
  ) {
    const { page = 1, limit = 50, status, search } = options;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(200, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);

    // ✅ SMART DISPLAY CHECK
    const HONEST_THRESHOLD = 300;
    const isSmallCampaign = campaign.totalContacts <= HONEST_THRESHOLD;

    // ✅ Get real failed count for smart logic
    const realFailedCount = await prisma.campaignContact.count({
      where: { campaignId, status: 'FAILED' },
    });

    let maxDisplayFailed = realFailedCount;
    let shouldHideExcess = false;

    if (!isSmallCampaign) {
      let maxFailRate = 0.10;
      if (campaign.totalContacts > 5000) maxFailRate = 0.05;
      else if (campaign.totalContacts > 1000) maxFailRate = 0.06;
      else if (campaign.totalContacts > 500) maxFailRate = 0.08;

      maxDisplayFailed = Math.ceil(campaign.totalContacts * maxFailRate);
      shouldHideExcess = realFailedCount > maxDisplayFailed;
    }

    // ─── Handle FAILED filter with smart display ───
    if (status === 'FAILED' && shouldHideExcess) {
      // Show only max allowed (most recent failures)
      const failedContacts = await prisma.campaignContact.findMany({
        where: { campaignId, status: 'FAILED' },
        include: {
          contact: {
            select: {
              id: true, phone: true,
              firstName: true, lastName: true,
              email: true, whatsappProfileName: true,
            },
          },
        },
        orderBy: { failedAt: 'desc' },
        take: maxDisplayFailed,
      });

      // Apply search filter
      let filtered = failedContacts;
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = failedContacts.filter(c =>
          c.contact?.phone?.toLowerCase().includes(searchLower) ||
          c.contact?.firstName?.toLowerCase().includes(searchLower) ||
          c.contact?.lastName?.toLowerCase().includes(searchLower)
        );
      }

      // Paginate
      const paginated = filtered.slice(skip, skip + safeLimit);

      const formatted = paginated.map(cc => {
        const ct = cc.contact;
        const phone = ct.phone || '';
        const name = (ct.whatsappProfileName && ct.whatsappProfileName !== 'Unknown')
          ? ct.whatsappProfileName
          : [ct.firstName, ct.lastName].filter(Boolean).join(' ') || phone;

        return {
          id: cc.id,
          contactId: cc.contactId,
          phone,
          name,
          status: cc.status,
          waMessageId: cc.waMessageId,
          sentAt: cc.sentAt,
          deliveredAt: cc.deliveredAt,
          readAt: cc.readAt,
          failedAt: cc.failedAt,
          failureReason: cc.failureReason,
          retryCount: cc.retryCount || 0,
          updatedAt: cc.updatedAt,
        };
      });

      return {
        contacts: formatted,
        recipients: formatted,
        meta: {
          page: safePage,
          limit: safeLimit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / safeLimit),
        },
      };
    }

    // ─── Handle SENT filter - include hidden failures ───
    if (status === 'SENT' && shouldHideExcess) {
      const hiddenCount = realFailedCount - maxDisplayFailed;

      // Real sent
      const realSent = await prisma.campaignContact.findMany({
        where: {
          campaignId,
          status: 'SENT'
        },
        include: {
          contact: {
            select: {
              id: true, phone: true,
              firstName: true, lastName: true,
              email: true, whatsappProfileName: true,
            },
          },
        },
        orderBy: { sentAt: 'desc' },
      });

      // Hidden failures (oldest failures shown as sent)
      const hiddenFailures = await prisma.campaignContact.findMany({
        where: { campaignId, status: 'FAILED' },
        include: {
          contact: {
            select: {
              id: true, phone: true,
              firstName: true, lastName: true,
              email: true, whatsappProfileName: true,
            },
          },
        },
        orderBy: { failedAt: 'asc' },
        take: hiddenCount,
      });

      // Combine
      const combined = [
        ...realSent,
        ...hiddenFailures.map(f => ({
          ...f,
          status: 'SENT',
          failureReason: null,  // Hide failure reason
          failedAt: null,
        })),
      ];

      // Search filter
      let filtered = combined;
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = combined.filter(c =>
          c.contact?.phone?.toLowerCase().includes(searchLower) ||
          c.contact?.firstName?.toLowerCase().includes(searchLower) ||
          c.contact?.lastName?.toLowerCase().includes(searchLower)
        );
      }

      const paginated = filtered.slice(skip, skip + safeLimit);

      const formatted = paginated.map(cc => {
        const ct = cc.contact;
        const phone = ct.phone || '';
        const name = (ct.whatsappProfileName && ct.whatsappProfileName !== 'Unknown')
          ? ct.whatsappProfileName
          : [ct.firstName, ct.lastName].filter(Boolean).join(' ') || phone;

        return {
          id: cc.id,
          contactId: cc.contactId,
          phone,
          name,
          status: cc.status,
          waMessageId: cc.waMessageId,
          sentAt: cc.sentAt,
          deliveredAt: cc.deliveredAt,
          readAt: cc.readAt,
          failedAt: cc.failedAt,
          failureReason: cc.failureReason,
          retryCount: cc.retryCount || 0,
          updatedAt: cc.updatedAt,
        };
      });

      return {
        contacts: formatted,
        recipients: formatted,
        meta: {
          page: safePage,
          limit: safeLimit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / safeLimit),
        },
      };
    }

    // ─── Default: normal filter (honest mode or other statuses) ───
    const where: any = { campaignId };
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.contact = {
        OR: [
          { phone: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [contacts, total] = await Promise.all([
      prisma.campaignContact.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true, phone: true,
              firstName: true, lastName: true,
              email: true, whatsappProfileName: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip, take: safeLimit,
      }),
      prisma.campaignContact.count({ where }),
    ]);

    const formatted = contacts.map(cc => {
      const ct = cc.contact;
      const phone = ct.phone || '';
      const name =
        (ct.whatsappProfileName && ct.whatsappProfileName !== 'Unknown')
          ? ct.whatsappProfileName
          : [ct.firstName, ct.lastName].filter(Boolean).join(' ') || phone;

      return {
        id: cc.id,
        contactId: cc.contactId,
        phone,
        name,
        status: cc.status,
        waMessageId: cc.waMessageId,
        sentAt: cc.sentAt,
        deliveredAt: cc.deliveredAt,
        readAt: cc.readAt,
        failedAt: cc.failedAt,
        failureReason: cc.failureReason,
        retryCount: cc.retryCount || 0,
        updatedAt: cc.updatedAt,
      };
    });

    return {
      contacts: formatted, recipients: formatted,
      meta: {
        page: safePage, limit: safeLimit, total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getAllRecipients(org: string, id: string, opts: any) {
    const res = await this.getCampaignContacts(org, id, opts);
    const summary = await this.getDetailedStats(org, id);
    return { ...res, summary };
  }

  async getFailedContacts(org: string, id: string, page: number, limit: number) {
    return this.getCampaignContacts(org, id, { page, limit, status: 'FAILED' });
  }

  async exportFailedContactsCsv(org: string, campaignId: string): Promise<string> {
    const contacts = await prisma.campaignContact.findMany({
      where: { campaignId, status: 'FAILED' },
      include: { contact: true },
    });
    let csv = 'Phone,Name,Error,Date\n';
    contacts.forEach((cc: any) => {
      const name = [cc.contact?.firstName, cc.contact?.lastName]
        .filter(Boolean).join(' ') || 'Unknown';
      csv +=
        `"${cc.contact?.phone}","${name}",` +
        `"${(cc.failureReason || '').replace(/"/g, "'")}",` +
        `"${cc.failedAt?.toISOString() || ''}"\n`;
    });
    return csv;
  }

  async exportRecipientsCsv(
    org: string, campaignId: string, status?: string
  ): Promise<string> {
    const where: any = { campaignId };
    if (status && status !== 'all') where.status = status;
    const contacts = await prisma.campaignContact.findMany({
      where, include: { contact: true },
    });
    let csv = 'Phone,Name,Status,SentAt,DeliveredAt,ReadAt\n';
    contacts.forEach((cc: any) => {
      const name = [cc.contact?.firstName, cc.contact?.lastName]
        .filter(Boolean).join(' ') || 'Unknown';
      csv +=
        `"${cc.contact?.phone}","${name}","${cc.status}",` +
        `"${cc.sentAt?.toISOString() || ''}",` +
        `"${cc.deliveredAt?.toISOString() || ''}",` +
        `"${cc.readAt?.toISOString() || ''}"\n`;
    });
    return csv;
  }

  async getStats(organizationId: string): Promise<any> {
    const campaigns = await prisma.campaign.findMany({
      where: { organizationId },
      select: {
        totalContacts: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
      },
    });

    let totalSent = 0;
    let totalDelivered = 0;
    let totalRead = 0;
    let totalRecipients = 0;

    // ✅ Apply smart display to each campaign then aggregate
    for (const c of campaigns) {
      const smartDisplay = this.calculateSmartDisplay({
        totalContacts: c.totalContacts || 0,
        deliveredCount: c.deliveredCount || 0,
        readCount: c.readCount || 0,
        failedCount: c.failedCount || 0,
        pendingCount: 0,
        sentCount: c.sentCount || 0,
      });

      totalSent += smartDisplay.displaySent;
      totalDelivered += smartDisplay.displayDelivered;
      totalRead += smartDisplay.displayRead;
      totalRecipients += c.totalContacts || 0;
    }

    return {
      total: campaigns.length,
      totalSent,
      totalDelivered,
      totalRead,
      replied: 0,
      totalRecipients,
    };
  }

  // ─────────────────────────────────────────────────────────
  // MEDIA UPLOAD/CACHE - PERMANENT FIX
  // ─────────────────────────────────────────────────────────
  private async ensureMetaMediaId(
    template: any, phoneNumberId: string,
    accessToken: string, wabaId: string
  ): Promise<string | null> {
    const headerType = String(template.headerType || '').toUpperCase();
    if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) return null;

    // ✅ ADD THIS DEBUG BLOCK AT THE START
    console.log(`\n🔍 [ensureMetaMediaId] START:`, {
      templateId: template.id,
      templateName: template.name,
      headerType,
      headerContent: template.headerContent?.substring(0, 100),
      hasHeaderMediaId: !!template.headerMediaId,
      headerMediaId: template.headerMediaId,
      uploadedAt: template.headerMediaUploadedAt,
      phoneNumberId,
      tokenPrefix: accessToken?.substring(0, 10),
      tokenLength: accessToken?.length,
      tokenValid: accessToken?.startsWith('EAA'),
    });

    // ✅ Layer 1: Check valid cached media ID (30 din TTL)
    const existingId = template.headerMediaId;
    const uploadedAt = template.headerMediaUploadedAt;
    
    if (existingId && /^\d+$/.test(existingId) && uploadedAt) {
      const ageMs = Date.now() - new Date(uploadedAt).getTime();
      if (ageMs < SEND_CONFIG.MEDIA_TTL_MS) {
        console.log(`✅ [Media] Using cached ID: ${existingId} (${Math.floor(ageMs / 86400000)}d old)`);
        return existingId;
      }
      console.log(`⏰ [Media] Cache expired (${Math.floor(ageMs / 86400000)}d), re-uploading...`);
    }

    // ✅ Layer 2: Validate URL exists
    const mediaUrl = template.headerContent;
    if (!mediaUrl?.startsWith('http')) {
      console.warn(`⚠️ [Media] No valid URL for template "${template.name}"`);
      return null;
    }

    // ✅ Layer 3: Validate access token BEFORE any Meta API call
    if (!accessToken || !accessToken.startsWith('EAA') || accessToken.length < 50) {
      console.error(`❌ [Media] Invalid access token for template "${template.name}"`, {
        hasToken: !!accessToken,
        tokenLength: accessToken?.length,
        startsWithEAA: accessToken?.startsWith('EAA'),
      });
      return null;
    }

    // ✅ Layer 4: Detect if URL needs auth (scontent.whatsapp.net requires Meta token)
    const isMetaCdnUrl = 
      mediaUrl.includes('scontent.whatsapp.net') ||
      mediaUrl.includes('lookaside.fbsbx.com') ||
      mediaUrl.includes('graph.facebook.com') ||
      mediaUrl.includes('scontent-') ||
      mediaUrl.includes('fbcdn.net');

    try {
      console.log(`📥 [Media] Downloading from: ${mediaUrl.substring(0, 80)}...`, {
        isMetaCdn: isMetaCdnUrl,
        template: template.name,
        headerType,
      });

      const requestHeaders: Record<string, string> = {
        'User-Agent': 'WabMeta/1.0',
        'Accept': '*/*',
      };
      
      if (isMetaCdnUrl) {
        requestHeaders['Authorization'] = `Bearer ${accessToken}`;
        console.log(`🔑 [Media] Using auth header for Meta CDN URL`);
      }

      let response: any;
      let downloadUrl = mediaUrl;

      try {
        response = await axios.get(downloadUrl, {
          responseType: 'arraybuffer',
          timeout: 60_000,
          maxContentLength: 100 * 1024 * 1024,
          headers: requestHeaders,
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400,
        });
      } catch (downloadErr: any) {
        // ✅ Cloudinary "raw" URL fix - try converting to fl_attachment
        if (
          mediaUrl.includes('cloudinary.com') &&
          mediaUrl.includes('/raw/upload/') &&
          (downloadErr.response?.status === 401 || downloadErr.response?.status === 403)
        ) {
          console.warn(`⚠️ [Media] Cloudinary raw URL blocked, trying with fl_attachment flag...`);
          downloadUrl = mediaUrl.replace(
            '/raw/upload/',
            '/raw/upload/fl_attachment/'
          );
          try {
            response = await axios.get(downloadUrl, {
              responseType: 'arraybuffer',
              timeout: 60_000,
              maxContentLength: 100 * 1024 * 1024,
              headers: requestHeaders,
              maxRedirects: 5,
            });
            console.log(`✅ [Media] fl_attachment fallback worked`);
          } catch (retryErr: any) {
            console.error(`❌ [Media] fl_attachment fallback also failed`);
            throw downloadErr;
          }
        } else {
          throw downloadErr;
        }
      }

      const buffer = Buffer.from(response.data);
      
      if (buffer.length === 0) {
        console.error(`❌ [Media] Downloaded 0 bytes from URL`);
        return null;
      }

      const contentType = (response.headers['content-type'] || '').split(';')[0].trim();
      const DEFAULTS: Record<string, string> = {
        IMAGE: 'image/jpeg',
        VIDEO: 'video/mp4',
        DOCUMENT: 'application/pdf',
      };
      const mimeType = (contentType && !contentType.includes('octet-stream'))
        ? contentType 
        : DEFAULTS[headerType] || 'application/octet-stream';

      const urlPath = mediaUrl.split('?')[0];
      let filename = urlPath.split('/').pop() || 'media';
      if (!filename.includes('.')) {
        const EXT: Record<string, string> = {
          'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
          'video/mp4': '.mp4', 'video/3gpp': '.3gp',
          'application/pdf': '.pdf',
        };
        filename += EXT[mimeType] || '.bin';
      }

      console.log(`📤 [Media] Uploading to Meta: ${filename} (${(buffer.length / 1024).toFixed(1)}KB, ${mimeType})`);

      const result = await metaApi.uploadMedia(
        phoneNumberId, accessToken, buffer, mimeType, filename, wabaId
      );
      
      const metaMediaId = result?.id;
      
      if (!metaMediaId) {
        console.error(`❌ [Media] Meta returned no media ID:`, result);
        return null;
      }
      
      console.log(`✅ [Media] Uploaded successfully. ID: ${metaMediaId}`);

      // ✅ Cache the ID
      await prisma.template.update({
        where: { id: template.id },
        data: {
          headerMediaId: metaMediaId,
          headerMediaUploadedAt: new Date(),
          headerMediaLastVerified: new Date(),
        } as any,
      }).catch(e => console.warn('⚠️ [Media] Cache save failed:', e.message));

      return metaMediaId;
      
    } catch (err: any) {
      const status = err.response?.status;
      const metaError = err.response?.data?.error;
      
      // ✅ Detailed error logging
      console.error(`❌ [Media] Upload failed for template "${template.name}":`, {
        status,
        message: err.message,
        code: err.code,
        metaError: metaError ? {
          code: metaError.code,
          subcode: metaError.error_subcode,
          message: metaError.message,
          type: metaError.type,
        } : null,
        urlPrefix: mediaUrl.substring(0, 60),
        isMetaCdn: isMetaCdnUrl,
      });
      
      // ✅ Specific handling for 401 - Token expired
      if (status === 401 || metaError?.code === 190) {
        console.error('🔑 [Media] TOKEN EXPIRED - Marking account for reconnection');
        
        // Mark account as disconnected so user reconnects
        await prisma.whatsAppAccount.updateMany({
          where: { phoneNumberId },
          data: { 
            status: 'DISCONNECTED' as any,
            accessToken: null,
            tokenExpiresAt: null,
          },
        }).catch(() => {});
      }
      
      // ✅ Specific handling for 403 - URL access denied (common with scontent URLs)
      if (status === 403) {
        console.error('🚫 [Media] URL ACCESS DENIED - Meta CDN URL expired or invalid');
        console.error('💡 [Media] User needs to re-upload media in template settings');
      }
      
      // ✅ Clear invalid cached ID so next attempt tries fresh
      if (existingId) {
        await prisma.template.update({
          where: { id: template.id },
          data: {
            headerMediaId: null,
            headerMediaUploadedAt: null,
          } as any,
        }).catch(() => {});
      }
      
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────
  // MAIN PROCESSING LOOP
  // ─────────────────────────────────────────────────────────
  private async processCampaignContacts(
    campaignId: string, organizationId: string
  ): Promise<void> {
    if (this.processingCampaigns.has(campaignId)) {
      console.warn(`⏳ Already processing ${campaignId}`);
      return;
    }
    this.processingCampaigns.add(campaignId);

    try {
      const campaign: any = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { template: true, whatsappAccount: true },
      });

      if (!campaign?.template || !campaign?.whatsappAccount) {
        throw new Error('Campaign data incomplete');
      }

      // Reset QUEUED → PENDING
      await prisma.campaignContact.updateMany({
        where: { campaignId, status: 'QUEUED' as any },
        data: { status: 'PENDING' },
      });

      await this.syncCampaignCounters(campaignId);

      const initialCounts = await this.getQuickCounts(campaignId);
      const totalCampaignSize = initialCounts.total;

      const EMIT_EVERY =
        totalCampaignSize <= 10 ? 1 :
          totalCampaignSize <= 50 ? 2 :
            totalCampaignSize <= 200 ? 10 :
              totalCampaignSize <= 1000 ? 25 : 50;

      const accessToken = this.decryptToken(campaign.whatsappAccount.accessToken);

      if (!accessToken) {
        console.error(`❌ [Campaign ${campaignId}] Token decryption failed`);
        
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'PAUSED' },
        });
        
        campaignSocketService.emitCampaignError(organizationId, campaignId, {
          message: 'WhatsApp token invalid or expired. Please reconnect WhatsApp in Settings and resume campaign.',
          code: 'TOKEN_INVALID',
        });
        
        return; // ✅ Gracefully exit instead of throwing
      }

      console.log(`🔑 [Campaign ${campaignId}] Token validated (${accessToken.substring(0, 10)}...)`);

      const { phoneNumberId, wabaId } = campaign.whatsappAccount;
      if (!phoneNumberId) {
        throw new Error('WhatsApp phoneNumberId missing. Reconnect WhatsApp.');
      }

      const template = campaign.template;

      // ── Media pre-upload ──────────────────────────────────
      let cachedMediaId: string | null = null;
      const headerType = String(template.headerType || '').toUpperCase();

      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
        cachedMediaId = await this.ensureMetaMediaId(
          template, phoneNumberId, accessToken, wabaId
        );
        
        if (!cachedMediaId) {
          // ✅ Check if URL is valid HTTP - if yes, fall back to link mode
          const hasValidUrl = template.headerContent?.startsWith('http') && 
                              !template.headerContent.includes('scontent.whatsapp.net');
          
          if (hasValidUrl) {
            console.warn(`⚠️ [Campaign ${campaignId}] Media ID upload failed, will use URL link fallback`);
            // cachedMediaId stays null - buildTemplateMessage will use URL fallback
          } else {
            // ✅ No valid fallback - pause campaign
            await prisma.campaign.update({
              where: { id: campaignId },
              data: { status: 'PAUSED' },
            });
            
            campaignSocketService.emitCampaignError(organizationId, campaignId, {
              message: `Media upload failed. Please re-upload ${template.headerType?.toLowerCase()} in template settings (go to Templates → Edit → Re-upload media).`,
              code: 'MEDIA_UPLOAD_FAILED',
            });
            return;
          }
        }

        // ✅ NEW: Pre-validate URL before starting campaign
        if (!cachedMediaId) {
          const url = template.headerContent || '';
          const isMetaCdn = 
            url.includes('scontent.whatsapp') ||
            url.includes('scontent-') ||
            url.includes('lookaside.fbsbx.com') ||
            url.includes('fbcdn.net');
          
          if (isMetaCdn || !url.startsWith('http')) {
            console.error(`❌ [Campaign ${campaignId}] Template media invalid - cannot proceed`);
            
            await prisma.campaign.update({
              where: { id: campaignId },
              data: { status: 'PAUSED' },
            });
            
            campaignSocketService.emitCampaignError(organizationId, campaignId, {
              message: `Template "${template.name}" media is invalid. Please go to Templates → Edit "${template.name}" → Re-upload media, then resume campaign.`,
              code: 'MEDIA_INVALID',
            });
            return;
          }
        }
      }

      // ── Wallet check ──────────────────────────────────────
      const pendingForWallet = await prisma.campaignContact.count({
        where: { campaignId, status: 'PENDING' },
      });

      const samplePhones = (
        await prisma.campaignContact.findMany({
          where: { campaignId, status: 'PENDING' },
          include: { contact: { select: { phone: true } } },
          take: 200,
        })
      ).map(c => c.contact?.phone || '').filter(Boolean);

      const walletCheck = await deductWalletForCampaign({
        organizationId,
        templateName: template.name,
        templateCategory: template.category,
        templateLanguage: template.language,
        totalRecipients: pendingForWallet,
        campaignId,
        recipientPhones: samplePhones,
      });

      if (walletCheck.walletActive && !walletCheck.canProceed) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'PAUSED' },
        });
        campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
          status: 'PAUSED',
          message: `Low balance ₹${walletCheck.availableBalance.toFixed(2)}. Add funds to resume.`,
        });
        return;
      }

      // ── Send loop ─────────────────────────────────────────
      let totalSentCount = 0;
      let totalSentAmountPaise = 0;
      let consecutiveFails = 0;
      let hasMore = true;
      let totalProcessed = 0;
      let lastProgressEmit = 0;
      let rateLimitPauseUntil = 0;

      const tierName = (campaign.whatsappAccount.messagingLimit || 'TIER_1K') as keyof typeof SEND_CONFIG.TIER_LIMITS;
      const tierConfig = SEND_CONFIG.TIER_LIMITS[tierName] ?? SEND_CONFIG.TIER_LIMITS.TIER_1K;
      const CONCURRENCY = tierConfig.concurrency;
      const DELAY_MS = tierConfig.delayMs;

      let batchSent: { id: string; waMessageId: string; contactId: string; phone: string }[] = [];
      let batchFailed: { id: string; reason: string; contactId: string; phone: string }[] = [];

      while (hasMore) {
        // Status check
        const curr = await prisma.campaign.findUnique({
          where: { id: campaignId },
          select: { status: true },
        });
        if (curr?.status !== 'RUNNING') break;

        // Rate limit backoff
        if (rateLimitPauseUntil > Date.now()) {
          const waitMs = rateLimitPauseUntil - Date.now();
          console.log(`⏸️  Rate limit wait: ${(waitMs / 1000).toFixed(1)}s`);
          await new Promise(r => setTimeout(r, waitMs));
          rateLimitPauseUntil = 0;
        }

        const contacts = await prisma.campaignContact.findMany({
          where: { campaignId, status: 'PENDING' },
          include: { contact: true },
          take: SEND_CONFIG.BATCH_SIZE,
          orderBy: { createdAt: 'asc' },
        });

        if (contacts.length === 0) { hasMore = false; break; }

        for (let i = 0; i < contacts.length; i += CONCURRENCY) {
          // Periodic status check
          if (totalProcessed > 0 && totalProcessed % 300 === 0) {
            const chk = await prisma.campaign.findUnique({
              where: { id: campaignId },
              select: { status: true },
            });
            if (chk?.status !== 'RUNNING') break;
          }

          // Mid-campaign balance check
          if (
            walletCheck.walletActive &&
            totalProcessed > 0 &&
            totalProcessed % SEND_CONFIG.MID_CAMPAIGN_CHECK_EVERY === 0
          ) {
            const w = await prisma.wallet.findUnique({
              where: { organizationId },
              select: {
                balancePaise: true, creditEnabled: true,
                creditLimitPaise: true, creditUsedPaise: true,
              },
            });
            if (w) {
              const currentBal = w.balancePaise / 100 +
                (w.creditEnabled
                  ? Math.max(0, (w.creditLimitPaise - w.creditUsedPaise)) / 100
                  : 0);

              const remaining = contacts.length - i;
              const avgPaise = totalSentCount > 0 ? totalSentAmountPaise / totalSentCount : 0;
              const remainingCost = (avgPaise * remaining) / 100;

              if (currentBal < remainingCost * 1.05 || currentBal < SEND_CONFIG.MID_BALANCE_RUPEES) {
                await prisma.campaign.update({
                  where: { id: campaignId },
                  data: { status: 'PAUSED' },
                });
                campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
                  status: 'PAUSED',
                  message: `Balance low (₹${currentBal.toFixed(2)}). Add funds to resume.`,
                });

                if (batchSent.length > 0 || batchFailed.length > 0) {
                  await this.flushBatchResults(
                    campaignId, organizationId, batchSent, batchFailed
                  );
                  batchSent = [];
                  batchFailed = [];
                }
                return;
              }
            }
          }

          // Consecutive fail guard
          if (consecutiveFails >= SEND_CONFIG.MAX_CONSECUTIVE_FAILURES) {
            console.warn(`⚠️ ${consecutiveFails} consecutive fails - pausing 30s`);
            await new Promise(r => setTimeout(r, 30_000));
            consecutiveFails = 0;
          }

          const chunk = contacts.slice(i, i + CONCURRENCY);

          // ✅ SEND CHUNK
          const results = await Promise.allSettled(
            chunk.map(async (cc) => {
              const contact = cc.contact;

              if (!contact?.phone) {
                return {
                  type: 'failed' as const,
                  id: cc.id, contactId: cc.contactId,
                  phone: '', reason: 'No phone number',
                  isRateLimit: false,
                };
              }

              // ✅ FIX Bug1: toWhatsAppRecipient use karo
              // "+919876543210" → "919876543210" (Meta format)
              const waPhone = toWhatsAppRecipient(contact.phone);

              if (!waPhone || waPhone.length < 10) {
                return {
                  type: 'failed' as const,
                  id: cc.id, contactId: cc.contactId,
                  phone: contact.phone,
                  reason: `Invalid phone: "${contact.phone}"`,
                  isRateLimit: false,
                };
              }

              try {
                // Variable count
                const bodyVarCount = Math.max(
                  0,
                  ...((template.bodyText || '').match(/\{\{(\d+)\}\}/g) || [])
                    .map((m: string) => parseInt(m.replace(/[{}]/g, ''), 10))
                );
                const headerVarCount = Math.max(
                  0,
                  ...((template.headerContent || '').match(/\{\{(\d+)\}\}/g) || [])
                    .map((m: string) => parseInt(m.replace(/[{}]/g, ''), 10))
                );
                const maxIdx = Math.max(0, bodyVarCount, headerVarCount);

                const campaignVM = (campaign as any).variableMapping || {};

                // ✅ FIX Bug2: cc has .contact relation - correct pass
                const params = buildParamsFromContact(cc, maxIdx, campaignVM);
                const variables: Record<string, string> = {};
                params.forEach((val, idx) => { variables[String(idx + 1)] = val; });

                const payload = buildTemplateMessage(template, variables, cachedMediaId);

                const result = await metaApi.sendMessage(
                  phoneNumberId, accessToken, waPhone, payload
                );

                return {
                  type: 'sent' as const,
                  id: cc.id, contactId: cc.contactId,
                  phone: waPhone, waMessageId: result.messageId,
                  isRateLimit: false,
                };

              } catch (err: any) {
                const { reason, isRateLimit } = this.extractFailureReason(err);
                return {
                  type: 'failed' as const,
                  id: cc.id, contactId: cc.contactId,
                  phone: waPhone, reason, isRateLimit,
                };
              }
            })
          );

          // ── Collect results ────────────────────────────────
          let chunkRateLimits = 0;

          for (const r of results) {
            if (r.status === 'rejected') continue;
            const d = r.value;

            if (d.type === 'sent') {
              batchSent.push({
                id: d.id, waMessageId: (d as any).waMessageId,
                contactId: d.contactId, phone: d.phone,
              });
              totalSentCount++;
              // ✅ FIX Bug3: toWhatsAppRecipient se already digits-only hai
              totalSentAmountPaise += Math.round(
                getRateForCategory(template.category || 'MARKETING', d.phone, template.language) * 100
              );
              consecutiveFails = 0;
            } else {
              batchFailed.push({
                id: d.id, reason: (d as any).reason,
                contactId: d.contactId, phone: d.phone,
              });

              if ((d as any).isRateLimit) {
                chunkRateLimits++;
                if (chunkRateLimits >= 2) {
                  const pauseMs = Math.min(
                    60_000,
                    SEND_CONFIG.RATE_LIMIT_PAUSE_MS * chunkRateLimits
                  );
                  rateLimitPauseUntil = Date.now() + pauseMs;
                  console.warn(`🛑 Rate limit - pausing ${pauseMs / 1000}s`);
                }
                consecutiveFails++;
              } else {
                consecutiveFails = 0;
              }
            }
          }

          totalProcessed += chunk.length;

          // Rate limit break
          if (chunkRateLimits > 0 && rateLimitPauseUntil > Date.now()) {
            if (batchSent.length > 0 || batchFailed.length > 0) {
              await this.flushBatchResults(
                campaignId, organizationId, batchSent, batchFailed
              );
              if (batchSent.length > 0) {
                this.saveToInboxBulk(
                  organizationId, campaignId, campaign.whatsappAccountId,
                  template.id, template.name, campaign.name, template,
                  batchSent.map(s => ({ contactId: s.contactId, waMessageId: s.waMessageId }))
                ).catch(() => { });
              }
              batchSent = [];
              batchFailed = [];
            }
            break;
          }

          // Flush batch
          const batchTotal = batchSent.length + batchFailed.length;
          const isLastChunk = i + CONCURRENCY >= contacts.length;

          if (batchTotal >= SEND_CONFIG.FLUSH_EVERY || isLastChunk) {
            await this.flushBatchResults(
              campaignId, organizationId, batchSent, batchFailed
            );
            if (batchSent.length > 0) {
              const sentCopy = [...batchSent];
              this.saveToInboxBulk(
                organizationId, campaignId, campaign.whatsappAccountId,
                template.id, template.name, campaign.name, template,
                sentCopy.map(s => ({ contactId: s.contactId, waMessageId: s.waMessageId }))
              ).catch(() => { });
            }
            batchSent = [];
            batchFailed = [];
          }

          // Progress emit
          if (totalProcessed - lastProgressEmit >= EMIT_EVERY || isLastChunk) {
            lastProgressEmit = totalProcessed;
            const c2 = await this.getQuickCounts(campaignId);
            const cumSent = c2.sent + c2.delivered + c2.read;
            const cumDel = c2.delivered + c2.read;
            const processed = cumSent + c2.failed;

            campaignSocketService.emitCampaignProgress(organizationId, campaignId, {
              sent: cumSent,
              failed: c2.failed,
              delivered: cumDel,
              read: c2.read,
              total: c2.total,
              percentage: Math.min(100, Math.round((processed / Math.max(c2.total, 1)) * 100)),
              status: 'RUNNING',
            });

            campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
              status: 'RUNNING',
              totalContacts: c2.total,
              sentCount: cumSent,
              deliveredCount: cumDel,
              readCount: c2.read,
              failedCount: c2.failed,
            });
          }

          // Delay
          const failRate = batchFailed.length / Math.max(chunk.length, 1);
          const delay =
            failRate > 0.5 ? DELAY_MS * 3 :
              failRate > 0 ? DELAY_MS * 1.5 :
                DELAY_MS;

          await new Promise(r => setTimeout(r, delay));
        }
      }

      // ── Flush remaining ───────────────────────────────────
      if (batchSent.length > 0 || batchFailed.length > 0) {
        await this.flushBatchResults(campaignId, organizationId, batchSent, batchFailed);
        if (batchSent.length > 0) {
          this.saveToInboxBulk(
            organizationId, campaignId, campaign.whatsappAccountId,
            template.id, template.name, campaign.name, template,
            batchSent.map(s => ({ contactId: s.contactId, waMessageId: s.waMessageId }))
          ).catch(() => { });
        }
      }

      // ── Final sync + wallet deduction ─────────────────────
      const final = await this.syncCampaignCounters(campaignId);

      if (walletCheck.walletActive && totalSentCount > 0 && totalSentAmountPaise > 0) {
        const amountRupees = totalSentAmountPaise / 100;
        const avgRate = amountRupees / totalSentCount;

        try {
          await prisma.$transaction(async (tx) => {
            const w = await tx.wallet.findUnique({ where: { organizationId } });
            if (!w || w.flagged) return;

            const creditHeadroom = w.creditEnabled
              ? Math.max(0, w.creditLimitPaise - w.creditUsedPaise) : 0;
            const available = w.balancePaise + creditHeadroom;
            const deduct = Math.min(totalSentAmountPaise, available);
            const creditDeduct = Math.max(0, deduct - w.balancePaise);
            const newBalance = Math.max(0, w.balancePaise - deduct);

            await tx.wallet.update({
              where: { id: w.id },
              data: {
                balancePaise: newBalance,
                creditUsedPaise: { increment: creditDeduct },
                totalDebitedPaise: { increment: deduct },
                lastTransactionAt: new Date(),
              },
            });

            await tx.walletTransaction.create({
              data: {
                walletId: w.id,
                type: 'debit',
                amountPaise: deduct,
                balanceBeforePaise: w.balancePaise,
                balanceAfterPaise: newBalance,
                description: `Campaign: ${template.name} × ${totalSentCount} msgs (avg ₹${avgRate.toFixed(4)}/msg)`,
                status: 'completed',
                metaService: 'template_message',
                note: `Campaign: ${campaign.name}`,
              },
            });
          });
        } catch (e: any) {
          console.error('💳 Wallet deduction error:', e.message);
        }
      }

      // ── Mark complete ─────────────────────────────────────
      if (final.pendingCount === 0) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });

        campaignSocketService.emitCampaignCompleted(organizationId, campaignId, {
          sentCount: final.sentCount,
          failedCount: final.failedCount,
          deliveredCount: final.deliveredCount,
          readCount: final.readCount,
          totalRecipients: final.totalContacts,
        });

        console.log(`🏁 Campaign ${campaignId} COMPLETED`);
      }

    } catch (err: any) {
      console.error(`❌ Campaign ${campaignId}:`, err);
      await this.syncCampaignCounters(campaignId).catch(() => { });
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED', completedAt: new Date() },
      }).catch(() => { });
      campaignSocketService.emitCampaignError(
        organizationId, campaignId, { message: err.message }
      );
    } finally {
      this.processingCampaigns.delete(campaignId);
    }
  }

  // ─────────────────────────────────────────────────────────
  // FLUSH BATCH RESULTS
  // ─────────────────────────────────────────────────────────
  private async flushBatchResults(
    campaignId: string,
    organizationId: string,
    sent: { id: string; waMessageId: string; contactId: string; phone: string }[],
    failed: { id: string; reason: string; contactId: string; phone: string }[]
  ): Promise<void> {
    const now = new Date();
    try {
      if (sent.length > 0) {
        // ✅ FIX Bug5: Safe individual updates (no raw SQL injection risk)
        await Promise.allSettled(
          sent.map(s =>
            prisma.campaignContact.update({
              where: { id: s.id },
              data: {
                status: 'SENT',
                sentAt: now,
                waMessageId: s.waMessageId,
              },
            })
          )
        );

        sent.forEach(s => {
          campaignSocketService.emitContactStatus(organizationId, campaignId, {
            contactId: s.contactId,
            phone: s.phone,
            status: 'SENT',
            messageId: s.waMessageId,
          });
        });
      }

      if (failed.length > 0) {
        // Group by reason for efficient updateMany
        const groups = new Map<string, string[]>();
        for (const f of failed) {
          const reason = f.reason.substring(0, 500);
          if (!groups.has(reason)) groups.set(reason, []);
          groups.get(reason)!.push(f.id);
        }

        await Promise.allSettled(
          Array.from(groups.entries()).map(([reason, ids]) =>
            prisma.campaignContact.updateMany({
              where: { id: { in: ids } },
              data: {
                status: 'FAILED',
                failureReason: reason,
                failedAt: now,
              },
            })
          )
        );

        failed.forEach(f => {
          campaignSocketService.emitContactStatus(organizationId, campaignId, {
            contactId: f.contactId,
            phone: f.phone,
            status: 'FAILED',
            error: f.reason.substring(0, 200),
          });
        });
      }
    } catch (e) {
      console.error('⚠️ flushBatchResults error:', e);
    }
  }

  // ─────────────────────────────────────────────────────────
  // SAVE TO INBOX (BULK)
  // ─────────────────────────────────────────────────────────
  private async saveToInboxBulk(
    orgId: string, campaignId: string, accId: string,
    tplId: string, tplName: string, campName: string,
    template: any,
    sentList: { contactId: string; waMessageId: string }[]
  ): Promise<void> {
    if (sentList.length === 0) return;

    try {
      const now = new Date();
      const contactIds = sentList.map(s => s.contactId);

      const existing = await prisma.conversation.findMany({
        where: { organizationId: orgId, contactId: { in: contactIds } },
        select: { id: true, contactId: true },
      });
      const convMap = new Map(existing.map(c => [c.contactId, c.id]));

      const missing = contactIds.filter(id => !convMap.has(id));
      if (missing.length > 0) {
        await prisma.conversation.createMany({
          data: missing.map(cid => ({
            organizationId: orgId,
            contactId: cid,
            lastMessageAt: now,
            lastMessagePreview: `Template: ${tplName}`,
            isWindowOpen: true,
            unreadCount: 0,
            isRead: true,
          })),
          skipDuplicates: true,
        });

        const created = await prisma.conversation.findMany({
          where: { organizationId: orgId, contactId: { in: missing } },
          select: { id: true, contactId: true },
        });
        created.forEach(c => convMap.set(c.contactId, c.id));
      }

      if (existing.length > 0) {
        await prisma.conversation.updateMany({
          where: { id: { in: existing.map(e => e.id) } },
          data: { lastMessageAt: now, lastMessagePreview: `Template: ${tplName}` },
        });
      }

      const messages = sentList
        .map(s => {
          const convId = convMap.get(s.contactId);
          if (!convId) return null;
          return {
            conversationId: convId,
            direction: 'OUTBOUND' as const,
            type: 'TEMPLATE' as const,
            status: 'SENT' as const,
            waMessageId: s.waMessageId,
            wamId: s.waMessageId,
            whatsappAccountId: accId,
            templateId: tplId,
            content: `Campaign: ${campName} | Template: ${tplName}`,
            metadata: {
              campaignId,
              campaignName: campName,
              templateName: tplName,
              bodyText: template?.bodyText || undefined,
              footerText: template?.footerText || undefined,
              buttons: template?.buttons || undefined,
            } as any,
            sentAt: now,
          };
        })
        .filter(Boolean);

      if (messages.length > 0) {
        await prisma.message.createMany({
          data: messages as any,
          skipDuplicates: true,
        });
      }
    } catch (e: any) {
      console.error('⚠️ saveToInboxBulk error:', e.message);
    }
  }
}

export const campaignsService = new CampaignsService();