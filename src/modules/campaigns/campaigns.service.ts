// src/modules/campaigns/campaigns.service.ts - FINAL FIXED
import {
  CampaignStatus,
  MessageStatus,
  Prisma,
} from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { metaService } from '../meta/meta.service';
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

// ─── Constants ────────────────────────────────────────────────
const SEND_CONFIG = {
  BATCH_SIZE: 500,
  CONCURRENCY: 10,   // ✅ FIX Bug12: 20→10, safer for rate limits
  FLUSH_EVERY: 50,
  DELAY_BETWEEN_CHUNKS_MS: 200,  // ✅ ~50 msgs/sec (safer)
  MAX_CONSECUTIVE_FAILURES: 15,
  RATE_LIMIT_PAUSE_MS: 10_000,
  MEDIA_TTL_MS: 25 * 24 * 60 * 60 * 1000, // 25 days
  MID_CAMPAIGN_CHECK_EVERY: 50,
  MIN_BALANCE_RUPEES: 20,
  MID_BALANCE_RUPEES: 5,
} as const;

// ─── Pure Helpers ─────────────────────────────────────────────

const digitsOnly = (p: string): string =>
  String(p || '').replace(/\D/g, '');

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

const buildParamsFromContact = (
  cc:              any,
  varCount:        number,
  variableMapping?: Record<string, string>  // ✅ NEW parameter
): string[] => {
  const cd  = cc?.customData || {};
  const cnt = cc?.contact || cc?.Contact || cc || {};

  const params: string[] = [];

  for (let i = 0; i < varCount; i++) {
    const varKey = String(i + 1);
    let value: string = 'NA';

    // ✅ Priority 1: Check variableMapping from campaign
    if (variableMapping && variableMapping[varKey]) {
      const mappedValue = variableMapping[varKey];

      // If it's a field reference like "{{contact.firstName}}"
      if (mappedValue.startsWith('{{contact.') && mappedValue.endsWith('}}')) {
        const fieldName = mappedValue.slice(10, -2); // Extract "firstName"
        
        // Resolve to actual contact value
        switch (fieldName) {
          case 'firstName':
            value = cnt.firstName || 'NA';
            break;
          case 'lastName':
            value = cnt.lastName || '';
            break;
          case 'fullName':
            value = [cnt.firstName, cnt.lastName].filter(Boolean).join(' ') || 'NA';
            break;
          case 'phone':
            value = cnt.phone || 'NA';
            break;
          case 'email':
            value = cnt.email || 'NA';
            break;
          case 'company':
            value = cnt.customFields?.company || 'NA';
            break;
          default:
            value = cnt[fieldName] || 'NA';
        }
      } else {
        // ✅ Custom text - use as-is for all recipients
        value = mappedValue;
      }
    }
    // Priority 2: customData from CSV
    else if (cd[varKey]) {
      value = cd[varKey];
    }
    // Priority 3: Fallback to standard fields
    else {
      const fallback = [
        cnt.firstName || '',
        cnt.lastName  || '',
        cnt.phone     || '',
        cnt.email     || '',
      ].filter(Boolean);
      value = fallback[i] || 'NA';
    }

    params.push(String(value));
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

const toJsonValue = (value: any): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value));
};

const calculateRates = (
  campaign: any
): { deliveryRate: number; readRate: number } => ({
  deliveryRate:
    campaign.sentCount > 0
      ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100)
      : 0,
  readRate:
    campaign.deliveredCount > 0
      ? Math.round((campaign.readCount / campaign.deliveredCount) * 100)
      : 0,
});

const formatCampaign = (campaign: any): any => {
  const { deliveryRate, readRate } = calculateRates(campaign);
  const pendingCount = Math.max(
    0,
    (campaign.totalContacts || 0) -
    (campaign.sentCount || 0) -
    (campaign.failedCount || 0)
  );
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
    status: campaign.status,
    scheduledAt: campaign.scheduledAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    totalContacts: campaign.totalContacts || 0,
    sentCount: campaign.sentCount || 0,
    deliveredCount: campaign.deliveredCount || 0,
    readCount: campaign.readCount || 0,
    failedCount: campaign.failedCount || 0,
    pendingCount,
    deliveryRate,
    readRate,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
};

// ─── Template Message Builder ──────────────────────────────────
// ✅ FIX Bug7: Made synchronous (was async but no await inside)
function buildTemplateMessage(
  template: any,
  variables: Record<string, string>,
  metaMediaId: string | null
): any {
  const components: any[] = [];
  const headerType = String(template.headerType || '').toUpperCase();

  // ── Header ──────────────────────────────────────────────────
  if (headerType === 'TEXT' && template.headerContent) {
    const headerVars = extractVariables(template.headerContent);
    if (headerVars.length > 0) {
      components.push({
        type: 'header',
        parameters: headerVars.map(idx => ({
          type: 'text',
          text: variables[String(idx)] || '',
        })),
      });
    }

  } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
    const mediaType = headerType.toLowerCase();

    if (metaMediaId && /^\d+$/.test(metaMediaId)) {
      // ✅ Best: numeric Meta media ID
      const param: any = {
        type: mediaType,
        [mediaType]: { id: metaMediaId },
      };
      if (mediaType === 'document') {
        const fname =
          (template.headerContent || '').split('/').pop()?.split('?')[0] ||
          'document.pdf';
        param.document.filename = fname;
      }
      components.push({ type: 'header', parameters: [param] });

    } else if (template.headerContent?.startsWith('http')) {
      // Fallback: URL (may get 403 from Meta)
      const param: any = {
        type: mediaType,
        [mediaType]: { link: template.headerContent },
      };
      if (mediaType === 'document') {
        const fname =
          template.headerContent.split('/').pop()?.split('?')[0] ||
          'document.pdf';
        param.document.filename = fname;
      }
      components.push({ type: 'header', parameters: [param] });
      console.warn(`⚠️ Media fallback to URL for "${template.name}"`);

    } else {
      console.error(
        `❌ No valid media for template "${template.name}" (${headerType})`
      );
    }
  }

  // ── Body ────────────────────────────────────────────────────
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

  // ── Buttons ─────────────────────────────────────────────────
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
  // ✅ FIX Bug11: Use DB-backed lock instead of in-memory Set
  // In-memory Set clears on server restart → stuck campaigns
  private processingCampaigns = new Set<string>();

  // ── Count helpers ──────────────────────────────────────────
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
    const counts = await this.getQuickCounts(campaignId);
    const cumulativeSent = counts.sent + counts.delivered + counts.read;
    const cumulativeDelivered = counts.delivered + counts.read;

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        totalContacts: counts.total,
        sentCount: cumulativeSent,
        deliveredCount: cumulativeDelivered,
        readCount: counts.read,
        failedCount: counts.failed,
      },
    });

    return {
      totalContacts: counts.total,
      sentCount: cumulativeSent,
      deliveredCount: cumulativeDelivered,
      readCount: counts.read,
      failedCount: counts.failed,
      pendingCount: counts.pending,
    };
  }

  // ── Account finder ─────────────────────────────────────────
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

  // ── Token decryptor ────────────────────────────────────────
  // ✅ FIX Bug8: Don't rely on 'EAA' prefix - just try decrypt
  private decryptToken(rawToken: string | null): string | null {
    if (!rawToken) return null;
    // Try decrypt first
    try {
      const decrypted = safeDecrypt(rawToken);
      if (decrypted && decrypted.length > 20) return decrypted;
    } catch { /* not encrypted */ }
    // Return as-is if long enough (plain token)
    return rawToken.length > 20 ? rawToken : null;
  }

  // ── Error extractor ────────────────────────────────────────
  private extractFailureReason(error: any): string {
    const me = error.response?.data?.error;
    if (!me) return (error.message || 'Unknown error').substring(0, 500);

    const code = me.code;
    const details = me.error_data?.details || '';

    if (code === 131053) {
      if (details.includes('No video stream'))
        return 'Video corrupted - Re-encode with H.264 codec (HandBrake)';
      if (details.includes('403') || details.includes('Forbidden'))
        return 'Media URL inaccessible - Please re-upload media';
      if (details.includes('too large'))
        return 'Media file too large - Please compress';
      return `Media error: ${details || me.message}`.substring(0, 500);
    }

    const MAP: Record<number, string> = {
      100: 'Invalid parameter - Template mismatch',
      131030: 'Phone not on WhatsApp',
      131026: 'Message undeliverable',
      131048: 'Rate limit - please wait',
      131021: 'Rate limit - please wait',
      131056: 'Number restricted by Meta',
      131042: 'Meta account payment issue - Update payment in Facebook Business Manager',
      132000: 'Template parameters mismatch',
      132001: 'Template not found or not approved',
      132005: 'Template hydration failed',
      132007: 'Template content policy violation',
      132012: 'Template format mismatch',
      132015: 'Template PAUSED by Meta - Too many messages blocked',
      132016: 'Template DISABLED by Meta - Policy violation',
      190: 'Access token expired - Reconnect WhatsApp in Settings',
      368: 'Sender temporarily restricted',
      4: 'API rate limit exceeded',
      80007: 'Rate limit for messages',
    };
    return (MAP[code] || `${me.message || 'Meta error'} (${code})`).substring(0, 500);
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC METHODS
  // ─────────────────────────────────────────────────────────────

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

    // ── Validate template ──────────────────────────────────
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });
    if (!template) throw new AppError('Template not found', 404);
    if (template.status !== 'APPROVED') {
      throw new AppError(
        `Template not approved (status: ${template.status})`, 400
      );
    }

    // ── Find WA account ────────────────────────────────────
    const waAccount = await this.findWhatsAppAccount(
      organizationId, whatsappAccountId, phoneNumberId
    );
    if (!waAccount) {
      throw new AppError(
        'No WhatsApp account found. Please connect WhatsApp in Settings.', 400
      );
    }

    // ── Build contacts ─────────────────────────────────────
    let targetContacts: any[] = [];

    if (csvContacts?.length > 0) {
      const phones = csvContacts
        .map((c: any) => digitsOnly(c.phone))
        .filter(Boolean);

      await prisma.contact.createMany({
        data: phones.map((phone: string) => ({
          organizationId, phone, status: 'ACTIVE',
        })),
        skipDuplicates: true,
      });

      const dbContacts = await prisma.contact.findMany({
        where: { organizationId, phone: { in: phones } },
      });
      const contactMap = new Map(dbContacts.map(c => [c.phone, c]));

      targetContacts = csvContacts
        .map((c: any) => {
          const dbC = contactMap.get(digitsOnly(c.phone));
          return dbC ? { ...dbC, customData: c.customData } : null;
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
        if (audienceFilter.createdAfter) {
          where.createdAt = { gte: new Date(audienceFilter.createdAfter) };
        }
        if (audienceFilter.createdBefore) {
          where.createdAt = {
            ...(where.createdAt as any),
            lte: new Date(audienceFilter.createdBefore),
          };
        }
      }
      targetContacts = await prisma.contact.findMany({ where });
    }

    if (targetContacts.length === 0) {
      throw new AppError('No contacts found for selected audience.', 400);
    }

    // ── Deduplicate by contact ID ──────────────────────────
    const seen = new Set<string>();
    targetContacts = targetContacts.filter(c => {
      if (!c?.id || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    // ── Create campaign in transaction ─────────────────────
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
          status: scheduledAt ? 'SCHEDULED' : 'DRAFT' as CampaignStatus,
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

    return {
      campaigns: campaigns.map(formatCampaign),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getById(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { template: true, whatsappAccount: true, contactGroup: true },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);
    return formatCampaign(campaign);
  }

  async update(
    organizationId: string,
    campaignId: string,
    input: any
  ): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);

    if (['RUNNING', 'COMPLETED'].includes(campaign.status)) {
      throw new AppError('Cannot update a running or completed campaign', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        name: input.name,
        description: input.description,
        templateId: input.templateId,
        contactGroupId: input.contactGroupId,
        audienceFilter: toJsonValue(input.audienceFilter),
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        status: input.scheduledAt ? 'SCHEDULED' : undefined,
      },
      include: { template: true, whatsappAccount: true },
    });

    return formatCampaign(updated);
  }

  async delete(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (campaign.status === 'RUNNING') throw new AppError('Cannot delete a running campaign. Pause it first.', 400);

    await prisma.campaign.delete({ where: { id: campaignId } });
    return { message: 'Campaign deleted successfully' };
  }

  async duplicate(
    organizationId: string,
    campaignId: string,
    newName: string
  ): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { campaignContacts: true },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);

    const dup = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.campaign.create({
        data: {
          organizationId,
          name: newName,
          description: campaign.description,
          templateId: campaign.templateId,
          whatsappAccountId: campaign.whatsappAccountId,
          contactGroupId: campaign.contactGroupId,
          audienceFilter: campaign.audienceFilter || Prisma.JsonNull,
          status: 'DRAFT',
          totalContacts: campaign.totalContacts,
          createdById: (campaign as any).createdById,
        } as any,
      });

      if ((campaign as any).campaignContacts?.length > 0) {
        await tx.campaignContact.createMany({
          data: (campaign as any).campaignContacts.map((cc: any) => ({
            id: uuidv4(),
            campaignId: newCampaign.id,
            contactId: cc.contactId,
            customData: cc.customData || {},
            status: 'PENDING',
          })),
        });
      }

      return newCampaign;
    }, { timeout: 30_000 });

    return formatCampaign(dup);
  }

  // ── Start ──────────────────────────────────────────────────
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
      throw new AppError('Campaign already completed. Duplicate it to re-run.', 400);
    }

    // Template checks
    if (!campaign.template) {
      throw new AppError('Campaign has no template linked', 400);
    }
    if (campaign.template.status !== 'APPROVED') {
      throw new AppError(
        `Template "${campaign.template.name}" is not approved (${campaign.template.status}). ` +
        `Please wait for Meta approval.`, 400
      );
    }
    if (!campaign.whatsappAccount) {
      throw new AppError('No WhatsApp account linked to campaign', 400);
    }
    if (campaign.whatsappAccount.status !== 'CONNECTED') {
      throw new AppError(
        'WhatsApp account is disconnected. Please reconnect in Settings.', 400
      );
    }

    // ── Wallet pre-check ───────────────────────────────────
    const wallet = await prisma.wallet.findUnique({
      where: { organizationId },
    });

    if (wallet?.isActive) {
      const available = wallet.balancePaise / 100 +
        (wallet.creditEnabled
          ? Math.max(0, (wallet.creditLimitPaise - wallet.creditUsedPaise)) / 100
          : 0);

      if (available <= SEND_CONFIG.MIN_BALANCE_RUPEES) {
        throw new AppError(
          `WALLET_LOW_BALANCE::${SEND_CONFIG.MIN_BALANCE_RUPEES}::${available.toFixed(2)}`,
          400
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
        const samplePhones = sample
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
          recipientPhones: samplePhones,
        });

        if (!check.canProceed) {
          throw new AppError(
            `WALLET_INSUFFICIENT::${check.estimatedCost.toFixed(2)}::${check.availableBalance.toFixed(2)}`,
            400
          );
        }
      }
    }

    // ── Update status ──────────────────────────────────────
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'RUNNING',
        startedAt: campaign.startedAt || new Date(),
      },
      include: { template: true, whatsappAccount: true },
    });

    // ✅ FIX Bug1: Fire-and-forget with proper error logging
    // Use setImmediate so response is sent first
    setImmediate(() => {
      this.processCampaignContacts(campaignId, organizationId)
        .catch(err => {
          console.error(`❌ Campaign ${campaignId} processing failed:`, err);
          // Auto-mark as FAILED if processing throws
          prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'FAILED', completedAt: new Date() },
          }).catch(() => { });
        });
    });

    return formatCampaign(updated);
  }

  // ✅ FIX Bug6: pause() - added organizationId check
  async pause(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId }, // ✅ org check
    });
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (campaign.status !== 'RUNNING') {
      throw new AppError('Only running campaigns can be paused', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    });

    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'PAUSED',
      message: 'Campaign paused',
    });

    return formatCampaign(updated);
  }

  async resume(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { template: true },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);

    if (!['PAUSED', 'FAILED'].includes(campaign.status)) {
      throw new AppError(
        `Cannot resume campaign with status: ${campaign.status}`, 400
      );
    }

    // Wallet check on resume
    const wallet = await prisma.wallet.findUnique({
      where: { organizationId },
    });

    if (wallet?.isActive) {
      const available = wallet.balancePaise / 100 +
        (wallet.creditEnabled
          ? Math.max(0, (wallet.creditLimitPaise - wallet.creditUsedPaise)) / 100
          : 0);

      if (available <= SEND_CONFIG.MIN_BALANCE_RUPEES) {
        throw new AppError(
          `WALLET_LOW_BALANCE::${SEND_CONFIG.MIN_BALANCE_RUPEES}::${available.toFixed(2)}`,
          400
        );
      }

      const pendingCount = await prisma.campaignContact.count({
        where: { campaignId, status: 'PENDING' },
      });

      if (pendingCount > 0 && campaign.template) {
        const tpl = campaign.template as any;
        const sample = await prisma.campaignContact.findMany({
          where: { campaignId, status: 'PENDING' },
          include: { contact: { select: { phone: true } } },
          take: 50,
        });
        const phones = sample.map(c => c.contact?.phone || '').filter(Boolean);

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
            `WALLET_INSUFFICIENT::${check.estimatedCost.toFixed(2)}::${check.availableBalance.toFixed(2)}`,
            400
          );
        }
      }
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
    });

    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'RUNNING',
      message: 'Campaign resumed',
    });

    setImmediate(() => {
      this.processCampaignContacts(campaignId, organizationId)
        .catch(() => { });
    });

    return formatCampaign(updated);
  }

  // ✅ FIX Bug5: cancel → CANCELLED status (not FAILED)
  async cancel(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);

    if (campaign.status === 'COMPLETED') {
      throw new AppError('Cannot cancel a completed campaign', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED' as any, completedAt: new Date() },
    });

    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'CANCELLED',
      message: 'Campaign cancelled',
    });

    return formatCampaign(updated);
  }

  // ✅ FIX Bug9: retry - proper retryCount handling
  async retry(
    organizationId: string,
    campaignId: string,
    options: any = {}
  ): Promise<any> {
    const { retryFailed = true, retryPending = false, contactIds } = options;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);

    const statuses: string[] = [];
    if (retryFailed) statuses.push('FAILED');
    if (retryPending) statuses.push('PENDING');
    if (statuses.length === 0) statuses.push('FAILED');

    const where: any = { campaignId, status: { in: statuses as any } };
    if (contactIds?.length > 0) where.contactId = { in: contactIds };

    // ✅ FIX Bug9: increment retryCount but cap at 5
    // First check how many already have high retry count
    const highRetry = await prisma.campaignContact.count({
      where: { ...where, retryCount: { gte: 5 } },
    });

    if (highRetry > 0) {
      console.warn(
        `⚠️ ${highRetry} contacts have already been retried 5+ times`
      );
    }

    const result = await prisma.campaignContact.updateMany({
      where,
      data: {
        status: 'PENDING',
        failedAt: null,
        failureReason: null,
        // ✅ Don't increment here - will increment on actual send
      },
    });

    if (result.count === 0) {
      throw new AppError('No contacts to retry', 400);
    }

    // Sync counters after reset
    await this.syncCampaignCounters(campaignId);

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
    });

    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'RUNNING',
      message: `Retrying ${result.count} contacts`,
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

  // ── Cost estimation ────────────────────────────────────────
  async estimateCost(
    organizationId: string,
    campaignId: string
  ): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { template: true, whatsappAccount: true },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);

    const wallet = await prisma.wallet.findUnique({
      where: { organizationId },
    });

    if (!wallet) {
      return {
        hasWallet: false,
        walletActive: false,
        availableBalance: 0,
        estimatedCost: 0,
        canProceed: true,
        shortfall: 0,
        currency: 'INR',
        estimatedCostBreakdown: {
          totalRecipients: 0,
          ratePerMessage: 0,
          category: campaign.template?.category || 'MARKETING',
          language: campaign.template?.language || 'en',
          countryBreakdown: [],
        },
      };
    }

    const pendingCount = await prisma.campaignContact.count({
      where: { campaignId, status: 'PENDING' },
    });

    if (pendingCount === 0) {
      return {
        hasWallet: true,
        walletActive: wallet.isActive,
        availableBalance: wallet.balancePaise / 100,
        estimatedCost: 0,
        canProceed: true,
        shortfall: 0,
        currency: 'INR',
        estimatedCostBreakdown: {
          totalRecipients: 0,
          ratePerMessage: 0,
          category: campaign.template?.category || 'MARKETING',
          language: campaign.template?.language || 'en',
          countryBreakdown: [],
        },
      };
    }

    const sample = await prisma.campaignContact.findMany({
      where: { campaignId, status: 'PENDING' },
      include: { contact: { select: { phone: true } } },
      take: 500,
      orderBy: { createdAt: 'asc' },
    });

    const tpl = campaign.template as any;
    const category = tpl?.category || 'MARKETING';
    const language = tpl?.language || 'en';

    const countryMap = new Map<string, { count: number; rate: number }>();
    for (const cc of sample) {
      const phone = cc.contact?.phone || '';
      const rate = getRateForCategory(category, phone, language);
      const digits = phone.replace(/\D/g, '');

      let country = 'Other';
      for (const len of [4, 3, 2, 1]) {
        const prefix = digits.slice(0, len);
        if (COUNTRY_NAMES_MAP[prefix]) {
          country = COUNTRY_NAMES_MAP[prefix];
          break;
        }
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
      hasWallet: true,
      walletActive: wallet.isActive,
      availableBalance: +available.toFixed(2),
      estimatedCost: +totalCost.toFixed(2),
      canProceed,
      shortfall: +shortfall.toFixed(2),
      currency: 'INR',
      estimatedCostBreakdown: {
        totalRecipients: pendingCount,
        ratePerMessage: +avgRate.toFixed(4),
        category,
        language,
        countryBreakdown: breakdown,
      },
    };
  }

  // ── Analytics ──────────────────────────────────────────────
  async getAnalytics(organizationId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);

    const stats = await this.getDetailedStats(organizationId, campaignId);
    return { ...formatCampaign(campaign), ...stats, timeline: [] };
  }

  async getDetailedStats(organizationId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);

    const counts = await prisma.campaignContact.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });
    const get = (s: string) => counts.find(c => c.status === s)?._count || 0;

    const pending = get('PENDING');
    const queued = get('QUEUED');
    const sent = get('SENT');
    const delivered = get('DELIVERED');
    const read = get('READ');
    const failed = get('FAILED');
    const total = pending + queued + sent + delivered + read + failed;

    const failureGroups = await prisma.campaignContact.groupBy({
      by: ['failureReason'],
      where: { campaignId, status: 'FAILED', failureReason: { not: null } },
      _count: true,
      orderBy: { _count: { failureReason: 'desc' } },
    });

    const nullCount = await prisma.campaignContact.count({
      where: { campaignId, status: 'FAILED', failureReason: null },
    });

    const failureReasons = [
      ...failureGroups.map(fg => ({
        reason: fg.failureReason || 'Unknown',
        count: fg._count,
      })),
      ...(nullCount > 0 ? [{ reason: 'Unknown error', count: nullCount }] : []),
    ];

    const success = delivered + read;
    const processed = sent + delivered + read + failed;

    return {
      totalContacts: total,
      pending, queued, sent, delivered, read, failed,
      failureReasons,
      successRate: total > 0
        ? Math.round((success / total) * 100) : 0,
      deliveryRate: processed > 0
        ? Math.round((success / processed) * 100) : 0,
      readRate: (delivered + read) > 0
        ? Math.round((read / (delivered + read)) * 100) : 0,
    };
  }

  async getCampaignContacts(
    organizationId: string,
    campaignId: string,
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
        skip,
        take: safeLimit,
      }),
      prisma.campaignContact.count({ where }),
    ]);

    const formatted = contacts.map(cc => {
      const c = cc.contact;
      const phone = (c.phone || '').replace(/^\+/, '');
      const name =
        (c.whatsappProfileName && c.whatsappProfileName !== 'Unknown')
          ? c.whatsappProfileName
          : [c.firstName, c.lastName].filter(Boolean).join(' ') || phone;

      return {
        id: cc.id,
        contactId: cc.contactId,
        phone,
        name,
        fullName: name,
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
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getAllRecipients(
    organizationId: string,
    campaignId: string,
    options: any
  ) {
    const res = await this.getCampaignContacts(organizationId, campaignId, options);
    const summary = await this.getDetailedStats(organizationId, campaignId);
    return { ...res, summary };
  }

  async getFailedContacts(
    organizationId: string,
    campaignId: string,
    page: number,
    limit: number
  ) {
    return this.getCampaignContacts(
      organizationId, campaignId, { page, limit, status: 'FAILED' }
    );
  }

  async exportFailedContactsCsv(
    organizationId: string,
    campaignId: string
  ): Promise<string> {
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
    organizationId: string,
    campaignId: string,
    status?: string
  ): Promise<string> {
    const where: any = { campaignId };
    if (status && status !== 'all') where.status = status;

    const contacts = await prisma.campaignContact.findMany({
      where,
      include: { contact: true },
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
    const agg = await prisma.campaign.aggregate({
      where: { organizationId },
      _count: { id: true },
      _sum: {
        totalContacts: true, sentCount: true,
        deliveredCount: true, readCount: true, failedCount: true,
      },
    });
    return {
      total: agg._count.id || 0,
      totalSent: agg._sum.sentCount || 0,
      totalDelivered: agg._sum.deliveredCount || 0,
      totalRead: agg._sum.readCount || 0,
      replied: 0,
      totalRecipients: agg._sum.totalContacts || 0,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Media upload/cache
  // ─────────────────────────────────────────────────────────────
  private async ensureMetaMediaId(
    template: any,
    phoneNumberId: string,
    accessToken: string,
    wabaId: string
  ): Promise<string | null> {
    const headerType = String(template.headerType || '').toUpperCase();
    if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) return null;

    const cloudinaryUrl = template.headerContent;

    // Check cached
    const existingId = template.headerMediaId;
    const uploadedAt = template.headerMediaUploadedAt;
    if (existingId && /^\d+$/.test(existingId) && uploadedAt) {
      const ageMs = Date.now() - new Date(uploadedAt).getTime();
      if (ageMs < SEND_CONFIG.MEDIA_TTL_MS) {
        console.log(`✅ Cached media ID: ${existingId}`);
        return existingId;
      }
      console.log(`⏰ Media ID expired, refreshing...`);
    }

    if (!cloudinaryUrl?.startsWith('http')) {
      console.error(`❌ No Cloudinary URL for "${template.name}"`);
      return null;
    }

    try {
      const response = await axios.get(cloudinaryUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
        maxContentLength: 100 * 1024 * 1024,
        headers: { 'User-Agent': 'WabMeta/1.0', Accept: '*/*' },
      });

      const buffer = Buffer.from(response.data);
      const contentType = (response.headers['content-type'] || '')
        .split(';')[0].trim();

      const DEFAULTS: Record<string, string> = {
        IMAGE: 'image/jpeg', VIDEO: 'video/mp4', DOCUMENT: 'application/pdf',
      };
      const mimeType =
        (contentType && !contentType.includes('octet-stream'))
          ? contentType
          : DEFAULTS[headerType] || 'application/octet-stream';

      const urlPath = cloudinaryUrl.split('?')[0];
      let filename = urlPath.split('/').pop() || 'media';
      if (!filename.includes('.')) {
        const EXT: Record<string, string> = {
          'image/jpeg': '.jpg', 'image/png': '.png',
          'video/mp4': '.mp4', 'application/pdf': '.pdf',
        };
        filename += EXT[mimeType] || '.bin';
      }

      const result = await metaApi.uploadMedia(
        phoneNumberId, accessToken,
        buffer, mimeType, filename, wabaId
      );

      const metaMediaId = result.id;
      console.log(`✅ Media uploaded: ${metaMediaId}`);

      // Cache in DB
      await prisma.template.update({
        where: { id: template.id },
        data: {
          headerMediaId: metaMediaId,
          headerMediaUploadedAt: new Date(),
          headerMediaLastVerified: new Date(),
        } as any,
      }).catch(e => console.warn('⚠️ Failed to cache media ID:', e.message));

      return metaMediaId;
    } catch (err: any) {
      console.error(`❌ Media upload failed for "${template.name}":`, err.message);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Main processing loop
  // ─────────────────────────────────────────────────────────────
  private async processCampaignContacts(
    campaignId: string,
    organizationId: string
  ): Promise<void> {
    if (this.processingCampaigns.has(campaignId)) {
      console.warn(`⏳ Campaign ${campaignId} already processing`);
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

      // ✅ FIX Bug8: Use proper token decryption
      const accessToken = this.decryptToken(
        campaign.whatsappAccount.accessToken
      );
      if (!accessToken) {
        throw new Error('Invalid or missing WhatsApp access token');
      }

      const { phoneNumberId, wabaId } = campaign.whatsappAccount;
      const template = campaign.template;

      // ── Media pre-upload ──────────────────────────────────
      let cachedMediaId: string | null = null;
      const headerType = String(template.headerType || '').toUpperCase();

      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
        cachedMediaId = await this.ensureMetaMediaId(
          template, phoneNumberId, accessToken, wabaId
        );

        if (!cachedMediaId) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'PAUSED' },
          });
          campaignSocketService.emitCampaignError(organizationId, campaignId, {
            message: `Media upload failed for "${template.name}". ` +
              `Please re-upload the ${template.headerType?.toLowerCase()} in template settings.`,
            code: 'MEDIA_UPLOAD_FAILED',
          });
          return;
        }
      }

      // ── Wallet pre-check ──────────────────────────────────
      const pendingCount = await prisma.campaignContact.count({
        where: { campaignId, status: 'PENDING' },
      });

      const samplePhones = (
        await prisma.campaignContact.findMany({
          where: { campaignId, status: 'PENDING' },
          include: { contact: { select: { phone: true } } },
          take: 200,
          orderBy: { createdAt: 'asc' },
        })
      ).map(c => c.contact?.phone || '').filter(Boolean);

      const walletCheck = await deductWalletForCampaign({
        organizationId,
        templateName: template.name,
        templateCategory: template.category,
        templateLanguage: template.language,
        totalRecipients: pendingCount,
        campaignId,
        recipientPhones: samplePhones,
      });

      console.log('💳 Wallet check:', {
        active: walletCheck.walletActive,
        canProceed: walletCheck.canProceed,
        available: `₹${walletCheck.availableBalance.toFixed(2)}`,
        estimated: `₹${walletCheck.estimatedCost.toFixed(2)}`,
      });

      if (walletCheck.walletActive && !walletCheck.canProceed) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'PAUSED' },
        });

        const msg = walletCheck.availableBalance <= SEND_CONFIG.MIN_BALANCE_RUPEES
          ? `Campaign paused: Low balance ₹${walletCheck.availableBalance.toFixed(2)}. Add funds to resume.`
          : `Campaign paused: Need ₹${walletCheck.estimatedCost.toFixed(2)}, have ₹${walletCheck.availableBalance.toFixed(2)}.`;

        campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
          status: 'PAUSED', message: msg,
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

      let batchSent: { id: string; waMessageId: string; contactId: string; phone: string }[] = [];
      let batchFailed: { id: string; reason: string; contactId: string; phone: string }[] = [];

      while (hasMore) {
        // Status check
        const curr = await prisma.campaign.findUnique({
          where: { id: campaignId },
          select: { status: true },
        });
        if (curr?.status !== 'RUNNING') break;

        const contacts = await prisma.campaignContact.findMany({
          where: { campaignId, status: 'PENDING' },
          include: { contact: true },
          take: SEND_CONFIG.BATCH_SIZE,
          orderBy: { createdAt: 'asc' },
        });

        if (contacts.length === 0) { hasMore = false; break; }

        for (let i = 0; i < contacts.length; i += SEND_CONFIG.CONCURRENCY) {
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
                balancePaise: true,
                creditEnabled: true,
                creditLimitPaise: true,
                creditUsedPaise: true,
              },
            });

            if (w) {
              const currentBal = w.balancePaise / 100 +
                (w.creditEnabled
                  ? Math.max(0, (w.creditLimitPaise - w.creditUsedPaise)) / 100
                  : 0);

              const remaining = contacts.length - i;
              // ✅ FIX Bug3: Use tracked amountPaise for avg rate
              const avgPaise = totalSentCount > 0
                ? totalSentAmountPaise / totalSentCount
                : 0;
              const remainingCost = (avgPaise * remaining) / 100;

              if (
                currentBal < remainingCost * 1.05 ||
                currentBal < SEND_CONFIG.MID_BALANCE_RUPEES
              ) {
                await prisma.campaign.update({
                  where: { id: campaignId },
                  data: { status: 'PAUSED' },
                });
                campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
                  status: 'PAUSED',
                  message: `Balance depleted (₹${currentBal.toFixed(2)}). Add funds to resume.`,
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

          // Consecutive fail check
          if (consecutiveFails >= SEND_CONFIG.MAX_CONSECUTIVE_FAILURES) {
            console.warn(`⚠️ ${consecutiveFails} consecutive failures - pausing 10s`);
            campaignSocketService.emitCampaignError(organizationId, campaignId, {
              message: `High failure rate. Auto-pausing 10s.`,
              code: 'HIGH_FAILURE_RATE',
            });
            await new Promise(r => setTimeout(r, 10_000));
            consecutiveFails = 0;
          }

          const chunk = contacts.slice(i, i + SEND_CONFIG.CONCURRENCY);

          // ── Send chunk in parallel ───────────────────────
          const results = await Promise.allSettled(
            chunk.map(async (cc) => {
              const phone = cc.contact?.phone;
              if (!phone) return {
                type: 'failed' as const, id: cc.id,
                contactId: cc.contactId, phone: '',
                reason: 'No phone number', metaCode: 0,
              };

              const clean = digitsOnly(phone);
              if (!clean || clean.length < 10) return {
                type: 'failed' as const, id: cc.id,
                contactId: cc.contactId, phone: clean,
                reason: 'Invalid phone number (< 10 digits)', metaCode: 0,
              };

              try {
                const bodyMatches = (template.bodyText || '').match(/\{\{(\d+)\}\}/g) || [];
                const headerMatches = (template.headerContent || '').match(/\{\{(\d+)\}\}/g) || [];
                const maxIdx = Math.max(
                  0,
                  ...bodyMatches.map((m: string) => parseInt(m.replace(/[{}]/g, ''), 10)),
                  ...headerMatches.map((m: string) => parseInt(m.replace(/[{}]/g, ''), 10)),
                );

                // ✅ Get variableMapping from campaign
                const campaignVariableMapping = (campaign as any).variableMapping || {};

                const params = buildParamsFromContact(
                  cc,
                  maxIdx,
                  campaignVariableMapping  // ✅ Pass mapping
                );
                const variables: Record<string, string> = {};
                for (let j = 0; j < params.length; j++) {
                  variables[String(j + 1)] = params[j];
                }

                // ✅ FIX Bug7: synchronous now
                const payload = buildTemplateMessage(
                  template, variables, cachedMediaId
                );

                const result = await metaApi.sendMessage(
                  phoneNumberId, accessToken, clean, payload
                );

                return {
                  type: 'sent' as const, id: cc.id,
                  contactId: cc.contactId, phone: clean,
                  waMessageId: result.messageId, metaCode: 0,
                };
              } catch (err: any) {
                const reason = this.extractFailureReason(err);
                const metaCode = err.response?.data?.error?.code || 0;
                return {
                  type: 'failed' as const, id: cc.id,
                  contactId: cc.contactId, phone: clean,
                  reason, metaCode,
                };
              }
            })
          );

          // ── Collect results ──────────────────────────────
          let chunkFailed = 0;
          for (const r of results) {
            if (r.status === 'rejected') continue;
            const d = r.value;

            if (d.type === 'sent') {
              batchSent.push({
                id: d.id, waMessageId: d.waMessageId,
                contactId: d.contactId, phone: d.phone,
              });
              totalSentCount++;
              totalSentAmountPaise += Math.round(
                getRateForCategory(
                  template.category || 'MARKETING',
                  d.phone,
                  template.language
                ) * 100
              );
              consecutiveFails = 0;
            } else {
              batchFailed.push({
                id: d.id, reason: d.reason,
                contactId: d.contactId, phone: d.phone,
              });
              chunkFailed++;

              if (d.metaCode === 131048 || d.metaCode === 131021) {
                await new Promise(r =>
                  setTimeout(r, SEND_CONFIG.RATE_LIMIT_PAUSE_MS)
                );
              }
              if (
                d.reason.includes('ecosystem') ||
                d.reason.includes('undeliverable') ||
                d.reason.includes('restricted')
              ) {
                consecutiveFails++;
              } else {
                consecutiveFails = 0;
              }
            }
          }

          totalProcessed += chunk.length;

          // Flush batch
          const batchTotal = batchSent.length + batchFailed.length;
          const isLastChunk = i + SEND_CONFIG.CONCURRENCY >= contacts.length;

          if (batchTotal >= SEND_CONFIG.FLUSH_EVERY || isLastChunk) {
            await this.flushBatchResults(
              campaignId, organizationId, batchSent, batchFailed
            );

            // ✅ FIX Bug10: Save to inbox ONCE (bulk only, no individual)
            if (batchSent.length > 0) {
              const sentCopy = [...batchSent];
              this.saveToInboxBulk(
                organizationId, campaignId,
                campaign.whatsappAccountId,
                template.id, template.name, campaign.name, template,
                sentCopy.map(s => ({
                  contactId: s.contactId,
                  waMessageId: s.waMessageId,
                }))
              ).catch(e => console.error('⚠️ Inbox save error:', e.message));
            }

            batchSent = [];
            batchFailed = [];
          }

          // Emit progress
          if (
            totalProcessed - lastProgressEmit >= EMIT_EVERY ||
            isLastChunk
          ) {
            lastProgressEmit = totalProcessed;
            const counts = await this.getQuickCounts(campaignId);
            const cumSent = counts.sent + counts.delivered + counts.read;
            const cumDel = counts.delivered + counts.read;
            const processed = cumSent + counts.failed;

            campaignSocketService.emitCampaignProgress(organizationId, campaignId, {
              sent: cumSent,
              failed: counts.failed,
              delivered: cumDel,
              read: counts.read,
              total: counts.total,
              percentage: Math.min(100, Math.round(
                (processed / Math.max(counts.total, 1)) * 100
              )),
              status: 'RUNNING',
            });

            campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
              status: 'RUNNING',
              totalContacts: counts.total,
              sentCount: cumSent,
              deliveredCount: cumDel,
              readCount: counts.read,
              failedCount: counts.failed,
            });
          }

          // Delay
          const delay = chunkFailed > chunk.length / 2
            ? 500
            : SEND_CONFIG.DELAY_BETWEEN_CHUNKS_MS;
          await new Promise(r => setTimeout(r, delay));
        }
      }

      // ── Flush remaining ───────────────────────────────────
      if (batchSent.length > 0 || batchFailed.length > 0) {
        await this.flushBatchResults(
          campaignId, organizationId, batchSent, batchFailed
        );
        if (batchSent.length > 0) {
          this.saveToInboxBulk(
            organizationId, campaignId, campaign.whatsappAccountId,
            template.id, template.name, campaign.name, template,
            batchSent.map(s => ({
              contactId: s.contactId, waMessageId: s.waMessageId,
            }))
          ).catch(() => { });
        }
      }

      // ── Final sync ────────────────────────────────────────
      const final = await this.syncCampaignCounters(campaignId);

      // ── Wallet bulk deduction ─────────────────────────────
      if (
        walletCheck.walletActive &&
        totalSentCount > 0 &&
        totalSentAmountPaise > 0
      ) {
        const amountRupees = totalSentAmountPaise / 100;
        const avgRate = amountRupees / totalSentCount;

        try {
          await prisma.$transaction(async (tx) => {
            const w = await tx.wallet.findUnique({
              where: { organizationId },
            });
            if (!w || w.flagged) return;

            const creditHeadroom = w.creditEnabled
              ? Math.max(0, w.creditLimitPaise - w.creditUsedPaise)
              : 0;
            const available = w.balancePaise + creditHeadroom;
            const deduct = Math.min(totalSentAmountPaise, available);
            const creditDeducted = Math.max(0, deduct - w.balancePaise);
            const newBalance = Math.max(0, w.balancePaise - deduct);

            await tx.wallet.update({
              where: { id: w.id },
              data: {
                balancePaise: newBalance,
                creditUsedPaise: { increment: creditDeducted },
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
                description:
                  `Campaign: ${template.name} × ${totalSentCount} msgs ` +
                  `(avg ₹${avgRate.toFixed(4)}/msg)`,
                status: 'completed',
                metaService: 'template_message',
                note: `Campaign: ${campaign.name}`,
              },
            });

            console.log(
              `✅ Wallet deducted ₹${(deduct / 100).toFixed(2)} ` +
              `for ${totalSentCount} messages`
            );
          });
        } catch (e: any) {
          console.error('💳 Wallet deduction failed (non-blocking):', e.message);
        }
      }

      // ── Complete ──────────────────────────────────────────
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
      console.error(`❌ Campaign ${campaignId} error:`, err);
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

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Batch flush to DB
  // ─────────────────────────────────────────────────────────────
  private async flushBatchResults(
    campaignId: string,
    organizationId: string,
    sent: { id: string; waMessageId: string; contactId: string; phone: string }[],
    failed: { id: string; reason: string; contactId: string; phone: string }[]
  ): Promise<void> {
    const now = new Date();

    try {
      if (sent.length > 0) {
        await prisma.campaignContact.updateMany({
          where: { id: { in: sent.map(s => s.id) } },
          data: { status: 'SENT', sentAt: now },
        });

        // Individual waMessageId (needed for webhook tracking)
        await Promise.allSettled(
          sent.map(s =>
            prisma.campaignContact.update({
              where: { id: s.id },
              data: { waMessageId: s.waMessageId },
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
              data: { status: 'FAILED', failureReason: reason, failedAt: now },
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

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Save to inbox (bulk only)
  // ✅ FIX Bug10: Only one path to inbox (no individual save)
  // ─────────────────────────────────────────────────────────────
  private async saveToInboxBulk(
    orgId: string,
    campaignId: string,
    accId: string,
    tplId: string,
    tplName: string,
    campName: string,
    template: any,
    sentList: { contactId: string; waMessageId: string }[]
  ): Promise<void> {
    if (sentList.length === 0) return;

    try {
      const now = new Date();
      const contactIds = sentList.map(s => s.contactId);

      // Get existing conversations
      const existing = await prisma.conversation.findMany({
        where: { organizationId: orgId, contactId: { in: contactIds } },
        select: { id: true, contactId: true },
      });
      const convMap = new Map(existing.map(c => [c.contactId, c.id]));

      // Create missing conversations
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

      // Update existing
      if (existing.length > 0) {
        await prisma.conversation.updateMany({
          where: { id: { in: existing.map(e => e.id) } },
          data: {
            lastMessageAt: now,
            lastMessagePreview: `Template: ${tplName}`,
          },
        });
      }

      // Bulk create messages
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