/**
 * Resolves scontent.whatsapp URLs to Cloudinary
 */
export declare function resolveTemplateHeaderMedia(template: {
    id: string;
    organizationId: string;
    headerType: string | null;
    headerContent: string | null;
}): Promise<string | null>;
export declare function getFreshMediaIdForSending(templateId: string): Promise<string | null>;
export declare function validateTemplateReady(templateId: string): Promise<{
    ready: boolean;
    reason?: string;
}>;
//# sourceMappingURL=templateMediaResolver.d.ts.map