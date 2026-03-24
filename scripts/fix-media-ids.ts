/**
 * 🛠️ ONE-TIME FIX SCRIPT: Check templates missing headerMediaId
 * 
 * Run with:  npx ts-node scripts/fix-media-ids.ts
 * 
 * This script will:
 * 1. Show all templates that have IMAGE/VIDEO/DOCUMENT header but NO headerMediaId
 * 2. These templates will cause 131053 errors when used in campaigns
 * 3. You need to RE-UPLOAD media for those templates or re-create them
 */

import prisma from '../src/config/database';

async function main() {
  console.log('\n🔍 Checking templates with missing headerMediaId...\n');

  // Find all media templates that are APPROVED but missing headerMediaId
  const problematic = await prisma.template.findMany({
    where: {
      status: 'APPROVED',
      headerType: { in: ['IMAGE', 'VIDEO', 'DOCUMENT'] },
      OR: [
        { headerMediaId: null },
        { headerMediaId: '' },
      ],
    } as any,
    select: {
      id: true,
      name: true,
      language: true,
      headerType: true,
      headerContent: true,
      headerMediaId: true,
      whatsappAccountId: true,
      organizationId: true,
    },
  });

  if (problematic.length === 0) {
    console.log('✅ All media templates have headerMediaId set. No issues found!\n');
  } else {
    console.log(`❌ Found ${problematic.length} template(s) with MISSING headerMediaId:\n`);
    for (const t of problematic) {
      console.log(`  Template: "${t.name}" (${t.language})`);
      console.log(`    ID:           ${t.id}`);
      console.log(`    headerType:   ${t.headerType}`);
      console.log(`    headerMediaId: ${t.headerMediaId || 'NULL ← THIS CAUSES 403!'}`);
      console.log(`    headerContent: ${(t.headerContent || '').substring(0, 80)}`);
      console.log(`    orgId:         ${t.organizationId}`);
      console.log('');
    }
    console.log('⚠️  ACTION REQUIRED:');
    console.log('   These templates will fail with error 131053 (Media upload error)');
    console.log('   in campaigns because Meta cannot download your storage URLs.');
    console.log('');
    console.log('   FIX: For each template above:');
    console.log('   1. Go to Dashboard → Templates');
    console.log('   2. Re-upload the media file for that template');
    console.log('   3. OR delete and recreate the template with a fresh media upload');
  }

  // Also show healthy templates as reference
  const healthy = await prisma.template.findMany({
    where: {
      status: 'APPROVED',
      headerType: { in: ['IMAGE', 'VIDEO', 'DOCUMENT'] },
      headerMediaId: { not: null },
    } as any,
    select: { id: true, name: true, language: true, headerType: true, headerMediaId: true },
  });

  if (healthy.length > 0) {
    console.log(`\n✅ Healthy templates (have headerMediaId): ${healthy.length}`);
    for (const t of healthy) {
      console.log(`   ✅ "${t.name}" (${t.language}) → ${t.headerType} → ID: ${String(t.headerMediaId).substring(0, 25)}...`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Script error:', e);
  process.exit(1);
});
