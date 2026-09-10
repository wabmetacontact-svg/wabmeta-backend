// prisma/set-billing-plans.ts
//
// Sets the billing plans to a clean "duration discount" ladder:
//   every paid plan has IDENTICAL feature access; only the price-per-month,
//   team seats and WhatsApp accounts change with the commitment length.
//
// Why: previously the ₹899 Monthly plan had maxAutomations = 0, which the
// feature-lock middleware treats as "not in this plan" — so the main paid plan
// had automation completely disabled. The 6-Month plan also advertised
// "Save 15%" while costing the same ₹833/month as the 3-Month plan.
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

interface PlanSpec {
  type: PlanType;
  name: string;
  slug: string;
  description: string;
  price: number;        // total charged for the whole period
  months: number;       // period length, for the per-month maths
  validityDays: number;
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

const PLANS: PlanSpec[] = [
  {
    type: 'FREE_DEMO',
    name: 'Free Demo',
    slug: 'free-demo',
    description: 'Try every feature for 2 days, with small usage limits.',
    price: 0,
    months: 0,
    validityDays: 2,
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
    features: [
      'All features unlocked',
      'Automation & chatbot included',
      'WhatsApp + Instagram + Telegram',
      '100 messages · 50 contacts · 2 days',
    ],
  },
  {
    type: 'MONTHLY',
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
    isRecommended: true,
    features: [
      'Everything in 3-Month',
      '10 team members (2× the 3-Month plan)',
      '2 WhatsApp accounts',
      'Priority support',
    ],
  },
  {
    type: 'ANNUAL',
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
      yearlyPrice: p.price,
      validityDays: p.validityDays,
      isRecommended: p.isRecommended,
      isActive: true,
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

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
