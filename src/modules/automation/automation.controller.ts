// ✅ CREATE: src/modules/automation/automation.controller.ts

import { Request, Response, NextFunction } from 'express';
import { automationService } from './automation.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        organizationId?: string;
    };
}

export class AutomationController {
    // ==========================================
    // GET ALL AUTOMATIONS
    // ==========================================
    async getAll(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const organizationId = req.user!.organizationId;
            if (!organizationId) {
                throw new AppError('Organization context required', 400);
            }

            const automations = await automationService.getAll(organizationId);

            return sendSuccess(res, automations, 'Automations fetched successfully');
        } catch (error) {
            next(error);
        }
    }

    // ==========================================
    // GET AUTOMATION BY ID
    // ==========================================
    async getById(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const organizationId = req.user!.organizationId;
            if (!organizationId) {
                throw new AppError('Organization context required', 400);
            }

            const id = req.params.id as string;
            const automation = await automationService.getById(organizationId, id);

            return sendSuccess(res, automation, 'Automation fetched successfully');
        } catch (error) {
            next(error);
        }
    }

    // ==========================================
    // CREATE AUTOMATION
    // ==========================================
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const organizationId = req.user!.organizationId;
            if (!organizationId) {
                throw new AppError('Organization context required', 400);
            }

            const { name, description, trigger, triggerConfig, actions, isActive, targetGroupIds, excludeExisting } = req.body;

            if (!name || !trigger || !actions) {
                throw new AppError('Name, trigger, and actions are required', 400);
            }

            const automation = await automationService.create(organizationId, {
                name,
                description,
                trigger,
                triggerConfig,
                actions,
                isActive,
                targetGroupIds,
                excludeExisting,
            });

            return sendSuccess(res, automation, 'Automation created successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    // ==========================================
    // UPDATE AUTOMATION
    // ==========================================
    async update(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const organizationId = req.user!.organizationId;
            if (!organizationId) {
                throw new AppError('Organization context required', 400);
            }

            const id = req.params.id as string;
            const { name, description, trigger, triggerConfig, actions, isActive, targetGroupIds, excludeExisting } = req.body;

            const automation = await automationService.update(organizationId, id, {
                name,
                description,
                trigger,
                triggerConfig,
                actions,
                isActive,
                targetGroupIds,
                excludeExisting,
            });

            return sendSuccess(res, automation, 'Automation updated successfully');
        } catch (error) {
            next(error);
        }
    }

    // ==========================================
    // DELETE AUTOMATION
    // ==========================================
    async delete(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const organizationId = req.user!.organizationId;
            if (!organizationId) {
                throw new AppError('Organization context required', 400);
            }

            const id = req.params.id as string;
            const result = await automationService.delete(organizationId, id);

            return sendSuccess(res, result, result.message);
        } catch (error) {
            next(error);
        }
    }

    // ==========================================
    // TOGGLE AUTOMATION STATUS
    // ==========================================
    async toggle(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const organizationId = req.user!.organizationId;
            if (!organizationId) {
                throw new AppError('Organization context required', 400);
            }

            const id = req.params.id as string;
            const automation = await automationService.toggle(organizationId, id);

            return sendSuccess(
                res,
                automation,
                `Automation ${automation.isActive ? 'activated' : 'paused'} successfully`
            );
        } catch (error) {
            next(error);
        }
    }

    // ==========================================
    // GET STATS
    // ==========================================
    async getStats(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const organizationId = req.user!.organizationId;
            if (!organizationId) {
                throw new AppError('Organization context required', 400);
            }

            const stats = await automationService.getStats(organizationId);

            return sendSuccess(res, stats, 'Stats fetched successfully');
        } catch (error) {
            next(error);
        }
    }
}

export const automationController = new AutomationController();