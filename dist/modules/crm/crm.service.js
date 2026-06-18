"use strict";
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
            const def = await this.createDefaultPipeline(organizationId);
            return [def];
        }
        return pipelines;
    }
    async createPipeline(organizationId, data) {
        return database_1.default.pipeline.create({
            data: {
                organizationId,
                name: data.name,
                description: data.description,
                stages: data.stages
                    ? {
                        create: data.stages.map((s, i) => ({
                            name: s.name,
                            color: s.color || '#6B7280',
                            order: i,
                            probability: s.probability || 0,
                        })),
                    }
                    : undefined,
            },
            include: { stages: { orderBy: { order: 'asc' } } },
        });
    }
    // ==========================================
    // ORGANIZATION SETTINGS
    // ==========================================
    async getOrCreateSettings(organizationId) {
        let settings = await database_1.default.organizationSettings.findUnique({
            where: { organizationId },
        });
        if (!settings) {
            settings = await database_1.default.organizationSettings.create({
                data: { organizationId },
            });
        }
        return settings;
    }
    async updateSettings(organizationId, data) {
        return database_1.default.organizationSettings.upsert({
            where: { organizationId },
            create: { organizationId, ...data },
            update: data,
        });
    }
    // ==========================================
    // SMART LEAD CREATION
    // ==========================================
    /**
     * ✅ MAIN: Smart lead create - duplicate protection + auto assign
     */
    async smartCreateLead(params) {
        const { organizationId, contactId, conversationId, source = 'chatbot', score = 0, priority, qualificationData = {}, chatbotQualified = false, } = params;
        // ✅ STEP 1: Duplicate check
        const existingLead = await database_1.default.lead.findFirst({
            where: {
                organizationId,
                contactId,
                status: { notIn: ['WON', 'LOST'] },
            },
            include: { stage: true, pipeline: true },
        });
        if (existingLead) {
            console.log(`♻️ Lead already exists: ${existingLead.id} - Updating...`);
            // ✅ Update existing lead with new data
            const updatedLead = await database_1.default.lead.update({
                where: { id: existingLead.id },
                data: {
                    // Only upgrade score, never downgrade
                    score: Math.max(existingLead.score || 0, score),
                    // Update qualification data
                    serviceInterest: params.serviceInterest || existingLead.serviceInterest,
                    budget: params.budget || existingLead.budget,
                    city: params.city || existingLead.city,
                    chatbotQualified: chatbotQualified || existingLead.chatbotQualified,
                    qualificationData: {
                        ...(existingLead.qualificationData || {}),
                        ...qualificationData,
                        lastUpdated: new Date().toISOString(),
                    },
                    // Upgrade priority if higher
                    priority: this.getHigherPriority(existingLead.priority, priority || 'MEDIUM'),
                    lastActivityAt: new Date(),
                },
                include: {
                    contact: true,
                    stage: true,
                    pipeline: true,
                },
            });
            // Add activity
            await database_1.default.leadActivity.create({
                data: {
                    leadId: existingLead.id,
                    type: 'NOTE',
                    title: 'Lead updated from chatbot qualification',
                    metadata: { score, qualificationData },
                },
            });
            return {
                lead: updatedLead,
                wasExisting: true,
                action: 'updated',
            };
        }
        // ✅ STEP 2: Get settings
        const settings = await this.getOrCreateSettings(organizationId);
        // ✅ STEP 3: Get pipeline
        let pipeline = await database_1.default.pipeline.findFirst({
            where: {
                organizationId,
                id: settings.defaultPipelineId || undefined,
                isActive: true,
            },
            include: { stages: { orderBy: { order: 'asc' } } },
        });
        if (!pipeline) {
            pipeline = await database_1.default.pipeline.findFirst({
                where: { organizationId, isDefault: true, isActive: true },
                include: { stages: { orderBy: { order: 'asc' } } },
            });
        }
        if (!pipeline) {
            pipeline = await this.createDefaultPipeline(organizationId);
        }
        const firstStage = pipeline.stages[0];
        // ✅ STEP 4: Get contact info for title
        const contact = await database_1.default.contact.findUnique({
            where: { id: contactId },
            select: {
                firstName: true,
                lastName: true,
                phone: true,
                whatsappProfileName: true,
            },
        });
        const contactDisplayName = contact?.whatsappProfileName ||
            [contact?.firstName, contact?.lastName].filter(Boolean).join(' ').trim() ||
            contact?.phone ||
            'Unknown';
        // ✅ STEP 5: Determine priority from score
        const autoPriority = priority || this.scoreToPriority(score);
        // ✅ STEP 6: Create lead
        const newLead = await database_1.default.lead.create({
            data: {
                organizationId,
                contactId,
                title: params.title || `${contactDisplayName} - WhatsApp Lead`,
                pipelineId: pipeline.id,
                stageId: firstStage?.id,
                status: 'NEW',
                priority: autoPriority,
                source,
                score,
                conversationId,
                serviceInterest: params.serviceInterest,
                budget: params.budget,
                city: params.city,
                adSource: params.adSource,
                adId: params.adId,
                campaignId: params.campaignId,
                chatbotQualified,
                qualificationData: {
                    ...qualificationData,
                    createdAt: new Date().toISOString(),
                },
                assignedToId: settings.autoAssignLeads
                    ? settings.defaultAssigneeId
                    : null,
                lastActivityAt: new Date(),
                activities: {
                    create: {
                        type: 'NOTE',
                        title: chatbotQualified
                            ? 'Lead created via chatbot qualification'
                            : 'Lead created from WhatsApp',
                        metadata: {
                            source,
                            score,
                            serviceInterest: params.serviceInterest,
                            budget: params.budget,
                            conversationId,
                        },
                    },
                },
            },
            include: {
                contact: true,
                stage: true,
                pipeline: true,
            },
        });
        // ✅ STEP 7: Add initial note if provided
        if (params.notes) {
            await database_1.default.leadNote.create({
                data: {
                    leadId: newLead.id,
                    content: params.notes,
                    isPinned: true,
                },
            });
        }
        // ✅ STEP 8: Send notification (non-blocking)
        this.notifyNewLead(organizationId, newLead, settings).catch((e) => console.error('Lead notification error:', e));
        console.log(`✅ Smart Lead Created: ${newLead.id} (score: ${score}, priority: ${autoPriority})`);
        return {
            lead: newLead,
            wasExisting: false,
            action: 'created',
        };
    }
    // ==========================================
    // SCORE BASED AUTO LEAD CREATION
    // ==========================================
    /**
     * ✅ Check karo ki score threshold pe lead banana chahiye ya nahi
     */
    async checkAndCreateLeadByScore(organizationId, contactId, currentScore, context) {
        const settings = await this.getOrCreateSettings(organizationId);
        if (settings.leadCreationMode === 'FLOW_BASED') {
            // Flow-based mode mein score se auto-create nahi hoga
            return false;
        }
        if (currentScore < settings.leadScoreThreshold) {
            console.log(`📊 Score ${currentScore} < threshold ${settings.leadScoreThreshold} - no lead yet`);
            return false;
        }
        console.log(`🎯 Score ${currentScore} >= threshold ${settings.leadScoreThreshold} - creating lead!`);
        await this.smartCreateLead({
            organizationId,
            contactId,
            conversationId: context.conversationId,
            source: context.source || 'score_based',
            score: currentScore,
            chatbotQualified: true,
            qualificationData: context.qualificationData,
        });
        return true;
    }
    // ==========================================
    // LEAD MANAGEMENT (existing + upgraded)
    // ==========================================
    async getLeads(organizationId, options) {
        const page = Number(options.page) || 1;
        const limit = Number(options.limit) || 50;
        const skip = (page - 1) * limit;
        const where = { organizationId };
        if (options.status)
            where.status = options.status;
        if (options.pipelineId)
            where.pipelineId = options.pipelineId;
        if (options.stageId)
            where.stageId = options.stageId;
        if (options.assignedToId)
            where.assignedToId = options.assignedToId;
        if (options.source)
            where.source = options.source;
        if (options.chatbotQualified !== undefined) {
            where.chatbotQualified = options.chatbotQualified === true || String(options.chatbotQualified) === 'true';
        }
        if (options.minScore !== undefined) {
            where.score = { gte: Number(options.minScore) };
        }
        if (options.search) {
            where.OR = [
                { title: { contains: options.search, mode: 'insensitive' } },
                { contact: { phone: { contains: options.search } } },
                { contact: { firstName: { contains: options.search, mode: 'insensitive' } } },
                { serviceInterest: { contains: options.search, mode: 'insensitive' } },
            ];
        }
        const [leads, total] = await Promise.all([
            database_1.default.lead.findMany({
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
                            whatsappProfileName: true,
                        },
                    },
                    stage: { select: { id: true, name: true, color: true } },
                    pipeline: { select: { id: true, name: true } },
                    _count: { select: { activities: true, notes: true, tasks: true } },
                },
                skip,
                take: limit,
                orderBy: [
                    { score: 'desc' }, // High score first
                    { updatedAt: 'desc' },
                ],
            }),
            database_1.default.lead.count({ where }),
        ]);
        return {
            leads,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }
    // ==========================================
    // INTERESTED LEADS - Dedicated Section
    // ==========================================
    async getInterestedLeads(organizationId, options = {}) {
        const page = Number(options.page) || 1;
        const limit = Number(options.limit) || 50;
        const skip = (page - 1) * limit;
        const where = {
            organizationId,
            chatbotQualified: true,
            status: { notIn: ['WON', 'LOST'] },
        };
        if (options.search) {
            where.OR = [
                { title: { contains: options.search, mode: 'insensitive' } },
                { serviceInterest: { contains: options.search, mode: 'insensitive' } },
                { contact: { phone: { contains: options.search } } },
                { contact: { firstName: { contains: options.search, mode: 'insensitive' } } },
            ];
        }
        const [leads, total] = await Promise.all([
            database_1.default.lead.findMany({
                where,
                include: {
                    contact: {
                        select: {
                            id: true, phone: true,
                            firstName: true, lastName: true,
                            email: true, avatar: true,
                            whatsappProfileName: true,
                        },
                    },
                    stage: { select: { id: true, name: true, color: true } },
                    pipeline: { select: { id: true, name: true } },
                    _count: { select: { activities: true, notes: true } },
                },
                orderBy: [
                    { score: 'desc' },
                    { createdAt: 'desc' },
                ],
                skip,
                take: limit,
            }),
            database_1.default.lead.count({ where }),
        ]);
        // ✅ Group by interest level
        const hot = leads.filter(l => l.score >= 70);
        const warm = leads.filter(l => l.score >= 40 && l.score < 70);
        const cold = leads.filter(l => l.score < 40);
        return {
            leads,
            grouped: { hot, warm, cold },
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
        let pipelineId = data.pipelineId;
        let stageId = data.stageId;
        if (!pipelineId) {
            const def = await database_1.default.pipeline.findFirst({
                where: { organizationId, isDefault: true },
                include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
            });
            if (!def) {
                const created = await this.createDefaultPipeline(organizationId);
                pipelineId = created.id;
                stageId = created.stages[0]?.id;
            }
            else {
                pipelineId = def.id;
                stageId = stageId || def.stages[0]?.id;
            }
        }
        return database_1.default.lead.create({
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
                score: data.score || 0,
                serviceInterest: data.serviceInterest,
                budget: data.budget,
                city: data.city,
                activities: {
                    create: {
                        type: 'NOTE',
                        title: 'Lead created',
                        userId,
                    },
                },
            },
            include: { contact: true, stage: true, pipeline: true },
        });
    }
    async updateLead(organizationId, leadId, userId, data) {
        const lead = await database_1.default.lead.findFirst({
            where: { id: leadId, organizationId },
            include: { stage: true },
        });
        if (!lead)
            throw new errorHandler_1.AppError('Lead not found', 404);
        const activities = [];
        if (data.stageId && data.stageId !== lead.stageId) {
            const newStage = await database_1.default.pipelineStage.findUnique({
                where: { id: data.stageId },
            });
            activities.push({
                type: 'STAGE_CHANGE',
                title: `Moved to ${newStage?.name}`,
                userId,
                metadata: { fromStage: lead.stage?.name, toStage: newStage?.name },
            });
            if (newStage?.isWon)
                data.status = 'WON';
            if (newStage?.isLost)
                data.status = 'LOST';
        }
        if (data.status && data.status !== lead.status) {
            activities.push({
                type: 'STATUS_CHANGE',
                title: `Status changed to ${data.status}`,
                userId,
                metadata: { fromStatus: lead.status, toStatus: data.status },
            });
        }
        return database_1.default.lead.update({
            where: { id: leadId },
            data: {
                ...data,
                lastActivityAt: new Date(),
                ...(data.status === 'WON' || data.status === 'LOST'
                    ? { actualCloseDate: new Date() }
                    : {}),
                activities: activities.length > 0
                    ? { createMany: { data: activities } }
                    : undefined,
            },
            include: { contact: true, stage: true, pipeline: true },
        });
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
    // LEAD NOTES & TASKS (unchanged)
    // ==========================================
    async addLeadNote(organizationId, leadId, userId, content) {
        const lead = await database_1.default.lead.findFirst({
            where: { id: leadId, organizationId },
        });
        if (!lead)
            throw new errorHandler_1.AppError('Lead not found', 404);
        const [note] = await Promise.all([
            database_1.default.leadNote.create({ data: { leadId, userId, content } }),
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
            data: {
                leadId,
                userId,
                type: 'TASK',
                title: `Created task: ${data.title}`,
            },
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
            data: {
                leadId: task.leadId,
                userId,
                type: 'TASK',
                title: `Completed task: ${task.title}`,
            },
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
        return database_1.default.contactNote.create({ data: { contactId, userId, content } });
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
    // STATS - UPGRADED
    // ==========================================
    async getStats(organizationId) {
        const [totalLeads, newLeads, wonLeads, lostLeads, chatbotLeads, adLeads, totalValueAgg, wonValueAgg, avgScoreAgg, hotLeads,] = await Promise.all([
            database_1.default.lead.count({ where: { organizationId } }),
            database_1.default.lead.count({ where: { organizationId, status: 'NEW' } }),
            database_1.default.lead.count({ where: { organizationId, status: 'WON' } }),
            database_1.default.lead.count({ where: { organizationId, status: 'LOST' } }),
            database_1.default.lead.count({
                where: { organizationId, chatbotQualified: true },
            }),
            database_1.default.lead.count({
                where: { organizationId, source: 'whatsapp_ad' },
            }),
            database_1.default.lead.aggregate({
                where: { organizationId },
                _sum: { value: true },
            }),
            database_1.default.lead.aggregate({
                where: { organizationId, status: 'WON' },
                _sum: { value: true },
            }),
            database_1.default.lead.aggregate({
                where: { organizationId },
                _avg: { score: true },
            }),
            database_1.default.lead.count({
                where: {
                    organizationId,
                    priority: 'HIGH',
                    status: { notIn: ['WON', 'LOST'] },
                },
            }),
        ]);
        const winRate = wonLeads + lostLeads > 0
            ? Math.round((wonLeads / (wonLeads + lostLeads)) * 100)
            : 0;
        return {
            totalLeads,
            newLeads,
            wonLeads,
            lostLeads,
            chatbotLeads,
            adLeads,
            hotLeads,
            totalValue: totalValueAgg._sum.value || 0,
            wonValue: wonValueAgg._sum.value || 0,
            averageScore: Math.round(avgScoreAgg._avg?.score || 0),
            winRate,
        };
    }
    // ==========================================
    // SYNC (unchanged)
    // ==========================================
    async syncFromContacts(organizationId, userId) {
        let pipeline = await database_1.default.pipeline.findFirst({
            where: { organizationId, isDefault: true },
            include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
        });
        if (!pipeline)
            pipeline = await this.createDefaultPipeline(organizationId);
        const stageId = pipeline.stages[0]?.id;
        if (!stageId)
            throw new errorHandler_1.AppError('No pipeline stage found', 400);
        const contacts = await database_1.default.contact.findMany({
            where: { organizationId, leads: { none: {} } },
            take: 50,
            orderBy: { lastMessageAt: 'desc' },
        });
        if (contacts.length === 0) {
            return { message: 'No new contacts to sync', synced: 0 };
        }
        const results = await Promise.allSettled(contacts.map((c) => this.createLead(organizationId, userId, {
            title: `${c.firstName || 'Contact'} - ${c.phone}`,
            contactId: c.id,
            pipelineId: pipeline.id,
            stageId,
            source: c.source || 'sync',
        })));
        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        return {
            message: `Successfully synced ${successCount} contacts to CRM`,
            synced: successCount,
        };
    }
    // ==========================================
    // HELPERS
    // ==========================================
    scoreToPriority(score) {
        if (score >= 80)
            return 'URGENT';
        if (score >= 60)
            return 'HIGH';
        if (score >= 40)
            return 'MEDIUM';
        return 'LOW';
    }
    getHigherPriority(a, b) {
        const order = {
            LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3,
        };
        return order[a] >= order[b] ? a : b;
    }
    async notifyNewLead(organizationId, lead, settings) {
        if (!settings.notifyOnNewLead)
            return;
        const notifyUserId = settings.notifyUserId ||
            (await database_1.default.organization.findUnique({
                where: { id: organizationId },
                select: { ownerId: true },
            }))?.ownerId;
        if (!notifyUserId)
            return;
        await database_1.default.notification.create({
            data: {
                userId: notifyUserId,
                organizationId,
                type: 'new_lead',
                title: '🎯 New Lead Created',
                description: `${lead.title} has been added to your CRM pipeline.`,
                actionUrl: `/dashboard/crm/leads/${lead.id}`,
                metadata: {
                    leadId: lead.id,
                    score: lead.score,
                    source: lead.source,
                    chatbotQualified: lead.chatbotQualified,
                },
            },
        });
        console.log(`🔔 Lead notification sent to user: ${notifyUserId}`);
    }
}
exports.CRMService = CRMService;
exports.crmService = new CRMService();
//# sourceMappingURL=crm.service.js.map