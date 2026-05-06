import { TemplateStatus } from '@prisma/client';
import { CreateTemplateInput, UpdateTemplateInput, TemplatesQueryInput, TemplateResponse, TemplatesListResponse, TemplateStats, TemplatePreview, TemplateButton } from './templates.types';
export declare class TemplatesService {
    /**
     * Validate template before creation/update
     */
    validateTemplate(input: CreateTemplateInput): {
        valid: boolean;
        errors: string[];
    };
    /**
     * ✅ NEW: Helper to extract smuggled URL from mediaId
     */
    private extractSmuggledMedia;
    /**
     * Create new template
     */
    create(organizationId: string, input: CreateTemplateInput & {
        whatsappAccountId?: string;
        headerMediaId?: string;
        headerContent?: string;
        metaNumericId?: string | null;
        cloudinaryUrl?: string | null;
        permanentUrl?: string | null;
    }): Promise<TemplateResponse>;
    /**
     * Get list of templates with filtering
     */
    getList(organizationId: string, query: TemplatesQueryInput & {
        whatsappAccountId?: string;
        wabaId?: string;
    }): Promise<TemplatesListResponse>;
    /**
     * Get approved templates only
     */
    getApprovedTemplates(organizationId: string, whatsappAccountId?: string, wabaId?: string): Promise<TemplateResponse[]>;
    /**
     * Sync templates from Meta
     */
    syncFromMeta(organizationId: string, whatsappAccountId?: string): Promise<{
        message: string;
        synced: number;
    }>;
    /**
     * Get template by ID
     */
    getById(organizationId: string, templateId: string): Promise<TemplateResponse>;
    /**
     * Update template
     */
    update(organizationId: string, templateId: string, input: UpdateTemplateInput & {
        headerMediaId?: string;
        headerContent?: string;
        whatsappAccountId?: string;
    }): Promise<TemplateResponse>;
    /**
     * Delete template
     */
    delete(organizationId: string, templateId: string): Promise<{
        message: string;
    }>;
    /**
     * Get template statistics
     */
    getStats(organizationId: string, whatsappAccountId?: string): Promise<TemplateStats>;
    /**
     * Duplicate template
     */
    duplicate(organizationId: string, templateId: string, newName: string, targetWhatsappAccountId?: string): Promise<TemplateResponse>;
    /**
     * Preview template with variables
     */
    preview(bodyText: string, variables?: Record<string, string>, headerType?: string, headerContent?: string, footerText?: string, buttons?: TemplateButton[]): Promise<TemplatePreview>;
    /**
     * Submit template to Meta
     */
    submitToMeta(organizationId: string, templateId: string, whatsappAccountId?: string): Promise<{
        message: string;
        metaTemplateId?: string;
    }>;
    /**
     * Get available languages
     */
    getLanguages(organizationId: string, whatsappAccountId?: string): Promise<{
        language: string;
        count: number;
    }[]>;
    /**
     * Update template status (called from webhook)
     */
    updateStatus(metaTemplateId: string, status: TemplateStatus, rejectionReason?: string): Promise<void>;
    /**
     * Sync templates for specific account
     */
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