/**
 * FIX SCRIPT: Re-fetch headerMediaId from Meta API for templates that lost it during sync.
 * 
 * Run: npx ts-node scripts/restore-media-ids.ts
 */

import prisma from '../src/config/database';
import { metaApi } from '../src/modules/meta/meta.api';
import { safeDecryptStrict } from '../src/utils/encryption';

async function main() {
  console.log('\n🔧 Starting headerMediaId restoration...\n');

  // 1. Find all broken templates
  const broken = await (prisma as any).template.findMany({
    where: {
      status: 'APPROVED',
      headerType: { in: ['IMAGE', 'VIDEO', 'DOCUMENT'] },
      OR: [{ headerMediaId: null }, { headerMediaId: '' }],
    },
    include: {
      whatsappAccount: {
        select: { id: true, wabaId: true, accessToken: true },
      },
    },
  });

  console.log(`Found ${broken.length} template(s) missing headerMediaId\n`);

  let restored = 0;
  let failed = 0;

  for (const template of broken) {
    try {
      console.log(`Processing: "${template.name}" (${template.language})`);

      const waAccount = template.whatsappAccount;
      if (!waAccount) {
        console.log(`  ⚠️  No WhatsApp account linked — skipping\n`);
        failed++;
        continue;
      }

      // Decrypt token
      let accessToken = waAccount.accessToken;
      if (accessToken && !accessToken.startsWith('EAA')) {
        accessToken = safeDecryptStrict(accessToken);
      }
      if (!accessToken) {
        console.log(`  ⚠️  Cannot decrypt token — skipping\n`);
        failed++;
        continue;
      }

      // Fetch templates from Meta to find existing handle
      const metaTemplates = await metaApi.getTemplates(waAccount.wabaId, accessToken);
      const match = metaTemplates.find(
        (t: any) => t.name === template.name && t.language === template.language
      );

      if (!match) {
        console.log(`  ⚠️  Template not found on Meta — skipping\n`);
        failed++;
        continue;
      }

      // Extract handle from example
      const headerComp = (match.components || []).find((c: any) => c.type === 'HEADER');
      const handle = headerComp?.example?.header_handle?.[0];

      if (handle && !handle.startsWith('http')) {
        await prisma.template.update({
          where: { id: template.id },
          data: { headerMediaId: handle } as any,
        });
        console.log(`  ✅ Restored headerMediaId: ${handle.substring(0, 30)}...\n`);
        restored++;
      } else {
        console.log(`  ⚠️  Meta did not return a handle for this template`);
        console.log(`      handle_url from example: ${headerComp?.example?.header_url?.[0] || 'none'}`);
        console.log(`      You must RE-UPLOAD media for this template.\n`);
        failed++;
      }

    } catch (e: any) {
      console.error(`  ❌ Error: ${e.message}\n`);
      failed++;
    }
  }

  console.log(`\n===========================`);
  console.log(`✅ Restored: ${restored}`);
  console.log(`⚠️  Need manual fix: ${failed}`);
  console.log(`===========================\n`);
  console.log(`For templates that could not be restored automatically:`);
  console.log(`  1. Go to Dashboard → Templates`);
  console.log(`  2. Delete the template and re-create it with a new media upload`);
  console.log(`  3. Wait for Meta approval, then re-run campaigns\n`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Script failed:', e);
  process.exit(1);
});
