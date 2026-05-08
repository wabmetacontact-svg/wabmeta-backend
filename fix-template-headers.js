// fix-template-headers.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTemplateHeaders() {
  const templates = await prisma.template.findMany({
    where: {
      headerType: { in: ['IMAGE', 'VIDEO', 'DOCUMENT'] }
    },
    select: {
      id: true, name: true, status: true,
      headerType: true, headerMediaId: true, headerContent: true
    }
  });

  console.log(`\n📋 Found ${templates.length} media templates\n`);

  for (const t of templates) {
    const hasGoodUrl = t.headerContent?.startsWith('http') && 
                       !t.headerContent?.includes('scontent');
    const hasBadHandle = t.headerMediaId && 
                         /^\d+:[A-Za-z0-9+/=:_-]+$/.test(t.headerMediaId);
    const hasNumericId = t.headerMediaId && /^\d+$/.test(t.headerMediaId);

    console.log(`Template: "${t.name}" (${t.status})`);
    console.log(`  headerType:    ${t.headerType}`);
    console.log(`  headerContent: ${t.headerContent?.substring(0, 70) || 'NULL'}`);
    console.log(`  headerMediaId: ${t.headerMediaId?.substring(0, 50) || 'NULL'}`);

    if (hasGoodUrl && hasBadHandle) {
      // ✅ Good URL hai, bad handle clear karo
      await prisma.template.update({
        where: { id: t.id },
        data: { headerMediaId: null }
      });
      console.log(`  ✅ FIXED: Cleared expired handle, keeping Cloudinary URL`);

    } else if (hasGoodUrl && !t.headerMediaId) {
      console.log(`  ✅ OK: Has Cloudinary URL`);

    } else if (hasNumericId) {
      console.log(`  ✅ OK: Has numeric media ID`);

    } else if (!hasGoodUrl && !hasNumericId) {
      console.log(`  ❌ BROKEN: No valid media! Re-upload needed`);

    } else {
      console.log(`  ⚠️  Check manually`);
    }
    console.log('');
  }
}

fixTemplateHeaders()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
