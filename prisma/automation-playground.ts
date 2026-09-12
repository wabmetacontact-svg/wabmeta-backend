// prisma/automation-playground.ts
//
// LOCAL ONLY. Follow-up automations ko chalta hua dekhne ke liye - bina asli
// WhatsApp ke. Har scenario ek chhota demo hai: kya "bheja" gaya, kaunsa job
// bana, kab chalega, sequence ka haal kya hai. Intezar ki jagah "time travel":
// pending jobs ka runAt abhi kar ke scheduler wala runDueJobs chalaya jata hai.
//
// WhatsApp send, wallet deduction aur push notifications yahan patch hain -
// kuch bhi Meta tak nahi jata, koi paisa nahi katta.
//
// Run (Docker Desktop khula ho):
//   npm run playground                  # saare scenarios
//   npm run playground -- reply         # sirf ek scenario
//   npm run playground -- --verbose     # engine ke logs bhi
//   npm run playground -- --wipe        # playground data hatao
//
// DATABASE_URL set na ho to local test DB (wabmeta_test) apne aap. Ye .env
// load hone se PEHLE hota hai, aur dotenv pehle se set vars nahi badalta -
// isliye production URL kabhi nahi uthti.
//
// Note: runDueJobs, triggerNoReply aur triggerTasksDue poore DB par chalte hain.
// wabmeta_test par sirf playground ka data hota hai; wabmeta_dev par chalaoge
// to wahan ke due jobs/tasks bhi (patched sends ke saath) process ho jayenge.

const LOCAL_TEST_DB = 'postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test';
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = LOCAL_TEST_DB;
if (!process.env.DIRECT_URL) process.env.DIRECT_URL = process.env.DATABASE_URL;

const isLocal = (u: string) => /@(localhost|127\.0\.0\.1)[:/]/.test(u);
if (!isLocal(process.env.DATABASE_URL || '') || !isLocal(process.env.DIRECT_URL || '')) {
  console.error(
    'Refusing to run: DATABASE_URL aur DIRECT_URL dono localhost wale hone chahiye.\n' +
    "  $env:DATABASE_URL='postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test'; $env:DIRECT_URL=$env:DATABASE_URL"
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const WIPE = args.includes('--wipe');
const ONLY = args.find((a) => !a.startsWith('--'));

const SLUG = 'automation-playground';
const EMAIL = 'playground@local.dev';
const HOUR = 60 * 60 * 1000;

// ── output ───────────────────────────────────────────────────────────────

const out = console.log.bind(console);
const real = { log: console.log, info: console.info, warn: console.warn };

/** Engine bahut bolta hai; --verbose ke bina uske logs chhupao. */
async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  if (VERBOSE) return fn();
  console.log = console.info = console.warn = () => {};
  try {
    return await fn();
  } finally {
    Object.assign(console, real);
  }
}

const when = (d: Date) => {
  const hours = Math.round((d.getTime() - Date.now()) / HOUR);
  const local = d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  return hours > 0 ? `${local} IST (~${hours} ghante baad)` : `${local} IST`;
};

// ── state ────────────────────────────────────────────────────────────────

let prisma: any;
let engine: any;
let crm: any;
let optOut: any;
let orgId = '';
let userId = '';
let templateId = '';
let templateName = '';
const names = new Map<string, string>(); // phone -> name
let sendCount = 0;
let actionSeq = 0;

async function load() {
  await quiet(async () => {
    prisma = (await import('../src/config/database')).default;
    engine = (await import('../src/modules/automation/automation.engine')).automationEngine;
    crm = (await import('../src/modules/crm/crm.service')).crmService;
    optOut = await import('../src/modules/contacts/optOut');

    // Asli WhatsApp/wallet/push ki jagah terminal
    const wa: any = (await import('../src/modules/whatsapp/whatsapp.service')).whatsappService;
    wa.sendTextMessage = async (_acc: string, to: string, text: string) => {
      sendCount++;
      out(`   📤 WhatsApp -> ${names.get(to) || to}: "${text}"`);
      return {};
    };
    wa.sendTemplateMessage = async (o: any) => {
      sendCount++;
      out(`   📤 WhatsApp -> ${names.get(o.to) || o.to}: [TEMPLATE ${o.templateName}]`);
      return { waMessageId: `wamid.playground.${Date.now()}` };
    };
    wa.sendMediaMessage = async (_acc: string, to: string, type: string) => {
      sendCount++;
      out(`   📤 WhatsApp -> ${names.get(to) || to}: [${type}]`);
      return {};
    };
    wa.sendMessage = async (o: any) => {
      sendCount++;
      out(`   📤 WhatsApp -> ${names.get(o.to) || o.to}: [${o.type}]`);
      return {};
    };

    const wallet: any = await import('../src/modules/wallet/wallet.deduction.service');
    wallet.deductWalletForTemplate = async () => ({ deducted: false, walletUsed: false, amount: 0 });

    const notif: any = (await import('../src/modules/notifications/notifications.service')).notificationsService;
    notif.create = async (n: any) => {
      out(`   🔔 Notification (agent ko): ${n.title} - ${n.description}`);
      return n;
    };
  });
}

// ── setup / wipe ─────────────────────────────────────────────────────────

async function wipe() {
  const org = await prisma.organization.findFirst({ where: { slug: SLUG }, select: { id: true } });
  if (org?.id) {
    const organizationId = org.id;
    await prisma.automationJob.deleteMany({ where: { organizationId } });
    await prisma.automationSequence.deleteMany({ where: { automation: { organizationId } } });
    await prisma.lead.deleteMany({ where: { organizationId } });
    await prisma.pipeline.deleteMany({ where: { organizationId } });
    await prisma.conversation.deleteMany({ where: { organizationId } });
    await prisma.contact.deleteMany({ where: { organizationId } });
    await prisma.automation.deleteMany({ where: { organizationId } });
    await prisma.organizationSettings.deleteMany({ where: { organizationId } });
    await prisma.template.deleteMany({ where: { organizationId } });
    await prisma.whatsAppAccount.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
  }
  await prisma.user.deleteMany({ where: { email: EMAIL } });
}

async function setup() {
  await wipe();
  const user = await prisma.user.create({
    data: { email: EMAIL, firstName: 'Playground', lastName: 'Agent', status: 'ACTIVE', emailVerified: true },
  });
  userId = user.id;
  const org = await prisma.organization.create({ data: { name: 'Automation Playground', slug: SLUG, ownerId: userId } });
  orgId = org.id;
  await prisma.whatsAppAccount.create({
    data: {
      organizationId: orgId, phoneNumberId: 'pn-playground', wabaId: 'waba-playground',
      phoneNumber: '+910000000000', displayName: 'Playground', accessToken: 'fake', status: 'CONNECTED',
    },
  });
  templateName = 'followup_reminder';
  const tpl = await prisma.template.create({
    data: {
      organizationId: orgId, name: templateName, category: 'MARKETING', language: 'en',
      status: 'APPROVED', bodyText: 'Hi {{1}}, just following up on your enquiry.',
    },
  });
  templateId = tpl.id;
}

// ── building blocks ──────────────────────────────────────────────────────

type Person = { id: string; phone: string; name: string; conversationId: string };

const openChat = () => ({
  lastCustomerMessageAt: new Date(),
  lastMessageAt: new Date(),
  windowExpiresAt: new Date(Date.now() + 23 * HOUR),
  isWindowOpen: true,
});

let phoneSeq = 0;
async function person(name: string, chat: Record<string, any> = openChat()): Promise<Person> {
  const phone = `+91900000${String(++phoneSeq).padStart(4, '0')}`;
  const c = await prisma.contact.create({ data: { organizationId: orgId, phone, countryCode: '91', firstName: name } });
  const conv = await prisma.conversation.create({
    data: { organizationId: orgId, contactId: c.id, channel: 'WHATSAPP', ...chat },
  });
  names.set(phone, name);
  return { id: c.id, phone, name, conversationId: conv.id };
}

const text = (body: string, config: Record<string, any> = {}) => ({
  id: `a${++actionSeq}`, type: 'send_text', config: { text: body, ...config },
});
const delay = (value: number, unit: string) => ({ id: `a${++actionSeq}`, type: 'delay', config: { value, unit } });
const wait = (config: Record<string, any>) => ({ id: `a${++actionSeq}`, type: 'wait_for_response', config });

async function automation(name: string, actions: any[], extra: Record<string, any> = {}) {
  return prisma.automation.create({
    data: { organizationId: orgId, name, trigger: 'KEYWORD', triggerConfig: {}, actions, isActive: true, ...extra },
  });
}

async function start(a: any, p: Person) {
  out(`▶️  "${a.name}" shuru hua ${p.name} ke liye`);
  await quiet(() => engine.executeActions(a.id, a.actions, { organizationId: orgId, contactId: p.id, phone: p.phone }));
}

async function customerSays(p: Person, message: string) {
  out(`💬 ${p.name}: "${message}"`);
  await quiet(() => engine.onInboundMessage({ organizationId: orgId, contactId: p.id, phone: p.phone, message }));
}

async function timeTravel(label: string) {
  await prisma.automationJob.updateMany({
    where: { organizationId: orgId, status: 'PENDING' },
    data: { runAt: new Date(Date.now() - 1000) },
  });
  out(`⏩ Time travel: ${label}`);
  const before = sendCount;
  await quiet(() => engine.runDueJobs());
  if (sendCount === before) out('   (koi message nahi gaya)');
}

async function show(a: any, p: Person) {
  const s = await prisma.automationSequence.findUnique({
    where: { automationId_contactId: { automationId: a.id, contactId: p.id } },
  });
  const total = (a.actions as any[]).length;
  out(`   📋 ${p.name}: sequence ${s?.status ?? '-'}${s ? ` (step ${s.currentStep + 1}/${total})` : ''}`);
  const jobs = await prisma.automationJob.findMany({
    where: { automationId: a.id, contactId: p.id },
    orderBy: { createdAt: 'asc' },
  });
  for (const j of jobs) {
    const extra = j.status === 'PENDING' ? ` - chalega ${when(j.runAt)}` : '';
    const why = j.lastError ? ` (${j.lastError})` : '';
    out(`   ⏰ job ${j.type}: ${j.status}${extra}${why}`);
  }
}

// ── scenarios ────────────────────────────────────────────────────────────

const scenarios: Array<{ key: string; title: string; look: string; run: () => Promise<void> }> = [
  {
    key: 'delay',
    title: '2 din baad follow-up',
    look: 'Pehla message turant, follow-up ek job ban kar 2 din baad. Pehle ye 30 sec me chala jata tha.',
    run: async () => {
      const p = await person('Priya');
      const a = await automation('Price list + follow-up', [
        text('Hi {{name}}, yeh rahi price list 📄'),
        delay(2, 'days'),
        text('Hi {{name}}, price list dekhi? Koi sawaal ho to batayein 🙂'),
      ]);
      await start(a, p);
      await show(a, p);
      await timeTravel('2 din aage');
      await show(a, p);
    },
  },
  {
    key: 'reply',
    title: 'Customer ne reply kiya -> follow-up ruk gaya',
    look: 'Reply aate hi pending follow-up CANCELLED, sequence REPLIED. Time travel par kuch nahi jata.',
    run: async () => {
      const p = await person('Rohit');
      const a = await automation('Price list + follow-up (reply)', [
        text('Hi {{name}}, yeh rahi price list 📄'),
        delay(2, 'days'),
        text('Hi {{name}}, price list dekhi?'),
      ]);
      await start(a, p);
      await customerSays(p, 'Haan dekh li, thanks!');
      await show(a, p);
      await timeTravel('2 din aage');
    },
  },
  {
    key: 'timeout',
    title: 'Quote -> 24 ghante intezar -> reply nahi aaya to follow-up',
    look: 'Rahul chup rehta hai: follow-up jata hai. Anjali reply karti hai: run wahin ruk jata hai.',
    run: async () => {
      const rahul = await person('Rahul');
      const anjali = await person('Anjali');
      const actions = [
        text('Hi {{name}}, aapka quote ₹25,000 hai.'),
        wait({ onReply: 'stop', onTimeout: 'continue', timeoutValue: 24, timeoutUnit: 'hours' }),
        text('Hi {{name}}, quote par koi sawaal? Aaj confirm karein to 10% off 🎁'),
      ];
      const a = await automation('Quote follow-up', actions);
      await start(a, rahul);
      await start(a, anjali);
      await show(a, rahul);
      await customerSays(anjali, 'Theek hai, kal confirm karti hoon');
      await timeTravel('24 ghante aage');
      await show(a, rahul);
      await show(a, anjali);
    },
  },
  {
    key: 'keyword',
    title: 'Sahi jawab ka intezar (text reply par)',
    look: '"hello?" par kuch nahi hota; "Pro" par flow aage badhta hai. Pehle text reply par ye kabhi aage nahi badhta tha.',
    run: async () => {
      const p = await person('Sneha');
      const a = await automation('Plan chuno', [
        text('Hi {{name}}, kaunsa plan chahiye - Basic ya Pro?'),
        wait({ keywords: ['basic', 'pro'] }),
        text('Badhiya choice! Details bhej raha hoon 👍'),
      ]);
      await start(a, p);
      await customerSays(p, 'hello?');
      await show(a, p);
      await customerSays(p, 'Pro plan chahiye');
      await show(a, p);
    },
  },
  {
    key: 'window',
    title: '24 ghante ki window band -> template',
    look: 'Customer ka aakhri message 30 ghante purana: text Meta reject karta, isliye fallback template jata hai; bina fallback wala step chhoot jata hai.',
    run: async () => {
      const p = await person('Karan', {
        lastCustomerMessageAt: new Date(Date.now() - 30 * HOUR),
        lastMessageAt: new Date(Date.now() - 30 * HOUR),
        windowExpiresAt: new Date(Date.now() - 6 * HOUR),
        isWindowOpen: false,
      });
      const a = await automation('Offer reminder', [
        text('Offer aaj raat khatam! ⏳', { fallbackTemplateId: templateId }),
        text('Ye text bina fallback ke - band window me skip hoga'),
      ]);
      await start(a, p);
      await show(a, p);
    },
  },
  {
    key: 'noreply',
    title: 'NO_REPLY: 24 ghante se chup customers',
    look: 'Sirf Vikram ko nudge (baat ki thi, phir chup). Neha (campaign, kabhi reply nahi) aur Arjun (aakhri message uska) ko nahi. Doosri baar scan par dobara nahi.',
    run: async () => {
      const now = Date.now();
      await person('Vikram', {
        lastCustomerMessageAt: new Date(now - 30 * HOUR), lastMessageAt: new Date(now - 26 * HOUR),
        windowExpiresAt: new Date(now - 6 * HOUR), isWindowOpen: false,
      });
      await person('Neha', { lastCustomerMessageAt: null, lastMessageAt: new Date(now - 26 * HOUR), isWindowOpen: false });
      await person('Arjun', { lastCustomerMessageAt: new Date(now - 26 * HOUR), lastMessageAt: new Date(now - 26 * HOUR) });
      await automation(
        'Chup customers ko nudge',
        [text('Hi {{name}}, koi sawaal baaki hai?', { fallbackTemplateId: templateId })],
        { trigger: 'NO_REPLY', triggerConfig: { hours: 24 } }
      );
      out('🔎 NO_REPLY scan (scheduler har 10 min chalata hai)');
      await quiet(() => engine.triggerNoReply());
      out('🔎 Dobara scan');
      const before = sendCount;
      await quiet(() => engine.triggerNoReply());
      if (sendCount === before) out('   (koi message nahi gaya - ek chup par ek hi baar)');
    },
  },
  {
    key: 'stage',
    title: 'Lead "Proposal" stage me gaya -> quote + 3 din baad follow-up',
    look: 'CRM me lead move karte hi automation chalti hai (crm.updateLead se, jaise web app se hota hai).',
    run: async () => {
      const p = await person('Meera');
      const pipeline = await prisma.pipeline.create({
        data: {
          organizationId: orgId, name: 'Playground Sales',
          stages: { create: [{ name: 'New', order: 0 }, { name: 'Proposal', order: 1 }, { name: 'Won', order: 2, isWon: true }] },
        },
        include: { stages: { orderBy: { order: 'asc' } } },
      });
      const [newStage, proposal] = pipeline.stages;
      const lead = await prisma.lead.create({
        data: { organizationId: orgId, title: 'Meera - website', contactId: p.id, pipelineId: pipeline.id, stageId: newStage.id },
      });
      const a = await automation(
        'Proposal follow-up',
        [
          text('Hi {{name}}, aapka quote taiyaar hai: ₹40,000'),
          delay(3, 'days'),
          text('Hi {{name}}, quote par aapki kya raay hai?'),
        ],
        { trigger: 'LEAD_STAGE_CHANGED', triggerConfig: { toStageId: proposal.id } }
      );
      out('🗂️  Agent ne lead ko "Proposal" me move kiya');
      await quiet(async () => {
        await crm.updateLead(orgId, lead.id, userId, { stageId: proposal.id });
        // updateLead trigger ko background me chalata hai - uske delay step
        // tak pahunchne ka intezar (tab tak engine ke logs bhi chhupe rahein)
        for (let i = 0; i < 50; i++) {
          const s = await prisma.automationSequence.findFirst({ where: { automationId: a.id, status: 'SCHEDULED' } });
          if (s) break;
          await new Promise((r) => setTimeout(r, 100));
        }
      });
      await show(a, p);
      await timeTravel('3 din aage');
      await show(a, p);
    },
  },
  {
    key: 'task',
    title: 'Task ki due date -> agent ko reminder + customer ko message',
    look: 'Due task par agent ko notification, aur TASK_DUE automation customer ko batati hai. Doosri baar kuch nahi.',
    run: async () => {
      const p = await person('Farhan');
      const lead = await prisma.lead.create({ data: { organizationId: orgId, title: 'Farhan - CRM plan', contactId: p.id, assignedToId: userId } });
      await prisma.leadTask.create({ data: { leadId: lead.id, title: 'Farhan ko call karo', dueDate: new Date(Date.now() - 60_000) } });
      await automation('Call se pehle heads-up', [text('Hi {{name}}, humari team aapko thodi der me call karegi 📞')], { trigger: 'TASK_DUE' });
      out('🔎 Due tasks check (scheduler har minute chalata hai)');
      await quiet(() => engine.triggerTasksDue());
      out('🔎 Dobara check');
      const before = sendCount;
      await quiet(() => engine.triggerTasksDue());
      if (sendCount === before) out('   (kuch nahi - reminder ek hi baar)');
    },
  },
  {
    key: 'optout',
    title: 'Customer ne STOP bola -> follow-up nahi jata',
    look: 'Contact UNSUBSCRIBED ho jata hai; follow-up ka waqt aane par job CANCELLED.',
    run: async () => {
      const p = await person('Pooja');
      const a = await automation('Offer + follow-up (opt-out)', [
        text('Hi {{name}}, naya offer! 🎉'),
        delay(1, 'days'),
        text('Hi {{name}}, offer kal khatam ho raha hai'),
      ]);
      await start(a, p);
      out(`💬 ${p.name}: "STOP"`);
      // Webhook yahi karta hai: opt-out lagao, aur us message par koi automation nahi
      await optOut.applyOptSignal(optOut.detectOptSignal('STOP'), p.id, orgId);
      await timeTravel('1 din aage');
      await show(a, p);
    },
  },
  {
    key: 'handoff',
    title: 'Agent ne chat apne haath me li -> bot chup',
    look: 'Inbox me automation pause karte hi pending follow-up CANCELLED.',
    run: async () => {
      const p = await person('Aman');
      const a = await automation('Demo + follow-up (handoff)', [
        text('Hi {{name}}, demo ka link: https://example.com/demo'),
        delay(1, 'days'),
        text('Hi {{name}}, demo kaisa laga?'),
      ]);
      await start(a, p);
      out('🧑‍💼 Agent ne inbox me is chat ki automation pause ki');
      await prisma.conversation.update({ where: { id: p.conversationId }, data: { automationPaused: true } });
      await timeTravel('1 din aage');
      await show(a, p);
    },
  },
  {
    key: 'quiet',
    title: 'Quiet hours -> follow-up subah tak khisak gaya',
    look: 'Quiet hours abhi chal rahe hain (demo ke liye abhi ke aas-paas set kiye), isliye job chalne ki jagah aage khisakta hai.',
    run: async () => {
      const { minuteOfDayIn } = await import('../src/modules/automation/automation.timing');
      const hhmm = (m: number) => {
        const x = ((m % 1440) + 1440) % 1440;
        return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
      };
      const nowMin = minuteOfDayIn(new Date(), 'Asia/Kolkata');
      const start_ = hhmm(nowMin - 60);
      const end = hhmm(nowMin + 60);
      await prisma.organizationSettings.upsert({
        where: { organizationId: orgId },
        create: { organizationId: orgId, quietHoursEnabled: true, quietHoursStart: start_, quietHoursEnd: end },
        update: { quietHoursEnabled: true, quietHoursStart: start_, quietHoursEnd: end },
      });
      out(`🌙 Quiet hours: ${start_} - ${end} IST`);
      const p = await person('Divya');
      const a = await automation('Follow-up (quiet hours)', [
        text('Hi {{name}}, catalogue bhej diya 📘'),
        delay(1, 'days'),
        text('Hi {{name}}, catalogue dekha?'),
      ]);
      await start(a, p);
      await timeTravel('1 din aage');
      await show(a, p);
      await prisma.organizationSettings.deleteMany({ where: { organizationId: orgId } });
    },
  },
];

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  await load();

  if (WIPE) {
    await wipe();
    out('🧹 Playground data hata diya.');
    return;
  }

  const chosen = ONLY ? scenarios.filter((s) => s.key === ONLY) : scenarios;
  if (chosen.length === 0) {
    out(`"${ONLY}" naam ka scenario nahi hai. Ye hain:`);
    for (const s of scenarios) out(`  ${s.key.padEnd(8)} ${s.title}`);
    return;
  }

  await setup();
  const db = (process.env.DATABASE_URL || '').split('/').pop()?.split('?')[0];
  out(`\n🧪 Automation playground - DB: ${db} (WhatsApp/wallet/push sab nakli)\n`);

  for (const [i, s] of chosen.entries()) {
    out(`${'━'.repeat(70)}\n${i + 1}. ${s.title}   [${s.key}]\n   👀 ${s.look}\n`);
    await s.run();
    out('');
  }

  // Bache hue PENDING jobs (jaise quiet hours wala) baad me kisi aur ke
  // runDueJobs se - vitest ya local server - chal jate. Rows rehne do taaki
  // Prisma Studio me dikhein, bas cancel kar do.
  await prisma.automationJob.updateMany({
    where: { organizationId: orgId, status: 'PENDING' },
    data: { status: 'CANCELLED', lastError: 'playground finished' },
  });

  out('━'.repeat(70));
  out('✅ Ho gaya. Data DB me pada hai. Tables dekhne ho to PEHLE test DB set karo,');
  out('   warna Prisma Studio .env wala PRODUCTION DB khol dega:');
  out(`   $env:DATABASE_URL='${LOCAL_TEST_DB}'; $env:DIRECT_URL=$env:DATABASE_URL; npx prisma studio`);
  out('   Hatane ke liye:  npm run playground -- --wipe');
}

main()
  .catch((err) => {
    Object.assign(console, real);
    const msg = String(err?.message || err);
    if (err?.code === 'P1001' || /Can't reach database|ECONNREFUSED/i.test(msg)) {
      console.error(
        '❌ Local database se connect nahi ho paya.\n' +
        '   1. Docker Desktop kholo (taskbar me whale icon "running" dikhe)\n' +
        '   2. Terminal me:  docker start wabmeta-localdb\n' +
        '   3. Phir se:      npm run playground'
      );
    } else if (/does not exist/i.test(msg) && /wabmeta_test|AutomationJob/i.test(msg)) {
      console.error('❌ Test database ya naya table nahi mila. Claude se kaho: "wabmeta_test DB phir se bana do".');
    } else {
      console.error('❌ Playground failed:', err);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect().catch(() => {});
    process.exit();
  });
