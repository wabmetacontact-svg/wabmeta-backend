// src/modules/admin/clientBilling.ts
//
// One client's bill and the money that actually came in, and the onboarder
// side of it: creating clients, assigning them, and the revenue each
// onboarder's clients have really paid.
//
// "Real revenue" here means money received: Razorpay plan payments, wallet
// top-ups paid through Razorpay, and offline payments a finance or super
// admin has verified. What a client is billed (plan + add-ons) is shown next
// to it but never counted as revenue on its own.

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { hashPassword } from '../../utils/password';
import { ADDON_CATALOG, isAddOnActive, isAddOnType } from './addOns';
import { istMonthStart, receivedSummary } from './revenue';

interface Actor {
  id: string;
  email?: string;
  role?: string;
}

export const PAYMENT_METHODS = ['UPI', 'CASH', 'BANK', 'CHEQUE', 'OTHER'] as const;

const monthStart = (now = new Date()) => istMonthStart(now);

/** A plan's price per month, from the list prices, for the cycle the client is on. */
export const planMonthlyPaise = (
  plan: { monthlyPrice: unknown; yearlyPrice: unknown } | null | undefined,
  billingCycle: string | null | undefined
): number => {
  if (!plan) return 0;
  if (billingCycle === 'yearly') return Math.round((Number(plan.yearlyPrice) || 0) * 100 / 12);
  return Math.round((Number(plan.monthlyPrice) || 0) * 100);
};

// ─── One client's bill ─────────────────────────────────────────────────────

export const getClientBilling = async (organizationId: string) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true, name: true, status: true, planType: true, createdAt: true,
      onboardedById: true, onboardedAt: true,
      owner: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      subscription: {
        select: {
          status: true, billingCycle: true, currentPeriodStart: true, currentPeriodEnd: true,
          plan: { select: { name: true, type: true, monthlyPrice: true, yearlyPrice: true } },
        },
      },
    },
  });
  if (!org) throw new AppError('Organization not found', 404);

  const [addOns, razorpay, manual, wallet, onboarder] = await Promise.all([
    prisma.clientAddOn.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } }),
    prisma.payment.findMany({
      where: { organizationId, status: { in: ['SUCCESS', 'REFUNDED'] }, razorpayPaymentId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, amount: true, refundedAmount: true, status: true, planName: true, billingCycle: true,
        paidAt: true, createdAt: true, razorpayPaymentId: true,
      },
    }),
    prisma.manualPayment.findMany({ where: { organizationId }, orderBy: { paidAt: 'desc' } }),
    prisma.wallet.findUnique({ where: { organizationId }, select: { id: true } }),
    org.onboardedById
      ? prisma.adminUser.findUnique({ where: { id: org.onboardedById }, select: { id: true, name: true, email: true } })
      : null,
  ]);

  const topups = wallet
    ? await prisma.walletTransaction.findMany({
        where: { walletId: wallet.id, type: 'credit', status: 'completed', razorpayPaymentId: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, amountPaise: true, createdAt: true, razorpayPaymentId: true },
      })
    : [];

  const now = new Date();
  const activeAddOns = addOns.filter((a) => isAddOnActive(a, now));
  const addOnLines = addOns.map((a) => ({
    ...a,
    active: isAddOnActive(a, now),
    linePaise: a.quantity * a.unitPricePaise,
  }));

  const plan = org.subscription?.plan;
  const planPaise = plan?.type === 'FREE_DEMO' ? 0 : planMonthlyPaise(plan, org.subscription?.billingCycle);
  const monthlyAddOnsPaise = activeAddOns
    .filter((a) => a.billing === 'MONTHLY')
    .reduce((s, a) => s + a.quantity * a.unitPricePaise, 0);
  const oneTimeAddOnsPaise = addOns
    .filter((a) => a.billing === 'ONE_TIME' && !a.removedAt)
    .reduce((s, a) => s + a.quantity * a.unitPricePaise, 0);

  const verifiedManual = manual.filter((m) => m.status === 'VERIFIED');
  // Net of refunds, as everywhere revenue is counted (admin/revenue.ts).
  const net = (p: { amount: number; refundedAmount: number }) => p.amount - p.refundedAmount;
  const razorpayPaise = razorpay.reduce((s, p) => s + net(p), 0);
  const topupPaise = topups.reduce((s, t) => s + t.amountPaise, 0);
  const manualPaise = verifiedManual.reduce((s, m) => s + m.amountPaise, 0);
  const pendingPaise = manual.filter((m) => m.status === 'PENDING').reduce((s, m) => s + m.amountPaise, 0);

  const ms = monthStart(now);
  const thisMonthPaise =
    razorpay.filter((p) => (p.paidAt ?? p.createdAt) >= ms).reduce((s, p) => s + net(p), 0) +
    topups.filter((t) => t.createdAt >= ms).reduce((s, t) => s + t.amountPaise, 0) +
    verifiedManual.filter((m) => m.paidAt >= ms).reduce((s, m) => s + m.amountPaise, 0);

  return {
    organization: org,
    onboarder,
    plan: plan
      ? {
          name: plan.name,
          type: plan.type,
          billingCycle: org.subscription?.billingCycle,
          status: org.subscription?.status,
          periodStart: org.subscription?.currentPeriodStart,
          periodEnd: org.subscription?.currentPeriodEnd,
          monthlyPaise: planPaise,
        }
      : null,
    addOns: addOnLines,
    bill: {
      planMonthlyPaise: planPaise,
      monthlyAddOnsPaise,
      monthlyTotalPaise: planPaise + monthlyAddOnsPaise,
      oneTimeAddOnsPaise,
    },
    payments: { razorpay, walletTopups: topups, manual },
    revenue: {
      totalPaise: razorpayPaise + topupPaise + manualPaise,
      razorpayPaise,
      walletTopupPaise: topupPaise,
      offlineVerifiedPaise: manualPaise,
      offlinePendingPaise: pendingPaise,
      thisMonthPaise,
    },
  };
};

// ─── Offline payments ──────────────────────────────────────────────────────

export const recordManualPayment = async (
  organizationId: string,
  input: { amountPaise: number; method: string; reference?: string; description?: string; paidAt?: string },
  actor: Actor
) => {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) throw new AppError('Organization not found', 404);

  const amountPaise = Math.floor(Number(input.amountPaise));
  if (!Number.isFinite(amountPaise) || amountPaise < 100) throw new AppError('Enter an amount of at least ₹1.', 400);
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) throw new AppError('Pick a payment method.', 400);

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  if (paidAt.getTime() > Date.now() + 86_400_000) throw new AppError('The payment date cannot be in the future.', 400);

  return prisma.manualPayment.create({
    data: {
      organizationId,
      amountPaise,
      method: input.method,
      reference: input.reference?.trim().slice(0, 120) || null,
      description: input.description?.trim().slice(0, 300) || null,
      paidAt,
      status: 'PENDING',
      recordedById: actor.id,
      recordedByEmail: actor.email,
    },
  });
};

export const listManualPayments = async (filter: { status?: string; organizationId?: string; onboardedById?: string }) => {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.organizationId) where.organizationId = filter.organizationId;
  if (filter.onboardedById) {
    const orgs = await prisma.organization.findMany({ where: { onboardedById: filter.onboardedById }, select: { id: true } });
    where.organizationId = { in: orgs.map((o) => o.id) };
  }

  const rows = await prisma.manualPayment.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  const orgs = await prisma.organization.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.organizationId))] } },
    select: { id: true, name: true },
  });
  const names = new Map(orgs.map((o) => [o.id, o.name]));
  return rows.map((r) => ({ ...r, organizationName: names.get(r.organizationId) ?? r.organizationId }));
};

/**
 * Accept or refuse an offline payment. The person who recorded a payment
 * cannot verify it themselves - someone else has to have seen the money.
 */
export const reviewManualPayment = async (id: string, approve: boolean, reason: string | undefined, actor: Actor) => {
  const payment = await prisma.manualPayment.findUnique({ where: { id } });
  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.status !== 'PENDING') throw new AppError(`This payment is already ${payment.status.toLowerCase()}.`, 400);
  if (payment.recordedById === actor.id) {
    throw new AppError('You recorded this payment, so someone else has to verify it.', 400);
  }
  if (!approve && !reason?.trim()) throw new AppError('Say why the payment is rejected.', 400);

  return prisma.manualPayment.update({
    where: { id },
    data: approve
      ? { status: 'VERIFIED', verifiedById: actor.id, verifiedByEmail: actor.email, verifiedAt: new Date() }
      : { status: 'REJECTED', verifiedById: actor.id, verifiedByEmail: actor.email, verifiedAt: new Date(), rejectReason: reason!.trim().slice(0, 300) },
  });
};

// ─── Onboarders ────────────────────────────────────────────────────────────

/** Point a client at an onboarder, or clear it with null. */
export const assignOnboarder = async (organizationId: string, onboarderId: string | null) => {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) throw new AppError('Organization not found', 404);

  if (onboarderId) {
    const person = await prisma.adminUser.findUnique({ where: { id: onboarderId }, select: { role: true, isActive: true } });
    if (!person || person.role !== 'onboarder') throw new AppError('Pick an admin with the onboarder role.', 400);
    if (!person.isActive) throw new AppError('That onboarder is switched off.', 400);
  }

  return prisma.organization.update({
    where: { id: organizationId },
    data: { onboardedById: onboarderId, onboardedAt: onboarderId ? new Date() : null },
    select: { id: true, onboardedById: true, onboardedAt: true },
  });
};

/**
 * A new client created by an onboarder: an owner who can sign in straight
 * away with the password the onboarder hands over, and an organization on
 * the same starting plan as a normal sign-up.
 */
export const createClient = async (
  input: { firstName: string; lastName?: string; email: string; phone?: string; password: string; organizationName: string },
  actor: Actor
) => {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new AppError('A user with this email already exists. Ask a super admin to assign that client to you.', 409);

  const { createOrgWithPlan } = await import('../auth/auth.service');
  const password = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password,
        firstName: input.firstName.trim(),
        lastName: input.lastName?.trim() || null,
        phone: input.phone?.trim() || null,
        emailVerified: true,
        status: 'ACTIVE',
      },
    });
    const organization = await createOrgWithPlan(tx, user.id, input.organizationName.trim());
    await tx.organization.update({
      where: { id: organization.id },
      data: {
        onboardedById: actor.role === 'onboarder' ? actor.id : null,
        onboardedAt: actor.role === 'onboarder' ? new Date() : null,
      },
    });
    return { user, organization };
  });

  return {
    user: { id: result.user.id, email: result.user.email, firstName: result.user.firstName },
    organization: { id: result.organization.id, name: result.organization.name },
  };
};

/** Numbers for one onboarder's clients: what is billed and what was really paid. */
export const onboarderSummary = async (onboarderId: string) => {
  const orgs = await prisma.organization.findMany({
    where: { onboardedById: onboarderId, deletedAt: null },
    select: { id: true },
  });
  const ids = orgs.map((o) => o.id);
  if (ids.length === 0) {
    return { clients: 0, monthlyBilledPaise: 0, revenueTotalPaise: 0, revenueThisMonthPaise: 0, pendingPaise: 0 };
  }

  const [received, pending, addOns, subs] = await Promise.all([
    receivedSummary(ids),
    prisma.manualPayment.aggregate({
      where: { organizationId: { in: ids }, status: 'PENDING' },
      _sum: { amountPaise: true },
    }),
    prisma.clientAddOn.findMany({ where: { organizationId: { in: ids }, removedAt: null, billing: 'MONTHLY' } }),
    prisma.subscription.findMany({
      where: { organizationId: { in: ids }, status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } },
      select: { billingCycle: true, plan: { select: { type: true, monthlyPrice: true, yearlyPrice: true } } },
    }),
  ]);

  const monthlyBilledPaise =
    subs.filter((s) => s.plan.type !== 'FREE_DEMO').reduce((sum, s) => sum + planMonthlyPaise(s.plan, s.billingCycle), 0) +
    addOns.filter((a) => isAddOnActive(a)).reduce((s, a) => s + a.quantity * a.unitPricePaise, 0);

  return {
    clients: ids.length,
    monthlyBilledPaise,
    revenueTotalPaise: received.total.totalPaise,
    revenueThisMonthPaise: received.month.totalPaise,
    pendingPaise: pending._sum.amountPaise ?? 0,
  };
};

export const listMyClients = async (onboarderId: string, search?: string) => {
  const where: any = { onboardedById: onboarderId, deletedAt: null };
  if (search?.trim()) where.name = { contains: search.trim(), mode: 'insensitive' };

  return prisma.organization.findMany({
    where,
    orderBy: { onboardedAt: 'desc' },
    take: 500,
    select: {
      id: true, name: true, status: true, planType: true, onboardedAt: true, createdAt: true,
      owner: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      subscription: { select: { status: true, currentPeriodEnd: true, plan: { select: { name: true } } } },
    },
  });
};

/** Every onboarder and how their clients are doing, for super admins. */
export const onboardersReport = async () => {
  const people = await prisma.adminUser.findMany({
    where: { role: 'onboarder' },
    select: { id: true, name: true, email: true, isActive: true },
    orderBy: { name: 'asc' },
  });
  return Promise.all(people.map(async (p) => ({ ...p, ...(await onboarderSummary(p.id)) })));
};

export const addOnCatalog = () =>
  Object.entries(ADDON_CATALOG).map(([type, item]) => ({ type, ...item }));

export { isAddOnType };
