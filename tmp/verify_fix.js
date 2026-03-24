const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const templateId = 'cmn4up1jo0007b8u26dc0917l';
    const template = await prisma.template.findUnique({
      where: { id: templateId }
    });

    console.log('✅ VERIFICATION:');
    console.log('headerContent (Cloudinary):', template.headerContent.substring(0, 60) + '...');
    console.log('headerMediaId (Meta):', template.headerMediaId);
    console.log('Is valid Meta ID?', /^\d{10,}$/.test(template.headerMediaId));
    
    if (/^\d{10,}$/.test(template.headerMediaId)) {
      console.log('');
      console.log('🎉 FIXED! You can retry the campaign now.');
    } else {
      console.log('');
      console.log('❌ STILL BROKEN - Contact me with error details');
    }
  } catch (err) {
    console.error(err.message);
  } finally {
    process.exit(0);
  }
})();
