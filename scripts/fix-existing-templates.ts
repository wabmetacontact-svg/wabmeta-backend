// scripts/fix-existing-templates.ts
// Run once: npx ts-node scripts/fix-existing-templates.ts
// Fixes existing templates that have expired media IDs

import prisma from '../src/config/database';

async function fixTemplates() {
  console.log('🔍 Finding templates with issues...\n');

  // Find all approved templates with media
  const templates = await prisma.template.findMany({
    where: {
      status: 'APPROVED',
      headerType: { in: ['IMAGE', 'VIDEO', 'DOCUMENT'] },
    },
    select: {
      id: true,
      name: true,
      headerType: true,
      headerContent: true,
      headerMediaId: true,
    },
  });

  console.log(`📋 Found ${templates.length} media templates\n`);

  let fixed = 0;
  let broken = 0;
  let clean = 0;

  for (const t of templates) {
    const hasValidUrl = t.headerContent && 
                       t.headerContent.startsWith('http') && 
                       !t.headerContent.includes('scontent.whatsapp') &&
                       !t.headerContent.includes('lookaside.fbsbx.com');

    if (!hasValidUrl) {
      console.log(`❌ BROKEN: "${t.name}" - No valid Cloudinary URL`);
      console.log(`   headerContent: ${t.headerContent?.substring(0, 60) || 'null'}`);
      broken++;
      continue;
    }

    // Clear expired media ID (we don't use it anymore)
    if (t.headerMediaId) {
      await prisma.template.update({
        where: { id: t.id },
        data: {
          headerMediaId: null,
          headerMediaUploadedAt: null,
          headerMediaLastVerified: null,
        },
      });
      console.log(`✅ FIXED: "${t.name}" - Cleared old media ID`);
      fixed++;
    } else {
      console.log(`✓ CLEAN: "${t.name}"`);
      clean++;
    }
  }

  console.log(`\n🏁 Summary:`);
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ✓ Clean: ${clean}`);
  console.log(`   ❌ Broken (need re-upload): ${broken}`);
  
  if (broken > 0) {
    console.log(`\n⚠️  Broken templates need manual media re-upload from template editor.`);
  }

  await prisma.$disconnect();
}

fixTemplates().catch(console.error);
