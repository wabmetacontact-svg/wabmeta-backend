// 📁 src/modules/campaigns/campaigns.recovery.service.ts

import prisma from '../../config/database';
import { campaignsService } from './campaigns.service';

class CampaignRecoveryService {
  async resetStuckContacts(): Promise<void> {
    try {
      const result = await prisma.campaignContact.updateMany({
        where: { status: 'QUEUED' as any },
        data: { status: 'PENDING' },
      });

      if (result.count > 0) {
        console.log(`🔄 Reset ${result.count} QUEUED contacts to PENDING`);
      }
    } catch (error) {
      console.error('❌ Failed to reset stuck contacts:', error);
    }
  }

  async resumeStuckCampaigns(): Promise<void> {
    try {
      const runningCampaigns = await prisma.campaign.findMany({
        where: { status: 'RUNNING' },
        select: { id: true, organizationId: true, name: true },
      });

      console.log(`🔍 Found ${runningCampaigns.length} RUNNING campaigns`);

      for (const campaign of runningCampaigns) {
        const pendingCount = await prisma.campaignContact.count({
          where: {
            campaignId: campaign.id,
            status: { in: ['PENDING', 'QUEUED'] },
          },
        });

        if (pendingCount > 0) {
          console.log(`▶️ Resuming: ${campaign.name} (${pendingCount} pending)`);

          (campaignsService as any)
            .processCampaignContacts(campaign.id, campaign.organizationId)
            .catch((err: any) => console.error(`Resume error:`, err));
        } else {
          console.log(`🏁 Completing: ${campaign.name}`);
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to resume campaigns:', error);
    }
  }

  async initialize(): Promise<void> {
    console.log('🚀 Campaign Recovery: Initializing...');
    await this.resetStuckContacts();
    await this.resumeStuckCampaigns();
    console.log('✅ Campaign Recovery: Ready');
  }
}

export const campaignRecoveryService = new CampaignRecoveryService();
