export declare class CampaignsService {
    private processingCampaigns;
    private getQuickCounts;
    private syncCampaignCounters;
    private findWhatsAppAccount;
    create(organizationId: string, userId: string, input: any): Promise<any>;
    getList(organizationId: string, query: any): Promise<any>;
    getById(organizationId: string, campaignId: string): Promise<any>;
    update(organizationId: string, campaignId: string, input: any): Promise<any>;
    delete(organizationId: string, campaignId: string): Promise<any>;
    duplicate(organizationId: string, campaignId: string, newName: string): Promise<any>;
    estimateCost(organizationId: string, campaignId: string): Promise<{
        hasWallet: boolean;
        walletActive: boolean;
        availableBalance: number;
        estimatedCost: number;
        estimatedCostBreakdown: {
            totalRecipients: number;
            ratePerMessage: number;
            category: string;
            language: string;
            countryBreakdown: {
                country: string;
                count: number;
                rate: number;
                cost: number;
            }[];
        };
        canProceed: boolean;
        shortfall: number;
        currency: string;
    }>;
    start(organizationId: string, campaignId: string): Promise<any>;
    pause(organizationId: string, campaignId: string): Promise<any>;
    resume(organizationId: string, campaignId: string): Promise<any>;
    cancel(organizationId: string, campaignId: string): Promise<any>;
    retry(organizationId: string, campaignId: string, options?: any): Promise<any>;
    retryFailed(org: string, id: string, contactIds?: string[]): Promise<any>;
    retryFailedContacts(org: string, id: string, contactIds?: string[]): Promise<any>;
    resumePending(org: string, id: string): Promise<any>;
    getAnalytics(organizationId: string, campaignId: string): Promise<any>;
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
    getAllRecipients(organizationId: string, campaignId: string, options: any): Promise<any>;
    getFailedContacts(organizationId: string, campaignId: string, page: number, limit: number): Promise<any>;
    exportFailedContactsCsv(organizationId: string, campaignId: string): Promise<string>;
    exportRecipientsCsv(organizationId: string, campaignId: string, status?: string): Promise<string>;
    getDetailedStats(organizationId: string, campaignId: string): Promise<any>;
    private processCampaignContacts;
    private flushBatchResults;
    private saveCampaignMessage;
    private getCampaignStats;
    private resolveMediaId;
    private buildTemplatePayload;
    private extractFailureReason;
    private getDecryptedToken;
    getStats(organizationId: string): Promise<any>;
}
export declare const campaignsService: CampaignsService;
//# sourceMappingURL=campaigns.service.d.ts.map