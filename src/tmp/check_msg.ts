import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkMessage() {
  const messages = await prisma.message.findMany({
    where: {
      type: 'TEMPLATE'
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log('Template Messages:', JSON.stringify(messages, null, 2));
}

checkMessage().finally(() => prisma.$disconnect());
