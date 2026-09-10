// prisma/seed-local-demo.ts
//
// Seeds a few demo conversations across WhatsApp / Instagram / Telegram into the
// LOCAL dev database so the multi-channel inbox features can actually be seen.
//
// Run:
//   DATABASE_URL="postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_dev" \
//     npx ts-node prisma/seed-local-demo.ts
//
// Refuses to run unless DATABASE_URL points at localhost, so it can never touch
// production. Everything it creates is prefixed/marked as demo and can be wiped
// with `npx ts-node prisma/seed-local-demo.ts --wipe`.

import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL || '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Refusing to run: DATABASE_URL must point at localhost. Got:', url.replace(/:[^:@]*@/, ':***@'));
  process.exit(1);
}

const prisma = new PrismaClient();
const WIPE = process.argv.includes('--wipe');

// Demo contacts are identified by this phone prefix so a wipe is precise.
const DEMO_PREFIX = 'demo:';

const people = [
  {
    key: 'wa',
    channel: 'WHATSAPP' as const,
    phone: '+919876500001',
    firstName: 'Priya',
    lastName: 'Sharma',
    messages: [
      { dir: 'INBOUND' as const, text: 'Hi! Is the Diwali offer still running?' },
      { dir: 'OUTBOUND' as const, text: 'Hello Priya! Yes, it runs till Sunday. 🎉' },
      { dir: 'INBOUND' as const, text: 'Great — what is the price for the 3 month plan?' },
    ],
  },
  {
    key: 'ig',
    channel: 'INSTAGRAM' as const,
    phone: '+919876500002',
    firstName: 'Rahul',
    lastName: 'Verma',
    igUserId: 'ig_demo_17841400000000001',
    igUsername: 'rahul.builds',
    messages: [
      { dir: 'INBOUND' as const, text: 'Saw your reel — do you ship to Pune?' },
      { dir: 'OUTBOUND' as const, text: 'Yes we do! Delivery is 2-3 days to Pune.' },
      { dir: 'INBOUND' as const, text: 'Perfect, send me the link please' },
    ],
  },
  {
    key: 'tg',
    channel: 'TELEGRAM' as const,
    phone: 'tg:demo900000003',
    firstName: 'Anjali',
    lastName: 'Nair',
    tgUserId: 'demo900000003',
    tgUsername: 'anjali_n',
    messages: [
      { dir: 'INBOUND' as const, text: '/start' },
      { dir: 'OUTBOUND' as const, text: 'Welcome to WabMeta! How can I help you today?' },
      { dir: 'INBOUND' as const, text: 'I need help with my invoice' },
    ],
  },
];

async function main() {
  const organization = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!organization) {
    console.error('No organization found. Run seed-local-test.ts first.');
    process.exit(1);
  }
  const organizationId = organization.id;

  if (WIPE) {
    const contacts = await prisma.contact.findMany({
      where: { organizationId, source: `${DEMO_PREFIX}seed` },
      select: { id: true },
    });
    const ids = contacts.map((c) => c.id);
    if (ids.length) {
      // Leads reference contacts, so clear them (and their children) first.
      const leads = await prisma.lead.findMany({
        where: { organizationId, OR: [{ contactId: { in: ids } }, { source: `${DEMO_PREFIX}seed` }] },
        select: { id: true },
      });
      const leadIds = leads.map((l) => l.id);
      if (leadIds.length) {
        await prisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
        await prisma.leadNote.deleteMany({ where: { leadId: { in: leadIds } } });
        await prisma.leadTask.deleteMany({ where: { leadId: { in: leadIds } } });
        await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
      }

      await prisma.message.deleteMany({ where: { conversation: { contactId: { in: ids } } } });
      await prisma.conversation.deleteMany({ where: { contactId: { in: ids } } });
      await prisma.contact.deleteMany({ where: { id: { in: ids } } });
      console.log(`🧹 Wiped ${ids.length} demo contacts, their conversations and ${leadIds.length} demo lead(s).`);
    } else {
      console.log('🧹 No demo contacts found.');
    }
    return;
  }

  let created = 0;

  for (const p of people) {
    const contact = await prisma.contact.upsert({
      where: { organizationId_phone: { organizationId, phone: p.phone } },
      update: {},
      create: {
        organizationId,
        phone: p.phone,
        firstName: p.firstName,
        lastName: p.lastName,
        source: `${DEMO_PREFIX}seed`,
        instagramUserId: (p as any).igUserId || null,
        instagramUsername: (p as any).igUsername || null,
        telegramUserId: (p as any).tgUserId || null,
        telegramUsername: (p as any).tgUsername || null,
        lastMessageAt: new Date(),
      },
    });

    const last = p.messages[p.messages.length - 1];

    const conversation = await prisma.conversation.upsert({
      where: {
        organizationId_contactId_channel: { organizationId, contactId: contact.id, channel: p.channel },
      },
      update: {},
      create: {
        organizationId,
        contactId: contact.id,
        channel: p.channel,
        isWindowOpen: true,
        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isRead: false,
        unreadCount: p.messages.filter((m) => m.dir === 'INBOUND').length,
        lastMessageAt: new Date(),
        lastCustomerMessageAt: new Date(),
        lastMessagePreview: last.text.slice(0, 120),
        telegramChatId: p.channel === 'TELEGRAM' ? (p as any).tgUserId : null,
      },
    });

    const existing = await prisma.message.count({ where: { conversationId: conversation.id } });
    if (existing === 0) {
      let t = Date.now() - p.messages.length * 60_000;
      for (const m of p.messages) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            channel: p.channel,
            direction: m.dir,
            type: 'TEXT',
            content: m.text,
            status: m.dir === 'OUTBOUND' ? 'SENT' : 'DELIVERED',
            timestamp: new Date(t),
            sentAt: m.dir === 'OUTBOUND' ? new Date(t) : null,
          },
        });
        t += 60_000;
      }
      created++;
    }
  }

  console.log(`✅ Demo data ready: ${people.length} conversations (WhatsApp / Instagram / Telegram), ${created} seeded with messages.`);
  console.log('   Wipe anytime with: npx ts-node prisma/seed-local-demo.ts --wipe');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
