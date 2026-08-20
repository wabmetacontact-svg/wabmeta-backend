// src/scripts/migrate-cloudinary-to-r2.ts
import axios from 'axios';
import prisma from '../config/database';
import { r2Service } from '../services/r2.service';

async function migrateCloudinaryToR2() {
  console.log('🚀 Starting Cloudinary to Cloudflare R2 migration...\n');

  if (!r2Service.isConfigured()) {
    console.error('❌ Cloudflare R2 is not configured in .env!');
    console.error('Please make sure the following variables are set:');
    console.error('- R2_ACCOUNT_ID');
    console.error('- R2_ACCESS_KEY_ID');
    console.error('- R2_SECRET_ACCESS_KEY');
    console.error('- R2_BUCKET_NAME');
    console.error('- R2_PUBLIC_URL');
    process.exit(1);
  }

  // 1. Migrate Templates
  console.log('📦 Step 1: Migrating Template Media...');
  const templates = await prisma.template.findMany({
    where: {
      headerContent: {
        contains: 'cloudinary.com',
      },
    },
  });

  console.log(`Found ${templates.length} templates with Cloudinary media.`);

  let templateSuccess = 0;
  let templateFail = 0;

  for (const t of templates) {
    if (!t.headerContent) continue;
    try {
      console.log(`⏳ Downloading template "${t.name}" media: ${t.headerContent.substring(0, 60)}...`);
      const res = await axios.get(t.headerContent, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(res.data);
      const mimeType = res.headers['content-type'] || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      const key = `templates/${t.organizationId}/${t.name}_${Date.now()}.${ext}`;

      const uploadResult = await r2Service.uploadBuffer(buffer, key, mimeType);
      console.log(`✅ Uploaded to R2: ${uploadResult.url}`);

      await prisma.template.update({
        where: { id: t.id },
        data: {
          headerContent: uploadResult.url,
        },
      });

      templateSuccess++;
    } catch (err: any) {
      console.error(`❌ Failed to migrate template "${t.name}":`, err.message);
      templateFail++;
    }
  }

  // 2. Migrate Messages Media
  console.log('\n💬 Step 2: Migrating Chat Messages Media...');
  const messages = await prisma.message.findMany({
    where: {
      mediaUrl: {
        contains: 'cloudinary.com',
      },
    },
    take: 500, // Safe batch
  });

  console.log(`Found ${messages.length} messages with Cloudinary media.`);

  let messageSuccess = 0;
  let messageFail = 0;

  for (const m of messages) {
    if (!m.mediaUrl) continue;
    try {
      const res = await axios.get(m.mediaUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(res.data);
      const mimeType = res.headers['content-type'] || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      const key = `inbound/${m.whatsappAccountId || 'common'}/${m.id}_${Date.now()}.${ext}`;

      const uploadResult = await r2Service.uploadBuffer(buffer, key, mimeType);

      await prisma.message.update({
        where: { id: m.id },
        data: {
          mediaUrl: uploadResult.url,
        },
      });

      messageSuccess++;
    } catch (err: any) {
      console.error(`❌ Failed to migrate message ${m.id}:`, err.message);
      messageFail++;
    }
  }

  console.log('\n🎉 Migration Summary:');
  console.log(`- Templates: ${templateSuccess} succeeded, ${templateFail} failed`);
  console.log(`- Messages: ${messageSuccess} succeeded, ${messageFail} failed`);
  console.log('\nMigration completed.');
  await prisma.$disconnect();
}

migrateCloudinaryToR2().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
