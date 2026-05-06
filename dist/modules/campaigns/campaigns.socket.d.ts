import { Server as SocketServer } from 'socket.io';
/**
 * Initialize campaign socket service with Socket.IO instance
 */
export declare const initializeCampaignSocket: (socketServer: SocketServer) => void;
/**
 * Campaign Socket Service Class
 */
declare class CampaignSocketService {
    /**
     * Emit campaign status update
     */
    emitCampaignUpdate(organizationId: string, campaignId: string, data: {
        status: string;
        message: string;
        totalContacts?: number;
    }): void;
    /**
     * Emit campaign progress updates
     */
    emitCampaignProgress(organizationId: string, campaignId: string, data: {
        sent: number;
        failed: number;
        delivered?: number;
        read?: number;
        total: number;
        percentage: number;
        status: string;
    }): void;
    /**
     * Emit individual contact status update
     */
    emitContactStatus(organizationId: string, campaignId: string, data: {
        contactId: string;
        phone: string;
        status: string;
        messageId?: string;
        error?: string;
    }): void;
    /**
     * Emit campaign completion event
     */
    emitCampaignCompleted(organizationId: string, campaignId: string, stats: {
        sentCount: number;
        failedCount: number;
        deliveredCount: number;
        readCount: number;
        totalRecipients: number;
    }): void;
    /**
     * Emit campaign error
     */
    emitCampaignError(organizationId: string, campaignId: string, error: {
        message: string;
        code?: string;
    }): void;
    /**
     * Emit CSV upload progress
     */
    emitCsvUploadProgress(userId: string, data: {
        uploadId: string;
        progress: number;
        totalRows: number;
        processedRows: number;
        validRows: number;
        invalidRows: number;
        duplicateRows: number;
        status: string;
    }): void;
    /**
     * Emit contact validation results
     */
    emitContactValidation(userId: string, data: {
        uploadId: string;
        contacts: any[];
    }): void;
    /**
     * Check if socket is initialized
     */
    isInitialized(): boolean;
    /**
     * Get Socket.IO instance (for advanced usage)
     */
    getIO(): SocketServer | null;
}
export declare const campaignSocketService: CampaignSocketService;
export default campaignSocketService;
//# sourceMappingURL=campaigns.socket.d.ts.map