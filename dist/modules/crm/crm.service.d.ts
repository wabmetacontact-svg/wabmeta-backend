import { Prisma, LeadStatus, LeadPriority } from '@prisma/client';
export declare class CRMService {
    createDefaultPipeline(organizationId: string): Promise<{
        stages: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            pipelineId: string;
            order: number;
            color: string;
            probability: number;
            isWon: boolean;
            isLost: boolean;
        }[];
    } & {
        name: string;
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isDefault: boolean;
        isActive: boolean;
        description: string | null;
    }>;
    getPipelines(organizationId: string): Promise<({
        stages: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            pipelineId: string;
            order: number;
            color: string;
            probability: number;
            isWon: boolean;
            isLost: boolean;
        }[];
    } & {
        name: string;
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isDefault: boolean;
        isActive: boolean;
        description: string | null;
    })[]>;
    createPipeline(organizationId: string, data: {
        name: string;
        description?: string;
        stages?: {
            name: string;
            color?: string;
            probability?: number;
        }[];
    }): Promise<{
        stages: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            pipelineId: string;
            order: number;
            color: string;
            probability: number;
            isWon: boolean;
            isLost: boolean;
        }[];
    } & {
        name: string;
        organizationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isDefault: boolean;
        isActive: boolean;
        description: string | null;
    }>;
    getLeads(organizationId: string, options: {
        page?: number | string;
        limit?: number | string;
        status?: LeadStatus;
        pipelineId?: string;
        stageId?: string;
        search?: string;
        assignedToId?: string;
    }): Promise<{
        leads: ({
            contact: {
                email: string | null;
                id: string;
                firstName: string | null;
                lastName: string | null;
                phone: string;
                avatar: string | null;
            } | null;
            pipeline: {
                name: string;
                id: string;
            } | null;
            _count: {
                notes: number;
                activities: number;
                tasks: number;
            };
            stage: {
                name: string;
                id: string;
                color: string;
            } | null;
        } & {
            organizationId: string;
            status: import(".prisma/client").$Enums.LeadStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            value: Prisma.Decimal | null;
            source: string | null;
            currency: string;
            contactId: string | null;
            title: string;
            pipelineId: string | null;
            stageId: string | null;
            priority: import(".prisma/client").$Enums.LeadPriority;
            assignedToId: string | null;
            expectedCloseDate: Date | null;
            actualCloseDate: Date | null;
            lastActivityAt: Date | null;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getLeadById(organizationId: string, leadId: string): Promise<{
        contact: {
            email: string | null;
            organizationId: string;
            tags: string[];
            status: import(".prisma/client").$Enums.ContactStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            firstName: string | null;
            lastName: string | null;
            phone: string;
            avatar: string | null;
            lastMessageAt: Date | null;
            countryCode: string;
            whatsappProfileName: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            messageCount: number;
            source: string | null;
        } | null;
        pipeline: ({
            stages: {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                pipelineId: string;
                order: number;
                color: string;
                probability: number;
                isWon: boolean;
                isLost: boolean;
            }[];
        } & {
            name: string;
            organizationId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isDefault: boolean;
            isActive: boolean;
            description: string | null;
        }) | null;
        notes: {
            userId: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            content: string;
            isPinned: boolean;
            leadId: string;
        }[];
        stage: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            pipelineId: string;
            order: number;
            color: string;
            probability: number;
            isWon: boolean;
            isLost: boolean;
        } | null;
        activities: {
            type: import(".prisma/client").$Enums.ActivityType;
            userId: string | null;
            id: string;
            createdAt: Date;
            description: string | null;
            metadata: Prisma.JsonValue | null;
            title: string;
            leadId: string;
        }[];
        tasks: {
            userId: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            title: string;
            priority: import(".prisma/client").$Enums.LeadPriority;
            completedAt: Date | null;
            dueDate: Date | null;
            leadId: string;
            isCompleted: boolean;
        }[];
    } & {
        organizationId: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        value: Prisma.Decimal | null;
        source: string | null;
        currency: string;
        contactId: string | null;
        title: string;
        pipelineId: string | null;
        stageId: string | null;
        priority: import(".prisma/client").$Enums.LeadPriority;
        assignedToId: string | null;
        expectedCloseDate: Date | null;
        actualCloseDate: Date | null;
        lastActivityAt: Date | null;
    }>;
    createLead(organizationId: string, userId: string, data: {
        title: string;
        contactId?: string;
        value?: number;
        pipelineId?: string;
        stageId?: string;
        source?: string;
        priority?: LeadPriority;
        expectedCloseDate?: Date;
    }): Promise<{
        contact: {
            email: string | null;
            organizationId: string;
            tags: string[];
            status: import(".prisma/client").$Enums.ContactStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            firstName: string | null;
            lastName: string | null;
            phone: string;
            avatar: string | null;
            lastMessageAt: Date | null;
            countryCode: string;
            whatsappProfileName: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            messageCount: number;
            source: string | null;
        } | null;
        pipeline: {
            name: string;
            organizationId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isDefault: boolean;
            isActive: boolean;
            description: string | null;
        } | null;
        stage: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            pipelineId: string;
            order: number;
            color: string;
            probability: number;
            isWon: boolean;
            isLost: boolean;
        } | null;
    } & {
        organizationId: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        value: Prisma.Decimal | null;
        source: string | null;
        currency: string;
        contactId: string | null;
        title: string;
        pipelineId: string | null;
        stageId: string | null;
        priority: import(".prisma/client").$Enums.LeadPriority;
        assignedToId: string | null;
        expectedCloseDate: Date | null;
        actualCloseDate: Date | null;
        lastActivityAt: Date | null;
    }>;
    updateLead(organizationId: string, leadId: string, userId: string, data: {
        title?: string;
        value?: number;
        stageId?: string;
        status?: LeadStatus;
        priority?: LeadPriority;
        expectedCloseDate?: Date;
        assignedToId?: string;
    }): Promise<{
        contact: {
            email: string | null;
            organizationId: string;
            tags: string[];
            status: import(".prisma/client").$Enums.ContactStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            firstName: string | null;
            lastName: string | null;
            phone: string;
            avatar: string | null;
            lastMessageAt: Date | null;
            countryCode: string;
            whatsappProfileName: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            messageCount: number;
            source: string | null;
        } | null;
        pipeline: {
            name: string;
            organizationId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isDefault: boolean;
            isActive: boolean;
            description: string | null;
        } | null;
        stage: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            pipelineId: string;
            order: number;
            color: string;
            probability: number;
            isWon: boolean;
            isLost: boolean;
        } | null;
    } & {
        organizationId: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        value: Prisma.Decimal | null;
        source: string | null;
        currency: string;
        contactId: string | null;
        title: string;
        pipelineId: string | null;
        stageId: string | null;
        priority: import(".prisma/client").$Enums.LeadPriority;
        assignedToId: string | null;
        expectedCloseDate: Date | null;
        actualCloseDate: Date | null;
        lastActivityAt: Date | null;
    }>;
    deleteLead(organizationId: string, leadId: string): Promise<{
        message: string;
    }>;
    addLeadNote(organizationId: string, leadId: string, userId: string, content: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        isPinned: boolean;
        leadId: string;
    }>;
    getLeadNotes(organizationId: string, leadId: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        isPinned: boolean;
        leadId: string;
    }[]>;
    addLeadTask(organizationId: string, leadId: string, userId: string, data: {
        title: string;
        description?: string;
        dueDate?: Date;
        priority?: LeadPriority;
    }): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        title: string;
        priority: import(".prisma/client").$Enums.LeadPriority;
        completedAt: Date | null;
        dueDate: Date | null;
        leadId: string;
        isCompleted: boolean;
    }>;
    completeTask(organizationId: string, taskId: string, userId: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        title: string;
        priority: import(".prisma/client").$Enums.LeadPriority;
        completedAt: Date | null;
        dueDate: Date | null;
        leadId: string;
        isCompleted: boolean;
    }>;
    addContactNote(organizationId: string, contactId: string, userId: string, content: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        contactId: string;
        isPinned: boolean;
    }>;
    getContactNotes(organizationId: string, contactId: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        content: string;
        contactId: string;
        isPinned: boolean;
    }[]>;
    getStats(organizationId: string): Promise<{
        totalLeads: number;
        newLeads: number;
        wonLeads: number;
        lostLeads: number;
        totalValue: number | Prisma.Decimal;
        wonValue: number | Prisma.Decimal;
        winRate: number;
        leadsByStage: (Prisma.PickEnumerable<Prisma.LeadGroupByOutputType, "stageId"[]> & {
            _count: number;
            _sum: {
                value: Prisma.Decimal | null;
            };
        })[];
    }>;
    syncFromContacts(organizationId: string, userId: string): Promise<{
        message: string;
        synced: number;
    }>;
}
export declare const crmService: CRMService;
//# sourceMappingURL=crm.service.d.ts.map