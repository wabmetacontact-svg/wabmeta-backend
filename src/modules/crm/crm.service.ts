// ✅ CREATE: src/modules/crm/crm.service.ts

import { Prisma, LeadStatus, LeadPriority } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export class CRMService {
    // ==========================================
    // PIPELINE MANAGEMENT
    // ==========================================

    async createDefaultPipeline(organizationId: string) {
        const existing = await prisma.pipeline.findFirst({
            where: { organizationId, isDefault: true },
            include: { stages: { orderBy: { order: 'asc' } } },
        });

        if (existing) return existing;

        return prisma.pipeline.create({
            data: {
                organizationId,
                name: 'Sales Pipeline',
                isDefault: true,
                stages: {
                    create: [
                        { name: 'New Lead', color: '#6B7280', order: 0, probability: 10 },
                        { name: 'Contacted', color: '#3B82F6', order: 1, probability: 20 },
                        { name: 'Qualified', color: '#8B5CF6', order: 2, probability: 40 },
                        { name: 'Proposal', color: '#F59E0B', order: 3, probability: 60 },
                        { name: 'Negotiation', color: '#EC4899', order: 4, probability: 80 },
                        { name: 'Won', color: '#10B981', order: 5, probability: 100, isWon: true },
                        { name: 'Lost', color: '#EF4444', order: 6, probability: 0, isLost: true },
                    ],
                },
            },
            include: { stages: { orderBy: { order: 'asc' } } },
        });
    }

    async getPipelines(organizationId: string) {
        const pipelines = await prisma.pipeline.findMany({
            where: { organizationId, isActive: true },
            include: {
                stages: { orderBy: { order: 'asc' } },
                _count: { select: { leads: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        if (pipelines.length === 0) {
            const defaultPipeline = await this.createDefaultPipeline(organizationId);
            return [defaultPipeline];
        }

        return pipelines;
    }

    async createPipeline(organizationId: string, data: {
        name: string;
        description?: string;
        stages?: { name: string; color?: string; probability?: number }[];
    }) {
        return prisma.pipeline.create({
            data: {
                organizationId,
                name: data.name,
                description: data.description,
                stages: data.stages ? {
                    create: data.stages.map((s, i) => ({
                        name: s.name,
                        color: s.color || '#6B7280',
                        order: i,
                        probability: s.probability || 0,
                    })),
                } : undefined,
            },
            include: { stages: { orderBy: { order: 'asc' } } },
        });
    }

    // ==========================================
    // LEAD MANAGEMENT
    // ==========================================

    async getLeads(organizationId: string, options: {
        page?: number | string;
        limit?: number | string;
        status?: LeadStatus;
        pipelineId?: string;
        stageId?: string;
        search?: string;
        assignedToId?: string;
    }) {
        const page = Number(options.page) || 1;
        const limit = Number(options.limit) || 50;
        const skip = (page - 1) * limit;

        const { status, pipelineId, stageId, search, assignedToId } = options;

        const where: Prisma.LeadWhereInput = { organizationId };

        if (status) where.status = status;
        if (pipelineId) where.pipelineId = pipelineId;
        if (stageId) where.stageId = stageId;
        if (assignedToId) where.assignedToId = assignedToId;
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { contact: { phone: { contains: search } } },
                { contact: { firstName: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                include: {
                    contact: {
                        select: { id: true, phone: true, firstName: true, lastName: true, email: true, avatar: true },
                    },
                    stage: { select: { id: true, name: true, color: true } },
                    pipeline: { select: { id: true, name: true } },
                    _count: { select: { activities: true, notes: true, tasks: true } },
                },
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' },
            }),
            prisma.lead.count({ where }),
        ]);

        return {
            leads,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getLeadById(organizationId: string, leadId: string) {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
            include: {
                contact: true,
                stage: true,
                pipeline: { include: { stages: { orderBy: { order: 'asc' } } } },
                activities: { orderBy: { createdAt: 'desc' }, take: 20 },
                notes: { orderBy: { isPinned: 'desc' }, take: 20 },
                tasks: { orderBy: { dueDate: 'asc' } },
            },
        });

        if (!lead) throw new AppError('Lead not found', 404);
        return lead;
    }

    async createLead(organizationId: string, userId: string, data: {
        title: string;
        contactId?: string;
        value?: number;
        pipelineId?: string;
        stageId?: string;
        source?: string;
        priority?: LeadPriority;
        expectedCloseDate?: Date;
    }) {
        // Get default pipeline if not specified
        let pipelineId = data.pipelineId;
        let stageId = data.stageId;

        if (!pipelineId) {
            const defaultPipeline = await prisma.pipeline.findFirst({
                where: { organizationId, isDefault: true },
                include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
            });

            if (!defaultPipeline) {
                const newPipeline = await this.createDefaultPipeline(organizationId);
                pipelineId = newPipeline.id;
                stageId = newPipeline.stages[0]?.id;
            } else {
                pipelineId = defaultPipeline.id;
                stageId = stageId || defaultPipeline.stages[0]?.id;
            }
        }

        const lead = await prisma.lead.create({
            data: {
                organizationId,
                title: data.title,
                contactId: data.contactId,
                value: data.value,
                pipelineId,
                stageId,
                source: data.source,
                priority: data.priority || 'MEDIUM',
                expectedCloseDate: data.expectedCloseDate,
                activities: {
                    create: {
                        type: 'NOTE',
                        title: 'Lead created',
                        userId,
                    },
                },
            },
            include: {
                contact: true,
                stage: true,
                pipeline: true,
            },
        });

        return lead;
    }

    async updateLead(organizationId: string, leadId: string, userId: string, data: {
        title?: string;
        value?: number;
        stageId?: string;
        status?: LeadStatus;
        priority?: LeadPriority;
        expectedCloseDate?: Date;
        assignedToId?: string;
    }) {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
            include: { stage: true },
        });

        if (!lead) throw new AppError('Lead not found', 404);

        const activities: Prisma.LeadActivityCreateManyLeadInput[] = [];

        // Track stage change
        if (data.stageId && data.stageId !== lead.stageId) {
            const newStage = await prisma.pipelineStage.findUnique({ where: { id: data.stageId } });
            activities.push({
                type: 'STAGE_CHANGE',
                title: `Moved to ${newStage?.name}`,
                userId,
                metadata: { fromStage: lead.stage?.name, toStage: newStage?.name },
            });

            // Auto-update status based on stage
            if (newStage?.isWon) data.status = 'WON';
            if (newStage?.isLost) data.status = 'LOST';
        }

        // Track status change
        if (data.status && data.status !== lead.status) {
            activities.push({
                type: 'STATUS_CHANGE',
                title: `Status changed to ${data.status}`,
                userId,
                metadata: { fromStatus: lead.status, toStatus: data.status },
            });
        }

        const updated = await prisma.lead.update({
            where: { id: leadId },
            data: {
                ...data,
                lastActivityAt: new Date(),
                ...(data.status === 'WON' || data.status === 'LOST' ? { actualCloseDate: new Date() } : {}),
                activities: activities.length > 0 ? { createMany: { data: activities } } : undefined,
            },
            include: { contact: true, stage: true, pipeline: true },
        });

        return updated;
    }

    async deleteLead(organizationId: string, leadId: string) {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });

        if (!lead) throw new AppError('Lead not found', 404);

        await prisma.lead.delete({ where: { id: leadId } });
        return { message: 'Lead deleted successfully' };
    }

    // ==========================================
    // LEAD NOTES
    // ==========================================

    async addLeadNote(organizationId: string, leadId: string, userId: string, content: string) {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });

        if (!lead) throw new AppError('Lead not found', 404);

        const [note] = await Promise.all([
            prisma.leadNote.create({
                data: { leadId, userId, content },
            }),
            prisma.leadActivity.create({
                data: { leadId, userId, type: 'NOTE', title: 'Added a note' },
            }),
            prisma.lead.update({
                where: { id: leadId },
                data: { lastActivityAt: new Date() },
            }),
        ]);

        return note;
    }

    async getLeadNotes(organizationId: string, leadId: string) {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });

        if (!lead) throw new AppError('Lead not found', 404);

        return prisma.leadNote.findMany({
            where: { leadId },
            orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        });
    }

    // ==========================================
    // LEAD TASKS
    // ==========================================

    async addLeadTask(organizationId: string, leadId: string, userId: string, data: {
        title: string;
        description?: string;
        dueDate?: Date;
        priority?: LeadPriority;
    }) {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });

        if (!lead) throw new AppError('Lead not found', 404);

        const task = await prisma.leadTask.create({
            data: {
                leadId,
                userId,
                title: data.title,
                description: data.description,
                dueDate: data.dueDate,
                priority: data.priority || 'MEDIUM',
            },
        });

        await prisma.leadActivity.create({
            data: { leadId, userId, type: 'TASK', title: `Created task: ${data.title}` },
        });

        return task;
    }

    async completeTask(organizationId: string, taskId: string, userId: string) {
        const task = await prisma.leadTask.findUnique({
            where: { id: taskId },
            include: { lead: true },
        });

        if (!task || task.lead.organizationId !== organizationId) {
            throw new AppError('Task not found', 404);
        }

        const updated = await prisma.leadTask.update({
            where: { id: taskId },
            data: { isCompleted: true, completedAt: new Date() },
        });

        await prisma.leadActivity.create({
            data: { leadId: task.leadId, userId, type: 'TASK', title: `Completed task: ${task.title}` },
        });

        return updated;
    }

    // ==========================================
    // CONTACT NOTES
    // ==========================================

    async addContactNote(organizationId: string, contactId: string, userId: string, content: string) {
        const contact = await prisma.contact.findFirst({
            where: { id: contactId, organizationId },
        });

        if (!contact) throw new AppError('Contact not found', 404);

        return prisma.contactNote.create({
            data: { contactId, userId, content },
        });
    }

    async getContactNotes(organizationId: string, contactId: string) {
        const contact = await prisma.contact.findFirst({
            where: { id: contactId, organizationId },
        });

        if (!contact) throw new AppError('Contact not found', 404);

        return prisma.contactNote.findMany({
            where: { contactId },
            orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        });
    }

    // ==========================================
    // CRM STATS
    // ==========================================

    async getStats(organizationId: string) {
        const [
            totalLeads,
            newLeads,
            wonLeads,
            lostLeads,
            totalValue,
            wonValue,
            leadsByStage,
        ] = await Promise.all([
            prisma.lead.count({ where: { organizationId } }),
            prisma.lead.count({ where: { organizationId, status: 'NEW' } }),
            prisma.lead.count({ where: { organizationId, status: 'WON' } }),
            prisma.lead.count({ where: { organizationId, status: 'LOST' } }),
            prisma.lead.aggregate({
                where: { organizationId },
                _sum: { value: true },
            }),
            prisma.lead.aggregate({
                where: { organizationId, status: 'WON' },
                _sum: { value: true },
            }),
            prisma.lead.groupBy({
                by: ['stageId'],
                where: { organizationId },
                _count: true,
                _sum: { value: true },
            }),
        ]);

        const winRate = totalLeads > 0 ? Math.round((wonLeads / (wonLeads + lostLeads || 1)) * 100) : 0;

        return {
            totalLeads,
            newLeads,
            wonLeads,
            lostLeads,
            totalValue: totalValue._sum.value || 0,
            wonValue: wonValue._sum.value || 0,
            winRate,
            leadsByStage,
        };
    }

    // ==========================================
    // CRM ONBOARDING
    // ==========================================

    async syncFromContacts(organizationId: string, userId: string) {
        // 1. Get default pipeline and stage
        let pipeline = await prisma.pipeline.findFirst({
            where: { organizationId, isDefault: true },
            include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
        });

        if (!pipeline) {
            pipeline = await this.createDefaultPipeline(organizationId);
        }

        const stageId = pipeline.stages[0]?.id;
        if (!stageId) throw new AppError('No pipeline stage found', 400);

        // 2. Find contacts not already leads
        const contacts = await prisma.contact.findMany({
            where: {
                organizationId,
                leads: { none: {} },
            },
            take: 50, // Onboard first 50 contacts
            orderBy: { lastMessageAt: 'desc' },
        });

        if (contacts.length === 0) {
            return { message: 'No new contacts to sync', synced: 0 };
        }

        // 3. Create leads
        const leadData = contacts.map(c => ({
            organizationId,
            contactId: c.id,
            title: `${c.firstName || 'Contact'} - ${c.phone}`,
            pipelineId: pipeline!.id,
            stageId,
            status: 'NEW' as LeadStatus,
            priority: 'MEDIUM' as LeadPriority,
            source: c.source || 'sync',
        }));

        // Note: Using create as separate calls to ensure activities are created
        const results = await Promise.allSettled(
            leadData.map(data => this.createLead(organizationId, userId, data))
        );

        const successfulCount = results.filter(r => r.status === 'fulfilled').length;

        return {
            message: `Successfully synced ${successfulCount} contacts to CRM`,
            synced: successfulCount,
        };
    }
}

export const crmService = new CRMService();