"use strict";
// src/modules/automation/automation.service.ts - FIXED
// ✅ FIX 1: getActiveByTrigger now handles undefined organizationId (global query)
// ✅ FIX 2: Added getGlobalActiveByTrigger for cron jobs
// ✅ FIX 3: Better error handling with P2024 skip
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.automationService = exports.AutomationService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
class AutomationService {
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
    async getById(organizationId, automationId) {
        const automation = await database_1.default.automation.findFirst({
            where: { id: automationId, organizationId },
        });
        if (!automation)
            throw new errorHandler_1.AppError('Automation not found', 404);
        return {
            ...automation,
            actions: automation.actions,
            triggerConfig: automation.triggerConfig,
        };
    }
    async create(organizationId, input) {
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
    async update(organizationId, automationId, input) {
        const automation = await database_1.default.automation.findFirst({
            where: { id: automationId, organizationId },
        });
        if (!automation)
            throw new errorHandler_1.AppError('Automation not found', 404);
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
    async delete(organizationId, automationId) {
        const automation = await database_1.default.automation.findFirst({
            where: { id: automationId, organizationId },
        });
        if (!automation)
            throw new errorHandler_1.AppError('Automation not found', 404);
        await database_1.default.automation.delete({ where: { id: automationId } });
        console.log(`✅ Automation deleted: ${automationId}`);
        return { message: 'Automation deleted successfully' };
    }
    async toggle(organizationId, automationId) {
        const automation = await database_1.default.automation.findFirst({
            where: { id: automationId, organizationId },
        });
        if (!automation)
            throw new errorHandler_1.AppError('Automation not found', 404);
        const updated = await database_1.default.automation.update({
            where: { id: automationId },
            data: { isActive: !automation.isActive },
        });
        console.log(`✅ Automation ${automationId} is now ${updated.isActive ? 'ACTIVE' : 'INACTIVE'}`);
        return {
            ...updated,
            actions: updated.actions,
            triggerConfig: updated.triggerConfig,
        };
    }
    /**
     * ✅ FIXED: Get active automations by trigger
     * - If organizationId provided: filter by that org (for webhook triggers)
     * - If organizationId undefined: return ALL orgs (for cron jobs)
     */
    async getActiveByTrigger(organizationId, trigger) {
        try {
            const where = { trigger, isActive: true };
            // ✅ Only add organizationId filter if provided
            if (organizationId) {
                where.organizationId = organizationId;
            }
            const automations = await database_1.default.automation.findMany({
                where,
                // ✅ Include organization info for cron jobs (no orgId filter)
                select: {
                    id: true,
                    organizationId: true,
                    name: true,
                    description: true,
                    trigger: true,
                    triggerConfig: true,
                    actions: true,
                    isActive: true,
                    executionCount: true,
                    lastExecutedAt: true,
                    targetGroupIds: true,
                    excludeExisting: true,
                    createdAt: true,
                    updatedAt: true,
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
        catch (error) {
            if (error?.code === 'P2024') {
                console.warn(`⚠️ getActiveByTrigger(${trigger}) skipped: DB pool busy`);
                return [];
            }
            throw error;
        }
    }
    async incrementExecutionCount(automationId) {
        try {
            await database_1.default.automation.update({
                where: { id: automationId },
                data: {
                    executionCount: { increment: 1 },
                    lastExecutedAt: new Date(),
                },
            });
        }
        catch (error) {
            if (error?.code !== 'P2024') {
                console.error('Failed to increment execution count:', error);
            }
        }
    }
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