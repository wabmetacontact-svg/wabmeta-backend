
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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
    console.log('Campaign not found');
    return;
  }

  console.log('Campaign Name:', campaign.name);
  console.log('Template Name:', campaign.template.name);
  console.log('Template Header Type:', campaign.template.headerType);
  console.log('Template Body:', campaign.template.bodyText);
  console.log('Template Buttons:', JSON.stringify(campaign.template.buttons, null, 2));
  console.log('Template Variables:', JSON.stringify(campaign.template.variables, null, 2));
  
  if (campaign.campaignContacts.length > 0) {
    console.log('Failed Contact Custom Data:', JSON.stringify(campaign.campaignContacts[0].customData, null, 2));
    console.log('Failure Reason:', campaign.campaignContacts[0].failureReason);
  }
}

checkCampaign().catch(console.error).finally(() => prisma.$disconnect());
