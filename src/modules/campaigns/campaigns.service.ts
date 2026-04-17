// 📁 src/modules/campaigns/campaigns.service.ts - FINAL PRODUCTION VERSION

import { PrismaClient, CampaignStatus, MessageStatus, Prisma } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { metaService } from '../meta/meta.service';
import { metaApi } from '../meta/meta.api';
import { campaignSocketService } from './campaigns.socket';
import { v4 as uuidv4 } from 'uuid';
import { safeDecrypt } from '../../utils/encryption';
import { inboxService } from '../inbox/inbox.service';
import prisma from '../../config/database';

// ============================================
// HELPER FUNCTIONS
// ============================================

const digitsOnly = (p: string): string => String(p || '').replace(/\D/g, '');

const toMetaLang = (lang?: string): string => {
  const l = String(lang || '').trim();
  if (!l) return 'en_US';
  if (l.length >= 2 && l.length <= 6 && !l.includes(' ')) return l;
  const mapping: Record<string, string> = {
    english: 'en_US', hindi: 'hi', spanish: 'es_ES',
    portuguese: 'pt_BR', french: 'fr_FR', german: 'de_DE', italian: 'it_IT',
  };
  return mapping[l.toLowerCase()] || l;
};

const buildParamsFromContact = (campaignContact: any, varCount: number): string[] => {
  const cd = campaignContact?.customData || {};
  const cnt = campaignContact?.contact || campaignContact?.Contact || campaignContact || {};
  const fallback = [cnt?.firstName || '', cnt?.lastName || '', cnt?.phone || '', cnt?.email || ''].filter(Boolean);
  const params: string[] = [];
  for (let i = 0; i < varCount; i++) {
    params.push(cd[String(i + 1)] || fallback[i] || 'NA');
  }
  return params;
};

const calculateRates = (campaign: any): { deliveryRate: number; readRate: number } => {
  const deliveryRate = campaign.sentCount > 0 ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100) : 0;
  const readRate = campaign.deliveredCount > 0 ? Math.round((campaign.readCount / campaign.deliveredCount) * 100) : 0;
  return { deliveryRate, readRate };
};

const formatCampaign = (campaign: any): any => {
  const { deliveryRate, readRate } = calculateRates(campaign);
  const pendingCount = Math.max(0, (campaign.totalContacts || 0) - (campaign.sentCount || 0) - (campaign.failedCount || 0));
  const c = campaign as any;
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    templateId: c.templateId,
    templateName: c.template?.name || c.Template?.name || '',
    whatsappAccountId: c.whatsappAccountId,
    whatsappAccountPhone: c.whatsappAccount?.phoneNumber || c.WhatsAppAccount?.phoneNumber || '',
    contactGroupId: c.contactGroupId,
    contactGroupName: c.contactGroup?.name || c.ContactGroup?.name || null,
    status: c.status,
    scheduledAt: c.scheduledAt,
    startedAt: c.startedAt,
    completedAt: c.completedAt,
    totalContacts: c.totalContacts || 0,
    sentCount: c.sentCount || 0,
    deliveredCount: c.deliveredCount || 0,
    readCount: c.readCount || 0,
    failedCount: c.failedCount || 0,
    pendingCount,
    deliveryRate,
    readRate,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
};

const formatCampaignContact = (cc: any): any => ({
  id: cc.id,
  contactId: cc.contactId,
  phone: cc.contact?.phone || '',
  fullName: [cc.contact?.firstName, cc.contact?.lastName].filter(Boolean).join(' ') || cc.contact?.phone || '',
  status: cc.status,
  waMessageId: cc.waMessageId || null,
  sentAt: cc.sentAt || null,
  deliveredAt: cc.deliveredAt || null,
  readAt: cc.readAt || null,
  failedAt: cc.failedAt || null,
  failureReason: cc.failureReason || null,
  retryCount: cc.retryCount || 0,
  updatedAt: cc.updatedAt
});

const toJsonValue = (value: any): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value));
};

// ============================================
// CAMPAIGNS SERVICE CLASS
// ============================================

export class CampaignsService {
  private processingCampaigns = new Set<string>();


  // ✅ LIGHT: Only count, don't update campaign record every time
  private async getQuickCounts(campaignId: string): Promise<{
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    pending: number;
  }> {
    const counts = await prisma.campaignContact.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });

    const get = (s: string) => counts.find(c => c.status === s)?._count || 0;

    return {
      total: counts.reduce((sum, c) => sum + c._count, 0),
      sent: get('SENT'),
      delivered: get('DELIVERED'),
      read: get('READ'),
      failed: get('FAILED'),
      pending: get('PENDING') + get('QUEUED'),
    };
  }

  // ✅ HEAVY: Full sync - only called at start, end, and on retry
  private async syncCampaignCounters(campaignId: string): Promise<{
    totalContacts: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    pendingCount: number;
  }> {
    const counts = await this.getQuickCounts(campaignId);

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        totalContacts: counts.total,
        sentCount: counts.sent + counts.delivered + counts.read,
        deliveredCount: counts.delivered + counts.read,
        readCount: counts.read,
        failedCount: counts.failed,
      },
    });

    return {
      totalContacts: counts.total,
      sentCount: counts.sent,
      deliveredCount: counts.delivered,
      readCount: counts.read,
      failedCount: counts.failed,
      pendingCount: counts.pending,
    };
  }

  private async findWhatsAppAccount(organizationId: string, whatsappAccountId?: string, phoneNumberId?: string): Promise<any> {
    console.log('🔍 Finding WhatsApp account:', { organizationId, whatsappAccountId, phoneNumberId });

    let waAccount = null;

    // Strategy 1: Find by whatsappAccountId
    if (whatsappAccountId) {
      waAccount = await prisma.whatsAppAccount.findFirst({ where: { id: whatsappAccountId, organizationId } });
      if (waAccount) return waAccount;
    }

    // Strategy 2: Find by phoneNumberId
    if (phoneNumberId) {
      waAccount = await prisma.whatsAppAccount.findFirst({ where: { phoneNumberId, organizationId } });
      if (waAccount) return waAccount;
    }

    // Strategy 3: Get default CONNECTED account
    waAccount = await prisma.whatsAppAccount.findFirst({
      where: { organizationId, status: 'CONNECTED' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    if (waAccount) return waAccount;

    // Strategy 4: ANY account (last resort)
    waAccount = await prisma.whatsAppAccount.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return waAccount;
  }

  async create(organizationId: string, userId: string, input: any): Promise<any> {
    const { name, description, templateId, whatsappAccountId, phoneNumberId, contactGroupId, contactIds, csvContacts, variableMapping, audienceFilter, scheduledAt } = input;
    
    // Validate template
    const template = await prisma.template.findFirst({ where: { id: templateId, organizationId } });
    if (!template) throw new AppError('Template not found', 404);
    if (template.status !== 'APPROVED') throw new AppError(`Template not approved (status: ${template.status})`, 400);

    // Find account
    const waAccount = await this.findWhatsAppAccount(organizationId, whatsappAccountId, phoneNumberId);
    if (!waAccount) throw new AppError('No WhatsApp account found. Please connect WhatsApp in Settings.', 400);

    // Build contacts
    let targetContacts: any[] = [];
    if (csvContacts && csvContacts.length > 0) {
      const phones = csvContacts.map((c: any) => digitsOnly(c.phone)).filter(Boolean);
      await prisma.contact.createMany({ data: phones.map((phone: string) => ({ organizationId, phone, status: 'ACTIVE' })), skipDuplicates: true });
      const dbContacts = await prisma.contact.findMany({ where: { organizationId, phone: { in: phones } } });
      const contactMap = new Map(dbContacts.map(c => [c.phone, c]));
      targetContacts = csvContacts.map((c: any) => {
        const dbC = contactMap.get(digitsOnly(c.phone));
        return dbC ? { ...dbC, customData: c.customData } : null;
      }).filter(Boolean);
    } else if (contactIds && contactIds.length > 0) {
      targetContacts = await prisma.contact.findMany({ where: { id: { in: contactIds }, organizationId, status: 'ACTIVE' } });
    } else if (contactGroupId) {
      const groupMembers = await prisma.contactGroupMember.findMany({ where: { groupId: contactGroupId, contact: { organizationId, status: 'ACTIVE' } }, include: { contact: true } });
      targetContacts = groupMembers.map(m => m.contact);
    } else if (audienceFilter) {
      const where: Prisma.ContactWhereInput = { organizationId, status: 'ACTIVE' };
      if (audienceFilter.all === true) { /* no-op */ }
      else if (audienceFilter.tags && audienceFilter.tags.length > 0) {
        where.tags = { hasSome: audienceFilter.tags };
      } else {
        if (audienceFilter.createdAfter) where.createdAt = { gte: new Date(audienceFilter.createdAfter) };
        if (audienceFilter.createdBefore) where.createdAt = { ...(where.createdAt as any), lte: new Date(audienceFilter.createdBefore) };
        if (audienceFilter.hasMessaged !== undefined) where.messageCount = audienceFilter.hasMessaged ? { gt: 0 } : { equals: 0 };
      }
      targetContacts = await prisma.contact.findMany({ where });
    }

    if (targetContacts.length === 0) throw new AppError('No contacts found for selected audience.', 400);

    const campaign = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.campaign.create({
        data: {
          organizationId, name, description, templateId, whatsappAccountId: waAccount.id,
          contactGroupId, audienceFilter: toJsonValue(audienceFilter),
          status: (scheduledAt ? 'SCHEDULED' : 'DRAFT') as CampaignStatus,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          totalContacts: targetContacts.length, createdById: userId,
        } as any,
        include: { template: true, whatsappAccount: true, contactGroup: true }
      });

      await tx.campaignContact.createMany({
        data: targetContacts.map(c => ({
          id: uuidv4(), campaignId: newCampaign.id, contactId: c.id,
          customData: c.customData || {}, status: 'PENDING',
        }))
      });
      return newCampaign;
    }, { timeout: 30000 });

    campaignSocketService.emitCampaignUpdate(organizationId, campaign.id, { 
       status: campaign.status, message: 'Campaign created successfully', totalContacts: targetContacts.length 
    });
    return formatCampaign(campaign);
  }

  async getList(organizationId: string, query: any): Promise<any> {
    const { page = 1, limit = 20, search, status } = query;
    const where: any = { organizationId };
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }];
    if (status) where.status = status;
    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { template: true, whatsappAccount: true } }),
      prisma.campaign.count({ where })
    ]);
    return { campaigns: campaigns.map(formatCampaign), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getById(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, organizationId }, include: { template: true, whatsappAccount: true, contactGroup: true } });
    if (!campaign) throw new AppError('Campaign not found', 404);
    return formatCampaign(campaign);
  }

  async update(organizationId: string, campaignId: string, input: any): Promise<any> {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, organizationId } });
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (['RUNNING', 'COMPLETED'].includes(campaign.status)) throw new AppError('Cannot update running campaign', 400);

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        name: input.name, description: input.description, templateId: input.templateId,
        contactGroupId: input.contactGroupId, audienceFilter: toJsonValue(input.audienceFilter),
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        status: input.scheduledAt ? 'SCHEDULED' : undefined
      },
      include: { template: true, whatsappAccount: true }
    });
    return formatCampaign(updated);
  }

  async delete(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, organizationId } });
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (campaign.status === 'RUNNING') throw new AppError('Cannot delete running campaign', 400);
    await prisma.campaign.delete({ where: { id: campaignId } });
    return { message: 'Campaign deleted successfully' };
  }

  async duplicate(organizationId: string, campaignId: string, newName: string): Promise<any> {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { campaignContacts: true } });
    if (!campaign) throw new AppError('Campaign not found', 404);

    const duplicated = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.campaign.create({
        data: {
          organizationId, name: newName, description: campaign.description,
          templateId: campaign.templateId, whatsappAccountId: campaign.whatsappAccountId,
          contactGroupId: campaign.contactGroupId, audienceFilter: campaign.audienceFilter || Prisma.JsonNull,
          status: 'DRAFT', totalContacts: campaign.totalContacts, createdById: (campaign as any).createdById
        } as any
      });
      await tx.campaignContact.createMany({
        data: (campaign as any).campaignContacts.map((cc: any) => ({
          id: uuidv4(), campaignId: newCampaign.id, contactId: cc.contactId,
          customData: cc.customData || {}, status: 'PENDING'
        }))
      });
      return newCampaign;
    }, { timeout: 30000 });
    return formatCampaign(duplicated);
  }

  async start(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { template: true, whatsappAccount: true },
    });

    if (!campaign) throw new AppError('Campaign not found', 404);
    if (campaign.status === 'RUNNING') throw new AppError('Already running', 400);

    // ✅ EXISTING: Template approval check
    if (campaign.template) {
      const tpl = campaign.template as any;
      if (tpl.status === 'REJECTED') {
        throw new AppError(`Template "${tpl.name}" is REJECTED by Meta.`, 400);
      }
      if (tpl.status !== 'APPROVED') {
        throw new AppError(`Template "${tpl.name}" is not approved (status: ${tpl.status}).`, 400);
      }

      // ✅ Media handle check (prevent campaign start with expired/missing media)
      const headerType = (tpl.headerType || '').toUpperCase();
      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
        const mediaId = tpl.headerMediaId;
        const permanentUrl = tpl.headerContent;

        // ⚠️ NOTE: '4:...' resumable handles are ONLY valid for template creation,
        //       NOT for message sending. Must have numeric ID or permanent URL.
        const hasNumericId = mediaId && /^\d+$/.test(mediaId);               // e.g. "1234567890"
        const hasPermanentUrl =
          permanentUrl &&
          permanentUrl.startsWith('http') &&
          !permanentUrl.includes('scontent.whatsapp');                        // Cloudinary URL
        const hasUrlInMediaId =
          mediaId &&
          mediaId.startsWith('http') &&
          !mediaId.includes('scontent.whatsapp');                             // HTTP URL in mediaId

        const hasAnyValidMedia =
          hasNumericId ||     // Numeric ID
          hasPermanentUrl ||  // Cloudinary URL
          hasUrlInMediaId;    // URL in mediaId

        if (!hasAnyValidMedia) {
          throw new AppError(
            `Template "${tpl.name}" has missing media. ` +
            `Please edit the template and re-upload the ${(tpl.headerType || 'media').toLowerCase()}.`,
            400
          );
        }
      }
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING', startedAt: campaign.startedAt || new Date() },
      include: { template: true, whatsappAccount: true }
    });

    this.processCampaignContacts(campaignId, organizationId).catch(err => console.error('Campaign error:', err));
    return formatCampaign(updated);
  }

  async pause(organizationId: string, campaignId: string): Promise<any> {
    const updated = await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, { status: 'PAUSED', message: 'Campaign paused' });
    return formatCampaign(updated);
  }

  async resume(organizationId: string, campaignId: string): Promise<any> {
    const updated = await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'RUNNING' } });
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, { status: 'RUNNING', message: 'Campaign resumed' });
    this.processCampaignContacts(campaignId, organizationId).catch(() => {});
    return formatCampaign(updated);
  }

  async cancel(organizationId: string, campaignId: string): Promise<any> {
    const updated = await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'FAILED', completedAt: new Date() } });
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, { status: 'FAILED', message: 'Campaign cancelled' });
    return formatCampaign(updated);
  }

  // ✅ FIXED: Unified retry - sync counters after reset
  async retry(
    organizationId: string,
    campaignId: string,
    options: any = {}
  ): Promise<any> {
    const { retryFailed = true, retryPending = false, contactIds } = 
      typeof options === 'object' ? options : { retryFailed: !!options };

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

    const result = await prisma.campaignContact.updateMany({
      where,
      data: {
        status: 'PENDING',
        retryCount: { increment: 1 },
        failedAt: null,
        failureReason: null,
      },
    });

    if (result.count === 0) throw new AppError('No contacts to retry', 400);

    // ✅ Sync counters AFTER reset (fixes the 115% bug)
    await this.syncCampaignCounters(campaignId);

    // Update status
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
    });

    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'RUNNING',
      message: `Retrying ${result.count} contacts`,
    });

    this.processCampaignContacts(campaignId, organizationId).catch(() => {});

    return { message: `Retrying ${result.count} contacts`, retryCount: result.count };
  }

  // ✅ Remove duplicate methods - keep only these
  async retryFailed(org: string, id: string, contactIds?: string[]) {
    return this.retry(org, id, { retryFailed: true, contactIds });
  }

  async retryFailedContacts(org: string, id: string, contactIds?: string[]) {
    return this.retry(org, id, { retryFailed: true, contactIds });
  }

  async resumePending(org: string, id: string) {
    return this.resume(org, id);
  }

  async getAnalytics(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);
    
    // For now returning basic stats, can be expanded for timeline logic
    const stats = await this.getDetailedStats(organizationId, campaignId);
    return { 
      ...formatCampaign(campaign), 
      ...stats,
      timeline: [] 
    }; 
  }

  async getCampaignContacts(
    organizationId: string,
    campaignId: string,
    options: { page?: number; limit?: number; status?: string; search?: string }
  ) {
    const { page = 1, limit = 50, status, search } = options;
    const skip = (page - 1) * limit;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) throw new AppError('Campaign not found', 404);

    const where: any = { campaignId };

    // ✅ Filter by status (if not 'all')
    if (status && status !== 'all') {
      where.status = status;
    }

    // ✅ Search by phone or name
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
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
              email: true,
              whatsappProfileName: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.campaignContact.count({ where }),
    ]);

    // ✅ Format with clean phone and proper name
    const formatted = contacts.map((cc) => {
      const c = cc.contact;
      const phone = (c.phone || '').replace(/^\+/, ''); // Remove "+" prefix

      // ✅ Build name: whatsappProfile > firstName lastName > phone
      let name = '';
      if (c.whatsappProfileName && c.whatsappProfileName !== 'Unknown') {
        name = c.whatsappProfileName;
      } else {
        const parts = [c.firstName, c.lastName].filter(Boolean).join(' ');
        name = parts || phone;
      }

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
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAllRecipients(organizationId: string, campaignId: string, options: any): Promise<any> {
    const res = await this.getCampaignContacts(organizationId, campaignId, options);
    const summary = await this.getDetailedStats(organizationId, campaignId);
    return { ...res, summary };
  }

  async getFailedContacts(organizationId: string, campaignId: string, page: number, limit: number): Promise<any> {
    return this.getCampaignContacts(organizationId, campaignId, { page, limit, status: 'FAILED' });
  }

  async exportFailedContactsCsv(organizationId: string, campaignId: string): Promise<string> {
    const contacts = await prisma.campaignContact.findMany({ 
      where: { campaignId, status: 'FAILED' }, 
      include: { contact: true } 
    });
    let csv = 'Phone,Name,Error,Date\n';
    contacts.forEach((cc: any) => {
      const name = [cc.contact?.firstName, cc.contact?.lastName].filter(Boolean).join(' ') || 'Unknown';
      csv += `"${cc.contact?.phone}","${name}","${cc.failureReason || ''}","${cc.failedAt?.toISOString() || ''}"\n`;
    });
    return csv;
  }

  async exportRecipientsCsv(organizationId: string, campaignId: string, status?: string): Promise<string> {
    const where: any = { campaignId };
    if (status && status !== 'all') where.status = status;
    const contacts = await prisma.campaignContact.findMany({ 
      where, 
      include: { contact: true } 
    });
    let csv = 'Phone,Name,Status,Date\n';
    contacts.forEach((cc: any) => {
      const name = [cc.contact?.firstName, cc.contact?.lastName].filter(Boolean).join(' ') || 'Unknown';
      csv += `"${cc.contact?.phone}","${name}","${cc.status}","${cc.updatedAt?.toISOString() || ''}"\n`;
    });
    return csv;
  }
  async getDetailedStats(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) throw new AppError('Campaign not found', 404);

    // ✅ Count from actual campaignContact records (source of truth)
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
    const totalContacts = pending + queued + sent + delivered + read + failed;

    // Failure reasons
    const failureReasons = await prisma.campaignContact.groupBy({
      by: ['failureReason'],
      where: { campaignId, status: 'FAILED', failureReason: { not: null } },
      _count: true,
      orderBy: { _count: { failureReason: 'desc' } },
    });

    // ✅ Also count contacts with FAILED status but NULL failureReason
    const nullReasonCount = await prisma.campaignContact.count({
      where: { campaignId, status: 'FAILED', failureReason: null },
    });

    const reasons = failureReasons.map((fr) => ({
      reason: fr.failureReason || 'Unknown error',
      count: fr._count,
    }));

    // ✅ Add null-reason failures so totals match
    if (nullReasonCount > 0) {
      reasons.push({ reason: 'Unknown error', count: nullReasonCount });
    }

    const successCount = delivered + read;
    const processedCount = sent + delivered + read + failed;

    return {
      totalContacts,
      pending,
      queued,
      sent,
      delivered,
      read,
      failed,
      failureReasons: reasons,
      successRate: totalContacts > 0
        ? Math.round((successCount / totalContacts) * 100)
        : 0,
      deliveryRate: processedCount > 0
        ? Math.round((successCount / processedCount) * 100)
        : 0,
      readRate: (delivered + read) > 0
        ? Math.round((read / (delivered + read)) * 100)
        : 0,
    };
  }

  // ✅ HIGH PERFORMANCE: Process campaign contacts
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

      // ✅ Sync counters ONLY at start
      await this.syncCampaignCounters(campaignId);

      const accessToken = this.getDecryptedToken(campaign.whatsappAccount.accessToken);
      if (!accessToken || !accessToken.startsWith('EAA')) {
        throw new Error('Invalid access token');
      }

      const phoneNumberId = campaign.whatsappAccount.phoneNumberId;
      const template = campaign.template;

      // ============================================
      // ✅ SPEED CONFIG - TUNED FOR MAXIMUM THROUGHPUT
      // ============================================
      const BATCH_SIZE = 1000;              // Fetch more contacts per batch
      const CONCURRENCY = 30;               // Send 30 parallel requests
      const FLUSH_EVERY = 100;              // DB write every 100 messages
      const EMIT_PROGRESS_EVERY = 50;       // Socket update every 50 messages
      const DELAY_BETWEEN_CHUNKS_MS = 30;   // Very small delay
      const MAX_CONSECUTIVE_FAILURES = 30;
      const RATE_LIMIT_PAUSE_MS = 3000;

      let hasMore = true;
      let totalProcessed = 0;
      let consecutiveFailures = 0;
      let rateLimitHits = 0;

      // ✅ In-memory batch buffers
      let batchSent: { id: string; waMessageId: string; contactId: string; phone: string }[] = [];
      let batchFailed: { id: string; reason: string; contactId: string; phone: string }[] = [];
      let lastProgressEmit = 0;

      while (hasMore) {
        // Check campaign status
        const current = await prisma.campaign.findUnique({
          where: { id: campaignId },
          select: { status: true },
        });
        if (current?.status !== 'RUNNING') break;

        // Fetch pending contacts
        const contacts = await prisma.campaignContact.findMany({
          where: { campaignId, status: 'PENDING' },
          include: { contact: true },
          take: BATCH_SIZE,
          orderBy: { createdAt: 'asc' },
        });

        if (contacts.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`📦 Processing ${contacts.length} contacts`);

        // ============================================
        // ✅ FAST PROCESSING LOOP
        // ============================================
        for (let i = 0; i < contacts.length; i += CONCURRENCY) {
          // Check status every 300 messages
          if (totalProcessed > 0 && totalProcessed % 300 === 0) {
            const check = await prisma.campaign.findUnique({
              where: { id: campaignId },
              select: { status: true },
            });
            if (check?.status !== 'RUNNING') break;
          }

          // ✅ Auto-pause on high failure rate
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.warn(`⚠️ ${consecutiveFailures} consecutive failures`);
            campaignSocketService.emitCampaignError(organizationId, campaignId, {
              message: `High failure rate (${consecutiveFailures} consecutive). Auto-pausing 10s.`,
              code: 'HIGH_FAILURE_RATE',
            });
            await new Promise(r => setTimeout(r, 10000));
            consecutiveFailures = 0;
          }

          const chunk = contacts.slice(i, i + CONCURRENCY);

          // ✅ SEND ALL IN PARALLEL
          const results = await Promise.allSettled(
            chunk.map(async (cc) => {
              const phone = cc.contact?.phone;
              if (!phone) {
                return { type: 'failed' as const, id: cc.id, contactId: cc.contactId, phone: '', reason: 'No phone number', metaCode: 0 };
              }

              const cleanPhone = digitsOnly(phone);
              if (!cleanPhone || cleanPhone.length < 10) {
                return { type: 'failed' as const, id: cc.id, contactId: cc.contactId, phone: cleanPhone, reason: 'Invalid phone number', metaCode: 0 };
              }

              try {
                const payload = await this.buildTemplatePayload(
                  template,
                  cc,
                  cleanPhone,
                  phoneNumberId,
                  accessToken,
                  campaign.whatsappAccount.wabaId
                );
                const result = await metaApi.sendMessage(phoneNumberId, accessToken, cleanPhone, payload);
                return { type: 'sent' as const, id: cc.id, contactId: cc.contactId, phone: cleanPhone, waMessageId: result.messageId, metaCode: 0 };
              } catch (err: any) {
                const reason = this.extractFailureReason(err);
                const metaCode = err.response?.data?.error?.code || 0;
                return { type: 'failed' as const, id: cc.id, contactId: cc.contactId, phone: cleanPhone, reason, metaCode };
              }
            })
          );

          // ✅ COLLECT RESULTS (no DB writes here!)
          let chunkFailed = 0;

          for (const result of results) {
            if (result.status === 'rejected') continue;
            const data = result.value;

            if (data.type === 'sent') {
              batchSent.push({ id: data.id, waMessageId: data.waMessageId, contactId: data.contactId, phone: data.phone });
              consecutiveFailures = 0;
            } else {
              batchFailed.push({ id: data.id, reason: data.reason, contactId: data.contactId, phone: data.phone });
              chunkFailed++;

              // Handle rate limits
              if (data.metaCode === 131048 || data.metaCode === 131021) {
                rateLimitHits++;
                await new Promise(r => setTimeout(r, RATE_LIMIT_PAUSE_MS));
              }

              if (data.reason.includes('ecosystem') || data.reason.includes('undeliverable')) {
                consecutiveFailures++;
              } else {
                consecutiveFailures = 0;
              }
            }
          }

          totalProcessed += chunk.length;

          // ✅ FLUSH TO DB every N messages
          const batchTotal = batchSent.length + batchFailed.length;
          if (batchTotal >= FLUSH_EVERY || i + CONCURRENCY >= contacts.length) {
            await this.flushBatchResults(campaignId, organizationId, batchSent, batchFailed);

            // ✅ SAVE TO INBOX (sequential background tasks to avoid pool exhaustion)
            const sentCopy = [...batchSent];
            setImmediate(async () => {
              for (const s of sentCopy) {
                try {
                  await this.saveCampaignMessage(
                    organizationId, campaignId, s.contactId,
                    campaign.whatsappAccountId, s.waMessageId,
                    template.name, template.language, [], template.id, campaign.name
                  );
                } catch (err) {
                  // Silent catch for background task
                }
              }
            });

            batchSent = [];
            batchFailed = [];
          }

          // ✅ EMIT PROGRESS (lightweight, no DB query)
          if (totalProcessed - lastProgressEmit >= EMIT_PROGRESS_EVERY) {
            lastProgressEmit = totalProcessed;

            // ✅ LIGHT: Quick count from DB (no campaign update)
            const counts = await this.getQuickCounts(campaignId);
            const processed = counts.sent + counts.delivered + counts.read + counts.failed;

            campaignSocketService.emitCampaignProgress(organizationId, campaignId, {
              sent: counts.sent + counts.delivered + counts.read,
              failed: counts.failed,
              delivered: counts.delivered + counts.read,
              read: counts.read,
              total: counts.total,
              percentage: Math.min(100, Math.round((processed / Math.max(counts.total, 1)) * 100)),
              status: 'RUNNING',
            });
          }

          // ✅ ADAPTIVE DELAY
          if (chunkFailed > chunk.length / 2) {
            await new Promise(r => setTimeout(r, 500)); // Slow down on failures
          } else {
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_CHUNKS_MS));
          }
        }
      }

      // ✅ Flush remaining
      if (batchSent.length > 0 || batchFailed.length > 0) {
        await this.flushBatchResults(campaignId, organizationId, batchSent, batchFailed);

        // Save remaining to inbox
        for (const s of batchSent) {
          this.saveCampaignMessage(
            organizationId, campaignId, s.contactId,
            campaign.whatsappAccountId, s.waMessageId,
            template.name, template.language, [], template.id, campaign.name
          ).catch(() => {});
          // Note: Here we don't strictly need await as it's the very end, but let's be safe
          await new Promise(r => setTimeout(r, 10)); 
        }
      }

      // ✅ Final sync (HEAVY sync only at END)
      const finalCounters = await this.syncCampaignCounters(campaignId);

      if (finalCounters.pendingCount === 0) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });

        campaignSocketService.emitCampaignCompleted(organizationId, campaignId, {
          sentCount: finalCounters.sentCount,
          failedCount: finalCounters.failedCount,
          deliveredCount: finalCounters.deliveredCount,
          readCount: finalCounters.readCount,
          totalRecipients: finalCounters.totalContacts,
        });

        console.log(`🏁 Campaign ${campaignId} COMPLETED`);
      }

    } catch (error: any) {
      console.error(`❌ Campaign ${campaignId} error:`, error);
      await this.syncCampaignCounters(campaignId).catch(() => {});
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED', completedAt: new Date() },
      });
      campaignSocketService.emitCampaignError(organizationId, campaignId, { message: error.message });
    } finally {
      this.processingCampaigns.delete(campaignId);
    }
  }

  // ✅ NEW: Batch write results to DB (much faster than individual updates)
  private async flushBatchResults(
    campaignId: string,
    organizationId: string,
    sentItems: { id: string; waMessageId: string; contactId: string; phone: string }[],
    failedItems: { id: string; reason: string; contactId: string; phone: string }[]
  ): Promise<void> {
    const now = new Date();

    try {
      // ✅ SENT contacts - batch update by IDs
      if (sentItems.length > 0) {
        const sentIds = sentItems.map(s => s.id);

        // Bulk status update (1 query instead of N!)
        await prisma.campaignContact.updateMany({
          where: { id: { in: sentIds } },
          data: { status: 'SENT', sentAt: now },
        });

        // Individual waMessageId updates (needed for unique tracking)
        await Promise.allSettled(
          sentItems.map(item =>
            prisma.campaignContact.update({
              where: { id: item.id },
              data: { waMessageId: item.waMessageId },
            })
          )
        );

        // Emit socket status for each sent
        sentItems.forEach(item => {
          campaignSocketService.emitContactStatus(organizationId, campaignId, {
            contactId: item.contactId,
            phone: item.phone,
            status: 'SENT',
            messageId: item.waMessageId,
          });
        });
      }

      // ✅ FAILED contacts - group by reason for efficiency
      if (failedItems.length > 0) {
        // Group by reason
        const reasonGroups = new Map<string, string[]>();
        for (const item of failedItems) {
          const reason = item.reason.substring(0, 500);
          if (!reasonGroups.has(reason)) reasonGroups.set(reason, []);
          reasonGroups.get(reason)!.push(item.id);
        }

        // One updateMany per reason group
        await Promise.allSettled(
          Array.from(reasonGroups.entries()).map(([reason, ids]) =>
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

        // Emit socket status for each failed
        failedItems.forEach(item => {
          campaignSocketService.emitContactStatus(organizationId, campaignId, {
            contactId: item.contactId,
            phone: item.phone,
            status: 'FAILED',
            error: item.reason.substring(0, 200),
          });
        });
      }
    } catch (err) {
      console.error('⚠️ flushBatchResults error:', err);
    }
  }


  // ✅ FIX: saveCampaignMessage - use upsert to prevent duplicate waMessageId error
  private async saveCampaignMessage(
    orgId: string,
    campaignId: string,
    contactId: string,
    accId: string,
    waMessageId: string,
    tplName: string,
    tplLang: string,
    params: any[],
    tplId?: string,
    campName?: string
  ): Promise<void> {
    try {
      // ✅ FIX: Check if message already exists (prevents P2002 unique constraint error)
      const existingMessage = await prisma.message.findFirst({
        where: {
          OR: [
            { waMessageId: waMessageId },
            { wamId: waMessageId },
            { whatsappMessageId: waMessageId },
          ],
        },
      });

      if (existingMessage) {
        // Message already saved (by webhook or previous attempt)
        return;
      }

      // Get or create conversation
      let conversation = await prisma.conversation.findFirst({
        where: { organizationId: orgId, contactId },
      });

      const now = new Date();

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organization: { connect: { id: orgId } },
            contact: { connect: { id: contactId } },
            lastMessageAt: now,
            lastMessagePreview: `Template: ${tplName}`,
            isWindowOpen: true,
            unreadCount: 0,
            isRead: true,
          },
        });
      } else {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: now,
            lastMessagePreview: `Template: ${tplName}`,
          },
        });
      }

      // ✅ Create message with error handling for duplicates
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          type: 'TEMPLATE',
          status: 'SENT',
          waMessageId: waMessageId,
          wamId: waMessageId,
          whatsappAccountId: accId,
          templateId: tplId,
          content: `Campaign: ${campName}\nTemplate: ${tplName}`,
          metadata: { campaignId, campaignName: campName, templateName: tplName } as any,
          sentAt: now,
        },
      }).catch((err: any) => {
        // ✅ Silently ignore duplicate key errors
        if (err.code === 'P2002') {
          // Already exists - no action needed
          return;
        }
        throw err;
      });

    } catch (e: any) {
      // ✅ Don't log P2002 errors (they're expected duplicates)
      if (e.code !== 'P2002') {
        console.error('⚠️ Save campaign message error:', e.message);
      }
    }
  }

  private async getCampaignStats(campaignId: string) {
    return (await prisma.campaign.findUnique({ where: { id: campaignId }, select: { sentCount: true, failedCount: true, deliveredCount: true, readCount: true, totalContacts: true } })) || { sentCount: 0, failedCount: 0, deliveredCount: 0, readCount: 0, totalContacts: 0 };
  }

  private async resolveMediaId(
    template: any,
    phoneNumberId: string,
    accessToken: string,
    wabaId: string
  ): Promise<string> {
    const hType = template.headerType.toUpperCase();
    const mediaId = template.headerMediaId;
    const permanentUrl = template.headerContent;

    // ✅ PRIORITY 1: Numeric ID - best, permanent, use directly
    if (mediaId && /^\d+$/.test(mediaId)) {
      console.log(`✅ Using numeric media ID: ${mediaId}`);
      return mediaId;
    }

    // ✅ PRIORITY 2: Cloudinary URL se fresh upload karo
    // Numeric ID milega jo campaign send kare
    if (
      permanentUrl &&
      permanentUrl.startsWith('http') &&
      !permanentUrl.includes('scontent.whatsapp')
    ) {
      console.log(`🔄 Re-uploading from Cloudinary for fresh numeric ID...`);
      try {
        const axios = require('axios');
        const response = await axios.default.get(permanentUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WabMeta/1.0)' },
        });

        const buffer = Buffer.from(response.data);
        const mimeType =
          response.headers['content-type'] ||
          (hType === 'IMAGE'
            ? 'image/jpeg'
            : hType === 'VIDEO'
            ? 'video/mp4'
            : 'application/pdf');
        const filename =
          permanentUrl.split('/').pop()?.split('?')[0] || 'media';

        const result = await metaApi.uploadMedia(
          phoneNumberId,
          accessToken,
          buffer,
          mimeType,
          filename,
          wabaId
        );

        console.log(`✅ Fresh numeric ID obtained: ${result.id}`);

        // ✅ DB update - future campaigns ke liye cache karo
        // Background mein save karo, campaign wait na kare
        prisma.template
          .update({
            where: { id: template.id },
            data: { headerMediaId: result.id },
          })
          .catch((e: any) =>
            console.warn('⚠️ Could not cache numeric ID:', e.message)
          );

        return result.id;
      } catch (uploadErr: any) {
        console.error(
          '❌ Cloudinary re-upload failed:',
          uploadErr.message
        );
        // Fall through to URL fallback
      }
    }

    // ✅ PRIORITY 3: URL directly mediaId mein stored hai
    if (
      mediaId &&
      mediaId.startsWith('http') &&
      !mediaId.includes('scontent.whatsapp')
    ) {
      console.log(`✅ Using URL from headerMediaId directly`);
      return mediaId; // Meta link field mein jayega
    }

    // ❌ No valid media found
    throw new Error(
      `Template "${template.name}" has invalid or expired media. ` +
      `Please edit the template and re-upload the ${hType.toLowerCase()}.`
    );
  }

  private async buildTemplatePayload(
    template: any,
    cc: any,
    phone: string,
    phoneNumberId: string,
    accessToken: string,
    wabaId: string
  ): Promise<any> {
    const components: any[] = [];

    if (template.headerType && template.headerType !== 'NONE') {
      const hType = template.headerType.toUpperCase();

      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(hType)) {
        // ✅ resolveMediaId() handle karega
        const resolvedId = await this.resolveMediaId(
          template,
          phoneNumberId,
          accessToken,
          wabaId
        );

        // Numeric ID check
        if (/^\d+$/.test(resolvedId)) {
          components.push({
            type: 'header',
            parameters: [{
              type: hType.toLowerCase(),
              [hType.toLowerCase()]: { id: resolvedId },
            }],
          });
        } else {
          // URL (link field)
          components.push({
            type: 'header',
            parameters: [{
              type: hType.toLowerCase(),
              [hType.toLowerCase()]: { link: resolvedId },
            }],
          });
        }
      }
      // TEXT header (unchanged)
      else if (hType === 'TEXT') {
        const matches = (template.headerContent || '').match(/\{\{(\d+)\}\}/g) || [];
        if (matches.length > 0) {
          const params = buildParamsFromContact(cc, matches.length);
          components.push({
            type: 'header',
            parameters: params.map((p: string) => ({ type: 'text', text: String(p) })),
          });
        }
      }
    }

    // Body (unchanged)
    const bodyMatches = (template.bodyText || '').match(/\{\{(\d+)\}\}/g) || [];
    if (bodyMatches.length > 0) {
      const params = buildParamsFromContact(cc, bodyMatches.length);
      components.push({
        type: 'body',
        parameters: params.map((p: string) => ({ type: 'text', text: String(p) })),
      });
    }

    return {
      type: 'template',
      template: {
        name: template.name,
        language: { code: toMetaLang(template.language) },
        ...(components.length > 0 ? { components } : {}),
      },
    };
  }

  // ✅ IMPROVED: Extract failure reason with better Meta error mapping
  private extractFailureReason(error: any): string {
    const me = error.response?.data?.error;
    if (!me) return error.message || 'Unknown error';

    const code = me.code;

    const errorMap: Record<number, string> = {
      100: 'Invalid parameter - Template format mismatch or media ID invalid',
      131030: 'Phone not on WhatsApp',
      131026: 'Message undeliverable',
      131048: 'Rate limit reached',
      131021: 'Rate limit reached',
      131056: 'Number restricted by Meta',
      132000: 'Template parameters mismatch',
      132001: 'Template not found or not approved',
      132005: 'Template hydration failed',
      132007: 'Template format character policy violated',
      132012: 'Template format mismatch (Media/link invalid or variables missing)',
      132015: 'Template PAUSED - Too many messages blocked by users',
      190: 'Access token expired - Reconnect WhatsApp',
    };

    if (errorMap[code]) return errorMap[code];
    return `${me.message || 'Meta API error'} (Code: ${code})`;
  }

  private getDecryptedToken(rawToken: string | null): string | null {
    if (!rawToken) return null;
    return rawToken.startsWith('EAA') ? rawToken : safeDecrypt(rawToken);
  }

  async getStats(organizationId: string): Promise<any> {
    const stats = await prisma.campaign.aggregate({ where: { organizationId }, _count: { id: true }, _sum: { totalContacts: true, sentCount: true, deliveredCount: true, readCount: true, failedCount: true } });
    return { total: stats._count.id || 0, totalSent: stats._sum.sentCount || 0, totalDelivered: stats._sum.deliveredCount || 0, totalRead: stats._sum.readCount || 0, replied: 0, totalRecipients: stats._sum.totalContacts || 0 };
  }
}

export const campaignsService = new CampaignsService();