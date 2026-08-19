// scripts/fix-cloudinary-raw-urls.ts
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function fixCloudinaryRawUrls() {
  console.log('🔍 Finding templates with Cloudinary raw URLs...\n');

  const templates = await prisma.template.findMany({
    where: {
      headerContent: { contains: '/raw/upload/' },
      NOT: { headerContent: { contains: 'fl_attachment' } },
    },
    select: {
      id: true,
      name: true,
      headerContent: true,
      headerType: true,
    },
  });

  console.log(`Found ${templates.length} templates to fix\n`);

  let fixed = 0;
  let failed = 0;

  for (const t of templates) {
    console.log(`📋 ${t.name} (${t.headerType})`);
    console.log(`   Current URL: ${t.headerContent?.substring(0, 80)}...`);

    if (!t.headerContent) continue;

    // Add fl_attachment to make Cloudinary serve it publicly
    const newUrl = t.headerContent.replace(
      '/raw/upload/',
      '/raw/upload/fl_attachment/'
    );

    // Test the new URL
    try {
      const testResponse = await axios.head(newUrl, {
        timeout: 10000,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      if (testResponse.status === 200) {
        // Update DB
        await prisma.template.update({
          where: { id: t.id },
          data: {
            headerContent: newUrl,
            // Clear cached media ID so next campaign re-uploads
            headerMediaId: null,
            headerMediaUploadedAt: null,
          } as any,
        });
        console.log(`   ✅ Fixed! New URL works`);
        fixed++;
      } else {
        console.log(`   ⚠️ New URL returned ${testResponse.status}`);
        failed++;
      }
    } catch (err: any) {
      console.log(`   ❌ Test failed: ${err.message}`);
      failed++;
    }

    console.log('');
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`═══════════════════════════════════`);
}

fixCloudinaryRawUrls()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
