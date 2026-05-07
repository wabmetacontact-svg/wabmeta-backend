// prisma/fix-phone-formats.ts
// ✅ EK BAAR CHALAO - sab purane records normalize ho jayenge

import { PrismaClient } from '@prisma/client';
import { toCanonicalPhone } from '../src/utils/phone';

const prisma = new PrismaClient();

async function fixPhoneFormats() {
  console.log('🔧 Starting phone format migration...');

  const contacts = await prisma.contact.findMany({
    select: { id: true, phone: true, organizationId: true }
  });

  console.log(`📊 Total contacts: ${contacts.length}`);

  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  let duplicates = 0;

  for (const contact of contacts) {
    try {
      const canonical = toCanonicalPhone(contact.phone);

      // Already correct format
      if (!canonical || canonical === contact.phone) {
        skipped++;
        continue;
      }

      // Check if canonical already exists (duplicate)
      const existingCanonical = await prisma.contact.findFirst({
        where: {
          organizationId: contact.organizationId,
          phone: canonical,
          id: { not: contact.id }
        }
      });

      if (existingCanonical) {
        // ✅ Duplicate found - merge karo (purana delete, naया rakhkho)
        console.log(`🔀 Duplicate: ${contact.phone} → ${canonical} (keeping ${existingCanonical.id})`);
        
        // Conversations move karo
        await prisma.conversation.updateMany({
          where: { contactId: contact.id },
          data: { contactId: existingCanonical.id }
        }).catch(() => {});
        
        // Group memberships move karo
        await prisma.contactGroupMember.updateMany({
          where: { contactId: contact.id },
          data: { contactId: existingCanonical.id }
        }).catch(() => {});

        // Purana delete karo
        await prisma.contact.delete({ where: { id: contact.id } }).catch(() => {});
        
        duplicates++;
        continue;
      }

      // Update to canonical format
      await prisma.contact.update({
        where: { id: contact.id },
        data: { 
          phone: canonical,
          countryCode: canonical.length > 11 
            ? '+' + canonical.slice(1, -10) 
            : '+91'
        }
      });

      console.log(`✅ Fixed: ${contact.phone} → ${canonical}`);
      fixed++;

    } catch (e: any) {
      console.error(`❌ Error for ${contact.id}: ${e.message}`);
      errors++;
    }
  }

  console.log(`
🎉 Migration Complete:
   ✅ Fixed:      ${fixed}
   ⏭️  Skipped:   ${skipped}
   🔀 Duplicates: ${duplicates}
   ❌ Errors:     ${errors}
  `);
}

fixPhoneFormats()
  .finally(() => prisma.$disconnect());
