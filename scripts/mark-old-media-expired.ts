// scripts/mark-old-media-expired.ts

import prisma from '../src/config/database';

async function markOldMediaExpired() {
  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  console.log('🔍 Finding old inbound media messages...\n');

  const oldMedia = await prisma.message.findMany({
    where: {
      direction: 'INBOUND',
      type: { in: ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'] },
      createdAt: { lt: THIRTY_DAYS_AGO },
      NOT: [
        { mediaUrl: { contains: 'cloudinary' } },
      ]
    },
    select: { 
      id: true, 
      createdAt: true, 
      metadata: true 
    }
  });

  console.log(`Found ${oldMedia.length} messages to mark as expired\n`);

  let updated = 0;
  for (const msg of oldMedia) {
    const existingMeta = (msg.metadata as any) || {};
    
    // Skip if already marked
    if (existingMeta.mediaExpired) continue;

    await prisma.message.update({
      where: { id: msg.id },
      data: {
        metadata: {
          ...existingMeta,
          mediaExpired: true,
          markedExpiredAt: new Date().toISOString(),
          reason: 'Bulk cleanup - media >30 days old',
        } as any,
      },
    });
    updated++;
  }

  console.log(`✅ Marked ${updated} messages as expired`);
  console.log(`💡 This will stop failed Meta API calls for these messages`);
  process.exit(0);
}

markOldMediaExpired().catch(err => {
  console.error(err);
  process.exit(1);
});
