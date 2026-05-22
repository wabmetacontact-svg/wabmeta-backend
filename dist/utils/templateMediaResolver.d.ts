/**
 * Resolves a template's header media. If the headerContent is a short-lived Meta CDN URL
 * (scontent.whatsapp.net), it downloads the media, uploads it to Cloudinary, updates the
 * template database record with the new Cloudinary URL, and returns the new URL.
 *
 * If it's already a permanent URL (like Cloudinary), it returns it as-is.
 */
export declare function resolveTemplateHeaderMedia(template: {
    id: string;
    organizationId: string;
    headerType: string | null;
    headerContent: string | null;
}): Promise<string | null>;
//# sourceMappingURL=templateMediaResolver.d.ts.map