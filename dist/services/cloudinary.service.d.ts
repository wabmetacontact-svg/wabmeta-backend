export declare class CloudinaryService {
    isConfigured(): boolean;
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
    fixExistingTemplateUrl(url: string): Promise<string>;
    uploadInboundMedia(params: {
        buffer: Buffer;
        mimeType: string;
        organizationId: string;
        messageId: string;
    }): Promise<{
        url: string;
        publicId: string;
        resourceType: string;
        size: number;
    } | null>;
    verifyUrlAccessible(url: string): Promise<{
        accessible: boolean;
        status?: number;
        contentType?: string;
        size?: number;
    }>;
    verifyMediaSize(secureUrl: string, mediaCategory: 'image' | 'video' | 'audio' | 'document'): Promise<{
        fits: boolean;
        size: number;
        limit: number;
    }>;
    deleteMedia(publicId: string, resourceType?: 'image' | 'video' | 'raw'): Promise<void>;
}
export declare const cloudinaryService: CloudinaryService;
//# sourceMappingURL=cloudinary.service.d.ts.map