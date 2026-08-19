// scripts/emergency-fixes.ts
// Run this ONCE to fix existing data

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚨 EMERGENCY FIXES STARTING...\n');

  // ═══════════════════════════════════════════
  // FIX 1: Cloudinary raw URLs → add fl_attachment
  // ═══════════════════════════════════════════
  console.log('📋 Fix 1: Cloudinary raw URLs');
  const rawTemplates = await prisma.template.findMany({
    where: {
      headerContent: { contains: '/raw/upload/' },
      NOT: { headerContent: { contains: 'fl_attachment' } },
    },
  });
  console.log(`   Found ${rawTemplates.length} templates to fix`);

  for (const t of rawTemplates) {
    const newUrl = t.headerContent!.replace(
      '/raw/upload/',
      '/raw/upload/fl_attachment/'
    );
    await prisma.template.update({
      where: { id: t.id },
      data: {
        headerContent: newUrl,
        headerMediaId: null,
        headerMediaUploadedAt: null,
      } as any,
    });
    console.log(`   ✅ Fixed: ${t.name}`);
  }

  // ═══════════════════════════════════════════
  // FIX 2: Mark broken "COMPLETED" campaigns as FAILED
  // ═══════════════════════════════════════════
  console.log('\n📋 Fix 2: Wrong "COMPLETED" campaigns');
  const brokenCampaigns = await prisma.campaign.findMany({
    where: {
      status: 'COMPLETED',
      failedCount: { gt: 0 },
      deliveredCount: 0,
    },
    select: {
      id: true, name: true, organizationId: true,
      sentCount: true, failedCount: true, totalContacts: true,
    },
  });
  console.log(`   Found ${brokenCampaigns.length} broken campaigns`);

  for (const c of brokenCampaigns) {
    const failRate = (c.failedCount / (c.totalContacts || 1)) * 100;
    if (failRate > 80) {
      await prisma.campaign.update({
        where: { id: c.id },
        data: { status: 'FAILED' as any },
      });
      console.log(`   ✅ Marked FAILED: ${c.name} (${failRate.toFixed(1)}% failed)`);
    }
  }

  // ═══════════════════════════════════════════
  // FIX 3: Refund unrefunded failed messages
  // ═══════════════════════════════════════════
  console.log('\n📋 Fix 3: Missed refunds for failed messages');
  
  const failedNoRefund = await prisma.campaignContact.findMany({
    where: {
      status: 'FAILED',
      failedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
    include: {
      campaign: {
        include: { template: true },
      },
      contact: { select: { phone: true } },
    },
    take: 5000,
  });

  const { getRateForCategory } = await import('../src/modules/wallet/wallet.deduction.service');
  
  let refundCount = 0;
  for (const cc of failedNoRefund) {
    if (!cc.waMessageId || !cc.campaign?.template) continue;

    // Check if refund already exists
    const existingRefund = await prisma.walletTransaction.findFirst({
      where: {
        metaChargeId: cc.waMessageId,
        metaService: 'template_message_refund',
      },
    });

    if (existingRefund) continue;

    // Refund
    const wallet = await prisma.wallet.findUnique({
      where: { organizationId: cc.campaign.organizationId },
    });

    if (!wallet) continue;

    const rateRupees = getRateForCategory(
      cc.campaign.template.category || 'MARKETING',
      cc.contact?.phone || '',
      cc.campaign.template.language,
    );
    const refundPaise = Math.round(rateRupees * 100);

    if (refundPaise <= 0) continue;

    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: wallet.id },
        data: { balancePaise: { increment: refundPaise } },
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'credit',
          amountPaise: refundPaise,
          balanceBeforePaise: wallet.balancePaise,
          balanceAfterPaise: wallet.balancePaise + refundPaise,
          description: `Emergency refund: Failed msg (${cc.contact?.phone})`,
          status: 'completed',
          metaChargeId: cc.waMessageId,
          metaService: 'template_message_refund',
          note: `Emergency refund (Campaign: ${cc.campaignId})`,
        },
      }),
    ]);

    refundCount++;
    if (refundCount % 50 === 0) console.log(`   Refunded ${refundCount}...`);
  }

  console.log(`   ✅ Total emergency refunds: ${refundCount}`);

  console.log('\n✅ ALL EMERGENCY FIXES COMPLETE!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
