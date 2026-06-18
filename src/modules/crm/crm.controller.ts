// ✅ CREATE: src/modules/crm/crm.controller.ts

import { Request, Response, NextFunction } from 'express';
import { crmService } from './crm.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

interface AuthRequest extends Request {
    user?: { id: string; email: string; organizationId?: string };
    params: any;
}

export class CRMController {
    // Pipelines
    async getPipelines(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const pipelines = await crmService.getPipelines(orgId);
            return sendSuccess(res, pipelines, 'Pipelines fetched');
        } catch (e) { next(e); }
    }

    async createPipeline(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const pipeline = await crmService.createPipeline(orgId, req.body);
            return sendSuccess(res, pipeline, 'Pipeline created', 201);
        } catch (e) { next(e); }
    }

    // Leads
    async getLeads(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const result = await crmService.getLeads(orgId, req.query as any);
            return res.json({ success: true, data: result.leads, meta: result.meta });
        } catch (e) { next(e); }
    }

    async getLeadById(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const lead = await crmService.getLeadById(orgId, req.params.id);
            return sendSuccess(res, lead, 'Lead fetched');
        } catch (e) { next(e); }
    }

    async createLead(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const lead = await crmService.createLead(orgId, req.user!.id, req.body);
            return sendSuccess(res, lead, 'Lead created', 201);
        } catch (e) { next(e); }
    }

    async updateLead(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const lead = await crmService.updateLead(orgId, req.params.id, req.user!.id, req.body);
            return sendSuccess(res, lead, 'Lead updated');
        } catch (e) { next(e); }
    }

    async deleteLead(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const result = await crmService.deleteLead(orgId, req.params.id);
            return sendSuccess(res, result, result.message);
        } catch (e) { next(e); }
    }

    // Notes
    async addLeadNote(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const note = await crmService.addLeadNote(orgId, req.params.id, req.user!.id, req.body.content);
            return sendSuccess(res, note, 'Note added', 201);
        } catch (e) { next(e); }
    }

    async getLeadNotes(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const notes = await crmService.getLeadNotes(orgId, req.params.id);
            return sendSuccess(res, notes, 'Notes fetched');
        } catch (e) { next(e); }
    }

    // Tasks
    async addLeadTask(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const task = await crmService.addLeadTask(orgId, req.params.id, req.user!.id, req.body);
            return sendSuccess(res, task, 'Task created', 201);
        } catch (e) { next(e); }
    }

    async completeTask(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const task = await crmService.completeTask(orgId, req.params.taskId, req.user!.id);
            return sendSuccess(res, task, 'Task completed');
        } catch (e) { next(e); }
    }

    // Contact Notes
    async addContactNote(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const note = await crmService.addContactNote(orgId, req.params.contactId, req.user!.id, req.body.content);
            return sendSuccess(res, note, 'Note added', 201);
        } catch (e) { next(e); }
    }

    async getContactNotes(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const notes = await crmService.getContactNotes(orgId, req.params.contactId);
            return sendSuccess(res, notes, 'Notes fetched');
        } catch (e) { next(e); }
    }

    // Stats
    async getStats(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const stats = await crmService.getStats(orgId);
            return sendSuccess(res, stats, 'Stats fetched');
        } catch (e) { next(e); }
    }

    async syncFromContacts(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const userId = req.user!.id;
            const result = await crmService.syncFromContacts(orgId, userId);
            return sendSuccess(res, result, result.message);
        } catch (e) { next(e); }
    }

    async getSettings(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const settings = await crmService.getOrCreateSettings(orgId);
            return sendSuccess(res, settings, 'Settings fetched');
        } catch (e) { next(e); }
    }

    async updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const settings = await crmService.updateSettings(orgId, req.body);
            return sendSuccess(res, settings, 'Settings updated');
        } catch (e) { next(e); }
    }

    async getHotLeads(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const result = await crmService.getLeads(orgId, {
                minScore: 70,
                status: 'NEW' as any,
                limit: 20,
            });
            return sendSuccess(res, result.leads, 'Hot leads fetched');
        } catch (e) { next(e); }
    }

    async getChatbotLeads(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId = req.user!.organizationId!;
            const result = await crmService.getLeads(orgId, {
                chatbotQualified: true,
                limit: req.query.limit as any,
                page: req.query.page as any,
            });
            return res.json({ success: true, data: result.leads, meta: result.meta });
        } catch (e) { next(e); }
    }

    async getInterestedLeads(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const orgId  = req.user!.organizationId!;
            const result = await crmService.getInterestedLeads(orgId, req.query as any);
            return res.json({
                success: true,
                data:    result,
                message: 'Interested leads fetched',
            });
        } catch (e) { next(e); }
    }
}

export const crmController = new CRMController();