import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Purging expiring Meta CDN URLs from database...');
  
  const result = await prisma.template.updateMany({
    where: {
      headerContent: {
        contains: 'scontent.whatsapp'
      }
    },
    data: {
      headerContent: null
    }
  });

  console.log(`✅ Cleared ${result.count} templates. Users will need to re-upload to set permanent links.`);
}

main().finally(() => prisma.$disconnect());
