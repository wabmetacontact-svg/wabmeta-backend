// scripts/recover-failed-refunds.ts

import prisma from '../src/config/database';
import { getRateForCategory } from '../src/modules/wallet/wallet.deduction.service';

async function recoverFailedRefunds() {
  console.log('🔍 Searching for failed messages without refunds...\n');

  // ✅ Sabhi FAILED campaign contacts nikaalo (last 7 days)
  const failedContacts = await prisma.campaignContact.findMany({
    where: {
      status: 'FAILED',
      failedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
      waMessageId: { not: null },
    },
    include: {
      contact: { select: { phone: true } },
      campaign: {
        include: {
          template: { select: { name: true, category: true, language: true } },
        },
      },
    },
  });

  console.log(`Found ${failedContacts.length} failed messages\n`);

  let refunded = 0;
  let skipped = 0;
  let failed = 0;

  for (const cc of failedContacts) {
    try {
      if (!cc.waMessageId) continue;

      // Check if already refunded
      const existing = await prisma.walletTransaction.findFirst({
        where: {
          metaChargeId: cc.waMessageId,
          metaService: 'template_message_refund',
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const template = cc.campaign.template;
      const rateRupees = getRateForCategory(
        template.category || 'MARKETING',
        cc.contact.phone || '',
        template.language,
      );
      const refundPaise = Math.round(rateRupees * 100);

      if (refundPaise <= 0) continue;

      // Process refund with generous timeout
      await prisma.$transaction(
        async (tx) => {
          const wallet = await tx.wallet.findUnique({
            where: { organizationId: cc.campaign.organizationId },
          });
          if (!wallet) throw new Error('Wallet not found');

          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balancePaise: wallet.balancePaise + refundPaise },
          });

          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'credit',
              amountPaise: refundPaise,
              balanceBeforePaise: wallet.balancePaise,
              balanceAfterPaise: wallet.balancePaise + refundPaise,
              description: `Recovery refund: ${cc.contact.phone} - ${template.name}`,
              status: 'completed',
              metaChargeId: cc.waMessageId!,
              metaService: 'template_message_refund',
              note: `Manual recovery (Campaign: ${cc.campaignId})`,
            },
          });
        },
        { timeout: 30000 },
      );

      refunded++;
      console.log(`✅ Refunded ₹${rateRupees.toFixed(2)} to ${cc.contact.phone}`);

      // Small delay
      await new Promise(r => setTimeout(r, 50));
    } catch (err: any) {
      failed++;
      console.error(`❌ Failed for ${cc.contact.phone}: ${err.message}`);
    }
  }

  console.log(`\n📊 Recovery Summary:`);
  console.log(`   ✅ Refunded: ${refunded}`);
  console.log(`   ⏭️  Skipped (already refunded): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   💰 Total refunded: ₹${refunded * 1}`);
  
  process.exit(0);
}

recoverFailedRefunds().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
