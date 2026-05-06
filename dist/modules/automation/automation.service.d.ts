import { AutomationTrigger } from '@prisma/client';
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
export declare class AutomationService {
    getAll(organizationId: string): Promise<{
        actions: AutomationAction[];
        triggerConfig: any;
        name: string;
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isActive: boolean;
        trigger: import(".prisma/client").$Enums.AutomationTrigger;
        executionCount: number;
        lastExecutedAt: Date | null;
        targetGroupIds: string[];
        excludeExisting: boolean;
    }[]>;
    getById(organizationId: string, automationId: string): Promise<{
        actions: AutomationAction[];
        triggerConfig: any;
        name: string;
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isActive: boolean;
        trigger: import(".prisma/client").$Enums.AutomationTrigger;
        executionCount: number;
        lastExecutedAt: Date | null;
        targetGroupIds: string[];
        excludeExisting: boolean;
    }>;
    create(organizationId: string, input: CreateAutomationInput): Promise<{
        actions: AutomationAction[];
        triggerConfig: any;
        name: string;
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isActive: boolean;
        trigger: import(".prisma/client").$Enums.AutomationTrigger;
        executionCount: number;
        lastExecutedAt: Date | null;
        targetGroupIds: string[];
        excludeExisting: boolean;
    }>;
    update(organizationId: string, automationId: string, input: UpdateAutomationInput): Promise<{
        actions: AutomationAction[];
        triggerConfig: any;
        name: string;
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isActive: boolean;
        trigger: import(".prisma/client").$Enums.AutomationTrigger;
        executionCount: number;
        lastExecutedAt: Date | null;
        targetGroupIds: string[];
        excludeExisting: boolean;
    }>;
    delete(organizationId: string, automationId: string): Promise<{
        message: string;
    }>;
    toggle(organizationId: string, automationId: string): Promise<{
        actions: AutomationAction[];
        triggerConfig: any;
        name: string;
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isActive: boolean;
        trigger: import(".prisma/client").$Enums.AutomationTrigger;
        executionCount: number;
        lastExecutedAt: Date | null;
        targetGroupIds: string[];
        excludeExisting: boolean;
    }>;
    getActiveByTrigger(organizationId: string, trigger: AutomationTrigger): Promise<any[]>;
    incrementExecutionCount(automationId: string): Promise<void>;
    getStats(organizationId: string): Promise<{
        total: number;
        active: number;
        inactive: number;
        totalExecutions: number;
    }>;
}
export declare const automationService: AutomationService;
export {};
//# sourceMappingURL=automation.service.d.ts.map