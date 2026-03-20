// 📁 src/modules/campaigns/campaigns.service.ts - COMPLETE WITH ALL FIXES + SOCKET INTEGRATION

import { PrismaClient, CampaignStatus, MessageStatus, Prisma } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { metaService } from '../meta/meta.service';
import { metaApi } from '../meta/meta.api';
import { campaignSocketService } from './campaigns.socket';
import { v4 as uuidv4 } from 'uuid';
import { safeDecrypt } from '../../utils/encryption';
import { inboxService } from '../inbox/inbox.service';
import { webhookEvents } from '../webhooks/webhook.service';
import {
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignsQueryInput,
  CampaignContactsQueryInput,
  CampaignResponse,
  CampaignDetailResponse,
  CampaignContactResponse,
  CampaignsListResponse,
  CampaignStats,
  CampaignAnalytics,
  AudienceFilter,
} from './campaigns.types';

import prisma from '../../config/database';

// ============================================
// HELPER FUNCTIONS
// ============================================

const digitsOnly = (p: string): string => String(p || '').replace(/\D/g, '');

const toMetaLang = (lang?: string): string => {
  const l = String(lang || '').trim();
  return l || 'en_US';
};

const toRecipient = (c: any): string | null => {
  const phone = String(c?.phone || '').trim();
  if (!phone) return null;

  if (phone.startsWith('+')) return digitsOnly(phone);

  const digits = digitsOnly(phone);
  if (!digits) return null;

  if (digits.length > 10) return digits;

  const cc = digitsOnly(c?.countryCode || '91');
  return `${cc}${digits}`;
};

const buildTemplateSendPayload = (args: {
  to: string;
  templateName: string;
  language: string;
  params: string[];
}) => ({
  messaging_product: 'whatsapp',
  to: digitsOnly(args.to),
  type: 'template',
  template: {
    name: args.templateName,
    language: { code: toMetaLang(args.language) },
    components: args.params.length
      ? [
        {
          type: 'body',
          parameters: args.params.map((t) => ({ type: 'text', text: String(t) })),
        },
      ]
      : [],
  },
});

const buildParamsFromContact = (contact: any, varCount: number): string[] => {
  const fallback = [
    contact?.firstName || '',
    contact?.lastName || '',
    contact?.phone || '',
    contact?.email || '',
  ].filter(Boolean);

  const params: string[] = [];
  for (let i = 0; i < varCount; i++) {
    params.push(fallback[i] || 'NA');
  }
  return params;
};

const calculateRates = (campaign: any): { deliveryRate: number; readRate: number } => {
  const deliveryRate =
    campaign.sentCount > 0 ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100) : 0;

  const readRate =
    campaign.deliveredCount > 0
      ? Math.round((campaign.readCount / campaign.deliveredCount) * 100)
      : 0;

  return { deliveryRate, readRate };
};

const formatCampaign = (campaign: any): CampaignResponse => {
  const { deliveryRate, readRate } = calculateRates(campaign);
  const pendingCount = campaign.totalContacts - campaign.sentCount - campaign.failedCount;

  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    templateId: campaign.templateId,
    templateName: (campaign as any).template?.name || (campaign as any).Template?.name || '',
    whatsappAccountId: campaign.whatsappAccountId,
    whatsappAccountPhone:
      (campaign as any).whatsappAccount?.phoneNumber ||
      (campaign as any).WhatsAppAccount?.phoneNumber ||
      '',
    contactGroupId: campaign.contactGroupId,
    contactGroupName:
      (campaign as any).contactGroup?.name || (campaign as any).ContactGroup?.name || null,
    audienceFilter: campaign.audienceFilter as AudienceFilter | null,
    variableMapping: null,
    status: campaign.status,
    scheduledAt: campaign.scheduledAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    totalContacts: campaign.totalContacts,
    sentCount: campaign.sentCount,
    deliveredCount: campaign.deliveredCount,
    readCount: campaign.readCount,
    failedCount: campaign.failedCount,
    pendingCount: pendingCount > 0 ? pendingCount : 0,
    deliveryRate,
    readRate,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
};

const formatCampaignContact = (cc: any): CampaignContactResponse => ({
  id: cc.id,
  contactId: cc.contactId,
  phone: (cc as any).contact?.phone || (cc as any).Contact?.phone || '',
  fullName:
    [
      (cc as any).contact?.firstName || (cc as any).Contact?.firstName,
      (cc as any).contact?.lastName || (cc as any).Contact?.lastName,
    ]
      .filter(Boolean)
      .join(' ') ||
    (cc as any).contact?.phone ||
    (cc as any).Contact?.phone ||
    '',
  status: cc.status,
  waMessageId: cc.waMessageId,
  sentAt: cc.sentAt,
  deliveredAt: cc.deliveredAt,
  readAt: cc.readAt,
  failedAt: cc.failedAt,
  failureReason: cc.failureReason,
  retryCount: cc.retryCount,
});

const toJsonValue = (value: any): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value));
};

// ============================================
// CAMPAIGNS SERVICE CLASS
// ============================================

export class CampaignsService {
  // ==========================================
  // FIND WHATSAPP ACCOUNT (ROBUST)
  // ==========================================
  private async findWhatsAppAccount(
    organizationId: string,
    whatsappAccountId?: string,
    phoneNumberId?: string
  ): Promise<any> {
    console.log('🔍 Finding WhatsApp account:', {
      organizationId,
      whatsappAccountId,
      phoneNumberId,
    });

    let waAccount = null;

    if (whatsappAccountId) {
      waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          id: whatsappAccountId,
          organizationId,
        },
      });

      if (waAccount) return waAccount;
    }

    if (!waAccount && phoneNumberId) {
      waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          phoneNumberId,
          organizationId,
        },
      });

      if (waAccount) return waAccount;
    }

    if (!waAccount) {
      waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          organizationId,
          status: 'CONNECTED',
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      if (waAccount) return waAccount;
    }

    if (!waAccount) {
      waAccount = await prisma.whatsAppAccount.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });

      if (waAccount) return waAccount;
    }

    return null;
  }

  // ==========================================
  // CREATE CAMPAIGN
  // ==========================================
  async create(
    organizationId: string,
    userId: string,
    input: CreateCampaignInput
  ): Promise<CampaignResponse> {
    const {
      name,
      description,
      templateId,
      whatsappAccountId,
      phoneNumberId,
      contactGroupId,
      contactIds,
      audienceFilter,
      scheduledAt,
    } = input as any;

    console.log('📦 Campaign create request:', {
      organizationId,
      name,
      templateId,
      whatsappAccountId,
      phoneNumberId,
      contactIdsCount: contactIds?.length || 0,
    });

    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    if (template.status !== 'APPROVED') {
      throw new AppError(
        `Template is not approved yet (status: ${template.status}). Please wait for Meta approval.`,
        400
      );
    }

    if (!(template as any).metaTemplateId) {
      throw new AppError('Template is not synced from Meta. Please sync templates first.', 400);
    }

    const waAccount = await this.findWhatsAppAccount(
      organizationId,
      whatsappAccountId,
      phoneNumberId
    );

    if (!waAccount) {
      throw new AppError(
        'WhatsApp account not found. Please connect WhatsApp first in Settings → WhatsApp.',
        400
      );
    }

    if ((template as any).wabaId && waAccount?.wabaId && (template as any).wabaId !== waAccount.wabaId) {
      throw new AppError(
        'Selected template belongs to a different WABA. Please select a template for the connected number.',
        400
      );
    }

    if (contactGroupId) {
      const group = await prisma.contactGroup.findFirst({
        where: { id: contactGroupId, organizationId },
      });

      if (!group) {
        throw new AppError('Contact group not found', 404);
      }
    }

    let targetContacts: { id: string }[] = [];

    if (contactIds && contactIds.length > 0) {
      targetContacts = await prisma.contact.findMany({
        where: {
          id: { in: contactIds },
          organizationId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
    } else if (contactGroupId) {
      const groupMembers = await prisma.contactGroupMember.findMany({
        where: {
          groupId: contactGroupId,
          contact: {
            organizationId,
            status: 'ACTIVE',
          },
        },
        select: { contactId: true },
      });
      targetContacts = groupMembers.map((m) => ({ id: m.contactId }));
    } else if (audienceFilter) {
      const where: Prisma.ContactWhereInput = {
        organizationId,
        status: 'ACTIVE',
      };

      if (audienceFilter.tags && audienceFilter.tags.length > 0) {
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

      if (audienceFilter.hasMessaged !== undefined) {
        where.messageCount = audienceFilter.hasMessaged ? { gt: 0 } : { equals: 0 };
      }

      targetContacts = await prisma.contact.findMany({
        where,
        select: { id: true },
      });
    }

    if (targetContacts.length === 0) {
      throw new AppError('No contacts found for this campaign', 400);
    }

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
          status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          totalContacts: targetContacts.length,
          createdById: userId,
        } as any,
        include: {
          template: { select: { name: true } },
          whatsappAccount: { select: { phoneNumber: true } },
          contactGroup: { select: { name: true } },
        } as any,
      });

      const campaignContactsData = targetContacts.map((contact) => ({
        id: uuidv4(),
        campaignId: newCampaign.id,
        contactId: contact.id,
        status: 'PENDING' as MessageStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await tx.campaignContact.createMany({
        data: campaignContactsData,
      });

      return newCampaign;
    });

    console.log(`✅ Campaign created: ${campaign.id} with ${targetContacts.length} contacts`);

    // ✅ Emit campaign created event
    campaignSocketService.emitCampaignUpdate(organizationId, campaign.id, {
      status: campaign.status,
      message: 'Campaign created successfully',
      totalContacts: targetContacts.length,
    });

    return formatCampaign(campaign);
  }

  // ==========================================
  // GET CAMPAIGNS LIST
  // ==========================================
  async getList(
    organizationId: string,
    query: CampaignsQueryInput
  ): Promise<CampaignsListResponse> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.CampaignWhereInput = {
      organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          template: { select: { name: true } },
          whatsappAccount: { select: { phoneNumber: true } },
          contactGroup: { select: { name: true } },
        } as any,
      }),
      prisma.campaign.count({ where }),
    ]);

    return {
      campaigns: campaigns.map(formatCampaign),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // GET CAMPAIGN BY ID
  // ==========================================
  async getById(organizationId: string, campaignId: string): Promise<CampaignDetailResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            bodyText: true,
            headerType: true,
            headerContent: true,
            language: true,
          },
        },
        whatsappAccount: {
          select: {
            id: true,
            phoneNumber: true,
            displayName: true,
          },
        },
        contactGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      } as any,
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const c = campaign as any;
    return {
      ...formatCampaign(campaign),
      template: c.template || c.Template,
      whatsappAccount: c.whatsappAccount || c.WhatsAppAccount,
      contactGroup: c.contactGroup || c.ContactGroup,
    };
  }

  // ==========================================
  // UPDATE CAMPAIGN
  // ==========================================
  async update(
    organizationId: string,
    campaignId: string,
    input: UpdateCampaignInput
  ): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (['RUNNING', 'COMPLETED'].includes(campaign.status)) {
      throw new AppError(`Cannot update ${campaign.status.toLowerCase()} campaign`, 400);
    }

    if (input.templateId) {
      const template = await prisma.template.findFirst({
        where: {
          id: input.templateId,
          organizationId,
        },
      });

      if (!template) {
        throw new AppError('Template not found', 404);
      }
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
      include: {
        template: { select: { name: true } },
        whatsappAccount: { select: { phoneNumber: true } },
        contactGroup: { select: { name: true } },
      } as any,
    });

    // ✅ Emit campaign updated event
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: updated.status,
      message: 'Campaign updated successfully',
    });

    return formatCampaign(updated);
  }

  // ==========================================
  // DELETE CAMPAIGN
  // ==========================================
  async delete(organizationId: string, campaignId: string): Promise<{ message: string }> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status === 'RUNNING') {
      throw new AppError('Cannot delete running campaign. Pause or cancel it first.', 400);
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    console.log(`✅ Campaign deleted: ${campaignId}`);

    // ✅ Emit campaign deleted event
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'DELETED',
      message: 'Campaign deleted successfully',
    });

    return { message: 'Campaign deleted successfully' };
  }

  // ==========================================
  // START CAMPAIGN - ✅ WITH ROBUST CHECKS
  // ==========================================
  async start(organizationId: string, campaignId: string): Promise<CampaignResponse> {
    console.log('🚀 Starting campaign:', { id: campaignId, organizationId });

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: {
        template: true,
        whatsappAccount: true,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status === 'RUNNING') {
      throw new AppError('Campaign is already running', 400);
    }

    if (!campaign.whatsappAccountId) {
      throw new AppError('No WhatsApp account connected to this campaign', 400);
    }

    if (!campaign.templateId) {
      throw new AppError('No template selected for this campaign', 400);
    }

    // ✅ CRITICAL: Check if campaign has contacts
    const contactCount = await prisma.campaignContact.count({
      where: { campaignId },
    });

    console.log(`📊 Campaign has ${contactCount} contacts`);

    if (contactCount === 0) {
      throw new AppError('Campaign has no contacts. Please add contacts first.', 400);
    }

    // ✅ Check pending contacts
    const pendingCount = await prisma.campaignContact.count({
      where: {
        campaignId,
        status: { in: ['PENDING', 'QUEUED'] } as any,
      },
    });

    console.log(`📋 Pending contacts: ${pendingCount}`);

    if (pendingCount === 0) {
      throw new AppError('No pending contacts to send. All contacts may have been processed.', 400);
    }

    // Update campaign status
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'RUNNING',
        startedAt: campaign.startedAt || new Date(),
      },
      include: {
        template: { select: { name: true } },
        whatsappAccount: { select: { phoneNumber: true } },
        contactGroup: { select: { name: true } },
      } as any,
    });

    console.log('✅ Campaign status updated to RUNNING');

    // ✅ Emit campaign started event
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'RUNNING',
      message: 'Campaign started successfully',
      totalContacts: contactCount,
    });

    // ✅ CRITICAL: Start processing contacts
    console.log('🔄 Starting contact processing...');
    this.processCampaignContacts(campaignId, organizationId).catch((error) => {
      console.error('❌ Campaign processing error:', error);
    });

    return formatCampaign(updatedCampaign);
  }

  // ✅ PROCESS CAMPAIGN CONTACTS - Optimized for high speed with concurrency
  private async processCampaignContacts(campaignId: string, organizationId: string): Promise<void> {
    console.log(`📤 Processing contacts for campaign: ${campaignId}`);

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { template: true, whatsappAccount: true },
    });

    if (!campaign || !campaign.template || !campaign.whatsappAccount) {
      console.error('❌ Campaign, template or WhatsApp account not found');
      return;
    }

    // Validate template is approved
    if (campaign.template.status !== 'APPROVED') {
      console.error(`❌ Template "${campaign.template.name}" is not APPROVED (status: ${campaign.template.status})`);
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED', completedAt: new Date() },
      });
      return;
    }

    // Decrypt access token
    const rawToken = campaign.whatsappAccount.accessToken;
    let accessToken: string | null = null;
    if (rawToken?.startsWith('EAA')) {
      accessToken = rawToken;
    } else if (rawToken) {
      accessToken = safeDecrypt(rawToken);
    }

    if (!accessToken || !accessToken.startsWith('EAA')) {
      console.error('❌ Invalid WhatsApp access token. Please reconnect the account.');
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED', completedAt: new Date() },
      });
      return;
    }

    const phoneNumberId = campaign.whatsappAccount.phoneNumberId;
    const template = campaign.template;

    // Concurrency settings: 15 messages in parallel
    const CONCURRENCY = 15;
    const BATCH_SIZE = 500;

    let processedCount = 0;
    let sentCount = campaign.sentCount || 0;
    let failedCount = campaign.failedCount || 0;
    let hasMore = true;

    while (hasMore) {
      // Check if campaign is still RUNNING
      const currentCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      });

      if (currentCampaign?.status !== 'RUNNING') {
        console.log('⏸️ Campaign paused/cancelled, stopping');
        break;
      }

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

      console.log(`📦 Processing batch of ${contacts.length} contacts (${CONCURRENCY} concurrent)`);

      // Mark batch as QUEUED
      await prisma.campaignContact.updateMany({
        where: { id: { in: contacts.map(c => c.id) } },
        data: { status: 'QUEUED' as any },
      });

      // Process in smaller concurrent chunks
      for (let i = 0; i < contacts.length; i += CONCURRENCY) {
        // Occasionally re-check campaign status
        if (i > 0 && i % (CONCURRENCY * 4) === 0) {
          const isRunning = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: { status: true },
          });
          if (isRunning?.status !== 'RUNNING') break;
        }

        const chunk = contacts.slice(i, i + CONCURRENCY);
        
        await Promise.all(chunk.map(async (campaignContact) => {
          const contact = (campaignContact as any).contact;
          const phone = contact?.phone;

          if (!phone) {
            await prisma.campaignContact.update({
              where: { id: campaignContact.id },
              data: { status: 'FAILED', failureReason: 'No phone number', failedAt: new Date() },
            });
            failedCount++;
            return;
          }

          try {
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            const variables = (campaignContact as any).variables || {};
            const campaignMeta = (campaign as any).templateMetadata || {};

            // Build template components
            const components: any[] = [];

            // 1. Handle Header (Media/Text)
            if (template.headerType && template.headerType !== 'NONE') {
              const hType = template.headerType.toUpperCase();
              if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(hType)) {
                // Get media from campaign metadata or use fallback from template
                const mediaUrl = campaignMeta.header?.link || campaignMeta.headerUrl || template.headerContent;
                if (mediaUrl) {
                  components.push({
                    type: 'header',
                    parameters: [
                      {
                        type: hType.toLowerCase(),
                        [hType.toLowerCase()]: {
                          link: mediaUrl,
                        },
                      },
                    ],
                  });
                }
              } else if (hType === 'TEXT' && template.headerContent?.includes('{{1}}')) {
                // Header text variables (usually just 1)
                components.push({
                  type: 'header',
                  parameters: [
                    {
                      type: 'text',
                      text: String(variables['header_var_1'] || variables['var_0'] || 'Hello'),
                    },
                  ],
                });
              }
            }

            // 2. Handle Body
            const bodyText = template.bodyText || '';
            const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
            if (matches.length > 0) {
              components.push({
                type: 'body',
                parameters: matches.map((_: string, idx: number) => ({
                  type: 'text',
                  text: String(variables[`var_${idx + 1}`] || variables[idx + 1] || 'N/A'),
                })),
              });
            }

            // ✅ DIRECT SEND
            const result = await metaApi.sendMessage(
              phoneNumberId,
              accessToken!,
              cleanPhone,
              {
                type: 'template',
                template: {
                  name: template.name,
                  language: { code: template.language || 'en_US' },
                  ...(components.length > 0 ? { components } : {}),
                },
              }
            );

            const waMessageId = result.messageId;
            const now = new Date();

            // Update campaign contact to SENT
            await prisma.campaignContact.update({
              where: { id: campaignContact.id },
              data: { status: 'SENT', waMessageId, sentAt: now },
            });

            // Non-blocking background save for message/conversation
            this.saveCampaignMessage(
              organizationId,
              campaignId,
              campaignContact.contactId,
              campaign.whatsappAccountId!,
              waMessageId,
              template.name,
              template.language || 'en_US',
              [], 
              template.id,
              campaign.name
            ).catch(() => {});

            sentCount++;
            processedCount++;

            // Socket notification
            campaignSocketService.emitContactStatus(organizationId, campaignId, {
              contactId: campaignContact.contactId,
              phone: cleanPhone,
              status: 'SENT',
              messageId: waMessageId,
            });

          } catch (error: any) {
            let failureReason = error.message || 'Unknown error';
            
            // Detailed failure reason from Meta
            if (error.response?.data?.error) {
              const me = error.response.data.error;
              failureReason = `${me.message} (Code: ${me.code}, Subcode: ${me.error_subcode || 'N/A'})`;
              
              // Map common error codes to user-friendly messages
              if (me.code === 131030) failureReason = 'Recipient phone number is not registered with WhatsApp.';
              if (me.code === 131026) failureReason = 'Message undeliverable - User may have blocked or the number is invalid.';
              if (me.code === 132000) failureReason = 'Template mismatch or invalid parameters.';
            }

            console.error(`❌ Failed to send to ${phone}:`, failureReason);

            await prisma.campaignContact.update({
              where: { id: campaignContact.id },
              data: {
                status: 'FAILED',
                failureReason: failureReason.substring(0, 500),
                failedAt: new Date(),
              },
            });

            failedCount++;
            processedCount++;

            campaignSocketService.emitContactStatus(organizationId, campaignId, {
              contactId: campaignContact.contactId,
              phone: phone.replace(/[^0-9]/g, ''),
              status: 'FAILED',
              error: failureReason.length > 200 ? failureReason.substring(0, 197) + '...' : failureReason,
            });
          }
        }));

        // Update campaign counters after each concurrent chunk
        await this.updateCampaignCounters(campaignId, organizationId, sentCount, failedCount);
      }
    }

    console.log(`✅ Campaign ${campaignId} done: ${sentCount} sent, ${failedCount} failed`);

    // Final completion check
    const finalCampaignStatus = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true, sentCount: true, failedCount: true, deliveredCount: true, readCount: true, totalContacts: true },
    });

    if (finalCampaignStatus?.status === 'RUNNING') {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      campaignSocketService.emitCampaignCompleted(organizationId, campaignId, {
        sentCount: finalCampaignStatus.sentCount,
        failedCount: finalCampaignStatus.failedCount,
        deliveredCount: finalCampaignStatus.deliveredCount,
        readCount: finalCampaignStatus.readCount,
        totalRecipients: finalCampaignStatus.totalContacts,
      });

      console.log(`🏁 Campaign ${campaignId} marked COMPLETED`);
    }
  }

  // Helper: update campaign sent/failed counters + emit progress socket
  private async updateCampaignCounters(
    campaignId: string,
    organizationId: string,
    sent: number,
    failed: number
  ): Promise<void> {
    try {
      const updated = await prisma.campaign.update({
        where: { id: campaignId },
        data: { sentCount: sent, failedCount: failed },
        select: { totalContacts: true, deliveredCount: true, readCount: true, status: true },
      });

      const processed = sent + failed;
      const percentage = Math.round((processed / (updated.totalContacts || 1)) * 100);

      campaignSocketService.emitCampaignProgress(organizationId, campaignId, {
        sent,
        failed,
        delivered: updated.deliveredCount,
        read: updated.readCount,
        total: updated.totalContacts,
        percentage,
        status: updated.status,
      });
    } catch (e) {
      // Non-fatal
    }
  }

  // UPDATE CAMPAIGN STATS (used after resume/manual refresh - NOT for completion tracking)
  private async updateCampaignStats(campaignId: string): Promise<void> {
    const stats = await prisma.campaignContact.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });

    const statusCounts: Record<string, number> = {};
    stats.forEach((stat) => {
      statusCounts[stat.status] = stat._count;
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        totalContacts: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        sentCount: statusCounts.SENT || 0,
        deliveredCount: statusCounts.DELIVERED || 0,
        readCount: statusCounts.READ || 0,
        failedCount: statusCounts.FAILED || 0,
      },
    });

    console.log('📊 Campaign stats updated:', statusCounts);

    // ✅ FIXED: Check BOTH PENDING and QUEUED — don't mark complete if messages are still in queue
    const remainingCount = await prisma.campaignContact.count({
      where: { campaignId, status: { in: ['PENDING', 'QUEUED'] } }
    });

    if (remainingCount === 0) {
      // Verify all contacts are truly done (SENT/DELIVERED/READ/FAILED)
      const totalCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);
      const doneCount = (statusCounts.SENT || 0) + (statusCounts.DELIVERED || 0) +
        (statusCounts.READ || 0) + (statusCounts.FAILED || 0);

      if (doneCount >= totalCount && totalCount > 0) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'COMPLETED', completedAt: new Date() }
        });
        console.log(`🏁 Campaign ${campaignId} marked as COMPLETED (via updateCampaignStats)`);
      }
    }
  }

  // ==========================================
  // PAUSE/RESUME/CANCEL
  // ==========================================
  async pause(organizationId: string, campaignId: string): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status !== 'RUNNING') {
      throw new AppError('Only running campaigns can be paused', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
      include: {
        template: { select: { name: true } },
        whatsappAccount: { select: { phoneNumber: true } },
        contactGroup: { select: { name: true } },
      } as any,
    });

    console.log(`⏸️ Campaign paused: ${campaignId}`);

    // ✅ Emit campaign paused event
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'PAUSED',
      message: 'Campaign paused',
    });

    return formatCampaign(updated);
  }

  async resume(organizationId: string, campaignId: string): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status !== 'PAUSED') {
      throw new AppError('Only paused campaigns can be resumed', 400);
    }

    const accountData = await metaService.getAccountWithToken(campaign.whatsappAccountId);

    if (!accountData || !accountData.accessToken.startsWith('EAA')) {
      throw new AppError(
        'WhatsApp account token is invalid. Please reconnect before resuming.',
        400
      );
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
      include: {
        template: { select: { name: true } },
        whatsappAccount: { select: { phoneNumber: true } },
        contactGroup: { select: { name: true } },
      } as any,
    });

    console.log(`▶️ Campaign resumed: ${campaignId}`);

    // ✅ Emit campaign resumed event
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'RUNNING',
      message: 'Campaign resumed',
    });

    // Resume sending
    this.processCampaignContacts(campaignId, organizationId);

    return formatCampaign(updated);
  }

  async cancel(organizationId: string, campaignId: string): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (['COMPLETED', 'FAILED'].includes(campaign.status)) {
      throw new AppError('Campaign is already finished', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
      include: {
        template: { select: { name: true } },
        whatsappAccount: { select: { phoneNumber: true } },
        contactGroup: { select: { name: true } },
      } as any,
    });

    console.log(`❌ Campaign cancelled: ${campaignId}`);

    // ✅ Emit campaign cancelled event
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'FAILED',
      message: 'Campaign cancelled by user',
    });

    return formatCampaign(updated);
  }

  // ==========================================
  // GET CAMPAIGN CONTACTS
  // ==========================================
  async getContacts(
    organizationId: string,
    campaignId: string,
    query: CampaignContactsQueryInput
  ): Promise<{ contacts: CampaignContactResponse[]; meta: any }> {
    const { page = 1, limit = 50, status } = query;
    const skip = (page - 1) * limit;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const where: Prisma.CampaignContactWhereInput = {
      campaignId,
    };

    if (status) {
      where.status = status;
    }

    const [contacts, total] = await Promise.all([
      prisma.campaignContact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: {
            select: {
              phone: true,
              countryCode: true,
              firstName: true,
              lastName: true,
            },
          },
        } as any,
      }),
      prisma.campaignContact.count({ where }),
    ]);

    return {
      contacts: contacts.map(formatCampaignContact),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // RETRY FAILED MESSAGES
  // ==========================================
  async retry(
    organizationId: string,
    campaignId: string,
    retryFailed: boolean = true,
    retryPending: boolean = false
  ): Promise<{ message: string; retryCount: number }> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const accountData = await metaService.getAccountWithToken(campaign.whatsappAccountId);

    if (!accountData || !accountData.accessToken.startsWith('EAA')) {
      throw new AppError(
        'WhatsApp account token is invalid. Please reconnect before retrying.',
        400
      );
    }

    const statusesToRetry: MessageStatus[] = [];
    if (retryFailed) statusesToRetry.push('FAILED');
    if (retryPending) statusesToRetry.push('PENDING');

    if (statusesToRetry.length === 0) {
      throw new AppError('No retry options selected', 400);
    }

    const result = await prisma.campaignContact.updateMany({
      where: {
        campaignId,
        status: { in: statusesToRetry },
      },
      data: {
        status: 'PENDING',
        retryCount: { increment: 1 },
        failedAt: null,
        failureReason: null,
      },
    });

    if (['COMPLETED', 'FAILED'].includes(campaign.status)) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'RUNNING' },
      });

      // ✅ Emit retry started event
      campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
        status: 'RUNNING',
        message: `Retrying ${result.count} messages`,
      });

      // Resume sending
      this.processCampaignContacts(campaignId, organizationId);
    }

    console.log(`🔄 Campaign retry: ${result.count} messages queued`);

    return {
      message: `${result.count} messages queued for retry`,
      retryCount: result.count,
    };
  }

  // ==========================================
  // DUPLICATE CAMPAIGN
  // ==========================================
  async duplicate(
    organizationId: string,
    campaignId: string,
    newName: string
  ): Promise<CampaignResponse> {
    const original = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!original) {
      throw new AppError('Campaign not found', 404);
    }

    const originalContacts = await prisma.campaignContact.findMany({
      where: { campaignId },
      select: { contactId: true },
    });

    const duplicate = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.campaign.create({
        data: {
          organizationId,
          name: newName,
          description: original.description,
          templateId: original.templateId,
          whatsappAccountId: original.whatsappAccountId,
          contactGroupId: original.contactGroupId,
          audienceFilter:
            original.audienceFilter === null ? undefined : toJsonValue(original.audienceFilter),
          status: 'DRAFT',
          totalContacts: originalContacts.length,
          createdById: (original as any).createdById,
        } as any,
        include: {
          template: { select: { name: true } },
          whatsappAccount: { select: { phoneNumber: true } },
          contactGroup: { select: { name: true } },
        } as any,
      });

      if (originalContacts.length > 0) {
        await tx.campaignContact.createMany({
          data: originalContacts.map((c) => ({
            id: uuidv4(),
            campaignId: newCampaign.id,
            contactId: c.contactId,
            status: 'PENDING' as MessageStatus,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        });
      }

      return newCampaign;
    });

    console.log(`📋 Campaign duplicated: ${campaignId} → ${duplicate.id}`);

    // ✅ Emit duplicate created event
    campaignSocketService.emitCampaignUpdate(organizationId, duplicate.id, {
      status: 'DRAFT',
      message: 'Campaign duplicated successfully',
      totalContacts: originalContacts.length,
    });

    return formatCampaign(duplicate);
  }

  private async shouldStopCampaign(campaignId: string): Promise<boolean> {
    const currentCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });

    return !currentCampaign || currentCampaign.status !== 'RUNNING';
  }

  private async saveCampaignMessage(
    organizationId: string,
    campaignId: string,
    contactId: string,
    accountId: string,
    waMessageId: string,
    templateName: string,
    templateLang: string,
    params: string[],
    templateId: string,
    campaignName: string
  ): Promise<void> {
    try {
      let conversation = await prisma.conversation.findFirst({
        where: {
          organizationId,
          contactId,
        },
      });

      const now = new Date();
      const windowExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organization: { connect: { id: organizationId } },
            contact: { connect: { id: contactId } },
            lastMessageAt: now,
            lastMessagePreview: `Template: ${templateName}`,
            lastCustomerMessageAt: null,
            windowExpiresAt: windowExpiry,
            isWindowOpen: true,
            unreadCount: 0,
            isRead: true,
          },
        });
        console.log(`✅ New conversation created: ${conversation.id}`);
      } else {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: now,
            lastMessagePreview: `Template: ${templateName}`,
            windowExpiresAt: windowExpiry,
            isWindowOpen: true,
          },
        });
      }

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          whatsappAccountId: accountId,
          waMessageId: waMessageId,
          wamId: waMessageId,
          direction: 'OUTBOUND',
          type: 'TEMPLATE',
          content: JSON.stringify({
            templateName,
            language: templateLang,
            params,
          }),
          status: 'SENT',
          templateId,
          sentAt: now,
          metadata: {
            campaignId,
            campaignName,
          },
        },
      });

      console.log(`💾 Campaign message saved with conversation: ${waMessageId}`);
    } catch (saveErr: any) {
      console.error('⚠️ Failed to save campaign message:', saveErr.message);
    }
  }

  // ==========================================
  // GET CAMPAIGN STATS
  // ==========================================
  async getStats(organizationId: string): Promise<CampaignStats> {
    try {
      const stats = await prisma.campaign.aggregate({
        where: { organizationId },
        _count: { id: true },
        _sum: {
          totalContacts: true,
          sentCount: true,
          deliveredCount: true,
          readCount: true,
          failedCount: true,
        },
      });

      const statusCounts = await prisma.campaign.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      });

      const total = stats._count.id || 0;
      const totalSent = stats._sum.sentCount || 0;
      const totalDelivered = stats._sum.deliveredCount || 0;
      const totalRead = stats._sum.readCount || 0;

      const getStatusCount = (status: CampaignStatus) =>
        statusCounts.find((s) => s.status === status)?._count || 0;

      const deliveryRate =
        totalSent > 0 ? Number(((totalDelivered / totalSent) * 100).toFixed(1)) : 0;

      const readRate =
        totalDelivered > 0 ? Number(((totalRead / totalDelivered) * 100).toFixed(1)) : 0;

      return {
        total,
        draft: getStatusCount('DRAFT'),
        scheduled: getStatusCount('SCHEDULED'),
        active: getStatusCount('RUNNING'), // ✅ Map running to active
        running: getStatusCount('RUNNING'),
        completed: getStatusCount('COMPLETED'),
        failed: getStatusCount('FAILED'),
        paused: getStatusCount('PAUSED'),
        totalSent,        // ✅ Match frontend: totalSent
        totalDelivered,   // ✅ Match frontend: totalDelivered
        totalRead,        // ✅ Match frontend: totalRead
        totalMessagesSent: totalSent,
        totalMessagesDelivered: totalDelivered,
        totalMessagesRead: totalRead,
        averageDeliveryRate: deliveryRate,
        averageReadRate: readRate,
      };
    } catch (error: any) {
      if (error.code === 'P2024') {
        return {
          total: 0,
          draft: 0,
          scheduled: 0,
          active: 0,
          running: 0,
          completed: 0,
          failed: 0,
          paused: 0,
          totalSent: 0,
          totalDelivered: 0,
          totalRead: 0,
          totalMessagesSent: 0,
          totalMessagesDelivered: 0,
          totalMessagesRead: 0,
          averageDeliveryRate: 0,
          averageReadRate: 0,
        };
      }

      throw new AppError('Failed to fetch campaign statistics', 500);
    }
  }

  // ==========================================
  // GET CAMPAIGN ANALYTICS
  // ==========================================
  async getAnalytics(organizationId: string, campaignId: string): Promise<CampaignAnalytics> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const statusCounts = await prisma.campaignContact.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { status: true },
    });

    const totalContacts = campaign.totalContacts || 1;
    const statusBreakdown = statusCounts.map((s) => ({
      status: s.status,
      count: s._count.status,
      percentage: Math.round((s._count.status / totalContacts) * 100),
    }));

    return {
      hourlyStats: [],
      statusBreakdown,
    };
  }

  // ==========================================
  // UPDATE CAMPAIGN CONTACT STATUS - ✅ WITH SOCKET
  // ==========================================
  async updateContactStatus(
    organizationId: string,
    campaignId: string,
    contactId: string,
    status: MessageStatus,
    waMessageId?: string,
    failureReason?: string
  ): Promise<void> {
    const now = new Date();

    const updateData: Prisma.CampaignContactUpdateInput = {
      status,
      waMessageId,
    };

    switch (status) {
      case 'SENT':
        updateData.sentAt = now;
        break;
      case 'DELIVERED':
        updateData.deliveredAt = now;
        break;
      case 'READ':
        updateData.readAt = now;
        break;
      case 'FAILED':
        updateData.failedAt = now;
        updateData.failureReason = failureReason;
        break;
    }

    await prisma.campaignContact.updateMany({
      where: {
        campaignId,
        contactId,
      },
      data: updateData,
    });

    const countField = `${status.toLowerCase()}Count`;
    if (['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(status)) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          [countField]: { increment: 1 },
        },
      });
    }

    // ✅ Emit status update via socket
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { phone: true },
    });

    if (contact) {
      campaignSocketService.emitContactStatus(organizationId, campaignId, {
        contactId,
        phone: contact.phone,
        status,
        messageId: waMessageId,
        error: failureReason,
      });
    }
  }

  // ==========================================
  // CHECK AND COMPLETE CAMPAIGN - ✅ WITH SOCKET
  // ==========================================
  async checkAndComplete(organizationId: string, campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.status !== 'RUNNING') return;

    const pendingCount = await prisma.campaignContact.count({
      where: {
        campaignId,
        status: { in: ['PENDING', 'QUEUED'] } as any,
      },
    });

    if (pendingCount === 0) {
      const updated = await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      console.log(`✅ Campaign completed: ${campaignId}`);

      // ✅ Emit campaign completed event
      campaignSocketService.emitCampaignCompleted(organizationId, campaignId, {
        sentCount: updated.sentCount,
        failedCount: updated.failedCount,
        deliveredCount: updated.deliveredCount,
        readCount: updated.readCount,
        totalRecipients: updated.totalContacts,
      });
    }
  }

  // ==========================================
  // GET FAILED CONTACTS
  // ==========================================
  async getFailedContacts(
    organizationId: string,
    campaignId: string,
    page: number = 1,
    limit: number = 100
  ): Promise<{ contacts: any[]; meta: any }> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      prisma.campaignContact.findMany({
        where: {
          campaignId,
          status: 'FAILED',
        },
        include: {
          contact: {
            select: {
              id: true,
              phone: true,
              countryCode: true,
              firstName: true,
              lastName: true,
              email: true,
              tags: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { failedAt: 'desc' },
      }),
      prisma.campaignContact.count({
        where: { campaignId, status: 'FAILED' },
      }),
    ]);

    return {
      contacts: contacts.map((cc) => ({
        id: cc.id,
        contactId: cc.contactId,
        phone: cc.contact.phone,
        fullName:
          [cc.contact.firstName, cc.contact.lastName].filter(Boolean).join(' ') ||
          cc.contact.phone,
        email: cc.contact.email,
        tags: cc.contact.tags,
        failureReason: cc.failureReason,
        failedAt: cc.failedAt,
        retryCount: cc.retryCount,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // EXPORT FAILED CONTACTS AS CSV
  // ==========================================
  async exportFailedContactsCsv(organizationId: string, campaignId: string): Promise<string> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const contacts = await prisma.campaignContact.findMany({
      where: {
        campaignId,
        status: 'FAILED',
      },
      include: {
        contact: {
          select: {
            phone: true,
            countryCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { failedAt: 'desc' },
    });

    // Build CSV
    const headers = [
      'Phone',
      'First Name',
      'Last Name',
      'Email',
      'Failure Reason',
      'Failed At',
      'Retry Count',
    ];
    const rows = contacts.map((cc) => [
      cc.contact.phone,
      cc.contact.firstName || '',
      cc.contact.lastName || '',
      cc.contact.email || '',
      (cc.failureReason || '').replace(/,/g, ';'),
      cc.failedAt ? new Date(cc.failedAt).toISOString() : '',
      cc.retryCount.toString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  // ==========================================
  // RETRY FAILED CONTACTS
  // ==========================================
  async retryFailedContacts(
    organizationId: string,
    campaignId: string,
    specificContactIds?: string[]
  ): Promise<{ message: string; retryCount: number }> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { whatsappAccount: true, template: true },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    // Build where clause
    const whereClause: any = {
      campaignId,
      status: 'FAILED',
    };

    if (specificContactIds && specificContactIds.length > 0) {
      whereClause.contactId = { in: specificContactIds };
    }

    // Reset failed contacts to PENDING
    const result = await prisma.campaignContact.updateMany({
      where: whereClause,
      data: {
        status: 'PENDING',
        failedAt: null,
        failureReason: null,
        retryCount: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new AppError('No failed contacts to retry', 400);
    }

    // Update campaign status if it was completed/failed
    if (['COMPLETED', 'FAILED'].includes(campaign.status)) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'RUNNING',
          failedCount: { decrement: result.count },
        },
      });

      // Emit socket event
      campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
        status: 'RUNNING',
        message: `Retrying ${result.count} failed messages`,
      });

      // Restart processing
      this.processCampaignContacts(campaignId, organizationId);
    }

    console.log(`🔄 Retrying ${result.count} failed contacts for campaign ${campaignId}`);

    return {
      message: `${result.count} failed contacts queued for retry`,
      retryCount: result.count,
    };
  }

  // ==========================================
  // GET ALL RECIPIENTS WITH STATUS
  // ==========================================
  async getAllRecipients(
    organizationId: string,
    campaignId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
    }
  ): Promise<{ recipients: any[]; meta: any; summary: any }> {
    const { page = 1, limit = 50, status, search } = options;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = { campaignId };

    if (status && status !== 'all') {
      whereClause.status = status.toUpperCase();
    }

    // Search in contact
    let contactWhere: any = undefined;
    if (search) {
      contactWhere = {
        OR: [
          { phone: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [recipients, total, statusCounts] = await Promise.all([
      prisma.campaignContact.findMany({
        where: {
          ...whereClause,
          ...(contactWhere ? { contact: contactWhere } : {}),
        },
        include: {
          contact: {
            select: {
              id: true,
              phone: true,
              countryCode: true,
              firstName: true,
              lastName: true,
              email: true,
              whatsappProfileName: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.campaignContact.count({
        where: {
          ...whereClause,
          ...(contactWhere ? { contact: contactWhere } : {}),
        },
      }),
      prisma.campaignContact.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: true,
      }),
    ]);

    // Build summary
    const summary: Record<string, number> = {
      total: 0,
      pending: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    };

    statusCounts.forEach((sc) => {
      const key = sc.status.toLowerCase();
      summary[key] = sc._count;
      summary.total += sc._count;
    });

    return {
      recipients: recipients.map((r) => ({
        id: r.id,
        contactId: r.contactId,
        phone: r.contact.phone,
        fullName:
          (r.contact as any).whatsappProfileName ||
          [r.contact.firstName, r.contact.lastName].filter(Boolean).join(' ') ||
          r.contact.phone,
        email: r.contact.email,
        status: r.status,
        waMessageId: r.waMessageId,
        sentAt: r.sentAt,
        deliveredAt: r.deliveredAt,
        readAt: r.readAt,
        failedAt: r.failedAt,
        failureReason: r.failureReason,
        retryCount: r.retryCount,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    };
  }

  // ==========================================
  // EXPORT RECIPIENTS AS CSV
  // ==========================================
  async exportRecipientsCsv(
    organizationId: string,
    campaignId: string,
    status?: string
  ): Promise<string> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const whereClause: any = { campaignId };
    if (status && status !== 'all') {
      whereClause.status = status.toUpperCase();
    }

    const recipients = await prisma.campaignContact.findMany({
      where: whereClause,
      include: {
        contact: {
          select: {
            phone: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV
    const headers = [
      'Phone',
      'First Name',
      'Last Name',
      'Email',
      'Status',
      'Message ID',
      'Sent At',
      'Delivered At',
      'Read At',
      'Failed At',
      'Failure Reason',
      'Retry Count',
    ];

    const rows = recipients.map((r) => [
      r.contact.phone,
      r.contact.firstName || '',
      r.contact.lastName || '',
      r.contact.email || '',
      r.status,
      r.waMessageId || '',
      r.sentAt ? new Date(r.sentAt).toISOString() : '',
      r.deliveredAt ? new Date(r.deliveredAt).toISOString() : '',
      r.readAt ? new Date(r.readAt).toISOString() : '',
      r.failedAt ? new Date(r.failedAt).toISOString() : '',
      (r.failureReason || '').replace(/,/g, ';'),
      r.retryCount.toString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  // ==========================================
  // ✅ GET CAMPAIGN CONTACTS WITH STATUS (Enhanced)
  // ==========================================
  async getCampaignContacts(
    organizationId: string,
    campaignId: string,
    query: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
    }
  ) {
    const { page = 1, limit = 50, status, search } = query;
    const skip = (page - 1) * limit;

    // Verify campaign belongs to organization
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const where: any = { campaignId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.contact = {
        OR: [
          { phone: { contains: search } },
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
              avatar: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.campaignContact.count({ where }),
    ]);

    // Format response
    const formatted = contacts.map((cc) => ({
      id: cc.id,
      contactId: cc.contactId,
      phone: cc.contact.phone,
      name: [cc.contact.firstName, cc.contact.lastName].filter(Boolean).join(' ') || cc.contact.phone,
      avatar: cc.contact.avatar,
      status: cc.status,
      waMessageId: cc.waMessageId,
      sentAt: cc.sentAt,
      deliveredAt: cc.deliveredAt,
      readAt: cc.readAt,
      failedAt: cc.failedAt,
      failureReason: cc.failureReason,
      retryCount: cc.retryCount,
      updatedAt: cc.updatedAt,
    }));

    return {
      contacts: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total,
        pending: await prisma.campaignContact.count({ where: { ...where, status: 'PENDING' } }),
        sent: await prisma.campaignContact.count({ where: { ...where, status: 'SENT' } }),
        delivered: await prisma.campaignContact.count({ where: { ...where, status: 'DELIVERED' } }),
        read: await prisma.campaignContact.count({ where: { ...where, status: 'READ' } }),
        failed: await prisma.campaignContact.count({ where: { ...where, status: 'FAILED' } }),
      },
    };
  }

  // ==========================================
  // ✅ RETRY FAILED CONTACTS
  // ==========================================
  async retryFailed(organizationId: string, campaignId: string, contactIds?: string[]) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { whatsappAccount: true, template: true },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get failed contacts
    const where: any = {
      campaignId,
      status: 'FAILED',
    };

    if (contactIds && contactIds.length > 0) {
      where.contactId = { in: contactIds };
    }

    // Reset status to PENDING
    const result = await prisma.campaignContact.updateMany({
      where,
      data: {
        status: 'PENDING',
        failureReason: null,
        failedAt: null,
        retryCount: { increment: 1 },
      },
    });

    console.log(`🔄 Reset ${result.count} contacts for retry`);

    // Resume campaign if not running
    if (campaign.status !== 'RUNNING') {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'RUNNING' },
      });
    }

    // Trigger send
    const { whatsappService } = await import('../whatsapp/whatsapp.service');
    whatsappService.sendCampaignMessages(campaignId).catch((err) => {
      console.error('Retry campaign send error:', err);
    });

    return { retriedCount: result.count };
  }

  // ==========================================
  // ✅ RESUME PENDING
  // ==========================================
  async resumePending(organizationId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const pendingCount = await prisma.campaignContact.count({
      where: { campaignId, status: 'PENDING' },
    });

    if (pendingCount === 0) {
      throw new Error('No pending contacts to send');
    }

    // Update status
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
    });

    // Trigger send
    const { whatsappService } = await import('../whatsapp/whatsapp.service');
    whatsappService.sendCampaignMessages(campaignId).catch((err) => {
      console.error('Resume campaign error:', err);
    });

    return { pendingCount };
  }

  // ==========================================
  // ✅ GET DETAILED STATS
  // ==========================================
  async getDetailedStats(organizationId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const [
      totalContacts,
      pending,
      queued,
      sent,
      delivered,
      read,
      failed,
      failureReasons,
    ] = await Promise.all([
      prisma.campaignContact.count({ where: { campaignId } }),
      prisma.campaignContact.count({ where: { campaignId, status: 'PENDING' } }),
      prisma.campaignContact.count({ where: { campaignId, status: 'QUEUED' } }),
      prisma.campaignContact.count({ where: { campaignId, status: 'SENT' } }),
      prisma.campaignContact.count({ where: { campaignId, status: 'DELIVERED' } }),
      prisma.campaignContact.count({ where: { campaignId, status: 'READ' } }),
      prisma.campaignContact.count({ where: { campaignId, status: 'FAILED' } }),
      prisma.campaignContact.groupBy({
        by: ['failureReason'],
        where: { campaignId, status: 'FAILED', failureReason: { not: null } },
        _count: true,
      }),
    ]);

    return {
      totalContacts,
      pending,
      queued,
      sent,
      delivered,
      read,
      failed,
      failureReasons: failureReasons.map((fr) => ({
        reason: fr.failureReason || 'Unknown',
        count: fr._count,
      })),
      successRate: totalContacts > 0 
        ? Math.round(((delivered + read) / totalContacts) * 100) 
        : 0,
      deliveryRate: sent > 0 
        ? Math.round(((delivered + read) / sent) * 100) 
        : 0,
      readRate: delivered > 0 
        ? Math.round((read / delivered) * 100) 
        : 0,
    };
  }
}

export const campaignsService = new CampaignsService();