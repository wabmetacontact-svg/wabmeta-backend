export declare class InboxMediaService {
    getMediaUrl(mediaId: string, accessToken: string): Promise<string | null>;
    downloadMediaAsBase64(mediaId: string, accessToken: string, mimeType?: string): Promise<{
        base64: string;
        mimeType: string;
    } | null>;
    getProxiedMediaUrl(mediaId: string, organizationId: string): Promise<string | null>;
    processIncomingMedia(mediaId: string, mediaType: string, organizationId: string): Promise<{
        url: string | null;
        base64: string | null;
        mimeType: string;
        mediaId: string;
    }>;
}
export declare const inboxMediaService: InboxMediaService;
export default inboxMediaService;
//# sourceMappingURL=inbox.media.d.ts.map