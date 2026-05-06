"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const prisma = new client_1.PrismaClient();
async function checkCampaign() {
    const campaignId = 'cmn2543810i64ypdxe5r3kh9c';
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
            template: true,
            campaignContacts: {
                take: 1,
                where: { status: 'FAILED' }
            }
        }
    });
    if (!campaign) {
        fs_1.default.writeFileSync('campaign_check_output.json', JSON.stringify({ error: 'Campaign not found' }));
        return;
    }
    const result = {
        campaignName: campaign.name,
        templateName: campaign.template.name,
        headerType: campaign.template.headerType,
        headerContent: campaign.template.headerContent,
        bodyText: campaign.template.bodyText,
        buttons: campaign.template.buttons,
        variables: campaign.template.variables,
        failedContactCustomData: campaign.campaignContacts.length > 0 ? campaign.campaignContacts[0].customData : null,
        failureReason: campaign.campaignContacts.length > 0 ? campaign.campaignContacts[0].failureReason : null,
    };
    fs_1.default.writeFileSync('campaign_check_output.json', JSON.stringify(result, null, 2));
}
checkCampaign().catch(err => fs_1.default.writeFileSync('campaign_check_output.json', JSON.stringify({ error: err.message }))).finally(() => prisma.$disconnect());
//# sourceMappingURL=check_failed_campaign_v2.js.map