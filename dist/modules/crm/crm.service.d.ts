import { Prisma, LeadStatus, LeadPriority } from '@prisma/client';
export declare class CRMService {
    createDefaultPipeline(organizationId: string): Promise<{
        stages: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            color: string;
            pipelineId: string;
            order: number;
            probability: number;
            isWon: boolean;
            isLost: boolean;
        }[];
    } & {
        organizationId: string;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        description: string | null;
        isDefault: boolean;
    }>;
    getPipelines(organizationId: string): Promise<({
        stages: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            color: string;
            pipelineId: string;
            order: number;
            probability: number;
            isWon: boolean;
            isLost: boolean;
        }[];
    } & {
        organizationId: string;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        description: string | null;
        isDefault: boolean;
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
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            color: string;
            pipelineId: string;
            order: number;
            probability: number;
            isWon: boolean;
            isLost: boolean;
        }[];
    } & {
        organizationId: string;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        description: string | null;
        isDefault: boolean;
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
                phone: string;
                email: string | null;
                id: string;
                firstName: string | null;
                lastName: string | null;
                avatar: string | null;
                whatsappProfileName: string | null;
            } | null;
            pipeline: {
                id: string;
                name: string;
            } | null;
            _count: {
                notes: number;
                activities: number;
                tasks: number;
            };
            stage: {
                id: string;
                name: string;
                color: string;
            } | null;
        } & {
            organizationId: string;
            value: Prisma.Decimal | null;
            id: string;
            status: import(".prisma/client").$Enums.LeadStatus;
            createdAt: Date;
            updatedAt: Date;
            source: string | null;
            contactId: string | null;
            title: string;
            currency: string;
            pipelineId: string | null;
            stageId: string | null;
            priority: import(".prisma/client").$Enums.LeadPriority;
            score: number;
            conversationId: string | null;
            serviceInterest: string | null;
            budget: string | null;
            city: string | null;
            adSource: string | null;
            adId: string | null;
            campaignId: string | null;
            chatbotQualified: boolean;
            qualificationData: Prisma.JsonValue;
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
    getInterestedLeads(organizationId: string, options?: {
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{
        leads: ({
            contact: {
                phone: string;
                email: string | null;
                id: string;
                firstName: string | null;
                lastName: string | null;
                avatar: string | null;
                whatsappProfileName: string | null;
            } | null;
            pipeline: {
                id: string;
                name: string;
            } | null;
            _count: {
                notes: number;
                activities: number;
            };
            stage: {
                id: string;
                name: string;
                color: string;
            } | null;
        } & {
            organizationId: string;
            value: Prisma.Decimal | null;
            id: string;
            status: import(".prisma/client").$Enums.LeadStatus;
            createdAt: Date;
            updatedAt: Date;
            source: string | null;
            contactId: string | null;
            title: string;
            currency: string;
            pipelineId: string | null;
            stageId: string | null;
            priority: import(".prisma/client").$Enums.LeadPriority;
            score: number;
            conversationId: string | null;
            serviceInterest: string | null;
            budget: string | null;
            city: string | null;
            adSource: string | null;
            adId: string | null;
            campaignId: string | null;
            chatbotQualified: boolean;
            qualificationData: Prisma.JsonValue;
            assignedToId: string | null;
            expectedCloseDate: Date | null;
            actualCloseDate: Date | null;
            lastActivityAt: Date | null;
        })[];
        grouped: {
            hot: ({
                contact: {
                    phone: string;
                    email: string | null;
                    id: string;
                    firstName: string | null;
                    lastName: string | null;
                    avatar: string | null;
                    whatsappProfileName: string | null;
                } | null;
                pipeline: {
                    id: string;
                    name: string;
                } | null;
                _count: {
                    notes: number;
                    activities: number;
                };
                stage: {
                    id: string;
                    name: string;
                    color: string;
                } | null;
            } & {
                organizationId: string;
                value: Prisma.Decimal | null;
                id: string;
                status: import(".prisma/client").$Enums.LeadStatus;
                createdAt: Date;
                updatedAt: Date;
                source: string | null;
                contactId: string | null;
                title: string;
                currency: string;
                pipelineId: string | null;
                stageId: string | null;
                priority: import(".prisma/client").$Enums.LeadPriority;
                score: number;
                conversationId: string | null;
                serviceInterest: string | null;
                budget: string | null;
                city: string | null;
                adSource: string | null;
                adId: string | null;
                campaignId: string | null;
                chatbotQualified: boolean;
                qualificationData: Prisma.JsonValue;
                assignedToId: string | null;
                expectedCloseDate: Date | null;
                actualCloseDate: Date | null;
                lastActivityAt: Date | null;
            })[];
            warm: ({
                contact: {
                    phone: string;
                    email: string | null;
                    id: string;
                    firstName: string | null;
                    lastName: string | null;
                    avatar: string | null;
                    whatsappProfileName: string | null;
                } | null;
                pipeline: {
                    id: string;
                    name: string;
                } | null;
                _count: {
                    notes: number;
                    activities: number;
                };
                stage: {
                    id: string;
                    name: string;
                    color: string;
                } | null;
            } & {
                organizationId: string;
                value: Prisma.Decimal | null;
                id: string;
                status: import(".prisma/client").$Enums.LeadStatus;
                createdAt: Date;
                updatedAt: Date;
                source: string | null;
                contactId: string | null;
                title: string;
                currency: string;
                pipelineId: string | null;
                stageId: string | null;
                priority: import(".prisma/client").$Enums.LeadPriority;
                score: number;
                conversationId: string | null;
                serviceInterest: string | null;
                budget: string | null;
                city: string | null;
                adSource: string | null;
                adId: string | null;
                campaignId: string | null;
                chatbotQualified: boolean;
                qualificationData: Prisma.JsonValue;
                assignedToId: string | null;
                expectedCloseDate: Date | null;
                actualCloseDate: Date | null;
                lastActivityAt: Date | null;
            })[];
            cold: ({
                contact: {
                    phone: string;
                    email: string | null;
                    id: string;
                    firstName: string | null;
                    lastName: string | null;
                    avatar: string | null;
                    whatsappProfileName: string | null;
                } | null;
                pipeline: {
                    id: string;
                    name: string;
                } | null;
                _count: {
                    notes: number;
                    activities: number;
                };
                stage: {
                    id: string;
                    name: string;
                    color: string;
                } | null;
            } & {
                organizationId: string;
                value: Prisma.Decimal | null;
                id: string;
                status: import(".prisma/client").$Enums.LeadStatus;
                createdAt: Date;
                updatedAt: Date;
                source: string | null;
                contactId: string | null;
                title: string;
                currency: string;
                pipelineId: string | null;
                stageId: string | null;
                priority: import(".prisma/client").$Enums.LeadPriority;
                score: number;
                conversationId: string | null;
                serviceInterest: string | null;
                budget: string | null;
                city: string | null;
                adSource: string | null;
                adId: string | null;
                campaignId: string | null;
                chatbotQualified: boolean;
                qualificationData: Prisma.JsonValue;
                assignedToId: string | null;
                expectedCloseDate: Date | null;
                actualCloseDate: Date | null;
                lastActivityAt: Date | null;
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
            organizationId: string;
            phone: string;
            email: string | null;
            id: string;
            status: import(".prisma/client").$Enums.ContactStatus;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            countryCode: string;
            telegramUserId: string | null;
            telegramUsername: string | null;
            instagramUserId: string | null;
            instagramUsername: string | null;
            firstName: string | null;
            lastName: string | null;
            avatar: string | null;
            whatsappProfileName: string | null;
            whatsappAbout: string | null;
            whatsappProfilePicUrl: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            tags: string[];
            lastMessageAt: Date | null;
            messageCount: number;
            source: string | null;
            deletedBy: string | null;
        } | null;
        pipeline: ({
            stages: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                color: string;
                pipelineId: string;
                order: number;
                probability: number;
                isWon: boolean;
                isLost: boolean;
            }[];
        } & {
            organizationId: string;
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            description: string | null;
            isDefault: boolean;
        }) | null;
        notes: {
            userId: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isPinned: boolean;
            leadId: string;
            content: string;
        }[];
        stage: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            color: string;
            pipelineId: string;
            order: number;
            probability: number;
            isWon: boolean;
            isLost: boolean;
        } | null;
        activities: {
            userId: string | null;
            id: string;
            createdAt: Date;
            metadata: Prisma.JsonValue | null;
            description: string | null;
            title: string;
            type: import(".prisma/client").$Enums.ActivityType;
            leadId: string;
        }[];
        tasks: {
            userId: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            completedAt: Date | null;
            title: string;
            priority: import(".prisma/client").$Enums.LeadPriority;
            leadId: string;
            dueDate: Date | null;
            isCompleted: boolean;
        }[];
    } & {
        organizationId: string;
        value: Prisma.Decimal | null;
        id: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        createdAt: Date;
        updatedAt: Date;
        source: string | null;
        contactId: string | null;
        title: string;
        currency: string;
        pipelineId: string | null;
        stageId: string | null;
        priority: import(".prisma/client").$Enums.LeadPriority;
        score: number;
        conversationId: string | null;
        serviceInterest: string | null;
        budget: string | null;
        city: string | null;
        adSource: string | null;
        adId: string | null;
        campaignId: string | null;
        chatbotQualified: boolean;
        qualificationData: Prisma.JsonValue;
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
        score?: number;
        serviceInterest?: string;
        budget?: string;
        city?: string;
    }): Promise<{
        contact: {
            organizationId: string;
            phone: string;
            email: string | null;
            id: string;
            status: import(".prisma/client").$Enums.ContactStatus;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            countryCode: string;
            telegramUserId: string | null;
            telegramUsername: string | null;
            instagramUserId: string | null;
            instagramUsername: string | null;
            firstName: string | null;
            lastName: string | null;
            avatar: string | null;
            whatsappProfileName: string | null;
            whatsappAbout: string | null;
            whatsappProfilePicUrl: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            tags: string[];
            lastMessageAt: Date | null;
            messageCount: number;
            source: string | null;
            deletedBy: string | null;
        } | null;
        pipeline: {
            organizationId: string;
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            description: string | null;
            isDefault: boolean;
        } | null;
        stage: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            color: string;
            pipelineId: string;
            order: number;
            probability: number;
            isWon: boolean;
            isLost: boolean;
        } | null;
    } & {
        organizationId: string;
        value: Prisma.Decimal | null;
        id: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        createdAt: Date;
        updatedAt: Date;
        source: string | null;
        contactId: string | null;
        title: string;
        currency: string;
        pipelineId: string | null;
        stageId: string | null;
        priority: import(".prisma/client").$Enums.LeadPriority;
        score: number;
        conversationId: string | null;
        serviceInterest: string | null;
        budget: string | null;
        city: string | null;
        adSource: string | null;
        adId: string | null;
        campaignId: string | null;
        chatbotQualified: boolean;
        qualificationData: Prisma.JsonValue;
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
        score?: number;
        serviceInterest?: string;
        budget?: string;
        city?: string;
    }): Promise<{
        contact: {
            organizationId: string;
            phone: string;
            email: string | null;
            id: string;
            status: import(".prisma/client").$Enums.ContactStatus;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            countryCode: string;
            telegramUserId: string | null;
            telegramUsername: string | null;
            instagramUserId: string | null;
            instagramUsername: string | null;
            firstName: string | null;
            lastName: string | null;
            avatar: string | null;
            whatsappProfileName: string | null;
            whatsappAbout: string | null;
            whatsappProfilePicUrl: string | null;
            whatsappProfileFetched: boolean;
            lastProfileFetchAt: Date | null;
            profileFetchAttempts: number;
            customFields: Prisma.JsonValue;
            tags: string[];
            lastMessageAt: Date | null;
            messageCount: number;
            source: string | null;
            deletedBy: string | null;
        } | null;
        pipeline: {
            organizationId: string;
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            description: string | null;
            isDefault: boolean;
        } | null;
        stage: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            color: string;
            pipelineId: string;
            order: number;
            probability: number;
            isWon: boolean;
            isLost: boolean;
        } | null;
    } & {
        organizationId: string;
        value: Prisma.Decimal | null;
        id: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        createdAt: Date;
        updatedAt: Date;
        source: string | null;
        contactId: string | null;
        title: string;
        currency: string;
        pipelineId: string | null;
        stageId: string | null;
        priority: import(".prisma/client").$Enums.LeadPriority;
        score: number;
        conversationId: string | null;
        serviceInterest: string | null;
        budget: string | null;
        city: string | null;
        adSource: string | null;
        adId: string | null;
        campaignId: string | null;
        chatbotQualified: boolean;
        qualificationData: Prisma.JsonValue;
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
        isPinned: boolean;
        leadId: string;
        content: string;
    }>;
    getLeadNotes(organizationId: string, leadId: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isPinned: boolean;
        leadId: string;
        content: string;
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
        completedAt: Date | null;
        title: string;
        priority: import(".prisma/client").$Enums.LeadPriority;
        leadId: string;
        dueDate: Date | null;
        isCompleted: boolean;
    }>;
    completeTask(organizationId: string, taskId: string, userId: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        completedAt: Date | null;
        title: string;
        priority: import(".prisma/client").$Enums.LeadPriority;
        leadId: string;
        dueDate: Date | null;
        isCompleted: boolean;
    }>;
    addContactNote(organizationId: string, contactId: string, userId: string, content: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        isPinned: boolean;
        content: string;
    }>;
    getContactNotes(organizationId: string, contactId: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        isPinned: boolean;
        content: string;
    }[]>;
    updateContactNote(organizationId: string, contactId: string, noteId: string, content: string): Promise<{
        userId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contactId: string;
        isPinned: boolean;
        content: string;
    } | null>;
    deleteContactNote(organizationId: string, contactId: string, noteId: string): Promise<{
        id: string;
    }>;
    getStats(organizationId: string): Promise<{
        totalLeads: number;
        newLeads: number;
        wonLeads: number;
        lostLeads: number;
        chatbotLeads: number;
        adLeads: number;
        hotLeads: number;
        leadsBySource: {
            source: any;
            count: any;
        }[];
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