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

  // ✅ FIXED: Robust account finder with detailed logging
  // ✅ NEW: Sync counters from ACTUAL database records (never double-count)
  private async syncCampaignCounters(campaignId: string): Promise<{
    totalContacts: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    pendingCount: number;
  }> {
    const counts = await prisma.campaignContact.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });

    const get = (status: string) => counts.find(c => c.status === status)?._count || 0;

    const result = {
      totalContacts: counts.reduce((sum, c) => sum + c._count, 0),
      sentCount: get('SENT'),
      deliveredCount: get('DELIVERED'),
      readCount: get('READ'),
      failedCount: get('FAILED'),
      pendingCount: get('PENDING') + get('QUEUED'),
    };

    // ✅ Update campaign record with ACTUAL counts (no increment!)
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        totalContacts: result.totalContacts,
        sentCount: result.sentCount + result.deliveredCount + result.readCount, // cumulative sent
        deliveredCount: result.deliveredCount + result.readCount, // cumulative delivered
        readCount: result.readCount,
        failedCount: result.failedCount,
      },
    });

    return result;
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
    });

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
    });
    return formatCampaign(duplicated);
  }

  async start(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, organizationId } });
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (campaign.status === 'RUNNING') throw new AppError('Already running', 400);

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

      // Sync counters at start
      await this.syncCampaignCounters(campaignId);

      const accessToken = this.getDecryptedToken(campaign.whatsappAccount.accessToken);
      if (!accessToken || !accessToken.startsWith('EAA')) {
        throw new Error('Invalid access token');
      }

      const phoneNumberId = campaign.whatsappAccount.phoneNumberId;
      const template = campaign.template;

      // ✅ SMART SENDING CONFIG
      const BATCH_SIZE = 500;
      const CONCURRENCY = 25;                   // ✅ Increased from 10
      const DELAY_BETWEEN_CHUNKS_MS = 50;       // ✅ Reduced from 200ms
      const SYNC_EVERY_N_MESSAGES = 50;         // ✅ Sync DB every 50, not every 10
      const RATE_LIMIT_PAUSE_MS = 3000;         // ✅ Pause on rate limit
      const MAX_CONSECUTIVE_FAILURES = 20;      // ✅ Stop if too many consecutive failures

      let hasMore = true;
      let totalProcessed = 0;
      let consecutiveFailures = 0;
      let rateLimitHits = 0;

      // ✅ Track results in memory (batch write to DB)
      let batchSent: { id: string; waMessageId: string }[] = [];
      let batchFailed: { id: string; reason: string }[] = [];

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

        console.log(`📦 Processing ${contacts.length} contacts (concurrency: ${CONCURRENCY})`);

        // Process in concurrent chunks
        for (let i = 0; i < contacts.length; i += CONCURRENCY) {
          // Check status periodically
          if (i > 0 && i % (CONCURRENCY * 10) === 0) {
            const check = await prisma.campaign.findUnique({
              where: { id: campaignId },
              select: { status: true },
            });
            if (check?.status !== 'RUNNING') break;
          }

          // ✅ SMART: If too many consecutive failures, pause and check quality
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.warn(`⚠️ ${consecutiveFailures} consecutive failures! Pausing 10s...`);
            
            // Emit warning to frontend
            campaignSocketService.emitCampaignError(organizationId, campaignId, {
              message: `High failure rate detected (${consecutiveFailures} consecutive). Auto-pausing for quality check.`,
              code: 'HIGH_FAILURE_RATE',
            });

            await new Promise(r => setTimeout(r, 10000)); // 10s pause
            consecutiveFailures = 0; // Reset counter
          }

          const chunk = contacts.slice(i, i + CONCURRENCY);

          // ✅ Process chunk concurrently
          const results = await Promise.allSettled(
            chunk.map(async (cc) => {
              const phone = cc.contact?.phone;
              if (!phone) {
                return { 
                  type: 'failed' as const, 
                  id: cc.id, 
                  contactId: cc.contactId,
                  phone: '',
                  reason: 'No phone number' 
                };
              }

              const cleanPhone = digitsOnly(phone);
              if (!cleanPhone || cleanPhone.length < 10) {
                return { 
                  type: 'failed' as const, 
                  id: cc.id, 
                  contactId: cc.contactId,
                  phone: cleanPhone,
                  reason: 'Invalid phone number' 
                };
              }

              try {
                const payload = this.buildTemplatePayload(template, cc, cleanPhone);

                const result = await metaApi.sendMessage(
                  phoneNumberId,
                  accessToken,
                  cleanPhone,
                  payload
                );

                return {
                  type: 'sent' as const,
                  id: cc.id,
                  contactId: cc.contactId,
                  phone: cleanPhone,
                  waMessageId: result.messageId,
                };
              } catch (err: any) {
                const reason = this.extractFailureReason(err);
                const metaCode = err.response?.data?.error?.code;

                return {
                  type: 'failed' as const,
                  id: cc.id,
                  contactId: cc.contactId,
                  phone: cleanPhone,
                  reason,
                  metaCode,
                };
              }
            })
          );

          // ✅ Process results
          let chunkSent = 0;
          let chunkFailed = 0;

          for (const result of results) {
            if (result.status === 'rejected') continue;

            const data = result.value;

            if (data.type === 'sent') {
              batchSent.push({ id: data.id, waMessageId: data.waMessageId });
              consecutiveFailures = 0; // Reset on success
              chunkSent++;

              // Emit individual status
              campaignSocketService.emitContactStatus(organizationId, campaignId, {
                contactId: data.contactId,
                phone: data.phone,
                status: 'SENT',
                messageId: data.waMessageId,
              });

            } else {
              batchFailed.push({ id: data.id, reason: data.reason });
              chunkFailed++;

              // ✅ SMART: Handle rate limits
              if (data.metaCode === 131048 || data.metaCode === 131021 ||
                  data.reason.includes('Rate limit') || data.reason.includes('rate limit')) {
                rateLimitHits++;
                console.warn(`⚠️ Rate limit hit #${rateLimitHits}! Pausing ${RATE_LIMIT_PAUSE_MS}ms`);
                await new Promise(r => setTimeout(r, RATE_LIMIT_PAUSE_MS));
              }

              // ✅ SMART: Track consecutive failures for ecosystem errors
              if (data.reason.includes('ecosystem') || data.reason.includes('undeliverable')) {
                consecutiveFailures++;
              } else {
                consecutiveFailures = 0;
              }

              campaignSocketService.emitContactStatus(organizationId, campaignId, {
                contactId: data.contactId,
                phone: data.phone,
                status: 'FAILED',
                error: data.reason.substring(0, 200),
              });
            }
          }

          totalProcessed += chunkSent + chunkFailed;

          // ✅ BATCH DB WRITE: Write to DB every N messages (not every single one!)
          if (batchSent.length + batchFailed.length >= SYNC_EVERY_N_MESSAGES || 
              i + CONCURRENCY >= contacts.length) {
            await this.flushBatchResults(campaignId, batchSent, batchFailed);
            batchSent = [];
            batchFailed = [];

            // Sync counters and emit progress
            const counters = await this.syncCampaignCounters(campaignId);
            const processed = counters.sentCount + counters.deliveredCount + 
                             counters.readCount + counters.failedCount;

            campaignSocketService.emitCampaignProgress(organizationId, campaignId, {
              sent: counters.sentCount + counters.deliveredCount + counters.readCount,
              failed: counters.failedCount,
              delivered: counters.deliveredCount + counters.readCount,
              read: counters.readCount,
              total: counters.totalContacts,
              percentage: Math.min(100, Math.round((processed / Math.max(counters.totalContacts, 1)) * 100)),
              status: 'RUNNING',
            });
          }

          // ✅ SMART DELAY: Adaptive delay based on failure rate
          if (chunkFailed > chunkSent && chunkFailed > 3) {
            // High failure rate → slow down
            await new Promise(r => setTimeout(r, 500));
          } else if (rateLimitHits > 0) {
            await new Promise(r => setTimeout(r, 200));
          } else {
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_CHUNKS_MS));
          }
        }
      }

      // ✅ Flush remaining batch
      if (batchSent.length > 0 || batchFailed.length > 0) {
        await this.flushBatchResults(campaignId, batchSent, batchFailed);
      }

      // ✅ Final sync and completion
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

        console.log(`🏁 Campaign ${campaignId} COMPLETED (Rate limit hits: ${rateLimitHits})`);
      }

    } catch (error: any) {
      console.error(`❌ Campaign ${campaignId} error:`, error);

      await this.syncCampaignCounters(campaignId).catch(() => {});

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED', completedAt: new Date() },
      });

      campaignSocketService.emitCampaignError(organizationId, campaignId, {
        message: error.message,
      });
    } finally {
      this.processingCampaigns.delete(campaignId);
    }
  }

  // ✅ NEW: Batch write results to DB (much faster than individual updates)
  private async flushBatchResults(
    campaignId: string,
    sentItems: { id: string; waMessageId: string }[],
    failedItems: { id: string; reason: string }[]
  ): Promise<void> {
    const now = new Date();

    // ✅ Batch update SENT contacts
    if (sentItems.length > 0) {
      // Use transaction for atomicity
      await prisma.$transaction(
        sentItems.map(item =>
          prisma.campaignContact.update({
            where: { id: item.id },
            data: {
              status: 'SENT',
              waMessageId: item.waMessageId,
              sentAt: now,
            },
          })
        )
      );
    }

    // ✅ Batch update FAILED contacts
    if (failedItems.length > 0) {
      await prisma.$transaction(
        failedItems.map(item =>
          prisma.campaignContact.update({
            where: { id: item.id },
            data: {
              status: 'FAILED',
              failureReason: item.reason.substring(0, 500),
              failedAt: now,
            },
          })
        )
      );
    }

    console.log(`💾 Flushed: ${sentItems.length} sent, ${failedItems.length} failed`);
  }
 
  // ✅ FIXED: markContactFailed - NO increment on campaign
  private async markContactFailed(
    ccId: string,
    campaignId: string,
    organizationId: string,
    contactId: string,
    phone: string,
    reason: string
  ): Promise<void> {
    await prisma.campaignContact.update({
      where: { id: ccId },
      data: {
        status: 'FAILED',
        failureReason: reason.substring(0, 500),
        failedAt: new Date(),
      },
    });

    // ✅ NO increment here! syncCampaignCounters handles it

    campaignSocketService.emitContactStatus(organizationId, campaignId, {
      contactId,
      phone: digitsOnly(phone),
      status: 'FAILED',
      error: reason.substring(0, 200),
    });
  }

  private async getCampaignStats(campaignId: string) {
    return (await prisma.campaign.findUnique({ where: { id: campaignId }, select: { sentCount: true, failedCount: true, deliveredCount: true, readCount: true, totalContacts: true } })) || { sentCount: 0, failedCount: 0, deliveredCount: 0, readCount: 0, totalContacts: 0 };
  }

  private buildTemplatePayload(template: any, cc: any, phone: string): any {
    const components: any[] = [];
    if (template.headerType && template.headerType !== 'NONE') {
      const hType = template.headerType.toUpperCase();
      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(hType) && template.headerMediaId) {
        components.push({ type: 'header', parameters: [{ type: hType.toLowerCase(), [hType.toLowerCase()]: { id: template.headerMediaId } }] });
      }
    }
    const bodyMatches = (template.bodyText || '').match(/\{\{(\d+)\}\}/g) || [];
    if (bodyMatches.length > 0) {
      const params = buildParamsFromContact(cc, bodyMatches.length);
      components.push({ type: 'body', parameters: params.map(p => ({ type: 'text', text: String(p) })) });
    }
    return { type: 'template', template: { name: template.name, language: { code: toMetaLang(template.language) }, components: components.length > 0 ? components : undefined } };
  }

  // ✅ IMPROVED: Extract failure reason with better Meta error mapping
  private extractFailureReason(error: any): string {
    const me = error.response?.data?.error;
    if (!me) return error.message || 'Unknown error';

    const code = me.code;
    const subcode = me.error_subcode;

    // ✅ Comprehensive Meta error mapping
    const errorMap: Record<number, string> = {
      // Phone/Contact errors
      131030: 'Phone number not registered on WhatsApp',
      131026: 'Message undeliverable',
      131047: 'Re-engagement message required (24h window expired)',
      
      // Rate limiting
      131048: 'Meta API rate limit reached - sending too fast',
      131021: 'Meta API rate limit reached',
      131056: 'Phone number rate limited by Meta',
      
      // Template errors  
      132000: 'Template parameters mismatch',
      132001: 'Template not found or not approved',
      132005: 'Template hydration failed',
      132007: 'Template format error',
      132012: 'Template paused due to low quality',
      132015: 'Template paused - too many blocks',
      
      // Account errors
      131051: 'Business account restricted by Meta',
      131031: 'Account not registered',
      131009: 'API parameter error',
      131042: 'Business eligibility error',
      
      // Ecosystem/Quality errors
      131049: 'This message was not delivered to maintain healthy ecosystem engagement.',
      131053: 'Media upload error',
      
      // Generic
      100: 'Invalid parameter in API request',
      190: 'Access token expired - reconnect WhatsApp',
      368: 'Account temporarily restricted for policy violation',
    };

    if (errorMap[code]) return errorMap[code];

    // Subcode mapping
    if (subcode === 2494010) return 'Message not delivered - ecosystem engagement protection';
    if (subcode === 2494049) return 'Recipient not eligible for this message type';

    return `${me.message || 'Meta API error'} (Code: ${code}${subcode ? `, Sub: ${subcode}` : ''})`;
  }

  private getDecryptedToken(rawToken: string | null): string | null {
    if (!rawToken) return null;
    return rawToken.startsWith('EAA') ? rawToken : safeDecrypt(rawToken);
  }

  private async saveCampaignMessage(orgId: string, campaignId: string, contactId: string, accId: string, waId: string, tplName: string, tplLang: string, params: any[], tplId?: string, campName?: string): Promise<void> {
    try {
      const conversation = await inboxService.getOrCreateConversation(orgId, contactId);
      await prisma.message.create({
        data: {
          conversationId: conversation.id, direction: 'OUTBOUND' as any, type: 'TEMPLATE', status: 'SENT',
          waMessageId: waId, wamId: waId, whatsappAccountId: accId, templateId: tplId,
          content: `Campaign: ${campName}\nTemplate: ${tplName}`,
          metadata: { campaignId, campaignName: campName, templateName: tplName, params } as any,
          sentAt: new Date(),
        }
      });
      await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date(), lastMessagePreview: `Template: ${tplName}` } });
    } catch (e) { console.error('Save message error:', e); }
  }

  async getStats(organizationId: string): Promise<any> {
    const stats = await prisma.campaign.aggregate({ where: { organizationId }, _count: { id: true }, _sum: { totalContacts: true, sentCount: true, deliveredCount: true, readCount: true, failedCount: true } });
    return { total: stats._count.id || 0, totalSent: stats._sum.sentCount || 0, totalDelivered: stats._sum.deliveredCount || 0, totalRead: stats._sum.readCount || 0, replied: 0, totalRecipients: stats._sum.totalContacts || 0 };
  }
}

export const campaignsService = new CampaignsService();