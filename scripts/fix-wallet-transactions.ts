// scripts/fix-wallet-transactions.ts
import prisma from '../src/config/database';

async function fixWalletTransactionLabels() {
  console.log('🔧 Fixing old wallet transaction labels...\n');

  // ─── Fix DEBIT records ──────────────────────────────────────────────────
  const debitResult = await prisma.walletTransaction.updateMany({
    where: {
      type: 'admin_debit',
      OR: [
        { description: { contains: 'Manual debit by admin', mode: 'insensitive' } },
        { description: { contains: 'manual debit', mode: 'insensitive' } },
        { note: { contains: 'Manual debit by admin', mode: 'insensitive' } },
        { note: { contains: 'manual debit', mode: 'insensitive' } },
      ],
    },
    data: {
      description: 'Adjustment by Meta: Debit by WabMeta',
      note: 'Debit by WabMeta',
    },
  });

  console.log(`✅ Fixed ${debitResult.count} DEBIT transaction(s)`);

  // ─── Fix CREDIT records ─────────────────────────────────────────────────
  const creditResult = await prisma.walletTransaction.updateMany({
    where: {
      type: 'admin_credit',
      OR: [
        { description: { contains: 'Manual credit by admin', mode: 'insensitive' } },
        { description: { contains: 'manual credit', mode: 'insensitive' } },
        { note: { contains: 'Manual credit by admin', mode: 'insensitive' } },
        { note: { contains: 'manual credit', mode: 'insensitive' } },
      ],
    },
    data: {
      description: 'Adjustment by Meta: Credit by WabMeta',
      note: 'Credit by WabMeta',
    },
  });

  console.log(`✅ Fixed ${creditResult.count} CREDIT transaction(s)`);

  // ─── Verify - List remaining old records ───────────────────────────────
  const remaining = await prisma.walletTransaction.findMany({
    where: {
      OR: [
        { description: { contains: 'manual', mode: 'insensitive' } },
        { description: { contains: 'by admin', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      type: true,
      description: true,
      note: true,
      createdAt: true,
    },
    take: 10,
  });

  if (remaining.length > 0) {
    console.log(`\n⚠️ ${remaining.length} record(s) still contain old wording:`);
    console.table(remaining);
  } else {
    console.log('\n🎉 All records cleaned up successfully!');
  }

  console.log('\n✅ Done!');
}

fixWalletTransactionLabels()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
