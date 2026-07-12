import { Prisma, LeadStatus, LeadPriority } from '@prisma/client';
export declare class CRMService {
    createDefaultPipeline(organizationId: string): Promise<{
        stages: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            order: number;
            color: string;
            probability: number;
            isWon: boolean;
            isLost: boolean;
            pipelineId: string;
        }[];
    } & {
        name: string;
        organizationId: string;
        id: string;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        description: string | null;
    }>;
    getPipelines(organizationId: string): Promise<({
        stages: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            order: number;
            color: string;
            probability: number;
            isWon: boolean;
            isLost: boolean;
            pipelineId: string;
        }[];
    } & {
        name: string;
        organizationId: string;
        id: string;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
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
            order: number;
            color: string;
            probability: number;
            isWon: boolean;
            isLost: boolean;
            pipelineId: string;
        }[];
    } & {
        name: string;
        organizationId: string;
        id: string;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        description: string | null;
    }>;
    getOrCreateSettings(organizationId: string): Promise<any>;
    updateSettings(organizationId: string, data: {
        leadCreationMode?: string;
        leadScoreThreshold?: number;
        autoAssignLeads?: boolean;
        defaultAssigneeId?: string;
        notifyOnNewLead?: boolean;
        notifyUserId?: string;
        trackAdSource?: boolean;
    }): Promise<any>;
    /**
     * ✅ MAIN: Smart lead create - duplicate protection + auto assign
     */
    smartCreateLead(params: {
        organizationId: string;
        contactId: string;
        conversationId?: string;
        title?: string;
        source?: string;
        score?: number;
        priority?: LeadPriority;
        serviceInterest?: string;
        budget?: string;
        city?: string;
        adSource?: string;
        adId?: string;
        campaignId?: string;
        qualificationData?: Record<string, any>;
        chatbotQualified?: boolean;
        notes?: string;
        createdByUserId?: string;
    }): Promise<{
        lead: any;
        wasExisting: boolean;
        action: 'created' | 'updated' | 'skipped';
    }>;
    /**
     * ✅ Check karo ki score threshold pe lead banana chahiye ya nahi
     */
    checkAndCreateLeadByScore(organizationId: string, contactId: string, currentScore: number, context: {
        conversationId?: string;
        qualificationData?: Record<string, any>;
        source?: string;
    }): Promise<boolean>;
    getLeads(organizationId: string, options: {
        page?: number | string;
        limit?: number | string;
        status?: LeadStatus;
        pipelineId?: string;
        stageId?: string;
        search?: string;
        assignedToId?: string;
        source?: string;
        chatbotQualified?: boolean;
        minScore?: number;
    }): Promise<{
        leads: ({
            contact: {
                email: string | null;
                id: string;
                firstName: string | null;
                lastName: string | null;
                phone: string;
                avatar: string | null;
                whatsappProfileName: string | null;
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
            id: string;
            status: import(".prisma/client").$Enums.LeadStatus;
            createdAt: Date;
            updatedAt: Date;
            value: Prisma.Decimal | null;
            source: string | null;
            campaignId: string | null;
            currency: string;
            pipelineId: string | null;
            title: string;
            priority: import(".prisma/client").$Enums.LeadPriority;
            score: number;
            conversationId: string | null;
            serviceInterest: string | null;
            budget: string | null;
            city: string | null;
            adSource: string | null;
            adId: string | null;
            chatbotQualified: boolean;
            qualificationData: Prisma.JsonValue;
            assignedToId: string | null;
            expectedCloseDate: Date | null;
            actualCloseDate: Date | null;
            lastActivityAt: Date | null;
            contactId: string | null;
            stageId: string | null;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getInterestedLeads(organizationId: string, options?: {
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{
        leads: ({
            contact: {
                email: string | null;
                id: string;
                firstName: string | null;
                lastName: string | null;
                phone: string;
                avatar: string | null;
                whatsappProfileName: string | null;
            } | null;
            pipeline: {
                name: string;
                id: string;
            } | null;
            _count: {
                notes: number;
                activities: number;
            };
            stage: {
                name: string;
                id: string;
                color: string;
            } | null;
        } & {
            organizationId: string;
            id: string;
            status: import(".prisma/client").$Enums.LeadStatus;
            createdAt: Date;
            updatedAt: Date;
            value: Prisma.Decimal | null;
            source: string | null;
            campaignId: string | null;
            currency: string;
            pipelineId: string | null;
            title: string;
            priority: import(".prisma/client").$Enums.LeadPriority;
            score: number;
            conversationId: string | null;
            serviceInterest: string | null;
            budget: string | null;
            city: string | null;
            adSource: string | null;
            adId: string | null;
            chatbotQualified: boolean;
            qualificationData: Prisma.JsonValue;
            assignedToId: string | null;
            expectedCloseDate: Date | null;
            actualCloseDate: Date | null;
            lastActivityAt: Date | null;
            contactId: string | null;
            stageId: string | null;
        })[];
        grouped: {
            hot: ({
                contact: {
                    email: string | null;
                    id: string;
                    firstName: string | null;
                    lastName: string | null;
                    phone: string;
                    avatar: string | null;
                    whatsappProfileName: string | null;
                } | null;
                pipeline: {
                    name: string;
                    id: string;
                } | null;
                _count: {
                    notes: number;
                    activities: number;
                };
                stage: {
                    name: string;
                    id: string;
                    color: string;
                } | null;
            } & {
                organizationId: string;
                id: string;
                status: import(".prisma/client").$Enums.LeadStatus;
                createdAt: Date;
                updatedAt: Date;
                value: Prisma.Decimal | null;
                source: string | null;
                campaignId: string | null;
                currency: string;
                pipelineId: string | null;
                title: string;
                priority: import(".prisma/client").$Enums.LeadPriority;
                score: number;
                conversationId: string | null;
                serviceInterest: string | null;
                budget: string | null;
                city: string | null;
                adSource: string | null;
                adId: string | null;
                chatbotQualified: boolean;
                qualificationData: Prisma.JsonValue;
                assignedToId: string | null;
                expectedCloseDate: Date | null;
                actualCloseDate: Date | null;
                lastActivityAt: Date | null;
                contactId: string | null;
                stageId: string | null;
            })[];
            warm: ({
                contact: {
                    email: string | null;
                    id: string;
                    firstName: string | null;
                    lastName: string | null;
                    phone: string;
                    avatar: string | null;
                    whatsappProfileName: string | null;
                } | null;
                pipeline: {
                    name: string;
                    id: string;
                } | null;
                _count: {
                    notes: number;
                    activities: number;
                };
                stage: {
                    name: string;
                    id: string;
                    color: string;
                } | null;
            } & {
                organizationId: string;
                id: string;
                status: import(".prisma/client").$Enums.LeadStatus;
                createdAt: Date;
                updatedAt: Date;
                value: Prisma.Decimal | null;
                source: string | null;
                campaignId: string | null;
                currency: string;
                pipelineId: string | null;
                title: string;
                priority: import(".prisma/client").$Enums.LeadPriority;
                score: number;
                conversationId: string | null;
                serviceInterest: string | null;
                budget: string | null;
                city: string | null;
                adSource: string | null;
                adId: string | null;
                chatbotQualified: boolean;
                qualificationData: Prisma.JsonValue;
                assignedToId: string | null;
                expectedCloseDate: Date | null;
                actualCloseDate: Date | null;
                lastActivityAt: Date | null;
                contactId: string | null;
                stageId: string | null;
            })[];
            cold: ({
                contact: {
                    email: string | null;
                    id: string;
                    firstName: string | null;
                    lastName: string | null;
                    phone: string;
                    avatar: string | null;
                    whatsappProfileName: string | null;
                } | null;
                pipeline: {
                    name: string;
                    id: string;
                } | null;
                _count: {
                    notes: number;
                    activities: number;
                };
                stage: {
                    name: string;
                    id: string;
                    color: string;
                } | null;
            } & {
                organizationId: string;
                id: string;
                status: import(".prisma/client").$Enums.LeadStatus;
                createdAt: Date;
                updatedAt: Date;
                value: Prisma.Decimal | null;
                source: string | null;
                campaignId: string | null;
                currency: string;
                pipelineId: string | null;
                title: string;
                priority: import(".prisma/client").$Enums.LeadPriority;
                score: number;
                conversationId: string | null;
                serviceInterest: string | null;
                budget: string | null;
                city: string | null;
                adSource: string | null;
                adId: string | null;
                chatbotQualified: boolean;
                qualificationData: Prisma.JsonValue;
                assignedToId: string | null;
                expectedCloseDate: Date | null;
                actualCloseDate: Date | null;
                lastActivityAt: Date | null;
                contactId: string | null;
                stageId: string | null;
            })[];
        };
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
            id: string;
            status: import(".prisma/client").$Enums.ContactStatus;
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
            deletedAt: Date | null;
            deletedBy: string | null;
        } | null;
        pipeline: ({
            stages: {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                order: number;
                color: string;
                probability: number;
                isWon: boolean;
                isLost: boolean;
                pipelineId: string;
            }[];
        } & {
            name: string;
            organizationId: string;
            id: string;
            isDefault: boolean;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            description: string | null;
        }) | null;
        notes: {
            userId: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string;
            content: string;
            isPinned: boolean;
        }[];
        activities: {
            type: import(".prisma/client").$Enums.ActivityType;
            userId: string | null;
            id: string;
            createdAt: Date;
            description: string | null;
            title: string;
            metadata: Prisma.JsonValue | null;
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
            leadId: string;
            dueDate: Date | null;
            isCompleted: boolean;
            completedAt: Date | null;
        }[];
        stage: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            order: number;
            color: string;
            probability: number;
            isWon: boolean;
            isLost: boolean;
            pipelineId: string;
        } | null;
    } & {
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        createdAt: Date;
        updatedAt: Date;
        value: Prisma.Decimal | null;
        source: string | null;
        campaignId: string | null;
        currency: string;
        pipelineId: string | null;
        title: string;
        priority: import(".prisma/client").$Enums.LeadPriority;
        score: number;
        conversationId: string | null;
        serviceInterest: string | null;
        budget: string | null;
        city: string | null;
        adSource: string | null;
        adId: string | null;
        chatbotQualified: boolean;
        qualificationData: Prisma.JsonValue;
        assignedToId: string | null;
        expectedCloseDate: Date | null;
        actualCloseDate: Date | null;
        lastActivityAt: Date | null;
        contactId: string | null;
        stageId: string | null;
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
        score?: number;
        serviceInterest?: string;
        budget?: string;
        city?: string;
    }): Promise<{
        contact: {
            email: string | null;
            organizationId: string;
            tags: string[];
            id: string;
            status: import(".prisma/client").$Enums.ContactStatus;
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
            deletedAt: Date | null;
            deletedBy: string | null;
        } | null;
        pipeline: {
            name: string;
            organizationId: string;
            id: string;
            isDefault: boolean;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            description: string | null;
        } | null;
        stage: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            order: number;
            color: string;
            probability: number;
            isWon: boolean;
            isLost: boolean;
            pipelineId: string;
        } | null;
    } & {
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        createdAt: Date;
        updatedAt: Date;
        value: Prisma.Decimal | null;
        source: string | null;
        campaignId: string | null;
        currency: string;
        pipelineId: string | null;
        title: string;
        priority: import(".prisma/client").$Enums.LeadPriority;
        score: number;
        conversationId: string | null;
        serviceInterest: string | null;
        budget: string | null;
        city: string | null;
        adSource: string | null;
        adId: string | null;
        chatbotQualified: boolean;
        qualificationData: Prisma.JsonValue;
        assignedToId: string | null;
        expectedCloseDate: Date | null;
        actualCloseDate: Date | null;
        lastActivityAt: Date | null;
        contactId: string | null;
        stageId: string | null;
    }>;
    updateLead(organizationId: string, leadId: string, userId: string, data: {
        title?: string;
        value?: number;
        stageId?: string;
        status?: LeadStatus;
        priority?: LeadPriority;
        expectedCloseDate?: Date;
        assignedToId?: string;
        score?: number;
        serviceInterest?: string;
        budget?: string;
        city?: string;
    }): Promise<{
        contact: {
            email: string | null;
            organizationId: string;
            tags: string[];
            id: string;
            status: import(".prisma/client").$Enums.ContactStatus;
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
            deletedAt: Date | null;
            deletedBy: string | null;
        } | null;
        pipeline: {
            name: string;
            organizationId: string;
            id: string;
            isDefault: boolean;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            description: string | null;
        } | null;
        stage: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            order: number;
            color: string;
            probability: number;
            isWon: boolean;
            isLost: boolean;
            pipelineId: string;
        } | null;
    } & {
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        createdAt: Date;
        updatedAt: Date;
        value: Prisma.Decimal | null;
        source: string | null;
        campaignId: string | null;
        currency: string;
        pipelineId: string | null;
        title: string;
        priority: import(".prisma/client").$Enums.LeadPriority;
        score: number;
        conversationId: string | null;
        serviceInterest: string | null;
        budget: string | null;
        city: string | null;
        adSource: string | null;
        adId: string | null;
        chatbotQualified: boolean;
        qualificationData: Prisma.JsonValue;
        assignedToId: string | null;
        expectedCloseDate: Date | null;
        actualCloseDate: Date | null;
        lastActivityAt: Date | null;
        contactId: string | null;
        stageId: string | null;
    }>;
    deleteLead(organizationId: string, leadId: string): Promise<{
        message: string;
    }>;
    addLeadNote(organizationId: string, leadId: string, userId: string, content: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        leadId: string;
        content: string;
        isPinned: boolean;
    }>;
    getLeadNotes(organizationId: string, leadId: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        leadId: string;
        content: string;
        isPinned: boolean;
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
        leadId: string;
        dueDate: Date | null;
        isCompleted: boolean;
        completedAt: Date | null;
    }>;
    completeTask(organizationId: string, taskId: string, userId: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        title: string;
        priority: import(".prisma/client").$Enums.LeadPriority;
        leadId: string;
        dueDate: Date | null;
        isCompleted: boolean;
        completedAt: Date | null;
    }>;
    addContactNote(organizationId: string, contactId: string, userId: string, content: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        content: string;
        isPinned: boolean;
    }>;
    getContactNotes(organizationId: string, contactId: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        content: string;
        isPinned: boolean;
    }[]>;
    getStats(organizationId: string): Promise<{
        totalLeads: number;
        newLeads: number;
        wonLeads: number;
        lostLeads: number;
        chatbotLeads: number;
        adLeads: number;
        hotLeads: number;
        totalValue: number | Prisma.Decimal;
        wonValue: number | Prisma.Decimal;
        averageScore: number;
        winRate: number;
    }>;
    syncFromContacts(organizationId: string, userId: string): Promise<{
        message: string;
        synced: number;
    }>;
    private scoreToPriority;
    private getHigherPriority;
    private notifyNewLead;
}
export declare const crmService: CRMService;
//# sourceMappingURL=crm.service.d.ts.map