"use strict";
// ✅ CREATE: src/modules/automation/automation.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.automationService = exports.AutomationService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
class AutomationService {
    // ==========================================
    // GET ALL AUTOMATIONS
    // ==========================================
    async getAll(organizationId) {
        const automations = await database_1.default.automation.findMany({
            where: { organizationId },
            orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        });
        return automations.map((a) => ({
            ...a,
            actions: a.actions,
            triggerConfig: a.triggerConfig,
        }));
    }
    // ==========================================
    // GET AUTOMATION BY ID
    // ==========================================
    async getById(organizationId, automationId) {
        const automation = await database_1.default.automation.findFirst({
            where: { id: automationId, organizationId },
        });
        if (!automation) {
            throw new errorHandler_1.AppError('Automation not found', 404);
        }
        return {
            ...automation,
            actions: automation.actions,
            triggerConfig: automation.triggerConfig,
        };
    }
    // ==========================================
    // CREATE AUTOMATION
    // ==========================================
    async create(organizationId, input) {
        // Validate actions
        if (!input.actions || input.actions.length === 0) {
            throw new errorHandler_1.AppError('At least one action is required', 400);
        }
        const automation = await database_1.default.automation.create({
            data: {
                organizationId,
                name: input.name,
                description: input.description,
                trigger: input.trigger,
                triggerConfig: input.triggerConfig || {},
                actions: input.actions,
                isActive: input.isActive || false,
                targetGroupIds: input.targetGroupIds || [],
                excludeExisting: input.excludeExisting ?? true,
            },
        });
        console.log(`✅ Automation created: ${automation.id}`);
        return {
            ...automation,
            actions: automation.actions,
            triggerConfig: automation.triggerConfig,
        };
    }
    // ==========================================
    // UPDATE AUTOMATION
    // ==========================================
    async update(organizationId, automationId, input) {
        const automation = await database_1.default.automation.findFirst({
            where: { id: automationId, organizationId },
        });
        if (!automation) {
            throw new errorHandler_1.AppError('Automation not found', 404);
        }
        const updated = await database_1.default.automation.update({
            where: { id: automationId },
            data: {
                name: input.name,
                description: input.description,
                trigger: input.trigger,
                triggerConfig: input.triggerConfig !== undefined ? input.triggerConfig : undefined,
                actions: input.actions !== undefined ? input.actions : undefined,
                isActive: input.isActive,
                targetGroupIds: input.targetGroupIds,
                excludeExisting: input.excludeExisting,
            },
        });
        console.log(`✅ Automation updated: ${automationId}`);
        return {
            ...updated,
            actions: updated.actions,
            triggerConfig: updated.triggerConfig,
        };
    }
    // ==========================================
    // DELETE AUTOMATION
    // ==========================================
    async delete(organizationId, automationId) {
        const automation = await database_1.default.automation.findFirst({
            where: { id: automationId, organizationId },
        });
        if (!automation) {
            throw new errorHandler_1.AppError('Automation not found', 404);
        }
        await database_1.default.automation.delete({
            where: { id: automationId },
        });
        console.log(`✅ Automation deleted: ${automationId}`);
        return { message: 'Automation deleted successfully' };
    }
    // ==========================================
    // TOGGLE AUTOMATION STATUS
    // ==========================================
    async toggle(organizationId, automationId) {
        const automation = await database_1.default.automation.findFirst({
            where: { id: automationId, organizationId },
        });
        if (!automation) {
            throw new errorHandler_1.AppError('Automation not found', 404);
        }
        const updated = await database_1.default.automation.update({
            where: { id: automationId },
            data: {
                isActive: !automation.isActive,
            },
        });
        console.log(`✅ Automation ${automationId} is now ${updated.isActive ? 'ACTIVE' : 'INACTIVE'}`);
        return {
            ...updated,
            actions: updated.actions,
            triggerConfig: updated.triggerConfig,
        };
    }
    // ==========================================
    // GET ACTIVE AUTOMATIONS BY TRIGGER
    // ==========================================
    async getActiveByTrigger(organizationId, trigger) {
        const automations = await database_1.default.automation.findMany({
            where: {
                organizationId,
                trigger,
                isActive: true,
            },
        });
        return automations.map((a) => ({
            ...a,
            actions: a.actions,
            triggerConfig: a.triggerConfig,
            targetGroupIds: a.targetGroupIds || [],
            excludeExisting: a.excludeExisting ?? true,
        }));
    }
    // ==========================================
    // INCREMENT EXECUTION COUNT
    // ==========================================
    async incrementExecutionCount(automationId) {
        await database_1.default.automation.update({
            where: { id: automationId },
            data: {
                executionCount: { increment: 1 },
                lastExecutedAt: new Date(),
            },
        });
    }
    // ==========================================
    // GET STATS
    // ==========================================
    async getStats(organizationId) {
        const [total, active, totalExecutions] = await Promise.all([
            database_1.default.automation.count({ where: { organizationId } }),
            database_1.default.automation.count({ where: { organizationId, isActive: true } }),
            database_1.default.automation.aggregate({
                where: { organizationId },
                _sum: { executionCount: true },
            }),
        ]);
        return {
            total,
            active,
            inactive: total - active,
            totalExecutions: totalExecutions._sum.executionCount || 0,
        };
    }
}
exports.AutomationService = AutomationService;
exports.automationService = new AutomationService();
//# sourceMappingURL=automation.service.js.map