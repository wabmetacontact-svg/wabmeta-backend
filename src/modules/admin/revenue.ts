// src/modules/admin/revenue.ts
//
// The one definition of revenue: money WabMeta actually received.
//
//   + Razorpay plan payments (Payment SUCCESS, or REFUNDED if partly kept),
//     minus whatever was refunded on them
//   + wallet top-ups paid through Razorpay
//   + offline payments (UPI / cash / bank) a finance or super admin verified
//
// Not revenue: plans an admin assigned for free, a client's own Razorpay
// collections from their customers (LeadPayment), wallet balance, prices on
// a bill that nobody has paid yet.
//
// The dashboard, the Revenue page, onboarder numbers and a client's billing
// page all read from here, so they can never disagree. Days and months are
// India time.

import prisma from '../../config/database';

const IST_MS = 330 * 60_000;

/** Midnight in India, as a UTC instant. */
export const istDayStart = (now: Date = new Date()): Date => {
  const ist = new Date(now.getTime() + IST_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_MS);
};

/** The first moment of this month in India, as a UTC instant. */
export const istMonthStart = (now: Date = new Date()): Date => {
  const ist = new Date(now.getTime() + IST_MS);
  ist.setUTCDate(1);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_MS);
};

export interface RevenueWindow {
  from?: Date;
  to?: Date;
  organizationIds?: string[];
}

export interface ReceivedBreakdown {
  planPaymentsPaise: number;
  refundsPaise: number;
  walletTopupsPaise: number;
  offlinePaise: number;
  totalPaise: number;
}

const range = (from?: Date, to?: Date) =>
  from || to ? { ...(from && { gte: from }), ...(to && { lt: to }) } : undefined;

/** Everything received in a window (optionally for some organizations only). */
export const receivedBetween = async (w: RevenueWindow = {}): Promise<ReceivedBreakdown> => {
  const r = range(w.from, w.to);
  const orgFilter = w.organizationIds ? { organizationId: { in: w.organizationIds } } : {};

  // A payment's date is when it was paid; old rows without paidAt fall back
  // to when they were created.
  const paymentWhere: any = {
    ...orgFilter,
    status: { in: ['SUCCESS', 'REFUNDED'] },
    razorpayPaymentId: { not: null },
    ...(r && { OR: [{ paidAt: r }, { paidAt: null, createdAt: r }] }),
  };

  const [plans, topups, offline] = await Promise.all([
    prisma.payment.aggregate({ where: paymentWhere, _sum: { amount: true, refundedAmount: true } }),
    prisma.walletTransaction.aggregate({
      where: {
        type: 'credit',
        status: 'completed',
        razorpayPaymentId: { not: null },
        ...(w.organizationIds && { wallet: { organizationId: { in: w.organizationIds } } }),
        ...(r && { createdAt: r }),
      },
      _sum: { amountPaise: true },
    }),
    prisma.manualPayment.aggregate({
      where: { ...orgFilter, status: 'VERIFIED', ...(r && { paidAt: r }) },
      _sum: { amountPaise: true },
    }),
  ]);

  const planPaymentsPaise = plans._sum.amount ?? 0;
  const refundsPaise = plans._sum.refundedAmount ?? 0;
  const walletTopupsPaise = topups._sum.amountPaise ?? 0;
  const offlinePaise = offline._sum.amountPaise ?? 0;

  return {
    planPaymentsPaise,
    refundsPaise,
    walletTopupsPaise,
    offlinePaise,
    totalPaise: planPaymentsPaise - refundsPaise + walletTopupsPaise + offlinePaise,
  };
};

/** Today, this month and all time, in India time. */
export const receivedSummary = async (organizationIds?: string[]) => {
  const now = new Date();
  const [today, month, total] = await Promise.all([
    receivedBetween({ from: istDayStart(now), organizationIds }),
    receivedBetween({ from: istMonthStart(now), organizationIds }),
    receivedBetween({ organizationIds }),
  ]);
  return { today, month, total };
};

/**
 * Monthly recurring revenue.
 *
 * From what each active paid subscriber last actually paid (net of refunds),
 * spread over the period that payment bought - not from list prices, which
 * grandfathered plans, coupons and yearly cycles make wrong. Subscriptions an
 * admin gave away count as complimentary, not revenue. Monthly add-ons are
 * reported beside it.
 */
export const computeMrr = async () => {
  const now = new Date();
  const [activeSubs, monthlyAddOns] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: 'ACTIVE', currentPeriodEnd: { gt: now } },
      select: {
        organizationId: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        plan: { select: { type: true } },
      },
    }),
    prisma.clientAddOn.findMany({
      where: { removedAt: null, billing: 'MONTHLY', startsAt: { lte: now } },
      select: { quantity: true, unitPricePaise: true, endsAt: true },
    }),
  ]);

  const orgIds = activeSubs.map((s) => s.organizationId);
  const lastPayments = orgIds.length
    ? await prisma.payment.findMany({
        where: { organizationId: { in: orgIds }, status: { in: ['SUCCESS', 'REFUNDED'] }, razorpayPaymentId: { not: null } },
        orderBy: { createdAt: 'desc' },
        distinct: ['organizationId'],
        select: { organizationId: true, amount: true, refundedAmount: true },
      })
    : [];
  const lastPaid = new Map(lastPayments.map((p) => [p.organizationId, Math.max(0, p.amount - p.refundedAmount)]));

  let mrrPaise = 0;
  let paying = 0;
  let complimentary = 0;
  const byPlan: Record<string, { customers: number; mrrPaise: number }> = {};

  for (const s of activeSubs) {
    const planType = String(s.plan?.type ?? 'UNKNOWN');
    if (planType === 'FREE_DEMO') continue;

    const amount = lastPaid.get(s.organizationId) ?? 0;
    const days = Math.max(1, (s.currentPeriodEnd.getTime() - s.currentPeriodStart.getTime()) / 86_400_000);
    const monthly = amount ? Math.round((amount * 30) / days) : 0;

    if (amount) paying++;
    else complimentary++;
    mrrPaise += monthly;
    byPlan[planType] = byPlan[planType] || { customers: 0, mrrPaise: 0 };
    byPlan[planType].customers++;
    byPlan[planType].mrrPaise += monthly;
  }

  const addOnMrrPaise = monthlyAddOns
    .filter((a) => !a.endsAt || a.endsAt > now)
    .reduce((sum, a) => sum + a.quantity * a.unitPricePaise, 0);

  return { mrrPaise, addOnMrrPaise, payingCustomers: paying, complimentaryCustomers: complimentary, byPlan };
};
