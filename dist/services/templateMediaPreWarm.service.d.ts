/**
 * Pre-warm template media before they expire.
 * Runs daily. Re-uploads media for templates with:
 * - Approved status
 * - Has Cloudinary URL
 * - Numeric ID is older than 20 days OR missing
 */
export declare class TemplateMediaPreWarmService {
    private isRunning;
    preWarmExpiringMedia(): Promise<{
        checked: number;
        refreshed: number;
        failed: number;
    }>;
}
export declare const templateMediaPreWarmService: TemplateMediaPreWarmService;
//# sourceMappingURL=templateMediaPreWarm.service.d.ts.map