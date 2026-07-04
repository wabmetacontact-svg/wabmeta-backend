// src/services/templateMediaPreWarm.service.ts
import prisma from '../config/database';
import { metaApi } from '../modules/meta/meta.api';
import { metaService } from '../modules/meta/meta.service';
import axios from 'axios';

/**
 * Pre-warm template media before they expire.
 * Runs daily. Re-uploads media for templates with:
 * - Approved status
 * - Has Cloudinary URL
 * - Numeric ID is older than 20 days OR missing
 */
export class TemplateMediaPreWarmService {
  private isRunning = false;

  async preWarmExpiringMedia(): Promise<{
    checked: number;
    refreshed: number;
    failed: number;
  }> {
    if (this.isRunning) {
      console.log('⏳ Pre-warm already running, skipping...');
      return { checked: 0, refreshed: 0, failed: 0 };
    }

    this.isRunning = true;
    console.log('🔥 Starting template media pre-warm...');

    let checked = 0;
    let refreshed = 0;
    let failed = 0;

    try {
      // Find templates that need refresh
      const REFRESH_THRESHOLD_DAYS = 25; // Meta ID valid for 30 days, refresh at 25
      const thresholdDate = new Date(
        Date.now() - REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
      );

      const templates = await prisma.template.findMany({
        where: {
          status: 'APPROVED',
          headerType: { in: ['IMAGE', 'VIDEO', 'DOCUMENT'] },
          headerContent: { not: null }, // Must have permanent URL
          OR: [
            { headerMediaUploadedAt: null },
            { headerMediaUploadedAt: { lt: thresholdDate } },
          ],
        },
        include: { whatsappAccount: true },
        take: 100, // Process 100 per run
        orderBy: { headerMediaUploadedAt: 'asc' }, // Oldest first
      });

      console.log(`📋 Found ${templates.length} templates needing refresh`);
      checked = templates.length;

      for (const template of templates) {
        try {
          if (!template.whatsappAccount) {
            console.warn(`⚠️ Template ${template.id} has no account`);
            continue;
          }

          // Skip if URL is not valid
          const url = template.headerContent;
          if (!url || !url.startsWith('http') || url.includes('scontent.whatsapp')) {
            console.warn(`⚠️ Template ${template.id} has invalid URL`);
            continue;
          }

          // Get decrypted token
          const accountWithToken = await metaService.getAccountWithToken(
            template.whatsappAccount.id
          );
          if (!accountWithToken) {
            console.warn(`⚠️ Cannot decrypt token for ${template.whatsappAccount.id}`);
            failed++;
            continue;
          }

          console.log(`🔄 Pre-warming template: ${template.name}`);

          // Download from Cloudinary
          const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });

          const buffer = Buffer.from(response.data);
          const mimeType =
            response.headers['content-type']?.split(';')[0]?.trim() ||
            (template.headerType === 'IMAGE'
              ? 'image/jpeg'
              : template.headerType === 'VIDEO'
              ? 'video/mp4'
              : 'application/pdf');

          const filename = url.split('/').pop()?.split('?')[0] || 'media';

          // Upload to Meta
          const result = await metaApi.uploadMedia(
            template.whatsappAccount.phoneNumberId,
            accountWithToken.accessToken,
            buffer,
            mimeType,
            filename,
            template.whatsappAccount.wabaId
          );

          // Update DB with fresh ID
          await prisma.template.update({
            where: { id: template.id },
            data: {
              headerMediaId: result.id,
              headerMediaUploadedAt: new Date(),
              headerMediaLastVerified: new Date(),
            },
          });

          console.log(`✅ Pre-warmed: ${template.name} → ${result.id}`);
          refreshed++;

          // Throttle: 1 second between uploads
          await new Promise(r => setTimeout(r, 1000));
        } catch (err: any) {
          console.error(
            `❌ Pre-warm failed for ${template.name}:`,
            err.message
          );
          failed++;
        }
      }

      console.log(
        `🏁 Pre-warm complete: ${refreshed} refreshed, ${failed} failed`
      );
      return { checked, refreshed, failed };
    } finally {
      this.isRunning = false;
    }
  }
}

export const templateMediaPreWarmService = new TemplateMediaPreWarmService();
