"use strict";
// ✅ CREATE: src/modules/automation/automation.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.automationController = exports.AutomationController = void 0;
const automation_service_1 = require("./automation.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middleware/errorHandler");
class AutomationController {
    // ==========================================
    // GET ALL AUTOMATIONS
    // ==========================================
    async getAll(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const automations = await automation_service_1.automationService.getAll(organizationId);
            return (0, response_1.sendSuccess)(res, automations, 'Automations fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET AUTOMATION BY ID
    // ==========================================
    async getById(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const automation = await automation_service_1.automationService.getById(organizationId, id);
            return (0, response_1.sendSuccess)(res, automation, 'Automation fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // CREATE AUTOMATION
    // ==========================================
    async create(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { name, description, trigger, triggerConfig, actions, isActive } = req.body;
            if (!name || !trigger || !actions) {
                throw new errorHandler_1.AppError('Name, trigger, and actions are required', 400);
            }
            const automation = await automation_service_1.automationService.create(organizationId, {
                name,
                description,
                trigger,
                triggerConfig,
                actions,
                isActive,
            });
            return (0, response_1.sendSuccess)(res, automation, 'Automation created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // UPDATE AUTOMATION
    // ==========================================
    async update(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const { name, description, trigger, triggerConfig, actions, isActive } = req.body;
            const automation = await automation_service_1.automationService.update(organizationId, id, {
                name,
                description,
                trigger,
                triggerConfig,
                actions,
                isActive,
            });
            return (0, response_1.sendSuccess)(res, automation, 'Automation updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DELETE AUTOMATION
    // ==========================================
    async delete(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const result = await automation_service_1.automationService.delete(organizationId, id);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // TOGGLE AUTOMATION STATUS
    // ==========================================
    async toggle(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const automation = await automation_service_1.automationService.toggle(organizationId, id);
            return (0, response_1.sendSuccess)(res, automation, `Automation ${automation.isActive ? 'activated' : 'paused'} successfully`);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET STATS
    // ==========================================
    async getStats(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const stats = await automation_service_1.automationService.getStats(organizationId);
            return (0, response_1.sendSuccess)(res, stats, 'Stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AutomationController = AutomationController;
exports.automationController = new AutomationController();
//# sourceMappingURL=automation.controller.js.map