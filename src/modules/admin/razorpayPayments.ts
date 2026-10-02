// src/modules/admin/razorpayPayments.ts
//
// The Razorpay account's own payment list, read live from Razorpay, for the
// admin's Razorpay page. Unlike Plan payments (WabMeta's records), this
// includes money that never went through WabMeta's checkout: QR codes,
// payment links and payment pages. Each payment says whether WabMeta has it
// recorded, and for which customer.
//
// Plans and wallet top-ups use separate Razorpay keys (RAZORPAY_* and
// WALLET_RAZORPAY_*), so the page picks the account.

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export const RAZORPAY_ACCOUNTS = ['plans', 'wallet'] as const;
export type RazorpayAccount = (typeof RAZORPAY_ACCOUNTS)[number];

export interface RazorpayPaymentsQuery {
  account: RazorpayAccount;
  /** YYYY-MM-DD, India time, inclusive */
  from?: string;
  to?: string;
  /** A pay_… id: fetch that one payment */
  paymentId?: string;
  page: number;
  limit: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{6,40}$/;
const PAGE_SIZE = 50;

export const parseRazorpayPaymentsQuery = (raw: Record<string, unknown>): RazorpayPaymentsQuery => {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const account = str(raw.account) as RazorpayAccount;
  const q = str(raw.q);
  return {
    account: (RAZORPAY_ACCOUNTS as readonly string[]).includes(account) ? account : 'plans',
    from: DATE.test(str(raw.from)) ? str(raw.from) : undefined,
    to: DATE.test(str(raw.to)) ? str(raw.to) : undefined,
    paymentId: PAYMENT_ID.test(q) ? q : undefined,
    page: Math.max(1, Math.floor(Number(raw.page)) || 1),
    limit: PAGE_SIZE,
  };
};

/** India-time day boundaries as the unix seconds Razorpay filters on. */
export const istRangeToUnix = (from?: string, to?: string) => ({
  ...(from && { from: Math.floor(Date.parse(`${from}T00:00:00+05:30`) / 1000) }),
  ...(to && { to: Math.floor(Date.parse(`${to}T23:59:59+05:30`) / 1000) }),
});

export type PaymentKind = 'plan' | 'wallet' | 'direct';

/**
 * What a Razorpay payment was for. WabMeta's checkout writes its notes on the
 * order (planId for a plan, purpose=wallet_topup for a top-up), and Razorpay
 * copies them onto the payment; a payment WabMeta recorded is known either
 * way. Anything else - QR codes, payment links, payment pages - came straight
 * to the Razorpay account.
 */
export const classifyPayment = (
  notes: Record<string, unknown> | null | undefined,
  recorded: { plan: boolean; wallet: boolean }
): PaymentKind => {
  if (recorded.plan) return 'plan';
  if (recorded.wallet) return 'wallet';
  const n = notes && typeof notes === 'object' ? notes : {};
  if (n.planId) return 'plan';
  if (n.purpose === 'wallet_topup') return 'wallet';
  return 'direct';
};

/**
 * Money Razorpay kept that WabMeta has no record of - a WabMeta checkout
 * whose customer may not have got what they paid for. Failed or abandoned
 * attempts collected nothing, so there is nothing to fix.
 */
export const needsReconcile = (status: string, kind: PaymentKind, recorded: boolean) =>
  kind !== 'direct' && !recorded && (status === 'captured' || status === 'refunded');

const configured = (account: RazorpayAccount) =>
  account === 'plans'
    ? !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
    : !!(process.env.WALLET_RAZORPAY_KEY_ID && process.env.WALLET_RAZORPAY_KEY_SECRET);

const instanceFor = (account: RazorpayAccount) => {
  if (!configured(account)) {
    throw new AppError(`The ${account} Razorpay account is not configured on this server.`, 503);
  }
  const Razorpay = require('razorpay');
  return account === 'plans'
    ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    : new Razorpay({ key_id: process.env.WALLET_RAZORPAY_KEY_ID, key_secret: process.env.WALLET_RAZORPAY_KEY_SECRET });
};

export const listRazorpayPayments = async (query: RazorpayPaymentsQuery) => {
  const rzp = instanceFor(query.account);

  let items: any[] = [];
  try {
    if (query.paymentId) {
      items = [await rzp.payments.fetch(query.paymentId)];
    } else {
      const page: any = await rzp.payments.all({
        ...istRangeToUnix(query.from, query.to),
        count: query.limit,
        skip: (query.page - 1) * query.limit,
      });
      items = page?.items ?? [];
    }
  } catch (err: any) {
    const status = err?.statusCode ?? err?.status;
    if (query.paymentId && (status === 400 || status === 404)) {
      items = []; // no such payment on this account
    } else {
      const reason = err?.error?.description || err?.message || 'unknown error';
      throw new AppError(`Razorpay did not answer: ${reason}`, 502);
    }
  }

  const ids = items.map((p) => p.id).filter(Boolean);
  const [plans, topups] = ids.length
    ? await Promise.all([
        prisma.payment.findMany({
          where: { razorpayPaymentId: { in: ids } },
          select: { razorpayPaymentId: true, organization: { select: { id: true, name: true } } },
        }),
        prisma.walletTransaction.findMany({
          where: { razorpayPaymentId: { in: ids }, type: 'credit' },
          select: { razorpayPaymentId: true, wallet: { select: { organization: { select: { id: true, name: true } } } } },
        }),
      ])
    : [[], []];

  const planOrg = new Map(plans.map((p) => [p.razorpayPaymentId!, p.organization]));
  const walletOrg = new Map(topups.map((t) => [t.razorpayPaymentId!, t.wallet?.organization ?? null]));

  // A WabMeta checkout names its customer in the notes even when the
  // payment was never recorded (failed, or missed before the webhook).
  const noteOrgIds = [
    ...new Set(
      items
        .map((p) => (typeof p.notes?.organizationId === 'string' ? p.notes.organizationId : null))
        .filter((id): id is string => !!id)
    ),
  ];
  const noteOrgs = noteOrgIds.length
    ? new Map(
        (await prisma.organization.findMany({ where: { id: { in: noteOrgIds } }, select: { id: true, name: true } }))
          .map((o) => [o.id, o])
      )
    : new Map<string, { id: string; name: string }>();

  return {
    account: query.account,
    accounts: RAZORPAY_ACCOUNTS.filter(configured),
    page: query.page,
    limit: query.limit,
    hasMore: !query.paymentId && items.length === query.limit,
    rows: items.map((p) => {
      const recorded = planOrg.has(p.id) || walletOrg.has(p.id);
      const kind = classifyPayment(p.notes, { plan: planOrg.has(p.id), wallet: walletOrg.has(p.id) });
      return {
        id: p.id as string,
        status: p.status as string,
        amountPaise: Number(p.amount) || 0,
        refundedPaise: Number(p.amount_refunded) || 0,
        currency: p.currency || 'INR',
        method: p.method || null,
        payer: p.vpa || p.email || p.contact || null,
        contact: p.contact || null,
        email: p.email || null,
        description: p.description || null,
        orderId: p.order_id || null,
        errorDescription: p.error_description || null,
        createdAt: new Date((Number(p.created_at) || 0) * 1000).toISOString(),
        kind,
        recorded,
        needsReconcile: needsReconcile(String(p.status), kind, recorded),
        organization:
          planOrg.get(p.id) ?? walletOrg.get(p.id) ??
          (typeof p.notes?.organizationId === 'string' ? noteOrgs.get(p.notes.organizationId) ?? null : null),
      };
    }),
  };
};
