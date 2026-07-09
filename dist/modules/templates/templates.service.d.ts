import { TemplateStatus } from '@prisma/client';
import { CreateTemplateInput, UpdateTemplateInput, TemplatesQueryInput, TemplateResponse, TemplatesListResponse, TemplateStats, TemplatePreview, TemplateButton } from './templates.types';
export declare class TemplatesService {
    validateTemplate(input: CreateTemplateInput): {
        valid: boolean;
        errors: string[];
    };
    private extractSmuggledMedia;
    create(organizationId: string, input: CreateTemplateInput & {
        whatsappAccountId?: string;
        headerMediaId?: string;
        headerContent?: string;
        metaNumericId?: string | null;
        cloudinaryUrl?: string | null;
        permanentUrl?: string | null;
        headerVariables?: Record<string, string>;
    }): Promise<TemplateResponse>;
    getList(organizationId: string, query: TemplatesQueryInput & {
        whatsappAccountId?: string;
        wabaId?: string;
    }): Promise<TemplatesListResponse>;
    getApprovedTemplates(organizationId: string, whatsappAccountId?: string, wabaId?: string): Promise<TemplateResponse[]>;
    syncFromMeta(organizationId: string, whatsappAccountId?: string): Promise<{
        message: string;
        synced: number;
    }>;
    getById(organizationId: string, templateId: string): Promise<TemplateResponse>;
    update(organizationId: string, templateId: string, input: UpdateTemplateInput & {
        headerMediaId?: string;
        headerContent?: string;
        whatsappAccountId?: string;
    }): Promise<TemplateResponse>;
    delete(organizationId: string, templateId: string): Promise<{
        message: string;
    }>;
    getStats(organizationId: string, whatsappAccountId?: string): Promise<TemplateStats>;
    duplicate(organizationId: string, templateId: string, newName: string, targetWhatsappAccountId?: string): Promise<TemplateResponse>;
    preview(bodyText: string, variables?: Record<string, string>, headerType?: string, headerContent?: string, footerText?: string, buttons?: TemplateButton[]): Promise<TemplatePreview>;
    submitToMeta(organizationId: string, templateId: string, whatsappAccountId?: string): Promise<{
        message: string;
        metaTemplateId?: string;
    }>;
    getLanguages(organizationId: string, whatsappAccountId?: string): Promise<{
        language: string;
        count: number;
    }[]>;
    updateStatus(metaTemplateId: string, status: TemplateStatus, rejectionReason?: string): Promise<void>;
    syncTemplatesForAccount(organizationId: string, whatsappAccountId: string): Promise<{
        created: number;
        updated: number;
        removed: number;
        skipped: number;
        total: number;
    }>;
}
export declare const templatesService: TemplatesService;
export default templatesService;
//# sourceMappingURL=templates.service.d.ts.map