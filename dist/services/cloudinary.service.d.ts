export declare class CloudinaryService {
    isConfigured(): boolean;
    /**
     * ✅ FIXED: Always builds URL with proper extension
     */
    uploadTemplateMedia(file: Buffer, filename: string, mimeType: string, organizationId: string): Promise<{
        url: string;
        secureUrl: string;
        publicId: string;
        format: string;
        resourceType: string;
    }>;
    deleteMedia(publicId: string, resourceType?: 'image' | 'video' | 'raw'): Promise<void>;
}
export declare const cloudinaryService: CloudinaryService;
//# sourceMappingURL=cloudinary.service.d.ts.map