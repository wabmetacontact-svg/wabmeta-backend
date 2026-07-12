/**
 * ✅ MAIN FUNCTION: Resolves scontent.whatsapp.net URLs to Cloudinary
 * Called when template is synced/created from Meta
 */
export declare function resolveTemplateHeaderMedia(template: {
    id: string;
    organizationId: string;
    headerType: string | null;
    headerContent: string | null;
}): Promise<string | null>;
export declare function getFreshMediaIdForSending(templateId: string): Promise<string | null>;
/**
 * ✅ HELPER: Validate template is ready to send
 * Called before campaign starts to fail fast
 */
export declare function validateTemplateReady(templateId: string): Promise<{
    ready: boolean;
    reason?: string;
}>;
//# sourceMappingURL=templateMediaResolver.d.ts.map