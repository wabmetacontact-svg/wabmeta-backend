export declare class CampaignsService {
    private processingCampaigns;
    private getQuickCounts;
    private syncCampaignCounters;
    private findWhatsAppAccount;
    private decryptToken;
    private extractFailureReason;
    create(organizationId: string, userId: string, input: any): Promise<any>;
    getList(organizationId: string, query: any): Promise<any>;
    getById(organizationId: string, campaignId: string): Promise<any>;
    update(organizationId: string, campaignId: string, input: any): Promise<any>;
    delete(organizationId: string, campaignId: string): Promise<any>;
    duplicate(organizationId: string, campaignId: string, newName: string): Promise<any>;
    start(organizationId: string, campaignId: string): Promise<any>;
    pause(organizationId: string, campaignId: string): Promise<any>;
    resume(organizationId: string, campaignId: string): Promise<any>;
    cancel(organizationId: string, campaignId: string): Promise<any>;
    retry(organizationId: string, campaignId: string, options?: any): Promise<any>;
    retryFailed(org: string, id: string, contactIds?: string[]): Promise<any>;
    retryFailedContacts(org: string, id: string, contactIds?: string[]): Promise<any>;
    resumePending(org: string, id: string): Promise<any>;
    estimateCost(organizationId: string, campaignId: string): Promise<any>;
    getAnalytics(organizationId: string, campaignId: string): Promise<any>;
    getDetailedStats(organizationId: string, campaignId: string): Promise<{
        totalContacts: number;
        pending: number;
        queued: number;
        sent: number;
        delivered: number;
        read: number;
        failed: number;
        failureReasons: {
            reason: string;
            count: number;
        }[];
        successRate: number;
        deliveryRate: number;
        readRate: number;
    }>;
    getCampaignContacts(organizationId: string, campaignId: string, options: {
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
    }): Promise<{
        contacts: {
            id: string;
            contactId: string;
            phone: string;
            name: string;
            fullName: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            waMessageId: string | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            retryCount: number;
            updatedAt: Date;
        }[];
        recipients: {
            id: string;
            contactId: string;
            phone: string;
            name: string;
            fullName: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            waMessageId: string | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            retryCount: number;
            updatedAt: Date;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getAllRecipients(organizationId: string, campaignId: string, options: any): Promise<{
        summary: {
            totalContacts: number;
            pending: number;
            queued: number;
            sent: number;
            delivered: number;
            read: number;
            failed: number;
            failureReasons: {
                reason: string;
                count: number;
            }[];
            successRate: number;
            deliveryRate: number;
            readRate: number;
        };
        contacts: {
            id: string;
            contactId: string;
            phone: string;
            name: string;
            fullName: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            waMessageId: string | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            retryCount: number;
            updatedAt: Date;
        }[];
        recipients: {
            id: string;
            contactId: string;
            phone: string;
            name: string;
            fullName: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            waMessageId: string | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            retryCount: number;
            updatedAt: Date;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getFailedContacts(organizationId: string, campaignId: string, page: number, limit: number): Promise<{
        contacts: {
            id: string;
            contactId: string;
            phone: string;
            name: string;
            fullName: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            waMessageId: string | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            retryCount: number;
            updatedAt: Date;
        }[];
        recipients: {
            id: string;
            contactId: string;
            phone: string;
            name: string;
            fullName: string;
            status: import(".prisma/client").$Enums.MessageStatus;
            waMessageId: string | null;
            sentAt: Date | null;
            deliveredAt: Date | null;
            readAt: Date | null;
            failedAt: Date | null;
            failureReason: string | null;
            retryCount: number;
            updatedAt: Date;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    exportFailedContactsCsv(organizationId: string, campaignId: string): Promise<string>;
    exportRecipientsCsv(organizationId: string, campaignId: string, status?: string): Promise<string>;
    getStats(organizationId: string): Promise<any>;
    private ensureMetaMediaId;
    private processCampaignContacts;
    private flushBatchResults;
    private saveToInboxBulk;
}
export declare const campaignsService: CampaignsService;
//# sourceMappingURL=campaigns.service.d.ts.map