export declare class CloudinaryService {
    isConfigured(): boolean;
    /**
     * ✅ Upload with automatic compression for WhatsApp
     * - Videos: compressed to fit 16MB limit
     * - Images: optimized to fit 5MB limit
     * - Documents: uploaded as-is (100MB limit)
     */
    uploadTemplateMedia(file: Buffer, filename: string, mimeType: string, organizationId: string): Promise<{
        url: string;
        secureUrl: string;
        publicId: string;
        format: string;
        resourceType: string;
        originalSize: number;
        finalSize: number;
        compressionApplied: boolean;
    }>;
    /**
     * ✅ Verify compressed media size fits Meta limit
     * Call this after upload to double-check
     */
    verifyMediaSize(secureUrl: string, mediaCategory: 'image' | 'video' | 'audio' | 'document'): Promise<{
        fits: boolean;
        size: number;
        limit: number;
    }>;
    deleteMedia(publicId: string, resourceType?: 'image' | 'video' | 'raw'): Promise<void>;
}
export declare const cloudinaryService: CloudinaryService;
//# sourceMappingURL=cloudinary.service.d.ts.map