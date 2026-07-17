import { Server as SocketServer } from 'socket.io';
export declare const initializeCampaignSocket: (socketServer: SocketServer) => void;
declare class CampaignSocketService {
    private emit;
    private getRooms;
    emitCampaignUpdate(organizationId: string, campaignId: string, data: {
        status: string;
        message?: string;
        totalContacts?: number;
        sentCount?: number;
        deliveredCount?: number;
        readCount?: number;
        failedCount?: number;
    }): void;
    emitCampaignProgress(organizationId: string, campaignId: string, data: {
        sent: number;
        failed: number;
        delivered: number;
        read: number;
        total: number;
        percentage: number;
        status: string;
    }): void;
    emitContactStatus(organizationId: string, campaignId: string, data: {
        contactId: string;
        phone: string;
        status: string;
        messageId?: string;
        error?: string;
    }): void;
    emitCampaignCompleted(organizationId: string, campaignId: string, stats: {
        sentCount: number;
        failedCount: number;
        deliveredCount: number;
        readCount: number;
        totalRecipients: number;
    }): void;
    emitCampaignError(organizationId: string, campaignId: string, error: {
        message: string;
        code?: string;
    }): void;
    emitCsvUploadProgress(userId: string, data: any): void;
    isInitialized(): boolean;
    getIO(): SocketServer | null;
}
export declare const campaignSocketService: CampaignSocketService;
export default campaignSocketService;
//# sourceMappingURL=campaigns.socket.d.ts.map