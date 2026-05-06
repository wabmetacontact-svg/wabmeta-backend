import { CampaignStatus, MessageStatus } from '@prisma/client';
export interface CreateCampaignInput {
    name: string;
    description?: string;
    templateId: string;
    whatsappAccountId: string;
    contactGroupId?: string;
    contactIds?: string[];
    audienceFilter?: AudienceFilter;
    scheduledAt?: Date;
    variableMapping?: VariableMapping;
    csvContacts?: Array<{
        phone: string;
        customData: Record<string, string>;
    }>;
}
export interface UpdateCampaignInput {
    name?: string;
    description?: string;
    templateId?: string;
    contactGroupId?: string;
    contactIds?: string[];
    audienceFilter?: AudienceFilter;
    scheduledAt?: Date;
    variableMapping?: VariableMapping;
}
export interface AudienceFilter {
    tags?: string[];
    status?: string[];
    createdAfter?: Date;
    createdBefore?: Date;
    hasMessaged?: boolean;
}
export interface VariableMapping {
    [variableIndex: string]: {
        type: 'field' | 'static';
        value: string;
    };
}
export interface CampaignsQueryInput {
    page?: number;
    limit?: number;
    search?: string;
    status?: CampaignStatus;
    sortBy?: 'createdAt' | 'name' | 'scheduledAt' | 'sentCount';
    sortOrder?: 'asc' | 'desc';
}
export interface CampaignContactsQueryInput {
    page?: number;
    limit?: number;
    status?: MessageStatus;
}
export interface RetryCampaignInput {
    retryFailed?: boolean;
    retryPending?: boolean;
}
export interface CampaignResponse {
    id: string;
    name: string;
    description: string | null;
    templateId: string;
    templateName: string;
    whatsappAccountId: string;
    whatsappAccountPhone: string;
    contactGroupId: string | null;
    contactGroupName: string | null;
    audienceFilter: AudienceFilter | null;
    variableMapping: VariableMapping | null;
    status: CampaignStatus;
    scheduledAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    totalContacts: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    pendingCount: number;
    deliveryRate: number;
    readRate: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface CampaignDetailResponse extends CampaignResponse {
    template: {
        id: string;
        name: string;
        bodyText: string;
        headerType: string | null;
        headerContent: string | null;
    };
    whatsappAccount: {
        id: string;
        phoneNumber: string;
        displayName: string;
    };
    contactGroup: {
        id: string;
        name: string;
    } | null;
}
export interface CampaignContactResponse {
    id: string;
    contactId: string;
    phone: string;
    fullName: string;
    status: MessageStatus;
    waMessageId: string | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
    failedAt: Date | null;
    failureReason: string | null;
    retryCount: number;
}
export interface CampaignsListResponse {
    campaigns: CampaignResponse[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface CampaignStats {
    total: number;
    draft: number;
    scheduled: number;
    running: number;
    active: number;
    completed: number;
    failed: number;
    paused: number;
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalMessagesSent: number;
    totalMessagesDelivered: number;
    totalMessagesRead: number;
    averageDeliveryRate: number;
    averageReadRate: number;
}
export interface CampaignAnalytics {
    hourlyStats: {
        hour: string;
        sent: number;
        delivered: number;
        read: number;
        failed: number;
    }[];
    statusBreakdown: {
        status: string;
        count: number;
        percentage: number;
    }[];
}
export interface CampaignContactData {
    contactId: string;
    phone: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    customFields?: Record<string, any>;
}
export interface ProcessCampaignResult {
    processed: number;
    successful: number;
    failed: number;
    errors: {
        contactId: string;
        error: string;
    }[];
}
//# sourceMappingURL=campaigns.types.d.ts.map