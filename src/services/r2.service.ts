// src/services/r2.service.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

export class R2Service {
  private s3Client: S3Client | null = null;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.bucket = config.r2.bucketName || 'wabmeta-media';
    this.publicUrl = (config.r2.publicUrl || '').replace(/\/+$/, '');

    if (this.isConfigured()) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.r2.accessKeyId,
          secretAccessKey: config.r2.secretAccessKey,
        },
      });
    }
  }

  isConfigured(): boolean {
    return !!(
      config.r2.accountId &&
      config.r2.accessKeyId &&
      config.r2.secretAccessKey &&
      config.r2.bucketName
    );
  }

  private getClient(): S3Client {
    if (!this.s3Client) {
      if (!this.isConfigured()) {
        throw new Error('Cloudflare R2 is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in .env');
      }
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.r2.accessKeyId,
          secretAccessKey: config.r2.secretAccessKey,
        },
      });
    }
    return this.s3Client;
  }

  getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^\/+/, '');
    if (this.publicUrl) {
      return `${this.publicUrl}/${cleanKey}`;
    }
    // Fallback if publicUrl not set
    return `https://${this.bucket}.${config.r2.accountId}.r2.cloudflarestorage.com/${cleanKey}`;
  }

  async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string
  ): Promise<{ url: string; key: string; size: number }> {
    const client = this.getClient();
    const cleanKey = key.replace(/^\/+/, '');

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      Body: buffer,
      ContentType: contentType,
    });

    await client.send(command);

    return {
      url: this.getPublicUrl(cleanKey),
      key: cleanKey,
      size: buffer.length,
    };
  }

  async uploadTemplateMedia(options: {
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    };
    organizationId: string;
    headerType: string;
    templateName?: string;
  }): Promise<{
    url: string;
    key: string;
    size: number;
    mimeType: string;
    filename: string;
  }> {
    const { file, organizationId, headerType, templateName } = options;
    const ext = file.originalname.split('.').pop() || 'bin';
    const cleanName = templateName
      ? templateName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
      : uuidv4().substring(0, 8);
    const key = `templates/${organizationId}/${cleanName}_${Date.now()}.${ext}`;

    const res = await this.uploadBuffer(file.buffer, key, file.mimetype);

    return {
      url: res.url,
      key: res.key,
      size: res.size,
      mimeType: file.mimetype,
      filename: file.originalname,
    };
  }

  async uploadInboundMedia(options: {
    buffer: Buffer;
    organizationId: string;
    mediaId: string;
    mimeType: string;
    extension?: string;
  }): Promise<{
    url: string;
    key: string;
    size: number;
  }> {
    const { buffer, organizationId, mediaId, mimeType, extension } = options;
    const ext = extension || mimeType.split('/')[1] || 'bin';
    const key = `inbound/${organizationId}/${mediaId}_${Date.now()}.${ext}`;

    const res = await this.uploadBuffer(buffer, key, mimeType);

    return {
      url: res.url,
      key: res.key,
      size: res.size,
    };
  }

  async deleteMedia(keyOrUrl: string): Promise<void> {
    try {
      const client = this.getClient();
      let key = keyOrUrl;
      if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
        const urlObj = new URL(keyOrUrl);
        key = urlObj.pathname.replace(/^\/+/, '');
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await client.send(command);
    } catch (e: any) {
      console.error('❌ Failed to delete R2 media:', e.message);
    }
  }
}

export const r2Service = new R2Service();
export default r2Service;
