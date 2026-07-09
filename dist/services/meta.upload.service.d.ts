export declare class MetaUploadService {
    /**
     * ✅ CORRECT: App-level Resumable Upload API
     * This is the ONLY way to get a handle for template creation
     * Handle format: "4:V2hh..." (long base64-like string)
     */
    uploadMediaForTemplate(_appIdIgnored: string, // ignored - always use config.meta.appId
    accessToken: string, file: Buffer, mimeType: string, filename: string): Promise<{
        handle: string;
    }>;
}
export declare const metaUploadService: MetaUploadService;
//# sourceMappingURL=meta.upload.service.d.ts.map