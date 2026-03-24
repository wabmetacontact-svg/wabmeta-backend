const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const campaignId = 'cmn4vd1kl000kb85y97bphtkf';

    // Reset failed contacts to PENDING
    const result = await prisma.campaignContact.updateMany({
      where: {
        campaignId: campaignId,
        status: 'FAILED'
      },
      data: {
        status: 'PENDING',
        failedAt: null,
        failureReason: null,
        retryCount: { increment: 1 }
      }
    });

    console.log('✅ Reset', result.count, 'failed contacts to PENDING');

    // Resume campaign
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' }
    });

    console.log('✅ Campaign resumed');
  } catch (err) {
    console.error(err.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
})();
