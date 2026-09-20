// prisma/set-billing-plans.ts
//
// The one place the plans are defined. Everything else - the pricing page,
// the comparison table, checkout, the feature middleware - reads the rows
// this writes, so pricing changes happen here and nowhere else.
//
// Four monthly tiers (Starter / Growth / Pro / Business) plus a 5-day Free
// Demo. Annual is ten months' price, i.e. two months free. The old duration
// plans (Monthly / 3-Month / 6-Month / 1-Year) stay in the table with
// isPublic: false so existing subscriptions keep working, but nobody new can
// buy them.
//
// Run (LOCAL):
//   DATABASE_URL="postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_dev" \
//     npx ts-node prisma/set-billing-plans.ts
//
// Run (PRODUCTION — deliberate, after reviewing the printed diff):
//   npx ts-node prisma/set-billing-plans.ts --allow-remote
//
// Add --dry to preview without writing.

import { PrismaClient, PlanType } from '@prisma/client';

const prisma = new PrismaClient();

const ALLOW_REMOTE = process.argv.includes('--allow-remote');
const DRY = process.argv.includes('--dry');

const url = process.env.DATABASE_URL || '';
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
if (!isLocal && !ALLOW_REMOTE) {
  console.error('Refusing to run: DATABASE_URL is not localhost.');
  console.error('   Got:', url.replace(/:[^:@]*@/, ':***@'));
  console.error('   Re-run with --allow-remote if you really mean to change production pricing.');
  process.exit(1);
}

const UNLIMITED = 999999;

// Base rate the discounts are measured against.
const BASE_MONTHLY = 899;

const pct = (total: number, months: number) =>
  Math.round((1 - total / months / BASE_MONTHLY) * 100);

export interface PlanSpec {
  type: PlanType;
  name: string;
  slug: string;
  description: string;
  price: number;        // total charged for the whole period
  months: number;       // period length, for the per-month maths
  validityDays: number;
  /** Annual price (10 months' worth = 2 months free). Same as `price` on the old term plans. */
  yearlyPrice?: number;
  /** Explicit yes/no per feature - this is what featureLock reads. */
  includedFeatures?: Record<string, boolean>;
  /** Whether the pricing page offers it. False on the retired term plans. */
  isPublic?: boolean;
  maxTeamMembers: number;
  maxWhatsAppAccounts: number;
  maxApiCalls: number;
  isRecommended: boolean;
  // Per-plan overrides. Anything not listed defaults to unlimited.
  // NOTE: 0 means the feature is LOCKED (see middleware/featureLock.ts).
  caps?: Partial<{
    maxContacts: number;
    maxMessages: number;
    maxCampaigns: number;
    maxTemplates: number;
    maxChatbots: number;
    maxAutomations: number;
  }>;
  features: string[];
}

export const PLANS: PlanSpec[] = [
  {
    type: 'FREE_DEMO',
    name: 'Free Demo',
    slug: 'free-demo',
    description: 'Try every feature for 5 days, with small usage limits.',
    price: 0,
    months: 0,
    validityDays: 5,
    maxTeamMembers: 1,
    maxWhatsAppAccounts: 1,
    maxApiCalls: 100,
    isRecommended: false,
    // Features UNLOCKED (never 0 — 0 means "locked" to the feature middleware),
    // just small enough to require an upgrade for real use.
    caps: {
      maxContacts: 50,
      maxMessages: 100,
      maxCampaigns: 1,
      maxTemplates: 2,
      maxChatbots: 1,
      maxAutomations: 3,
    },
    includedFeatures: { bulkPaste: true },
    features: [
      'Every feature unlocked',
      'WhatsApp + Instagram + Telegram',
      '50 contacts · 100 messages',
      '5-day trial',
    ],
  },
  // ─── Naye feature tiers (monthly-first) ───────────────────────────────────
  {
    type: 'STARTER',
    name: 'Starter',
    slug: 'starter',
    description: 'Get started on WhatsApp and Instagram.',
    price: 799,
    yearlyPrice: 7990,
    months: 1,
    validityDays: 30,
    maxTeamMembers: 3,
    maxWhatsAppAccounts: 1,
    maxApiCalls: 5000,
    isRecommended: false,
    caps: {
      maxContacts: 5000,
      maxMessages: 10000,
    },
    includedFeatures: {
      inbox: true, contacts: true, templates: true, campaigns: true,
      wallet: true, connection: true, instagram: true,
      telegram: false, chatbot: false, automation: false,
      crm: false, reports: false, aiAgent: false, bulkPaste: false,
    },
    features: [
      'WhatsApp + Instagram inbox',
      '5,000 contacts · 10,000 messages/mo',
      'Unlimited campaigns & templates',
      '3 team members · 1 WhatsApp number',
    ],
  },
  {
    type: 'GROWTH',
    name: 'Growth',
    slug: 'growth',
    description: 'Automation, chatbot and CRM for the whole team.',
    price: 1799,
    yearlyPrice: 17990,
    months: 1,
    validityDays: 30,
    maxTeamMembers: 5,
    maxWhatsAppAccounts: 1,
    maxApiCalls: 20000,
    isRecommended: true,
    caps: {
      maxContacts: 25000,
      maxMessages: 50000,
    },
    includedFeatures: {
      inbox: true, contacts: true, templates: true, campaigns: true,
      wallet: true, connection: true, instagram: true, telegram: true,
      chatbot: true, automation: true, crm: true, reports: true,
      aiAgent: false, bulkPaste: true,
    },
    features: [
      'Everything in Starter, plus:',
      'Telegram inbox',
      'Automation & chatbot flow builder',
      'CRM pipelines & reports',
      'Bulk paste & CSV import',
      '25,000 contacts · 50,000 messages/mo',
      '5 team members',
    ],
  },
  {
    type: 'PRO',
    name: 'Pro',
    slug: 'pro',
    description: 'AI Sales Agent and payment links.',
    price: 2999,
    yearlyPrice: 29990,
    months: 1,
    validityDays: 30,
    maxTeamMembers: 10,
    maxWhatsAppAccounts: 2,
    maxApiCalls: 50000,
    isRecommended: false,
    caps: {
      maxContacts: 100000,
      maxMessages: 200000,
    },
    includedFeatures: {
      inbox: true, contacts: true, templates: true, campaigns: true,
      wallet: true, connection: true, instagram: true, telegram: true,
      chatbot: true, automation: true, crm: true, reports: true,
      aiAgent: true, bulkPaste: true,
    },
    features: [
      'Everything in Growth, plus:',
      'AI Sales Agent — 2,000 replies/month',
      'Payment links',
      '100,000 contacts · 200,000 messages/mo',
      '10 team members · 2 WhatsApp numbers',
    ],
  },
  {
    type: 'BUSINESS',
    name: 'Business',
    slug: 'business',
    description: 'For agencies and multi-number setups.',
    price: 5999,
    yearlyPrice: 59990,
    months: 1,
    validityDays: 30,
    maxTeamMembers: UNLIMITED,
    maxWhatsAppAccounts: 3,
    maxApiCalls: 200000,
    isRecommended: false,
    includedFeatures: {
      inbox: true, contacts: true, templates: true, campaigns: true,
      wallet: true, connection: true, instagram: true, telegram: true,
      chatbot: true, automation: true, crm: true, reports: true,
      aiAgent: true, bulkPaste: true,
    },
    features: [
      'Everything in Pro, plus:',
      'Unlimited contacts & messages',
      'AI Sales Agent — 10,000 replies/month',
      '3 WhatsApp numbers · API access',
      'Unlimited team members',
    ],
  },

  // ─── Purane duration plans - zinda, par pricing page par nahi ────────────
  {
    type: 'MONTHLY',
    isPublic: false,
    name: 'Monthly Plan',
    slug: 'monthly',
    description: 'Entry plan — unlimited messaging on every channel. Automation and chatbots start at the 3-Month plan.',
    price: 899,
    months: 1,
    validityDays: 30,
    maxTeamMembers: 3,
    maxWhatsAppAccounts: 1,
    maxApiCalls: 5000,
    isRecommended: false,
    // 0 = locked. Automation and chatbots are the 3-Month upgrade hook.
    caps: { maxChatbots: 0, maxAutomations: 0 },
    features: [
      'Unlimited messages, campaigns & contacts',
      'WhatsApp + Instagram + Telegram inbox',
      'Unlimited templates · 3 team members',
      'Automation & chatbots: from 3-Month plan',
    ],
  },
  {
    type: 'QUARTERLY',
    isPublic: false,
    name: '3-Month Plan',
    slug: '3-month',
    description: 'Same full access, billed quarterly at a lower rate.',
    price: 2500,
    months: 3,
    validityDays: 90,
    maxTeamMembers: 5,
    maxWhatsAppAccounts: 1,
    maxApiCalls: 10000,
    isRecommended: false,
    features: [
      'Everything in Monthly, plus:',
      '✨ Automation & chatbots unlocked',
      'Save 7% vs monthly (₹833/mo)',
      '5 team members · standard support',
    ],
  },
  {
    type: 'BIANNUAL',
    isPublic: false,
    name: '6-Month Plan ⭐',
    slug: '6-month',
    // Price stays ₹5,000 (₹833/mo — the same rate as 3-Month). It previously
    // advertised "Save 15%", which was not true at this price. Since the rate
    // is unchanged, this tier is differentiated by capacity and support
    // instead: double the team seats, a second WhatsApp account, priority help.
    description: 'Full access with more seats, a second WhatsApp account and priority support.',
    price: 5000,
    months: 6,
    validityDays: 180,
    maxTeamMembers: 10,
    maxWhatsAppAccounts: 2,
    maxApiCalls: 25000,
    isRecommended: false,
    features: [
      'Everything in 3-Month',
      '10 team members (2× the 3-Month plan)',
      '2 WhatsApp accounts',
      'Priority support',
    ],
  },
  {
    type: 'ANNUAL',
    isPublic: false,
    name: '1-Year Plan ⭐',
    slug: '1-year',
    description: 'Same full access, billed yearly at the lowest rate.',
    price: 8999,
    months: 12,
    validityDays: 365,
    maxTeamMembers: UNLIMITED,
    maxWhatsAppAccounts: 2,
    maxApiCalls: 100000,
    isRecommended: false,
    features: [
      'Everything in 6-Month',
      'Save 17% vs monthly (₹750/mo)',
      'Unlimited team members',
      'Priority support',
    ],
  },
];

async function main() {
  console.log(`\n${DRY ? '🔎 DRY RUN — nothing will be written' : '✍️  Applying billing plans'}`);
  console.log(`   Target: ${isLocal ? 'LOCAL dev database' : '⚠️  REMOTE database'}\n`);

  for (const p of PLANS) {
    const caps = p.caps;
    const data = {
      name: p.name,
      slug: p.slug,
      description: p.description,
      monthlyPrice: p.price,
      yearlyPrice: p.yearlyPrice ?? p.price,
      validityDays: p.validityDays,
      isRecommended: p.isRecommended,
      isActive: true,
      isPublic: p.isPublic ?? true,
      includedFeatures: p.includedFeatures ?? undefined,
      // Paid plans: unlimited across the board. Trial: small but non-zero.
      maxContacts: caps?.maxContacts ?? UNLIMITED,
      maxMessages: caps?.maxMessages ?? UNLIMITED,
      maxMessagesPerMonth: caps?.maxMessages ?? UNLIMITED,
      maxCampaigns: caps?.maxCampaigns ?? UNLIMITED,
      maxCampaignsPerMonth: caps?.maxCampaigns ?? UNLIMITED,
      maxTemplates: caps?.maxTemplates ?? UNLIMITED,
      maxChatbots: caps?.maxChatbots ?? UNLIMITED,
      maxAutomations: caps?.maxAutomations ?? UNLIMITED,
      maxTeamMembers: p.maxTeamMembers,
      maxWhatsAppAccounts: p.maxWhatsAppAccounts,
      maxApiCalls: p.maxApiCalls,
      features: p.features,
    };

    const before = await prisma.plan.findUnique({ where: { type: p.type } });

    const fmt = (n: number) => (n === 0 ? '🔒 off' : n === UNLIMITED ? '∞' : String(n));
    const featureNote = `  automation: ${fmt(data.maxAutomations)} · chatbots: ${fmt(data.maxChatbots)}`;
    const rate = p.months ? ` (₹${Math.round(p.price / p.months)}/mo, ${pct(p.price, p.months)}% off)` : '';

    if (before) {
      const oldPrice = Number(before.monthlyPrice);
      const priceNote = oldPrice !== p.price ? `  💰 ₹${oldPrice} → ₹${p.price}` : '';
      console.log(`   ${p.name.padEnd(16)} ₹${String(p.price).padEnd(6)}${rate}${priceNote}${featureNote}`);
    } else {
      console.log(`   ${p.name.padEnd(16)} ₹${String(p.price).padEnd(6)}${rate}  (new)${featureNote}`);
    }

    if (!DRY) {
      await prisma.plan.upsert({
        where: { type: p.type },
        update: data,
        create: { type: p.type, ...data },
      });
    }
  }

  if (!DRY) {
    console.log('\n✅ Billing plans updated.');
    console.log('   Note: the feature-lock cache is in-memory with a 60s TTL —');
    console.log('   changes appear within a minute (or restart the backend).');
  } else {
    console.log('\n(dry run — re-run without --dry to apply)');
  }
}

// Sirf tab chalao jab file seedha run ki gayi ho. Test isse import karke
// sirf PLANS padhta hai - import par DB se judna nahi chahiye.
//
// argv se dekha jata hai, `require.main` se nahi: package.json me
// "type" nahi hai, to Node is file ko ES module ki tarah padhta hai
// (`import` dekh kar), aur ESM me `require` hota hi nahi - wahan
// require.main crash kar deta. argv dono me chalti hai, aur vitest ke
// andar argv[1] vitest ka binary hota hai, to test par main() nahi chalta.
const runDirectly = /set-billing-plans\.(ts|js)$/.test(process.argv[1] || '');

if (runDirectly) {
  main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
