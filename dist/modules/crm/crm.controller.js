"use strict";
// ✅ CREATE: src/modules/crm/crm.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.crmController = exports.CRMController = void 0;
const crm_service_1 = require("./crm.service");
const response_1 = require("../../utils/response");
class CRMController {
    // Pipelines
    async getPipelines(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const pipelines = await crm_service_1.crmService.getPipelines(orgId);
            return (0, response_1.sendSuccess)(res, pipelines, 'Pipelines fetched');
        }
        catch (e) {
            next(e);
        }
    }
    async createPipeline(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const pipeline = await crm_service_1.crmService.createPipeline(orgId, req.body);
            return (0, response_1.sendSuccess)(res, pipeline, 'Pipeline created', 201);
        }
        catch (e) {
            next(e);
        }
    }
    // Leads
    async getLeads(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const result = await crm_service_1.crmService.getLeads(orgId, req.query);
            return res.json({ success: true, data: result.leads, meta: result.meta });
        }
        catch (e) {
            next(e);
        }
    }
    async getLeadById(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const lead = await crm_service_1.crmService.getLeadById(orgId, req.params.id);
            return (0, response_1.sendSuccess)(res, lead, 'Lead fetched');
        }
        catch (e) {
            next(e);
        }
    }
    async createLead(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const lead = await crm_service_1.crmService.createLead(orgId, req.user.id, req.body);
            return (0, response_1.sendSuccess)(res, lead, 'Lead created', 201);
        }
        catch (e) {
            next(e);
        }
    }
    async updateLead(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const lead = await crm_service_1.crmService.updateLead(orgId, req.params.id, req.user.id, req.body);
            return (0, response_1.sendSuccess)(res, lead, 'Lead updated');
        }
        catch (e) {
            next(e);
        }
    }
    async deleteLead(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const result = await crm_service_1.crmService.deleteLead(orgId, req.params.id);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (e) {
            next(e);
        }
    }
    // Notes
    async addLeadNote(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const note = await crm_service_1.crmService.addLeadNote(orgId, req.params.id, req.user.id, req.body.content);
            return (0, response_1.sendSuccess)(res, note, 'Note added', 201);
        }
        catch (e) {
            next(e);
        }
    }
    async getLeadNotes(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const notes = await crm_service_1.crmService.getLeadNotes(orgId, req.params.id);
            return (0, response_1.sendSuccess)(res, notes, 'Notes fetched');
        }
        catch (e) {
            next(e);
        }
    }
    // Tasks
    async addLeadTask(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const task = await crm_service_1.crmService.addLeadTask(orgId, req.params.id, req.user.id, req.body);
            return (0, response_1.sendSuccess)(res, task, 'Task created', 201);
        }
        catch (e) {
            next(e);
        }
    }
    async completeTask(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const task = await crm_service_1.crmService.completeTask(orgId, req.params.taskId, req.user.id);
            return (0, response_1.sendSuccess)(res, task, 'Task completed');
        }
        catch (e) {
            next(e);
        }
    }
    // Contact Notes
    async addContactNote(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const note = await crm_service_1.crmService.addContactNote(orgId, req.params.contactId, req.user.id, req.body.content);
            return (0, response_1.sendSuccess)(res, note, 'Note added', 201);
        }
        catch (e) {
            next(e);
        }
    }
    async getContactNotes(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const notes = await crm_service_1.crmService.getContactNotes(orgId, req.params.contactId);
            return (0, response_1.sendSuccess)(res, notes, 'Notes fetched');
        }
        catch (e) {
            next(e);
        }
    }
    // Stats
    async getStats(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const stats = await crm_service_1.crmService.getStats(orgId);
            return (0, response_1.sendSuccess)(res, stats, 'Stats fetched');
        }
        catch (e) {
            next(e);
        }
    }
    async syncFromContacts(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const userId = req.user.id;
            const result = await crm_service_1.crmService.syncFromContacts(orgId, userId);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (e) {
            next(e);
        }
    }
    async getSettings(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const settings = await crm_service_1.crmService.getOrCreateSettings(orgId);
            return (0, response_1.sendSuccess)(res, settings, 'Settings fetched');
        }
        catch (e) {
            next(e);
        }
    }
    async updateSettings(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const settings = await crm_service_1.crmService.updateSettings(orgId, req.body);
            return (0, response_1.sendSuccess)(res, settings, 'Settings updated');
        }
        catch (e) {
            next(e);
        }
    }
    async getHotLeads(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const result = await crm_service_1.crmService.getLeads(orgId, {
                minScore: 70,
                status: 'NEW',
                limit: 20,
            });
            return (0, response_1.sendSuccess)(res, result.leads, 'Hot leads fetched');
        }
        catch (e) {
            next(e);
        }
    }
    async getChatbotLeads(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const result = await crm_service_1.crmService.getLeads(orgId, {
                chatbotQualified: true,
                limit: req.query.limit,
                page: req.query.page,
            });
            return res.json({ success: true, data: result.leads, meta: result.meta });
        }
        catch (e) {
            next(e);
        }
    }
    async getInterestedLeads(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const result = await crm_service_1.crmService.getInterestedLeads(orgId, req.query);
            return res.json({
                success: true,
                data: result,
                message: 'Interested leads fetched',
            });
        }
        catch (e) {
            next(e);
        }
    }
}
exports.CRMController = CRMController;
exports.crmController = new CRMController();
//# sourceMappingURL=crm.controller.js.map