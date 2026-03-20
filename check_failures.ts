import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const reasons = await prisma.campaignContact.groupBy({
      by: ['failureReason'],
      where: { status: 'FAILED' },
      _count: { failureReason: true },
    });
    console.log(JSON.stringify(reasons, null, 2));
  } catch(e) { console.error(e); }
  finally { await prisma.$disconnect(); }
}

main();
