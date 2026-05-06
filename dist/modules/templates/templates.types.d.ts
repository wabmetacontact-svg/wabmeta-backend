import { TemplateStatus, TemplateCategory } from '@prisma/client';
export interface TemplateButton {
    type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
    text: string;
    url?: string;
    phoneNumber?: string;
}
export interface TemplateVariable {
    index: number;
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
    example?: string;
    defaultValue?: string;
}
export interface CreateTemplateInput {
    name: string;
    language: string;
    category: TemplateCategory;
    headerType?: string | null;
    headerContent?: string | null;
    headerMediaId?: string | null;
    bodyText: string;
    footerText?: string | null;
    buttons?: TemplateButton[];
    variables?: TemplateVariable[];
    whatsappAccountId?: string;
}
export interface UpdateTemplateInput {
    name?: string;
    language?: string;
    category?: TemplateCategory;
    headerType?: string | null;
    headerContent?: string | null;
    headerMediaId?: string | null;
    bodyText?: string;
    footerText?: string | null;
    buttons?: TemplateButton[];
    variables?: TemplateVariable[];
}
export interface TemplatesQueryInput {
    page?: number;
    limit?: number;
    search?: string;
    status?: TemplateStatus;
    category?: TemplateCategory;
    language?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'status';
    sortOrder?: 'asc' | 'desc';
    whatsappAccountId?: string;
    wabaId?: string;
}
export interface TemplateResponse {
    id: string;
    name: string;
    language: string;
    category: TemplateCategory;
    headerType: string | null;
    headerContent: string | null;
    headerMediaId: string | null;
    bodyText: string;
    footerText: string | null;
    buttons: TemplateButton[];
    variables: TemplateVariable[];
    status: TemplateStatus;
    metaTemplateId: string | null;
    rejectionReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    whatsappAccount?: {
        id: string;
        phoneNumber: string;
        displayName: string;
    };
    wabaId: string | null;
    whatsappAccountId: string | null;
}
export interface TemplatesListResponse {
    templates: TemplateResponse[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface TemplateStats {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    byCategory: {
        marketing: number;
        utility: number;
        authentication: number;
    };
}
export interface TemplatePreview {
    header?: string;
    body: string;
    footer?: string;
    buttons?: {
        type: string;
        text: string;
    }[];
}
//# sourceMappingURL=templates.types.d.ts.map