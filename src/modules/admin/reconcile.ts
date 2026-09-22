// src/modules/admin/reconcile.ts
//
// Match what Razorpay says it collected against what WabMeta recorded.
//
// Razorpay is the source of truth for money that came in online. Anything
// captured there but missing here is revenue the reports cannot see (and,
// for a plan, a customer who paid and got nothing). This lists those, and
// can record one - through the same code the webhook uses, so a plan payment
// also activates the plan.

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export interface RazorpayPaymentLite {
  id: string;
  order_id?: string | null;
  amount: number;
  amount_refunded?: number;
  status: string;
  created_at: number; // unix seconds
  email?: string | null;
  contact?: string | null;
  method?: string | null;
}

export interface Recorded {
  razorpayPaymentId: string;
  amountPaise: number;
  refundedPaise: number;
  kind: 'plan' | 'wallet';
}

/**
 * Compare the two lists. Only payments Razorpay actually kept money for
 * (captured, or refunded afterwards) are expected to be recorded.
 */
export const diffPayments = (razorpay: RazorpayPaymentLite[], recorded: Recorded[]) => {
  const byId = new Map(recorded.map((r) => [r.razorpayPaymentId, r]));
  const collected = razorpay.filter((p) => p.status === 'captured' || p.status === 'refunded');

  const missing = collected.filter((p) => !byId.has(p.id));
  const amountMismatch = collected
    .filter((p) => byId.has(p.id) && byId.get(p.id)!.amountPaise !== p.amount)
    .map((p) => ({ payment: p, recordedPaise: byId.get(p.id)!.amountPaise }));
  const refundMismatch = collected
    .filter((p) => {
      const r = byId.get(p.id);
      return r && r.kind === 'plan' && (p.amount_refunded ?? 0) !== r.refundedPaise;
    })
    .map((p) => ({ payment: p, recordedRefundPaise: byId.get(p.id)!.refundedPaise }));

  const collectedPaise = collected.reduce((s, p) => s + p.amount - (p.amount_refunded ?? 0), 0);
  const missingPaise = missing.reduce((s, p) => s + p.amount - (p.amount_refunded ?? 0), 0);

  return { collectedCount: collected.length, collectedPaise, missing, missingPaise, amountMismatch, refundMismatch };
};

const rzpOrThrow = async () => {
  const { getRazorpayInstance } = await import('../billing/billing.service');
  const rzp = getRazorpayInstance();
  if (!rzp) throw new AppError('Razorpay is not configured on this server.', 503);
  return rzp;
};

/** Razorpay payments created in the last `days` days (at most 2,000). */
const fetchRazorpayPayments = async (days: number): Promise<RazorpayPaymentLite[]> => {
  const rzp = await rzpOrThrow();
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86_400;

  const all: RazorpayPaymentLite[] = [];
  for (let skip = 0; skip < 2000; skip += 100) {
    const page: any = await rzp.payments.all({ from, to, count: 100, skip });
    const items: RazorpayPaymentLite[] = page?.items ?? [];
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
};

export const reconcileWithRazorpay = async (days = 7) => {
  const window = Math.min(90, Math.max(1, Math.floor(days) || 7));
  const razorpay = await fetchRazorpayPayments(window);
  const ids = razorpay.map((p) => p.id);

  const [plans, topups] = await Promise.all([
    prisma.payment.findMany({
      where: { razorpayPaymentId: { in: ids } },
      select: { razorpayPaymentId: true, amount: true, refundedAmount: true },
    }),
    prisma.walletTransaction.findMany({
      where: { razorpayPaymentId: { in: ids }, type: 'credit' },
      select: { razorpayPaymentId: true, amountPaise: true },
    }),
  ]);

  const recorded: Recorded[] = [
    ...plans.map((p) => ({ razorpayPaymentId: p.razorpayPaymentId!, amountPaise: p.amount, refundedPaise: p.refundedAmount, kind: 'plan' as const })),
    ...topups.map((t) => ({ razorpayPaymentId: t.razorpayPaymentId!, amountPaise: t.amountPaise, refundedPaise: 0, kind: 'wallet' as const })),
  ];

  return { days: window, checkedAt: new Date().toISOString(), ...diffPayments(razorpay, recorded) };
};

/**
 * Record one Razorpay payment that WabMeta missed, the way the webhook would
 * have: a plan order activates the plan and adds a Payment; a wallet top-up
 * credits the wallet. Refunds already made are applied too.
 */
export const importRazorpayPayment = async (paymentId: string) => {
  const rzp = await rzpOrThrow();
  const payment: any = await rzp.payments.fetch(paymentId);
  if (!payment || (payment.status !== 'captured' && payment.status !== 'refunded')) {
    throw new AppError('Razorpay has not captured this payment, so there is nothing to record.', 400);
  }
  if (!payment.order_id) throw new AppError('This payment has no order, so its purpose is unknown.', 400);

  const order: any = await rzp.orders.fetch(payment.order_id);
  const notes = { ...(payment.notes || {}), ...(order.notes || {}) };
  const { billingService } = await import('../billing/billing.service');

  if (notes.planId && notes.organizationId) {
    const result = await billingService.activatePlanFromOrder({
      organizationId: notes.organizationId,
      order,
      razorpayPaymentId: payment.id,
    });
    if (payment.amount_refunded) await billingService.recordRefund(payment.id, payment.amount_refunded);
    return { kind: 'plan', organizationId: notes.organizationId, alreadyRecorded: !!result.alreadyRecorded };
  }

  if (notes.purpose === 'wallet_topup' && notes.organizationId) {
    const { creditWalletFromWebhook } = await import('../wallet/wallet.service');
    await creditWalletFromWebhook({
      organizationId: notes.organizationId,
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      amountPaise: Number(payment.amount),
    });
    return { kind: 'wallet', organizationId: notes.organizationId, alreadyRecorded: false };
  }

  throw new AppError('This payment is not a WabMeta plan or wallet top-up (no planId or purpose in its notes).', 400);
};
