export declare class AnalyticsService {
    getOverviewStats(organizationId: string, dateRange?: {
        start: Date;
        end: Date;
    }): Promise<{
        contacts: {
            total: number;
            newThisPeriod: number;
            growth: number;
        };
        conversations: {
            total: number;
            unread: number;
        };
        messages: {
            sent: number;
            received: number;
            total: number;
            thisPeriod: number;
            growth: number;
        };
        campaigns: {
            total: number;
            active: number;
            completed: number;
        };
        templates: {
            total: number;
            approved: number;
        };
    }>;
    getUnifiedDashboardStats(organizationId: string, days?: number): Promise<{
        overview: {
            totalEngagement: number;
            waVolume: number;
            igVolume: number;
        };
        audience: {
            whatsappContacts: number;
            instagramFollowers: number;
        };
        performance: {
            waDeliveryRate: number;
            igAutomationRate: number;
        };
    }>;
    getMessageAnalytics(organizationId: string, days?: number): Promise<{
        chartData: {
            date: string;
            sent: number;
            delivered: number;
            read: number;
            failed: number;
            received: number;
        }[];
        totals: {
            sent: number;
            delivered: number;
            read: number;
            failed: number;
            received: number;
        };
        rates: {
            delivery: number;
            read: number;
            failure: number;
        };
        typeBreakdown: {
            type: string;
            count: number;
            percentage: number;
        }[];
    }>;
    getCampaignAnalytics(organizationId: string, limit?: number): Promise<{
        campaigns: {
            id: string;
            name: string;
            templateName: string;
            status: import(".prisma/client").$Enums.CampaignStatus;
            totalContacts: number;
            sentCount: number;
            deliveredCount: number;
            readCount: number;
            failedCount: number;
            deliveryRate: number;
            readRate: number;
            failureRate: number;
            createdAt: Date;
            completedAt: Date | null;
        }[];
        statusBreakdown: {
            status: import(".prisma/client").$Enums.CampaignStatus;
            count: number;
        }[];
        overall: {
            totalCampaigns: number;
            totalContacts: number;
            totalSent: number;
            totalDelivered: number;
            totalRead: number;
            totalFailed: number;
            avgDeliveryRate: number;
            avgReadRate: number;
        };
    }>;
    getContactAnalytics(organizationId: string, days?: number): Promise<{
        chartData: {
            date: string;
            count: number;
        }[];
        totals: {
            total: number;
            active: number;
            newThisPeriod: number;
        };
        sourceBreakdown: {
            source: string;
            count: number;
            percentage: number;
        }[];
        statusBreakdown: {
            status: import(".prisma/client").$Enums.ContactStatus;
            count: number;
        }[];
        topTags: {
            tag: string;
            count: number;
        }[];
    }>;
    getConversationAnalytics(organizationId: string, days?: number): Promise<{
        chartData: {
            date: string;
            active: number;
            new: number;
        }[];
        totals: {
            total: number;
            openWindows: number;
            unread: number;
            avgMessagesPerConversation: number;
        };
    }>;
    getTemplateAnalytics(organizationId: string): Promise<{
        templates: {
            id: string;
            name: string;
            category: import(".prisma/client").$Enums.TemplateCategory;
            status: import(".prisma/client").$Enums.TemplateStatus;
            campaignsUsed: number;
            messagesSent: number;
            language: string;
            createdAt: Date;
        }[];
        totals: {
            total: number;
            approved: number;
            pending: number;
            rejected: number;
        };
        statusBreakdown: {
            status: import(".prisma/client").$Enums.TemplateStatus;
            count: number;
        }[];
        categoryBreakdown: {
            category: import(".prisma/client").$Enums.TemplateCategory;
            count: number;
        }[];
        topTemplates: {
            id: string;
            name: string;
            category: import(".prisma/client").$Enums.TemplateCategory;
            status: import(".prisma/client").$Enums.TemplateStatus;
            campaignsUsed: number;
            messagesSent: number;
            language: string;
            createdAt: Date;
        }[];
    }>;
    exportAnalytics(organizationId: string, type: string, format?: string): Promise<any>;
    private convertToCSV;
}
export declare const analyticsService: AnalyticsService;
export default analyticsService;
//# sourceMappingURL=analytics.service.d.ts.map