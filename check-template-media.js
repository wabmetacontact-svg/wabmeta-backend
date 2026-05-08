const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTemplates() {
  const templates = await prisma.template.findMany({
    where: {
      headerType: { in: ['IMAGE', 'VIDEO', 'DOCUMENT'] }
    },
    select: {
      id: true,
      name: true,
      headerType: true,
      headerMediaId: true,
      headerContent: true,
      status: true,
    }
  });

  console.log('\n📋 Templates with Media Headers:');
  console.log('='.repeat(60));
  
  for (const t of templates) {
    const mediaValue = t.headerMediaId || t.headerContent;
    const isUrl = mediaValue?.startsWith('http');
    const isMediaId = mediaValue && !isUrl;
    
    console.log(`\nTemplate: ${t.name} (${t.status})`);
    console.log(`  HeaderType: ${t.headerType}`);
    console.log(`  headerMediaId: ${t.headerMediaId || 'NULL'}`);
    console.log(`  headerContent: ${t.headerContent?.substring(0, 50) || 'NULL'}`);
    console.log(`  Will use: ${isUrl ? '{ link: "'+mediaValue?.substring(0,30)+'..." }' : '{ id: "'+mediaValue?.substring(0,30)+'..." }'}`);
    console.log(`  Status: ${isUrl ? '✅ URL' : isMediaId ? '✅ Media ID' : '❌ NO MEDIA!'}`);
  }
}

checkTemplates().finally(() => prisma.$disconnect());
