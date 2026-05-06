export declare class MetaUploadService {
    /**
     * Upload media to Meta using App-level Resumable Upload API
     * This returns a handle usable for template creation
     */
    uploadMediaForTemplate(appId: string, accessToken: string, file: Buffer, mimeType: string, filename: string): Promise<{
        handle: string;
    }>;
    /**
     * Simple: Upload to Phone Number ID and get media ID
     */
    uploadMediaSimple(phoneNumberId: string, accessToken: string, file: Buffer, mimeType: string, filename: string): Promise<{
        id: string;
    }>;
}
export declare const metaUploadService: MetaUploadService;
//# sourceMappingURL=meta.upload.service.d.ts.map