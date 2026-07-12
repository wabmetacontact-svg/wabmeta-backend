// scripts/fix-cloudinary-urls.ts
// ✅ One-time script to fix existing templates with missing extensions

import prisma from '../src/config/database';

const MIME_TO_EXT: Record<string, string> = {
  IMAGE: 'jpg',
  VIDEO: 'mp4',
  DOCUMENT: 'pdf',
};

async function fixCloudinaryUrls() {
  console.log('🔧 Fixing Cloudinary URLs...');

  const templates = await prisma.template.findMany({
    where: {
      headerContent: { contains: 'cloudinary.com' },
      headerType: { in: ['IMAGE', 'VIDEO', 'DOCUMENT'] },
    },
  });

  console.log(`Found ${templates.length} templates to check`);

  let fixed = 0;
  for (const t of templates) {
    const url = t.headerContent!;
    const urlPath = url.split('?')[0];
    
    // Check if URL has extension
    const hasExtension = /\.[a-z0-9]{2,5}(\?|$)/i.test(urlPath);
    
    if (!hasExtension) {
      const ext = MIME_TO_EXT[t.headerType!] || 'jpg';
      const newUrl = `${url}.${ext}`;
      
      await prisma.template.update({
        where: { id: t.id },
        data: { headerContent: newUrl },
      });
      
      console.log(`✅ Fixed ${t.name}: added .${ext}`);
      fixed++;
    }
  }

  console.log(`\n🎉 Fixed ${fixed} templates`);
}

fixCloudinaryUrls()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
