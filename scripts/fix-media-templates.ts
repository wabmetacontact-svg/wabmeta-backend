// scripts/fix-media-templates.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixBrokenMediaTemplates() {
  console.log('🔍 Finding templates with Meta CDN URLs...');
  
  const templates = await prisma.template.findMany({
    where: {
      OR: [
        { headerContent: { contains: 'scontent.whatsapp' } },
        { headerContent: { contains: 'scontent-' } },
        { headerContent: { contains: 'lookaside.fbsbx.com' } },
        { headerContent: { contains: 'fbcdn.net' } },
      ],
    },
    select: {
      id: true,
      name: true,
      headerContent: true,
      headerMediaId: true,
    },
  });

  console.log(`Found ${templates.length} templates with Meta CDN URLs`);
  
  for (const t of templates) {
    console.log(`\n📋 Template: ${t.name}`);
    console.log(`   URL: ${t.headerContent?.substring(0, 60)}...`);
    console.log(`   Media ID: ${t.headerMediaId || 'null'}`);
  }
  
  console.log(`\n💡 These templates need media re-upload from user side.`);
  console.log(`   Clearing invalid cached media IDs so next attempt re-uploads...`);
  
  const result = await prisma.template.updateMany({
    where: {
      OR: [
        { headerContent: { contains: 'scontent.whatsapp' } },
        { headerContent: { contains: 'scontent-' } },
      ],
    },
    data: {
      headerMediaId: null,
      headerMediaUploadedAt: null,
    },
  });
  
  console.log(`\n✅ Cleared ${result.count} cached media IDs`);
  console.log(`⚠️  Users must re-upload media for these templates to work in campaigns.`);
}

fixBrokenMediaTemplates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
