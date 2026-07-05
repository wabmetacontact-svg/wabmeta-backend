// src/services/templateMediaPreWarm.service.ts
import prisma from '../config/database';
import { metaApi } from '../modules/meta/meta.api';
import { metaService } from '../modules/meta/meta.service';
import axios from 'axios';
import { WhatsAppAccountStatus } from '@prisma/client';
import { resolveTemplateHeaderMedia } from '../utils/templateMediaResolver';

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
          let url = template.headerContent;
          if (!url || !url.startsWith('http')) {
            console.warn(`⚠️ Template ${template.id} has invalid URL`);
            continue;
          }

          // ✅ Resolve short-lived Meta URL to Cloudinary first if needed
          if (url.includes('scontent.whatsapp')) {
            console.log(`🔄 Template ${template.id} has scontent URL, resolving to Cloudinary first...`);
            const resolved = await resolveTemplateHeaderMedia(template).catch((err) => {
              console.error(`Failed to resolve template media in pre-warm:`, err.message);
              return null;
            });
            if (resolved && !resolved.includes('scontent.whatsapp')) {
              url = resolved;
            } else {
              console.warn(`⚠️ Failed to resolve scontent URL for template ${template.id}`);
              continue;
            }
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
            (template.headerType?.toUpperCase() === 'IMAGE'
              ? 'image/jpeg'
              : template.headerType?.toUpperCase() === 'VIDEO'
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

          // ✅ AUTO-HEAL: If token is expired or account not registered, mark as DISCONNECTED
          const isTokenError = 
            err.message?.includes('token') || 
            err.message?.includes('OAuth') || 
            err.status === 401 || 
            err.status === 403 || 
            err.message?.includes('190') || 
            err.message?.includes('133010') ||
            err.message?.includes('not registered');

          if (isTokenError && template.whatsappAccount?.id) {
            console.warn(`⚠️ Deactivating broken account ${template.whatsappAccount.id} due to pre-warm API error`);
            await prisma.whatsAppAccount.update({
              where: { id: template.whatsappAccount.id },
              data: {
                status: WhatsAppAccountStatus.DISCONNECTED,
                accessToken: null,
              },
            }).catch((e) => console.error('Failed to disconnect account in pre-warm error path:', e));
          }
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
