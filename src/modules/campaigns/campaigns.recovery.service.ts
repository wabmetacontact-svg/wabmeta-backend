// 📁 src/modules/campaigns/campaigns.recovery.service.ts - NEW

import { PrismaClient } from '@prisma/client';
import prisma from '../../config/database';
import { campaignsService } from './campaigns.service';

/**
 * ✅ CRITICAL FIX: Recover stuck campaigns after server restart
 * Render free tier restarts every 15 min idle
 * This ensures campaigns NEVER get permanently stuck
 */
class CampaignRecoveryService {
  
  /**
   * Reset QUEUED contacts back to PENDING
   * QUEUED means "being processed" but if server crashed, they're stuck
   */
  async resetStuckContacts(): Promise<void> {
    try {
      const result = await (prisma as any).campaignContact.updateMany({
        where: { status: 'QUEUED' as any },
        data: { status: 'PENDING' }
      });
      
      if (result.count > 0) {
        console.log(`🔄 Reset ${result.count} QUEUED contacts to PENDING`);
      }
    } catch (error) {
      console.error('❌ Failed to reset stuck contacts:', error);
    }
  }

  /**
   * Resume RUNNING campaigns that stopped mid-process
   */
  async resumeStuckCampaigns(): Promise<void> {
    try {
      const runningCampaigns = await prisma.campaign.findMany({
        where: { status: 'RUNNING' },
        select: { id: true, organizationId: true, name: true }
      });

      console.log(`🔍 Found ${runningCampaigns.length} RUNNING campaigns on startup`);

      for (const campaign of runningCampaigns) {
        const pendingCount = await (prisma as any).campaignContact.count({
          where: {
            campaignId: campaign.id,
            status: { in: ['PENDING', 'QUEUED'] }
          }
        });

        if (pendingCount > 0) {
          console.log(`▶️ Resuming campaign: ${campaign.name} (${pendingCount} pending)`);
          
          // Use service method to restart processing
          (campaignsService as any)['processCampaignContacts'](campaign.id, campaign.organizationId)
            .catch((err: any) => console.error(`Failed to resume ${campaign.id}:`, err));
        } else {
          // No pending contacts - mark as completed
          console.log(`🏁 Marking campaign as completed: ${campaign.name}`);
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: 'COMPLETED', completedAt: new Date() }
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to resume campaigns:', error);
    }
  }

  /**
   * Initialize recovery on server start
   */
  async initialize(): Promise<void> {
    console.log('🚀 Campaign Recovery Service: Initializing...');
    
    // Step 1: Reset stuck contacts
    await this.resetStuckContacts();
    
    // Step 2: Resume campaigns
    await this.resumeStuckCampaigns();
    
    console.log('✅ Campaign Recovery Service: Ready');
  }
}

export const campaignRecoveryService = new CampaignRecoveryService();
