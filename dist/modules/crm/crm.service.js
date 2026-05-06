"use strict";
// ✅ CREATE: src/modules/crm/crm.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.crmService = exports.CRMService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
class CRMService {
    // ==========================================
    // PIPELINE MANAGEMENT
    // ==========================================
    async createDefaultPipeline(organizationId) {
        const existing = await database_1.default.pipeline.findFirst({
            where: { organizationId, isDefault: true },
            include: { stages: { orderBy: { order: 'asc' } } },
        });
        if (existing)
            return existing;
        return database_1.default.pipeline.create({
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
    async getPipelines(organizationId) {
        const pipelines = await database_1.default.pipeline.findMany({
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
    async createPipeline(organizationId, data) {
        return database_1.default.pipeline.create({
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
    async getLeads(organizationId, options) {
        const page = Number(options.page) || 1;
        const limit = Number(options.limit) || 50;
        const skip = (page - 1) * limit;
        const { status, pipelineId, stageId, search, assignedToId } = options;
        const where = { organizationId };
        if (status)
            where.status = status;
        if (pipelineId)
            where.pipelineId = pipelineId;
        if (stageId)
            where.stageId = stageId;
        if (assignedToId)
            where.assignedToId = assignedToId;
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { contact: { phone: { contains: search } } },
                { contact: { firstName: { contains: search, mode: 'insensitive' } } },
            ];
        }
        const [leads, total] = await Promise.all([
            database_1.default.lead.findMany({
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
            database_1.default.lead.count({ where }),
        ]);
        return {
            leads,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }
    async getLeadById(organizationId, leadId) {
        const lead = await database_1.default.lead.findFirst({
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
        if (!lead)
            throw new errorHandler_1.AppError('Lead not found', 404);
        return lead;
    }
    async createLead(organizationId, userId, data) {
        // Get default pipeline if not specified
        let pipelineId = data.pipelineId;
        let stageId = data.stageId;
        if (!pipelineId) {
            const defaultPipeline = await database_1.default.pipeline.findFirst({
                where: { organizationId, isDefault: true },
                include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
            });
            if (!defaultPipeline) {
                const newPipeline = await this.createDefaultPipeline(organizationId);
                pipelineId = newPipeline.id;
                stageId = newPipeline.stages[0]?.id;
            }
            else {
                pipelineId = defaultPipeline.id;
                stageId = stageId || defaultPipeline.stages[0]?.id;
            }
        }
        const lead = await database_1.default.lead.create({
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
    async updateLead(organizationId, leadId, userId, data) {
        const lead = await database_1.default.lead.findFirst({
            where: { id: leadId, organizationId },
            include: { stage: true },
        });
        if (!lead)
            throw new errorHandler_1.AppError('Lead not found', 404);
        const activities = [];
        // Track stage change
        if (data.stageId && data.stageId !== lead.stageId) {
            const newStage = await database_1.default.pipelineStage.findUnique({ where: { id: data.stageId } });
            activities.push({
                type: 'STAGE_CHANGE',
                title: `Moved to ${newStage?.name}`,
                userId,
                metadata: { fromStage: lead.stage?.name, toStage: newStage?.name },
            });
            // Auto-update status based on stage
            if (newStage?.isWon)
                data.status = 'WON';
            if (newStage?.isLost)
                data.status = 'LOST';
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
        const updated = await database_1.default.lead.update({
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
    async deleteLead(organizationId, leadId) {
        const lead = await database_1.default.lead.findFirst({
            where: { id: leadId, organizationId },
        });
        if (!lead)
            throw new errorHandler_1.AppError('Lead not found', 404);
        await database_1.default.lead.delete({ where: { id: leadId } });
        return { message: 'Lead deleted successfully' };
    }
    // ==========================================
    // LEAD NOTES
    // ==========================================
    async addLeadNote(organizationId, leadId, userId, content) {
        const lead = await database_1.default.lead.findFirst({
            where: { id: leadId, organizationId },
        });
        if (!lead)
            throw new errorHandler_1.AppError('Lead not found', 404);
        const [note] = await Promise.all([
            database_1.default.leadNote.create({
                data: { leadId, userId, content },
            }),
            database_1.default.leadActivity.create({
                data: { leadId, userId, type: 'NOTE', title: 'Added a note' },
            }),
            database_1.default.lead.update({
                where: { id: leadId },
                data: { lastActivityAt: new Date() },
            }),
        ]);
        return note;
    }
    async getLeadNotes(organizationId, leadId) {
        const lead = await database_1.default.lead.findFirst({
            where: { id: leadId, organizationId },
        });
        if (!lead)
            throw new errorHandler_1.AppError('Lead not found', 404);
        return database_1.default.leadNote.findMany({
            where: { leadId },
            orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        });
    }
    // ==========================================
    // LEAD TASKS
    // ==========================================
    async addLeadTask(organizationId, leadId, userId, data) {
        const lead = await database_1.default.lead.findFirst({
            where: { id: leadId, organizationId },
        });
        if (!lead)
            throw new errorHandler_1.AppError('Lead not found', 404);
        const task = await database_1.default.leadTask.create({
            data: {
                leadId,
                userId,
                title: data.title,
                description: data.description,
                dueDate: data.dueDate,
                priority: data.priority || 'MEDIUM',
            },
        });
        await database_1.default.leadActivity.create({
            data: { leadId, userId, type: 'TASK', title: `Created task: ${data.title}` },
        });
        return task;
    }
    async completeTask(organizationId, taskId, userId) {
        const task = await database_1.default.leadTask.findUnique({
            where: { id: taskId },
            include: { lead: true },
        });
        if (!task || task.lead.organizationId !== organizationId) {
            throw new errorHandler_1.AppError('Task not found', 404);
        }
        const updated = await database_1.default.leadTask.update({
            where: { id: taskId },
            data: { isCompleted: true, completedAt: new Date() },
        });
        await database_1.default.leadActivity.create({
            data: { leadId: task.leadId, userId, type: 'TASK', title: `Completed task: ${task.title}` },
        });
        return updated;
    }
    // ==========================================
    // CONTACT NOTES
    // ==========================================
    async addContactNote(organizationId, contactId, userId, content) {
        const contact = await database_1.default.contact.findFirst({
            where: { id: contactId, organizationId },
        });
        if (!contact)
            throw new errorHandler_1.AppError('Contact not found', 404);
        return database_1.default.contactNote.create({
            data: { contactId, userId, content },
        });
    }
    async getContactNotes(organizationId, contactId) {
        const contact = await database_1.default.contact.findFirst({
            where: { id: contactId, organizationId },
        });
        if (!contact)
            throw new errorHandler_1.AppError('Contact not found', 404);
        return database_1.default.contactNote.findMany({
            where: { contactId },
            orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        });
    }
    // ==========================================
    // CRM STATS
    // ==========================================
    async getStats(organizationId) {
        const [totalLeads, newLeads, wonLeads, lostLeads, totalValue, wonValue, leadsByStage,] = await Promise.all([
            database_1.default.lead.count({ where: { organizationId } }),
            database_1.default.lead.count({ where: { organizationId, status: 'NEW' } }),
            database_1.default.lead.count({ where: { organizationId, status: 'WON' } }),
            database_1.default.lead.count({ where: { organizationId, status: 'LOST' } }),
            database_1.default.lead.aggregate({
                where: { organizationId },
                _sum: { value: true },
            }),
            database_1.default.lead.aggregate({
                where: { organizationId, status: 'WON' },
                _sum: { value: true },
            }),
            database_1.default.lead.groupBy({
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
    async syncFromContacts(organizationId, userId) {
        // 1. Get default pipeline and stage
        let pipeline = await database_1.default.pipeline.findFirst({
            where: { organizationId, isDefault: true },
            include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
        });
        if (!pipeline) {
            pipeline = await this.createDefaultPipeline(organizationId);
        }
        const stageId = pipeline.stages[0]?.id;
        if (!stageId)
            throw new errorHandler_1.AppError('No pipeline stage found', 400);
        // 2. Find contacts not already leads
        const contacts = await database_1.default.contact.findMany({
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
            pipelineId: pipeline.id,
            stageId,
            status: 'NEW',
            priority: 'MEDIUM',
            source: c.source || 'sync',
        }));
        // Note: Using create as separate calls to ensure activities are created
        const results = await Promise.allSettled(leadData.map(data => this.createLead(organizationId, userId, data)));
        const successfulCount = results.filter(r => r.status === 'fulfilled').length;
        return {
            message: `Successfully synced ${successfulCount} contacts to CRM`,
            synced: successfulCount,
        };
    }
}
exports.CRMService = CRMService;
exports.crmService = new CRMService();
//# sourceMappingURL=crm.service.js.map