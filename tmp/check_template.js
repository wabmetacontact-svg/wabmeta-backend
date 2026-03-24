const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Get campaign details
    const campaignId = 'cmn4vd1kl000kb85y97bphtkf';
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { template: true }
    });

    if (!campaign) {
      console.log('❌ Campaign not found:', campaignId);
      process.exit(1);
    }

    console.log('🔍 Current Template:');
    console.log('Template ID:', campaign.template.id);
    console.log('Template Name:', campaign.template.name);
    console.log('Header Type:', campaign.template.headerType);
    console.log('Header Content (URL):', campaign.template.headerContent);
    console.log('Header Media ID:', campaign.template.headerMediaId);
    console.log('');
    console.log('❌ PROBLEM:', 
      campaign.template.headerMediaId?.startsWith('http') 
        ? 'headerMediaId is a URL (should be numeric Meta ID)' 
        : !campaign.template.headerMediaId 
          ? 'headerMediaId is NULL/missing' 
          : 'headerMediaId looks OK'
    );
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
})();
