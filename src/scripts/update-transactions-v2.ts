import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting second transaction cleanup (Debits/Credits)...');

  // Update descriptions that have 'Manual credit by admin'
  const updateDescCredit = await prisma.walletTransaction.updateMany({
    where: {
      description: {
        contains: 'Manual credit by admin',
      },
    },
    data: {
      description: 'Adjustment by Meta: Credit by Meta'
    },
  });

  // Update descriptions that have 'Manual debit by admin'
  const updateDescDebit = await prisma.walletTransaction.updateMany({
    where: {
      description: {
        contains: 'Manual debit by admin',
      },
    },
    data: {
      description: 'Adjustment by Meta: Debit by Meta'
    },
  });

  // Update notes
  await prisma.walletTransaction.updateMany({
    where: { note: 'Manual credit by admin' },
    data: { note: 'Credit by Meta' },
  });

  await prisma.walletTransaction.updateMany({
    where: { note: 'Manual debit by admin' },
    data: { note: 'Debit by Meta' },
  });

  console.log(`✅ Updated ${updateDescCredit.count} credit descriptions and ${updateDescDebit.count} debit descriptions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
