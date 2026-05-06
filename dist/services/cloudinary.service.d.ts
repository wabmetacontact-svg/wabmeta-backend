export declare class CloudinaryService {
    isConfigured(): boolean;
    /**
     * Upload template media to Cloudinary
     */
    uploadTemplateMedia(file: Buffer, filename: string, mimeType: string, organizationId: string): Promise<{
        url: string;
        secureUrl: string;
        publicId: string;
        format: string;
        resourceType: string;
    }>;
    /**
     * Delete media from Cloudinary
     */
    deleteMedia(publicId: string, resourceType?: 'image' | 'video' | 'raw'): Promise<void>;
}
export declare const cloudinaryService: CloudinaryService;
//# sourceMappingURL=cloudinary.service.d.ts.map