/**
 * One-time script: Merge duplicate contacts that exist in different phone formats
 * Run: npx ts-node scripts/merge-duplicate-contacts.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (!phone.startsWith('+')) return `+${digits}`;
  return phone;
}

async function main() {
  console.log('🔍 Finding duplicate contacts...');

  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });

  let totalMerged = 0;

  for (const org of orgs) {
    const contacts = await prisma.contact.findMany({
      where: { organizationId: org.id },
      select: { id: true, phone: true },
    });

    // Group contacts by canonical phone number
    const groups = new Map<string, typeof contacts>();
    for (const c of contacts) {
      const key = normalizePhone(c.phone);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    for (const [canonical, dupes] of groups.entries()) {
      if (dupes.length <= 1) continue;

      // Keep the one with + prefix if exists, else first
      const keeper = dupes.find(c => c.phone.startsWith('+')) || dupes[0];
      const toDelete = dupes.filter(c => c.id !== keeper.id);

      console.log(`\n📱 [${org.name}] Merging ${canonical}:`);
      console.log(`   Keep:   ${keeper.id} (${keeper.phone})`);
      for (const d of toDelete) {
        console.log(`   Delete: ${d.id} (${d.phone})`);
      }

      // Reassign all related data to keeper
      for (const dup of toDelete) {
        await prisma.message.updateMany({
          where: { conversation: { contactId: dup.id } },
          data: {},
        }).catch(() => {});

        // Move conversations to keeper
        const dupConvs = await prisma.conversation.findMany({
          where: { contactId: dup.id },
        });

        for (const conv of dupConvs) {
          // Check if keeper already has a conversation for this org
          const existingKeeperConv = await prisma.conversation.findFirst({
            where: { contactId: keeper.id, organizationId: conv.organizationId },
          });

          if (existingKeeperConv) {
            // Move all messages to keeper conversation
            await prisma.message.updateMany({
              where: { conversationId: conv.id },
              data: { conversationId: existingKeeperConv.id },
            });
            await prisma.conversation.delete({ where: { id: conv.id } }).catch(() => {});
          } else {
            // Transfer conversation to keeper contact
            await prisma.conversation.update({
              where: { id: conv.id },
              data: { contactId: keeper.id },
            }).catch(() => {});
          }
        }

        // Delete duplicate contact
        await prisma.contact.delete({ where: { id: dup.id } }).catch(() => {});
        totalMerged++;
      }

      // Update keeper phone to canonical
      await prisma.contact.update({
        where: { id: keeper.id },
        data: { phone: canonical },
      }).catch(() => {});
    }
  }

  console.log(`\n✅ Done! Merged ${totalMerged} duplicate contacts.`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
