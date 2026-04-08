import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.template.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, headerType: true, headerContent: true, headerMediaId: true, status: true, createdAt: true }
  });
  console.log(JSON.stringify(templates, null, 2));
}

main().finally(() => prisma.$disconnect());
