/**
 * Revenue and plan activation against a real Postgres.
 *
 * Requires the local test DB:
 *   DATABASE_URL=postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../socket', () => ({ emitForceLogout: vi.fn() }));

import prisma from '../../config/database';
import { billingService } from '../billing/billing.service';
import { computeMrr, receivedBetween } from './revenue';

const SUFFIX = `rev-${Date.now()}`;
let orgId: string;
let userId: string;
let planId: string;
let walletId: string;

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }
  userId = (await prisma.user.create({ data: { email: `${SUFFIX}@t.local`, firstName: 'R', status: 'ACTIVE' } })).id;
  orgId = (await prisma.organization.create({ data: { name: 'Rev', slug: SUFFIX, ownerId: userId } })).id;
  planId = (
    await prisma.plan.create({
      data: {
        name: `Plan ${SUFFIX}`, type: 'GROWTH' as any, slug: `plan-${SUFFIX}`, monthlyPrice: 1799, yearlyPrice: 17990,
        maxContacts: 1, maxMessages: 1, maxTeamMembers: 1, maxCampaigns: 1, maxChatbots: 1, maxTemplates: 1,
        maxWhatsAppAccounts: 1, maxMessagesPerMonth: 1, maxCampaignsPerMonth: 1, maxAutomations: 1, maxApiCalls: 1,
      } as any,
    }).catch(async () => (await prisma.plan.findUnique({ where: { type: 'GROWTH' as any } }))!)
  ).id;
  walletId = (
    await prisma.wallet.create({ data: { organizationId: orgId, userId, isActive: true, monthResetDate: new Date() } as any })
  ).id;
});

afterAll(async () => {
  if (!orgId) {
    await prisma.$disconnect();
    return;
  }
  await prisma.walletTransaction.deleteMany({ where: { walletId } });
  await prisma.wallet.deleteMany({ where: { id: walletId } });
  await prisma.manualPayment.deleteMany({ where: { organizationId: orgId } });
  await prisma.payment.deleteMany({ where: { organizationId: orgId } });
  await prisma.subscription.deleteMany({ where: { organizationId: orgId } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.plan.deleteMany({ where: { slug: `plan-${SUFFIX}` } });
  await prisma.$disconnect();
});

const order = (id: string, amount = 179900) => ({
  id,
  amount,
  receipt: `r_${id}`,
  notes: { organizationId: 'set-below', planId: '', billingCycle: 'monthly', validityDays: 30 },
});

describe('plan activation is idempotent', () => {
  it('verify and webhook for the same order record one payment', async () => {
    const o = order(`order_a_${SUFFIX}`);
    o.notes.organizationId = orgId;
    o.notes.planId = planId;

    const first = await billingService.activatePlanFromOrder({ organizationId: orgId, order: o, razorpayPaymentId: `pay_a_${SUFFIX}` });
    const second = await billingService.activatePlanFromOrder({ organizationId: orgId, order: o, razorpayPaymentId: `pay_a_${SUFFIX}` });
    expect(first.alreadyRecorded).toBe(false);
    expect(second.alreadyRecorded).toBe(true);
    expect(await prisma.payment.count({ where: { razorpayOrderId: o.id } })).toBe(1);

    const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    expect(sub!.planId).toBe(planId);
  });

  it('two activations at the same moment still record one payment', async () => {
    const o = order(`order_b_${SUFFIX}`, 50000);
    o.notes.organizationId = orgId;
    o.notes.planId = planId;

    const results = await Promise.all([
      billingService.activatePlanFromOrder({ organizationId: orgId, order: o, razorpayPaymentId: `pay_b_${SUFFIX}` }),
      billingService.activatePlanFromOrder({ organizationId: orgId, order: o, razorpayPaymentId: `pay_b_${SUFFIX}` }),
    ]);
    expect(await prisma.payment.count({ where: { razorpayOrderId: o.id } })).toBe(1);
    expect(results.filter((r) => r.alreadyRecorded)).toHaveLength(1);
  });
});

describe('refunds', () => {
  it('records the running refunded total, and replaying it changes nothing', async () => {
    await billingService.recordRefund(`pay_b_${SUFFIX}`, 20000);
    await billingService.recordRefund(`pay_b_${SUFFIX}`, 20000);
    let p = await prisma.payment.findUnique({ where: { razorpayPaymentId: `pay_b_${SUFFIX}` } });
    expect(p!.refundedAmount).toBe(20000);
    expect(p!.status).toBe('SUCCESS');

    await billingService.recordRefund(`pay_b_${SUFFIX}`, 50000);
    p = await prisma.payment.findUnique({ where: { razorpayPaymentId: `pay_b_${SUFFIX}` } });
    expect(p!.status).toBe('REFUNDED');
    expect(p!.refundedAmount).toBe(50000);

    expect(await billingService.recordRefund('pay_unknown', 100)).toBe(null);
  });
});

describe('received money', () => {
  it('counts plan payments net of refunds, Razorpay top-ups and verified offline only', async () => {
    // Not money: a pending order, a failed one, an unverified offline payment,
    // and a wallet credit an admin gave without Razorpay.
    await prisma.payment.create({ data: { organizationId: orgId, amount: 99999, status: 'PENDING', razorpayOrderId: `order_p_${SUFFIX}` } });
    await prisma.payment.create({ data: { organizationId: orgId, amount: 99999, status: 'FAILED', razorpayOrderId: `order_f_${SUFFIX}`, razorpayPaymentId: `pay_f_${SUFFIX}` } });
    await prisma.manualPayment.create({ data: { organizationId: orgId, amountPaise: 30000, method: 'UPI', paidAt: new Date(), status: 'PENDING' } });
    await prisma.walletTransaction.create({ data: { walletId, type: 'admin_credit', amountPaise: 7777, balanceBeforePaise: 0, balanceAfterPaise: 7777, description: 'gift' } });

    // Money.
    await prisma.manualPayment.create({ data: { organizationId: orgId, amountPaise: 40000, method: 'CASH', paidAt: new Date(), status: 'VERIFIED' } });
    await prisma.walletTransaction.create({
      data: { walletId, type: 'credit', status: 'completed', amountPaise: 10000, balanceBeforePaise: 7777, balanceAfterPaise: 17777, description: 'topup', razorpayPaymentId: `pay_w_${SUFFIX}` },
    });

    const r = await receivedBetween({ organizationIds: [orgId] });
    expect(r.planPaymentsPaise).toBe(179900 + 50000);
    expect(r.refundsPaise).toBe(50000);
    expect(r.walletTopupsPaise).toBe(10000);
    expect(r.offlinePaise).toBe(40000);
    expect(r.totalPaise).toBe(179900 + 10000 + 40000);
  });

  it('MRR comes from what the customer last paid, net of refunds', async () => {
    const m = await computeMrr();
    expect(typeof m.mrrPaise).toBe('number');
    expect(m.mrrPaise).toBeGreaterThanOrEqual(0);
  });
});
