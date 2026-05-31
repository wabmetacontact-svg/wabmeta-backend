export declare class DashboardService {
    getStats(organizationId: string): Promise<{
        contacts: {
            total: number;
            today: number;
            thisWeek: number;
            thisMonth: number;
            growth: number;
        };
        messages: {
            sent: number;
            received: number;
            total: number;
            today: number;
            thisWeek: number;
            thisMonth: number;
            growth: number;
        };
        delivery: {
            delivered: number;
            read: number;
            failed: number;
            deliveryRate: number;
            readRate: number;
            failureRate: number;
        };
        conversations: {
            total: number;
            active: number;
            unread: number;
        };
        campaigns: {
            total: number;
            active: number;
            completed: number;
            thisMonth: number;
        };
        templates: {
            total: number;
            approved: number;
        };
        whatsapp: {
            connected: number;
        };
    }>;
    getWidgets(organizationId: string, days?: number): Promise<{
        messagesOverview: {
            date: string;
            sent: number;
            delivered: number;
            read: number;
            failed: number;
            received: number;
        }[];
        contactsGrowth: {
            date: string;
            count: number;
        }[];
        deliveryPerformance: {
            name: string;
            value: number;
            color: string;
        }[];
        recentCampaigns: {
            deliveryRate: number;
            name: string;
            id: string;
            status: import(".prisma/client").$Enums.CampaignStatus;
            createdAt: Date;
            totalContacts: number;
            sentCount: number;
            deliveredCount: number;
            readCount: number;
            failedCount: number;
        }[];
        recentConversations: {
            id: string;
            contactName: string;
            phone: string;
            avatar: string | null;
            lastMessage: string | null;
            lastMessageAt: Date | null;
            unreadCount: number;
        }[];
        summary: {
            totalSent: number;
            totalDelivered: number;
            totalRead: number;
            totalFailed: number;
            deliveryRate: number;
            readRate: number;
        };
    }>;
    getActivity(organizationId: string, limit?: number): Promise<{
        id: string;
        action: import(".prisma/client").$Enums.ActivityAction | null;
        entity: string | null;
        entityId: string | null;
        user: {
            name: string;
            avatar: string | null;
        } | null;
        metadata: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
    }[]>;
}
export declare const dashboardService: DashboardService;
export default dashboardService;
//# sourceMappingURL=dashboard.service.d.ts.map