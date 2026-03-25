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
  private async findWhatsAppAccount(
    organizationId: string,
    whatsappAccountId?: string,
    phoneNumberId?: string
  ): Promise<any> {
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

  async retry(organizationId: string, campaignId: string, arg3: any, arg4?: any): Promise<any> {
    const options = typeof arg3 === 'object' ? arg3 : { retryFailed: !!arg3, retryPending: !!arg4 };
    const { retryFailed = true, retryPending = false } = options;
    const statuses = [];
    if (retryFailed) statuses.push('FAILED');
    if (retryPending) statuses.push('PENDING');
    
    if (statuses.length === 0) return { message: 'No status selected', count: 0 };

    const result = await prisma.campaignContact.updateMany({
      where: { campaignId, status: { in: statuses as any } },
      data: { status: 'PENDING', retryCount: { increment: 1 }, failedAt: null, failureReason: null }
    });

    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'RUNNING' } });
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, { status: 'RUNNING', message: `Retrying ${result.count} contacts` });
    this.processCampaignContacts(campaignId, organizationId).catch(() => {});
    return { message: 'Retry started', count: result.count };
  }

  async getAnalytics(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new AppError('Campaign not found', 404);
    return { ...formatCampaign(campaign), timeline: [] }; 
  }

  async getCampaignContacts(organizationId: string, campaignId: string, options: any): Promise<any> {
    const { page = 1, limit = 50, status, search } = options;
    const where: any = { campaignId };
    if (status && status !== 'all') where.status = status;
    if (search) where.contact = { phone: { contains: search, mode: 'insensitive' } };
    const [contacts, total] = await Promise.all([
      prisma.campaignContact.findMany({ where, include: { contact: true }, skip: (page - 1) * limit, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.campaignContact.count({ where })
    ]);
    return { recipients: contacts.map(formatCampaignContact), contacts: contacts.map(formatCampaignContact), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getAllRecipients(organizationId: string, campaignId: string, options: any): Promise<any> {
    const res = await this.getCampaignContacts(organizationId, campaignId, options);
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    return { ...res, summary: { total: campaign?.totalContacts || 0, sent: campaign?.sentCount || 0, delivered: campaign?.deliveredCount || 0, read: campaign?.readCount || 0, failed: campaign?.failedCount || 0, pending: 0, queued: 0 } };
  }

  async getFailedContacts(organizationId: string, campaignId: string, page: number, limit: number): Promise<any> {
    return this.getCampaignContacts(organizationId, campaignId, { page, limit, status: 'FAILED' });
  }

  async exportFailedContactsCsv(organizationId: string, campaignId: string): Promise<string> {
    const contacts = await prisma.campaignContact.findMany({ where: { campaignId, status: 'FAILED' }, include: { contact: true } });
    let csv = 'Phone,Name,Error,Date\n';
    contacts.forEach((c: any) => {
      csv += `"${c.contact?.phone}","${c.contact?.firstName || ''} ${c.contact?.lastName || ''}","${c.failureReason || ''}","${c.failedAt?.toISOString() || ''}"\n`;
    });
    return csv;
  }

  async exportRecipientsCsv(organizationId: string, campaignId: string, status?: string): Promise<string> {
    const where: any = { campaignId };
    if (status && status !== 'all') where.status = status;
    const contacts = await prisma.campaignContact.findMany({ where, include: { contact: true } });
    let csv = 'Phone,Name,Status,Date\n';
    contacts.forEach((c: any) => {
      csv += `"${c.contact?.phone}","${c.contact?.firstName || ''} ${c.contact?.lastName || ''}","${c.status}","${c.updatedAt?.toISOString() || ''}"\n`;
    });
    return csv;
  }

  async retryFailedContacts(organizationId: string, campaignId: string, contactIds?: string[]): Promise<any> {
    const where: any = { campaignId, status: 'FAILED' };
    if (contactIds?.length) where.contactId = { in: contactIds };
    const result = await prisma.campaignContact.updateMany({ where, data: { status: 'PENDING', failedAt: null, failureReason: null } });
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'RUNNING' } });
    this.processCampaignContacts(campaignId, organizationId).catch(() => {});
    return { message: 'Retry started', count: result.count };
  }

  async retryFailed(organizationId: string, campaignId: string, contactIds?: string[]): Promise<any> {
    return this.retryFailedContacts(organizationId, campaignId, contactIds);
  }

  async resumePending(organizationId: string, campaignId: string): Promise<any> {
    return this.resume(organizationId, campaignId);
  }

  async getDetailedStats(organizationId: string, campaignId: string): Promise<any> {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new AppError('Campaign not found', 404);
    const failureReasons = await prisma.campaignContact.groupBy({ by: ['failureReason'], where: { campaignId, status: 'FAILED' }, _count: true });
    return { 
      ...formatCampaign(campaign), 
      pending: (campaign.totalContacts || 0) - (campaign.sentCount || 0) - (campaign.failedCount || 0),
      queued: 0,
      sent: campaign.sentCount || 0,
      delivered: campaign.deliveredCount || 0,
      read: campaign.readCount || 0,
      failed: campaign.failedCount || 0,
      failureReasons: failureReasons.map(fr => ({ reason: fr.failureReason || 'Unknown', count: fr._count })),
      successRate: 0, deliveryRate: 0, readRate: 0 
    };
  }

  private async processCampaignContacts(campaignId: string, organizationId: string): Promise<void> {
    if (this.processingCampaigns.has(campaignId)) return;
    this.processingCampaigns.add(campaignId);

    try {
      const campaign: any = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { template: true, whatsappAccount: true } });
      if (!campaign || !campaign.template || !campaign.whatsappAccount) throw new Error('Campaign data incomplete');

      // Reset stuck contacts
      await prisma.campaignContact.updateMany({ where: { campaignId, status: 'QUEUED' as any }, data: { status: 'PENDING' } });

      const accessToken = this.getDecryptedToken(campaign.whatsappAccount.accessToken);
      if (!accessToken || !accessToken.startsWith('EAA')) throw new Error('Invalid access token');
      
      const phoneNumberId = campaign.whatsappAccount.phoneNumberId;
      const template = campaign.template;

      const BATCH_SIZE = 500;
      const CONCURRENCY = 10;
      let hasMore = true;

      while (hasMore) {
        const current = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
        if (current?.status !== 'RUNNING') break;

        const contacts = await prisma.campaignContact.findMany({ where: { campaignId, status: 'PENDING' }, include: { contact: true }, take: BATCH_SIZE });
        if (contacts.length === 0) { hasMore = false; break; }

        for (let i = 0; i < contacts.length; i += CONCURRENCY) {
          const chunk = contacts.slice(i, i + CONCURRENCY);
          await Promise.all(chunk.map(async (cc) => {
            try {
              const phone = cc.contact?.phone;
              if (!phone) throw new Error('No phone');
              const cleanPhone = digitsOnly(phone);
              const payload = this.buildTemplatePayload(template, cc, cleanPhone);
              const result = await metaApi.sendMessage(phoneNumberId, accessToken, cleanPhone, payload);
              
              await prisma.campaignContact.update({ where: { id: cc.id }, data: { status: 'SENT', waMessageId: result.messageId, sentAt: new Date() } });
              await prisma.campaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } });
              
              campaignSocketService.emitContactStatus(organizationId, campaignId, { contactId: cc.contactId, phone: cleanPhone, status: 'SENT', messageId: result.messageId });
              this.saveCampaignMessage(organizationId, campaignId, cc.contactId, campaign.whatsappAccountId, result.messageId, template.name, template.language, [], template.id, campaign.name).catch(() => {});
            } catch (err: any) {
              const reason = this.extractFailureReason(err);
              await this.markContactFailed(cc.id, campaignId, organizationId, cc.contactId, cc.contact?.phone || '', reason);
            }
          }));
          await new Promise(r => setTimeout(r, 200));
        }

        const stats = await this.getCampaignStats(campaignId);
        campaignSocketService.emitCampaignProgress(organizationId, campaignId, { 
          sent: stats.sentCount, failed: stats.failedCount, delivered: stats.deliveredCount, read: stats.readCount, 
          total: stats.totalContacts, percentage: Math.round(((stats.sentCount + stats.failedCount) / stats.totalContacts) * 100), status: 'RUNNING' 
        });
      }

      const remaining = await prisma.campaignContact.count({ where: { campaignId, status: { in: ['PENDING', 'QUEUED'] } } });
      if (remaining === 0) {
        const final: any = await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED', completedAt: new Date() } });
        campaignSocketService.emitCampaignCompleted(organizationId, campaignId, { 
          sentCount: final.sentCount, failedCount: final.failedCount, deliveredCount: final.deliveredCount, readCount: final.readCount, totalRecipients: final.totalContacts 
        });
      }
    } catch (error: any) {
      console.error(`❌ Campaign error:`, error);
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'FAILED', completedAt: new Date() } });
      campaignSocketService.emitCampaignError(organizationId, campaignId, { message: error.message });
    } finally {
      this.processingCampaigns.delete(campaignId);
    }
  }

  private async markContactFailed(ccId: string, campaignId: string, organizationId: string, contactId: string, phone: string, reason: string): Promise<void> {
    await prisma.campaignContact.update({ where: { id: ccId }, data: { status: 'FAILED', failureReason: reason.substring(0, 500), failedAt: new Date() } });
    await prisma.campaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } });
    campaignSocketService.emitContactStatus(organizationId, campaignId, { contactId, phone: digitsOnly(phone), status: 'FAILED', error: reason.substring(0, 200) });
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

  private extractFailureReason(error: any): string {
    const me = error.response?.data?.error;
    if (me) {
      if (me.code === 131030) return 'Phone not on WhatsApp';
      if (me.code === 131026) return 'Message undeliverable';
      if (me.code === 132000) return 'Template invalid';
      if ([131048, 131021].includes(me.code)) return 'Rate limit';
      return `${me.message} (${me.code})`;
    }
    return error.message || 'Unknown error';
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