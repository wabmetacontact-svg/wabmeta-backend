import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- ALL LEADS ---');
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      contact: {
        select: {
          phone: true,
          firstName: true,
          lastName: true,
        }
      }
    }
  });

  for (const l of leads) {
    console.log(`ID: ${l.id} | Title: ${l.title} | Phone: ${l.contact?.phone} | Score: ${l.score} | Qualified: ${l.chatbotQualified} | Status: ${l.status} | CreatedAt: ${l.createdAt}`);
  }

  console.log('\n--- ACTIVE CHATBOTS ---');
  const chatbots = await prisma.chatbot.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, status: true }
  });
  console.log(chatbots);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
