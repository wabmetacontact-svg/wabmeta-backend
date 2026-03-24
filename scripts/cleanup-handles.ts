import prisma from '../src/config/database';

async function cleanup() {
  console.log('🧹 Cleaning up invalid headerMediaId records...');

  const templates = await (prisma as any).template.findMany({
    where: {
      headerMediaId: { not: null },
    },
  });

  let fixed = 0;
  for (const t of templates) {
    if (t.headerMediaId && !/^\d+$/.test(t.headerMediaId)) {
      console.log(`❌ Removing invalid handle form template "${t.name}": ${t.headerMediaId.substring(0, 30)}...`);
      await (prisma as any).template.update({
        where: { id: t.id },
        data: { headerMediaId: null },
      });
      fixed++;
    }
  }

  console.log(`✅ Fixed ${fixed} templates.`);
  await prisma.$disconnect();
}

cleanup().catch(console.error);
