const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const FormData = require('form-data');
const prisma = new PrismaClient();
const { safeDecrypt } = require('../dist/utils/encryption');

(async () => {
  try {
    const templateId = 'cmn4up1jo0007b8u26dc0917l'; // ✅ Fixed ID
    
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: { whatsappAccount: true }
    });

    if (!template) {
      console.log('❌ Template not found:', templateId);
      process.exit(1);
    }

    const cloudinaryUrl = template.headerContent;
    console.log('📥 Downloading from Cloudinary:', cloudinaryUrl);

    // Download from Cloudinary
    const response = await axios.get(cloudinaryUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const buffer = Buffer.from(response.data);
    const mimeType = response.headers['content-type'] || 'video/mp4';
    console.log('✅ Downloaded:', buffer.length, 'bytes');

    // Get access token
    const accessToken = safeDecrypt(template.whatsappAccount.accessToken);
    if (!accessToken) {
      console.log('❌ Failed to decrypt access token');
      process.exit(1);
    }

    // Upload to Meta
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', buffer, {
      filename: 'media.mp4',
      contentType: mimeType
    });

    console.log('📤 Uploading to Meta...');
    const metaResponse = await axios.post(
      `https://graph.facebook.com/v21.0/${template.whatsappAccount.phoneNumberId}/media`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const metaMediaId = metaResponse.data.id;
    console.log('✅ Meta Media ID:', metaMediaId);

    // Update template
    await prisma.template.update({
      where: { id: templateId },
      data: { headerMediaId: metaMediaId }
    });

    console.log('✅ Template updated successfully!');
  } catch (err) {
    if (err.response) {
      console.error('❌ Meta Error:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('❌ Error:', err.message);
    }
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
})();
