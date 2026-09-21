// src/modules/billing/usageQuota.ts
//
// The monthly message allowance and the contact allowance, as the plans now
// sell them (Starter 5,000 contacts / 10,000 messages, Growth 25,000 / 50,000,
// Pro 100,000 / 200,000, Business unlimited).
//
// Until now nothing read those numbers. checkLimit() existed in
// billing.service.ts and had no callers, so every cap was decorative: a
// Starter organisation could add its 50,000th contact and send its 100,000th
// message without meeting a single wall.
//
// Where the wall goes matters more than that it exists:
//
//   - Contacts and campaigns are blocked. Both are deliberate bulk actions,
//     and being stopped with a number in the message is how someone decides
//     to upgrade.
//   - A reply in the inbox is never blocked. A customer is waiting at the
//     other end of it; silencing that conversation costs far more than the
//     upgrade is worth, and it punishes the wrong person.
//
// The 80% warning is not here - the usage bars on the Billing page already
// turn yellow at 80% and red at 100%. They just had nothing real to measure
// against before.

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { effectiveLimit, getLimitOverrides } from '../admin/orgControl';

/** Plans write this where they mean "no limit". */
export const UNLIMITED_AT = 999999;

export interface Quota {
  used: number;
  /** null = unlimited, or no plan data to go on. */
  limit: number | null;
  /** null when the limit is null. */
  remaining: number | null;
  percentage: number;
}

const format = (n: number) => n.toLocaleString('en-IN');

/**
 * Turn a plan's raw limit into one we can act on.
 *
 * null for anything we cannot trust - unlimited, missing, zero, nonsense.
 * Blocking a customer because their plan row failed to load would be a far
 * worse bug than letting a few extra messages through.
 */
export const limitFromPlan = (
  raw: number | null | undefined
): number | null => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= UNLIMITED_AT) return null;
  return Math.floor(n);
};

export const quotaFrom = (used: number, limit: number | null): Quota => {
  const u = Math.max(0, Number(used) || 0);

  if (limit === null) {
    return { used: u, limit: null, remaining: null, percentage: 0 };
  }

  return {
    used: u,
    limit,
    remaining: Math.max(0, limit - u),
    percentage: Math.min(100, Math.round((u / limit) * 100)),
  };
};

/** First moment of the current billing month, in server time. */
export const monthStart = (now: Date = new Date()): Date => {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** When the allowance comes back, for the message the customer reads. */
export const nextResetDate = (now: Date = new Date()): Date => {
  const d = monthStart(now);
  d.setMonth(d.getMonth() + 1);
  return d;
};

const resetPhrase = (now: Date = new Date()): string =>
  `Resets on ${nextResetDate(now).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })}.`;

// ─── Messages ──────────────────────────────────────────────────────────────

const planForOrg = async (organizationId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: {
      plan: {
        select: { name: true, maxContacts: true, maxMessagesPerMonth: true },
      },
    },
  });
  const plan = subscription?.plan ?? null;

  // An admin's per-organization limit replaces the plan's.
  const overrides = await getLimitOverrides(organizationId);
  if (!overrides.contacts && !overrides.messagesPerMonth) return plan;

  return {
    name: plan?.name ?? '',
    maxContacts: effectiveLimit(overrides, 'contacts', plan?.maxContacts ?? null),
    maxMessagesPerMonth: effectiveLimit(overrides, 'messagesPerMonth', plan?.maxMessagesPerMonth ?? null),
  };
};

export const getMessageQuota = async (
  organizationId: string
): Promise<Quota> => {
  const plan = await planForOrg(organizationId);
  const limit = limitFromPlan(plan?.maxMessagesPerMonth);

  if (limit === null) return quotaFrom(0, null);

  const used = await prisma.message.count({
    where: {
      conversation: { organizationId },
      direction: 'OUTBOUND',
      createdAt: { gte: monthStart() },
    },
  });

  return quotaFrom(used, limit);
};

/**
 * Stop a campaign that would run past the month's allowance.
 *
 * The whole campaign is refused rather than half-sent: a campaign that stops
 * in the middle leaves the customer guessing who heard from them.
 */
export const assertCampaignWithinMessageQuota = async (
  organizationId: string,
  recipients: number
): Promise<void> => {
  const quota = await getMessageQuota(organizationId);
  if (quota.limit === null || quota.remaining === null) return;

  if (quota.remaining <= 0) {
    throw new AppError(
      `You have used all ${format(quota.limit)} messages included this month. ` +
        `${resetPhrase()} Upgrade your plan to send more now.`,
      403
    );
  }

  if (recipients > quota.remaining) {
    throw new AppError(
      `This campaign needs ${format(recipients)} messages but only ` +
        `${format(quota.remaining)} are left in this month's ${format(quota.limit)}. ` +
        `${resetPhrase()} Send to fewer contacts, or upgrade your plan.`,
      403
    );
  }
};

// ─── Contacts ──────────────────────────────────────────────────────────────

export const getContactQuota = async (
  organizationId: string
): Promise<Quota> => {
  const plan = await planForOrg(organizationId);
  const limit = limitFromPlan(plan?.maxContacts);

  if (limit === null) return quotaFrom(0, null);

  const used = await prisma.contact.count({
    where: { organizationId, status: { not: 'DELETED' } },
  });

  return quotaFrom(used, limit);
};

/**
 * Stop the contact that would put the organisation over its plan.
 *
 * Import already had this check (it trims to the slots available); a single
 * contact added from the UI did not, so the limit could be walked past one
 * contact at a time.
 */
export const assertContactCapacity = async (
  organizationId: string,
  adding: number = 1
): Promise<void> => {
  const quota = await getContactQuota(organizationId);
  if (quota.limit === null || quota.remaining === null) return;

  if (adding > quota.remaining) {
    throw new AppError(
      `Your plan includes ${format(quota.limit)} contacts and ` +
        `${format(quota.used)} are already saved. Upgrade your plan to add more.`,
      403
    );
  }
};
