// scripts/fix-template-urls.ts
// Existing templates ki URLs fix karo

import prisma from '../src/config/database';

async function fixTemplateUrls() {
  console.log('🔧 Fixing template URLs...');

  const templates = await prisma.template.findMany({
    where: {
      headerType: { in: ['IMAGE', 'VIDEO', 'DOCUMENT'] },
      headerContent: { not: null },
    },
  });

  console.log(`Found ${templates.length} media templates`);

  let fixed = 0;
  let cleared = 0;

  for (const template of templates) {
    const url = (template as any).headerContent;
    if (!url) continue;

    let newUrl = url;
    let needsUpdate = false;
    let clearMediaId = false;

    // ✅ Fix 1: fl_attachment hata do
    if (url.includes('fl_attachment')) {
      newUrl = url.replace(/fl_attachment\//g, '');
      needsUpdate = true;
      console.log(`🔧 Fixing fl_attachment: ${template.name}`);
    }

    // ✅ Fix 2: Meta CDN URLs clear karo
    const isMetaCdn =
      url.includes('scontent.whatsapp') ||
      url.includes('scontent-') ||
      url.includes('lookaside.fbsbx.com') ||
      url.includes('fbcdn.net');

    if (isMetaCdn) {
      newUrl = null as any;
      needsUpdate = true;
      clearMediaId = true;
      console.log(`🗑️ Clearing Meta CDN URL: ${template.name}`);
    }

    if (needsUpdate) {
      await (prisma.template as any).update({
        where: { id: template.id },
        data: {
          headerContent: newUrl,
          // ✅ Media ID bhi clear karo taaki fresh upload ho
          headerMediaId: clearMediaId ? null : undefined,
          headerMediaUploadedAt: clearMediaId ? null : undefined,
        },
      });

      if (clearMediaId) cleared++;
      else fixed++;
    }
  }

  console.log(`✅ Fixed: ${fixed}, Cleared: ${cleared}`);
}

fixTemplateUrls()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
