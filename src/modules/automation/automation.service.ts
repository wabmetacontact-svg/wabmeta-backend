// ✅ CREATE: src/modules/automation/automation.service.ts

import { Prisma, AutomationTrigger } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

interface AutomationAction {
    id: string;
    type: string;
    config: any;
}

interface CreateAutomationInput {
    name: string;
    description?: string;
    trigger: AutomationTrigger;
    triggerConfig?: any;
    actions: AutomationAction[];
    isActive?: boolean;
    targetGroupIds?: string[];
    excludeExisting?: boolean;
}

interface UpdateAutomationInput {
    name?: string;
    description?: string;
    trigger?: AutomationTrigger;
    triggerConfig?: any;
    actions?: AutomationAction[];
    isActive?: boolean;
    targetGroupIds?: string[];
    excludeExisting?: boolean;
}

export class AutomationService {
    // ==========================================
    // GET ALL AUTOMATIONS
    // ==========================================
    async getAll(organizationId: string) {
        const automations = await prisma.automation.findMany({
            where: { organizationId },
            orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        });

        return automations.map((a) => ({
            ...a,
            actions: a.actions as unknown as AutomationAction[],
            triggerConfig: a.triggerConfig as any,
        }));
    }

    // ==========================================
    // GET AUTOMATION BY ID
    // ==========================================
    async getById(organizationId: string, automationId: string) {
        const automation = await prisma.automation.findFirst({
            where: { id: automationId, organizationId },
        });

        if (!automation) {
            throw new AppError('Automation not found', 404);
        }

        return {
            ...automation,
            actions: automation.actions as unknown as AutomationAction[],
            triggerConfig: automation.triggerConfig as any,
        };
    }

    // ==========================================
    // CREATE AUTOMATION
    // ==========================================
    async create(organizationId: string, input: CreateAutomationInput) {
        // Validate actions
        if (!input.actions || input.actions.length === 0) {
            throw new AppError('At least one action is required', 400);
        }

        const automation = await prisma.automation.create({
            data: {
                organizationId,
                name: input.name,
                description: input.description,
                trigger: input.trigger,
                triggerConfig: input.triggerConfig || {},
                actions: input.actions as any,
                isActive: input.isActive || false,
                targetGroupIds: input.targetGroupIds || [],
                excludeExisting: input.excludeExisting ?? true,
            },
        });

        console.log(`✅ Automation created: ${automation.id}`);

        return {
            ...automation,
            actions: automation.actions as unknown as AutomationAction[],
            triggerConfig: automation.triggerConfig as any,
        };
    }

    // ==========================================
    // UPDATE AUTOMATION
    // ==========================================
    async update(organizationId: string, automationId: string, input: UpdateAutomationInput) {
        const automation = await prisma.automation.findFirst({
            where: { id: automationId, organizationId },
        });

        if (!automation) {
            throw new AppError('Automation not found', 404);
        }

        const updated = await prisma.automation.update({
            where: { id: automationId },
            data: {
                name: input.name,
                description: input.description,
                trigger: input.trigger,
                triggerConfig: input.triggerConfig !== undefined ? input.triggerConfig : undefined,
                actions: input.actions !== undefined ? (input.actions as any) : undefined,
                isActive: input.isActive,
                targetGroupIds: input.targetGroupIds,
                excludeExisting: input.excludeExisting,
            },
        });

        console.log(`✅ Automation updated: ${automationId}`);

        return {
            ...updated,
            actions: updated.actions as unknown as AutomationAction[],
            triggerConfig: updated.triggerConfig as any,
        };
    }

    // ==========================================
    // DELETE AUTOMATION
    // ==========================================
    async delete(organizationId: string, automationId: string) {
        const automation = await prisma.automation.findFirst({
            where: { id: automationId, organizationId },
        });

        if (!automation) {
            throw new AppError('Automation not found', 404);
        }

        await prisma.automation.delete({
            where: { id: automationId },
        });

        console.log(`✅ Automation deleted: ${automationId}`);

        return { message: 'Automation deleted successfully' };
    }

    // ==========================================
    // TOGGLE AUTOMATION STATUS
    // ==========================================
    async toggle(organizationId: string, automationId: string) {
        const automation = await prisma.automation.findFirst({
            where: { id: automationId, organizationId },
        });

        if (!automation) {
            throw new AppError('Automation not found', 404);
        }

        const updated = await prisma.automation.update({
            where: { id: automationId },
            data: {
                isActive: !automation.isActive,
            },
        });

        console.log(`✅ Automation ${automationId} is now ${updated.isActive ? 'ACTIVE' : 'INACTIVE'}`);

        return {
            ...updated,
            actions: updated.actions as unknown as AutomationAction[],
            triggerConfig: updated.triggerConfig as any,
        };
    }

    // ==========================================
    // GET ACTIVE AUTOMATIONS BY TRIGGER
    // ==========================================
    async getActiveByTrigger(organizationId: string, trigger: AutomationTrigger) {
        const automations = await prisma.automation.findMany({
            where: {
                organizationId,
                trigger,
                isActive: true,
            },
        });

        return automations.map((a: any) => ({
            ...a,
            actions: a.actions as unknown as AutomationAction[],
            triggerConfig: a.triggerConfig as any,
            targetGroupIds: a.targetGroupIds || [],
            excludeExisting: a.excludeExisting ?? true,
        }));
    }

    // ==========================================
    // INCREMENT EXECUTION COUNT
    // ==========================================
    async incrementExecutionCount(automationId: string) {
        await prisma.automation.update({
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
    async getStats(organizationId: string) {
        const [total, active, totalExecutions] = await Promise.all([
            prisma.automation.count({ where: { organizationId } }),
            prisma.automation.count({ where: { organizationId, isActive: true } }),
            prisma.automation.aggregate({
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

export const automationService = new AutomationService();