"use strict";
// 📁 src/modules/campaigns/campaigns.recovery.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignRecoveryService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const campaigns_service_1 = require("./campaigns.service");
class CampaignRecoveryService {
    async resetStuckContacts() {
        try {
            const result = await database_1.default.campaignContact.updateMany({
                where: { status: 'QUEUED' },
                data: { status: 'PENDING' },
            });
            if (result.count > 0) {
                console.log(`🔄 Reset ${result.count} QUEUED contacts to PENDING`);
            }
        }
        catch (error) {
            console.error('❌ Failed to reset stuck contacts:', error);
        }
    }
    async resumeStuckCampaigns() {
        try {
            const runningCampaigns = await database_1.default.campaign.findMany({
                where: { status: 'RUNNING' },
                select: { id: true, organizationId: true, name: true },
            });
            console.log(`🔍 Found ${runningCampaigns.length} RUNNING campaigns`);
            for (const campaign of runningCampaigns) {
                const pendingCount = await database_1.default.campaignContact.count({
                    where: {
                        campaignId: campaign.id,
                        status: { in: ['PENDING', 'QUEUED'] },
                    },
                });
                if (pendingCount > 0) {
                    console.log(`▶️ Resuming: ${campaign.name} (${pendingCount} pending)`);
                    campaigns_service_1.campaignsService
                        .processCampaignContacts(campaign.id, campaign.organizationId)
                        .catch((err) => console.error(`Resume error:`, err));
                }
                else {
                    console.log(`🏁 Completing: ${campaign.name}`);
                    await database_1.default.campaign.update({
                        where: { id: campaign.id },
                        data: { status: 'COMPLETED', completedAt: new Date() },
                    });
                }
            }
        }
        catch (error) {
            console.error('❌ Failed to resume campaigns:', error);
        }
    }
    async initialize() {
        console.log('🚀 Campaign Recovery: Initializing...');
        await this.resetStuckContacts();
        await this.resumeStuckCampaigns();
        console.log('✅ Campaign Recovery: Ready');
    }
}
exports.campaignRecoveryService = new CampaignRecoveryService();
//# sourceMappingURL=campaigns.recovery.service.js.map