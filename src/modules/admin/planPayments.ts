// src/modules/admin/planPayments.ts
//
// Every plan payment across all customers, for the admin's Plan payments
// page: money received (SUCCESS), refunds, and failed checkout attempts
// (FAILED, written by the Razorpay webhook - see recordFailedPlanPayment).
//
// A failed attempt keeps its Razorpay order id in notes.razorpayOrderId, not
// in the razorpayOrderId column, so search looks in both.

import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

export const PLAN_PAYMENT_STATUSES = ['SUCCESS', 'FAILED', 'REFUNDED'] as const;
export type PlanPaymentStatus = (typeof PLAN_PAYMENT_STATUSES)[number];

export interface PlanPaymentQuery {
  status?: PlanPaymentStatus;
  q?: string;
  /** YYYY-MM-DD, India time, inclusive */
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LIMIT = 100;

/** Query-string values in, a safe query out (bad values are dropped). */
export const parsePlanPaymentQuery = (raw: Record<string, unknown>): PlanPaymentQuery => {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const status = str(raw.status).toUpperCase();
  const page = Math.max(1, Math.floor(Number(raw.page)) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(raw.limit)) || 50));
  return {
    status: (PLAN_PAYMENT_STATUSES as readonly string[]).includes(status) ? (status as PlanPaymentStatus) : undefined,
    q: str(raw.q).slice(0, 100) || undefined,
    from: DATE.test(str(raw.from)) ? str(raw.from) : undefined,
    to: DATE.test(str(raw.to)) ? str(raw.to) : undefined,
    page,
    limit,
  };
};

/** Filters other than status: the summary tiles use these alone. */
export const planPaymentScope = (query: PlanPaymentQuery): Prisma.PaymentWhereInput => {
  const and: Prisma.PaymentWhereInput[] = [];

  if (query.from || query.to) {
    and.push({
      createdAt: {
        ...(query.from && { gte: new Date(`${query.from}T00:00:00+05:30`) }),
        ...(query.to && { lte: new Date(`${query.to}T23:59:59.999+05:30`) }),
      },
    });
  }

  if (query.q) {
    const q = query.q;
    and.push({
      OR: [
        { razorpayPaymentId: { contains: q, mode: 'insensitive' } },
        { razorpayOrderId: { contains: q, mode: 'insensitive' } },
        { notes: { path: ['razorpayOrderId'], equals: q } },
        { organizationId: q },
        { organization: { name: { contains: q, mode: 'insensitive' } } },
        { planName: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  return and.length ? { AND: and } : {};
};

export const planPaymentWhere = (query: PlanPaymentQuery): Prisma.PaymentWhereInput => {
  const scope = planPaymentScope(query);
  return query.status ? { AND: [scope, { status: query.status }] } : scope;
};

const noteText = (notes: Prisma.JsonValue | null, key: string): string | null => {
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return null;
  const v = (notes as Record<string, unknown>)[key];
  return typeof v === 'string' && v ? v : null;
};

export const listPlanPayments = async (query: PlanPaymentQuery) => {
  const where = planPaymentWhere(query);
  const scope = planPaymentScope(query);

  const [rows, total, received, failed] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        status: true,
        amount: true,
        refundedAmount: true,
        currency: true,
        planName: true,
        billingCycle: true,
        razorpayPaymentId: true,
        razorpayOrderId: true,
        notes: true,
        createdAt: true,
        paidAt: true,
        failedAt: true,
        organization: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where: { AND: [scope, { status: { in: ['SUCCESS', 'REFUNDED'] } }] },
      _count: true,
      _sum: { amount: true, refundedAmount: true },
    }),
    prisma.payment.count({ where: { AND: [scope, { status: 'FAILED' }] } }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      status: r.status,
      amountPaise: r.amount,
      refundedPaise: r.refundedAmount,
      currency: r.currency,
      planName: r.planName,
      billingCycle: r.billingCycle,
      razorpayPaymentId: r.razorpayPaymentId,
      razorpayOrderId: r.razorpayOrderId ?? noteText(r.notes, 'razorpayOrderId'),
      method: noteText(r.notes, 'method'),
      failureReason: noteText(r.notes, 'errorDescription'),
      createdAt: r.createdAt,
      paidAt: r.paidAt,
      failedAt: r.failedAt,
      organization: r.organization,
    })),
    total,
    page: query.page,
    limit: query.limit,
    summary: {
      receivedCount: received._count,
      // What was kept: paid minus refunded.
      receivedPaise: (received._sum.amount ?? 0) - (received._sum.refundedAmount ?? 0),
      refundedPaise: received._sum.refundedAmount ?? 0,
      failedCount: failed,
    },
  };
};
