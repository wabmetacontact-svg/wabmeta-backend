// src/modules/sync/sync.project.ts
//
// Turning this database into events for TeamOS.
//
// WHY A PROJECTOR AND NOT A HOOK AT EVERY WRITE
//
// The obvious design is to write an outbox row beside each business change.
// It was rejected here for two concrete reasons found while reading the code:
//
//   1. There is no single place money is recorded. A successful plan payment is
//      written in billing.service.ts activatePlanFromOrder AND again in
//      razorpay.routes.ts, refunds in recordRefund, wallet credits in
//      creditWalletAtomic, offline payments in clientBilling.ts - and the
//      webhook paths on top. Hooking each is six edits that must all be
//      remembered, and the seventh payment path somebody adds next year would
//      silently never reach TeamOS. Nothing would fail; the money would just be
//      missing.
//
//   2. creditWalletAtomic is the function that once wrote seven credit rows for
//      one payment, and it now carries a careful row lock. Adding another write
//      inside that transaction is real risk for no gain.
//
// So instead this reads the tables that already hold the truth, and the outbox
// compares a fingerprint to decide whether anything actually changed. A payment
// path added later is picked up because it writes to Payment, not because
// somebody remembered to call something.
//
// The cost is latency: changes are seen on the next tick rather than instantly.
// The scheduler runs this often enough that the difference is seconds.

import prisma from '../../config/database';
import { isAddOnActive } from '../admin/addOns';
import { planMonthlyPaise } from '../admin/clientBilling';
import {
  CATEGORY,
  clientExternalId,
  memberExternalId,
  offlineExternalId,
  planExternalId,
  refundExternalId,
  walletExternalId,
  type ClientPayload,
  type LedgerPayload,
  type MemberPayload,
  type SyncPayload,
} from './sync.types';

/** Where the money cursor is kept between runs. */
export const CURSOR_KEY = 'teamos.sync.cursor';

/**
 * How far back each run looks beyond the cursor.
 *
 * Rows are selected on a timestamp, and a row written while the previous run
 * was reading could carry a timestamp just under the cursor it then saved.
 * Re-reading a few minutes costs nothing, because an unchanged row stops at the
 * fingerprint comparison and never becomes a request.
 */
export const OVERLAP_MS = 10 * 60 * 1000;

/** How many rows are read at a time, so a large table cannot exhaust memory. */
const PAGE = 500;

// ─── dates ─────────────────────────────────────────────────────────────────

const IST_MS = 5.5 * 60 * 60 * 1000;

/**
 * A yyyy-MM-dd date in India time.
 *
 * The receiving workspace's timezone is Asia/Kolkata, and its ledger stores a
 * DATE, not an instant. Sending the UTC date would file a payment taken at
 * 1 a.m. IST on the previous day, which is how a month's revenue ends up
 * reported one day short at each end.
 */
export const istDate = (d: Date): string => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);

// ─── the team ──────────────────────────────────────────────────────────────

const TITLES: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  support: 'Support',
  finance: 'Finance',
  onboarder: 'Onboarder',
  sales: 'Sales',
};

/**
 * Everybody on the admin team, so TeamOS can list them and credit clients to
 * them. Switched-off admins are still sent: their past clients and revenue
 * stay attributed, and TeamOS decides on its own what somebody may do.
 */
export async function projectMembers(): Promise<MemberPayload[]> {
  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true },
  });

  return admins.map((a) => ({
    kind: 'member.upsert' as const,
    externalId: memberExternalId(a.id),
    name: a.name,
    email: a.email?.toLowerCase() ?? null,
    title: TITLES[a.role] ?? 'Team member',
  }));
}

// ─── clients ───────────────────────────────────────────────────────────────

/**
 * The organizations that are mirrored as clients.
 *
 * Every one is read on every run rather than tracked with a cursor. A client's
 * monthly figure depends on its subscription and its add-ons, and ClientAddOn
 * has no updatedAt - so there is no timestamp that reliably moves when the
 * number changes. Re-reading is the only honest way to notice, and the
 * fingerprint makes it free when nothing moved.
 */
export async function projectClients(scope: 'owned' | 'all'): Promise<ClientPayload[]> {
  const out: ClientPayload[] = [];
  let cursor: string | undefined;

  for (;;) {
    const page = await prisma.organization.findMany({
      // "Owned" means somebody on the team is attached to it: a seller, an
      // onboarder or both.
      where: scope === 'owned' ? { OR: [{ onboardedById: { not: null } }, { soldById: { not: null } }] } : {},
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      select: {
        id: true,
        name: true,
        createdAt: true,
        deletedAt: true,
        onboardedById: true,
        onboardedAt: true,
        soldById: true,
        soldAt: true,
        owner: { select: { email: true, phone: true } },
        subscription: {
          select: {
            status: true,
            billingCycle: true,
            currentPeriodEnd: true,
            plan: { select: { type: true, monthlyPrice: true, yearlyPrice: true } },
          },
        },
      },
    });
    if (!page.length) break;

    const addOns = await prisma.clientAddOn.findMany({
      where: { organizationId: { in: page.map((o) => o.id) }, removedAt: null, billing: 'MONTHLY' },
    });

    for (const org of page) {
      // What the client is billed per month: the plan, if the subscription is
      // live and not a giveaway, plus whatever add-ons are running today. Same
      // rule as the admin panel's "Billed per month" so the two never disagree.
      const sub = org.subscription;
      const planLive = sub?.status === 'ACTIVE' && !!sub.currentPeriodEnd && sub.currentPeriodEnd > new Date();
      const planPaise = planLive && sub.plan?.type !== 'FREE_DEMO' ? planMonthlyPaise(sub.plan, sub.billingCycle) : 0;
      const addOnPaise = addOns
        .filter((a) => a.organizationId === org.id && isAddOnActive(a))
        .reduce((sum, a) => sum + a.quantity * a.unitPricePaise, 0);

      out.push({
        kind: 'client.upsert',
        externalId: clientExternalId(org.id),
        name: org.name,
        company: null,
        contact: org.owner?.email ?? org.owner?.phone ?? null,
        // When the client came to us: the sale if there was one, else when an
        // onboarder took it on, else when the account was made.
        since: istDate(org.soldAt ?? org.onboardedAt ?? org.createdAt),
        retainerPaise: planPaise + addOnPaise,
        // Credit goes to whoever brought the client in. A handover to an
        // onboarder must not move it - the sale is still the seller's.
        ownerExternalId: (org.soldById ?? org.onboardedById) ? memberExternalId((org.soldById ?? org.onboardedById)!) : null,
        onboarderExternalId: org.onboardedById ? memberExternalId(org.onboardedById) : null,
        removed: org.deletedAt !== null,
      });
    }

    if (page.length < PAGE) break;
    cursor = page[page.length - 1]!.id;
  }

  return out;
}

// ─── money ─────────────────────────────────────────────────────────────────

export interface MoneyWindow {
  since: Date;
  /** Exclusive end. Left out, the window runs to now. */
  until?: Date;
  /**
   * Which timestamp the window is measured on.
   *
   * `changed` (the default) is what the live sync wants: everything whose row
   * has been touched since the last run, so a refund recorded today against a
   * payment from March is picked up.
   *
   * `received` is what a backfill wants: the money that actually arrived
   * between two dates, regardless of when the row was last edited. Asking for
   * "January" and getting every old payment that happened to be touched in
   * January would make a backfill impossible to reason about or resume.
   */
  by?: 'changed' | 'received';
}

/**
 * Money, in a window.
 *
 * The three sources are exactly the ones receivedBetween() in
 * modules/admin/revenue.ts counts, and they do not overlap - a plan payment, a
 * wallet top-up and a verified offline payment are three different rupees. Each
 * row is sent with its own id, so TeamOS does not have to re-derive revenue and
 * cannot double-count it.
 *
 * A refund goes out as its own entry rather than shrinking the payment it came
 * from: the ledger then shows both what arrived and what went back, and the net
 * is still right.
 *
 * Offline payments are sent only once VERIFIED. A pending one could later be
 * rejected, and the contract has no way to retract an entry - it would sit in
 * TeamOS as money owed forever. WabMeta's own Offline Payments screen is where
 * pending and rejected ones belong.
 */
export async function projectMoney(window: Date | MoneyWindow): Promise<LedgerPayload[]> {
  const { since, until, by = 'changed' } = window instanceof Date ? { since: window } as MoneyWindow : window;
  const range = { gte: since, ...(until && { lt: until }) };
  const out: LedgerPayload[] = [];

  // ── plan payments, and the refunds against them
  for await (const p of pages((cursor) =>
    prisma.payment.findMany({
      where: {
        status: { in: ['SUCCESS', 'REFUNDED'] },
        razorpayPaymentId: { not: null },
        // paidAt is nullable on older rows, so "when the money arrived" falls
        // back to when the row was written - the same rule revenue.ts uses.
        ...(by === 'received'
          ? { OR: [{ paidAt: range }, { paidAt: null, createdAt: range }] }
          : { updatedAt: range }),
      },
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      select: {
        id: true,
        organizationId: true,
        amount: true,
        refundedAmount: true,
        planName: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  )) {
    const paid = p.paidAt ?? p.createdAt;
    out.push({
      kind: 'ledger.upsert',
      externalId: planExternalId(p.id),
      type: 'in',
      date: istDate(paid),
      description: p.planName ? `${p.planName} plan` : 'Plan payment',
      category: CATEGORY.plan,
      amountPaise: p.amount,
      status: 'paid',
      paidOn: istDate(paid),
      method: 'Razorpay',
      clientExternalId: clientExternalId(p.organizationId),
      note: null,
    });

    if (p.refundedAmount > 0) {
      out.push({
        kind: 'ledger.upsert',
        externalId: refundExternalId(p.id),
        type: 'out',
        // Razorpay's refund date is not stored, so the payment row's last
        // change is the closest honest answer.
        date: istDate(p.updatedAt),
        description: p.planName ? `Refund - ${p.planName} plan` : 'Refund - plan payment',
        category: CATEGORY.refund,
        amountPaise: p.refundedAmount,
        status: 'paid',
        paidOn: istDate(p.updatedAt),
        method: 'Razorpay',
        clientExternalId: clientExternalId(p.organizationId),
        note: null,
      });
    }
  }

  // ── wallet top-ups
  for await (const t of pages((cursor) =>
    prisma.walletTransaction.findMany({
      where: {
        type: 'credit',
        status: 'completed',
        razorpayPaymentId: { not: null },
        ...(by === 'received' ? { createdAt: range } : { updatedAt: range }),
      },
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      select: {
        id: true,
        amountPaise: true,
        createdAt: true,
        wallet: { select: { organizationId: true } },
      },
    }),
  )) {
    if (!t.wallet?.organizationId) continue;
    out.push({
      kind: 'ledger.upsert',
      externalId: walletExternalId(t.id),
      type: 'in',
      date: istDate(t.createdAt),
      description: 'Wallet top-up',
      category: CATEGORY.wallet,
      amountPaise: t.amountPaise,
      status: 'paid',
      paidOn: istDate(t.createdAt),
      method: 'Razorpay',
      clientExternalId: clientExternalId(t.wallet.organizationId),
      note: null,
    });
  }

  // ── verified offline payments
  for await (const m of pages((cursor) =>
    prisma.manualPayment.findMany({
      where: {
        status: 'VERIFIED',
        // ManualPayment has no updatedAt, and verification is the only state
        // change that matters, so the two timestamps it does have cover it.
        ...(by === 'received'
          ? { paidAt: range }
          : { OR: [{ createdAt: range }, { verifiedAt: range }] }),
      },
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      select: {
        id: true,
        organizationId: true,
        amountPaise: true,
        method: true,
        reference: true,
        description: true,
        paidAt: true,
        verifiedAt: true,
      },
    }),
  )) {
    out.push({
      kind: 'ledger.upsert',
      externalId: offlineExternalId(m.id),
      type: 'in',
      date: istDate(m.paidAt),
      description: m.description?.trim() || 'Offline payment',
      category: CATEGORY.offline,
      amountPaise: m.amountPaise,
      status: 'paid',
      paidOn: istDate(m.verifiedAt ?? m.paidAt),
      method: m.method,
      clientExternalId: clientExternalId(m.organizationId),
      note: m.reference?.trim() || null,
    });
  }

  return out;
}

/** Walks a keyset-paginated query without holding every row at once. */
async function* pages<T extends { id: string }>(read: (cursor?: string) => Promise<T[]>) {
  let cursor: string | undefined;
  for (;;) {
    const page = await read(cursor);
    for (const row of page) yield row;
    if (page.length < PAGE) return;
    cursor = page[page.length - 1]!.id;
  }
}

// ─── the cursor ────────────────────────────────────────────────────────────

/**
 * Where the last run got to.
 *
 * On the very first run there is nothing stored, and reading every payment ever
 * taken would push years of history in one go. So the cursor starts at now and
 * only new money flows; history is a deliberate act, through the backfill
 * script, where a date range can be chosen and watched.
 */
export async function readCursor(now = new Date()): Promise<{ since: Date; firstRun: boolean }> {
  const row = await prisma.systemSetting.findUnique({ where: { key: CURSOR_KEY } });
  const stored = typeof row?.value === 'string' ? new Date(row.value) : null;

  if (!stored || Number.isNaN(stored.getTime())) return { since: now, firstRun: true };
  return { since: new Date(stored.getTime() - OVERLAP_MS), firstRun: false };
}

export async function writeCursor(at: Date): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: CURSOR_KEY },
    create: { key: CURSOR_KEY, value: at.toISOString(), updatedBy: 'teamos-sync' },
    update: { value: at.toISOString(), updatedBy: 'teamos-sync' },
  });
}

/** Everything due to be pushed right now. */
export async function project(scope: 'owned' | 'all', since: Date): Promise<SyncPayload[]> {
  const [members, clients, money] = await Promise.all([
    projectMembers(),
    projectClients(scope),
    projectMoney(since),
  ]);
  return [...members, ...clients, ...money];
}
