/**
 * Onboarders against a real Postgres: creating a client, scoped access,
 * add-ons raising limits, offline payments and the bill.
 *
 * Requires the local test DB:
 *   DATABASE_URL=postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../socket', () => ({ emitForceLogout: vi.fn() }));

import prisma from '../../config/database';
import { addClientAddOn, removeClientAddOn } from './addOns';
import { isOwnClient, requireOrgAccess } from './admin.permissions';
import {
  assignOnboarder,
  createClient,
  getClientBilling,
  onboarderSummary,
  recordManualPayment,
  reviewManualPayment,
} from './clientBilling';
import { getRevenueReport } from './admin.insights.service';
import { getOrgControl, invalidateOrgControl } from './orgControl';

const SUFFIX = `onb-${Date.now()}`;
let onboarderId: string;
let otherOnboarderId: string;
let financeId: string;
let clientOrgId: string;
let clientUserId: string;
let otherOrgId: string;
let otherUserId: string;
let createdFreePlan = false;

const runMiddleware = (mw: any, req: any) =>
  new Promise<any>((resolve) => mw(req, {}, (err?: any) => resolve(err ?? null)));

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }
  // createClient uses the normal sign-up path, which needs the FREE_DEMO plan.
  const free = await prisma.plan.findUnique({ where: { type: 'FREE_DEMO' } });
  if (!free) {
    await prisma.plan.create({
      data: {
        name: 'Free Demo', type: 'FREE_DEMO', slug: `free-demo-${SUFFIX}`, monthlyPrice: 0, yearlyPrice: 0,
        maxContacts: 50, maxMessages: 100, maxTeamMembers: 1, maxCampaigns: 1, maxChatbots: 0, maxTemplates: 2,
        maxWhatsAppAccounts: 1, maxMessagesPerMonth: 100, maxCampaignsPerMonth: 1, maxAutomations: 0, maxApiCalls: 0,
      } as any,
    });
    createdFreePlan = true;
  }

  const mk = (role: string, tag: string) =>
    prisma.adminUser.create({ data: { email: `${tag}-${SUFFIX}@t.local`, password: 'x', name: tag, role } });
  onboarderId = (await mk('onboarder', 'onb')).id;
  otherOnboarderId = (await mk('onboarder', 'onb2')).id;
  financeId = (await mk('finance', 'fin')).id;

  const other = await prisma.user.create({ data: { email: `other-${SUFFIX}@t.local`, firstName: 'O', status: 'ACTIVE' } });
  otherUserId = other.id;
  otherOrgId = (await prisma.organization.create({ data: { name: 'Other', slug: `other-${SUFFIX}`, ownerId: other.id } })).id;
});

afterAll(async () => {
  if (!onboarderId) {
    await prisma.$disconnect();
    return;
  }
  const orgIds = [clientOrgId, otherOrgId].filter(Boolean) as string[];
  await prisma.manualPayment.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.clientAddOn.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.subscription.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [clientUserId, otherUserId].filter(Boolean) as string[] } } });
  await prisma.adminUser.deleteMany({ where: { id: { in: [onboarderId, otherOnboarderId, financeId] } } });
  if (createdFreePlan) await prisma.plan.deleteMany({ where: { slug: `free-demo-${SUFFIX}` } });
  await prisma.$disconnect();
});

describe('clients', () => {
  it('an onboarder creates a client that belongs to them and can sign in', async () => {
    const r = await createClient(
      { firstName: 'Ravi', email: `client-${SUFFIX}@t.local`, password: 'Client#123', organizationName: 'Ravi Traders' },
      { id: onboarderId, role: 'onboarder' }
    );
    clientOrgId = r.organization.id;
    clientUserId = r.user.id;

    const org = await prisma.organization.findUnique({ where: { id: clientOrgId } });
    expect(org!.onboardedById).toBe(onboarderId);
    const user = await prisma.user.findUnique({ where: { id: clientUserId } });
    expect(user!.status).toBe('ACTIVE');
    expect(user!.emailVerified).toBe(true);
  });

  it('refuses a duplicate email', async () => {
    await expect(
      createClient(
        { firstName: 'X', email: `client-${SUFFIX}@t.local`, password: 'Client#123', organizationName: 'X' },
        { id: onboarderId, role: 'onboarder' }
      )
    ).rejects.toThrow(/already exists/);
  });

  it('assigning checks the role', async () => {
    await expect(assignOnboarder(otherOrgId, financeId)).rejects.toThrow(/onboarder role/);
    await assignOnboarder(otherOrgId, otherOnboarderId);
    expect(await isOwnClient(otherOnboarderId, otherOrgId)).toBe(true);
    await assignOnboarder(otherOrgId, null);
    expect(await isOwnClient(otherOnboarderId, otherOrgId)).toBe(false);
  });
});

describe('scoped access', () => {
  const mw = requireOrgAccess('orgs.read');

  it('lets an onboarder into their own client only', async () => {
    expect(await runMiddleware(mw, { admin: { id: onboarderId, role: 'onboarder' }, params: { id: clientOrgId } })).toBe(null);
    const denied = await runMiddleware(mw, { admin: { id: onboarderId, role: 'onboarder' }, params: { id: otherOrgId } });
    expect(denied?.statusCode).toBe(403);
    const denied2 = await runMiddleware(mw, { admin: { id: otherOnboarderId, role: 'onboarder' }, params: { id: clientOrgId } });
    expect(denied2?.statusCode).toBe(403);
  });

  it('lets a role with the permission into any organization', async () => {
    expect(await runMiddleware(mw, { admin: { id: financeId, role: 'finance' }, params: { id: otherOrgId } })).toBe(null);
  });
});

describe('add-ons raise limits', () => {
  it('a seat and AI top-up show up in the org control and go away when removed', async () => {
    const seat = await addClientAddOn(clientOrgId, { type: 'EXTRA_SEAT', quantity: 2 }, { id: onboarderId });
    await addClientAddOn(clientOrgId, { type: 'AI_TOPUP' }, { id: onboarderId });
    invalidateOrgControl(clientOrgId);
    const c = await getOrgControl(clientOrgId);
    expect(c.addOnBoosts.teamMembers).toBe(2);
    expect(c.addOnBoosts.aiRepliesPerDay).toBeGreaterThan(0);
    expect(seat.unitPricePaise).toBe(39900);

    await removeClientAddOn(clientOrgId, seat.id, { id: onboarderId });
    const after = await getOrgControl(clientOrgId);
    expect(after.addOnBoosts.teamMembers).toBeUndefined();
  });

  it('a custom line needs a description', async () => {
    await expect(addClientAddOn(clientOrgId, { type: 'CUSTOM', unitPricePaise: 100000 }, { id: onboarderId })).rejects.toThrow(/Describe/);
  });
});

describe('offline payments and the bill', () => {
  it('pending does not count; the recorder cannot verify; someone else can', async () => {
    const p = await recordManualPayment(clientOrgId, { amountPaise: 150000, method: 'UPI', reference: 'UTR123' }, { id: onboarderId });

    let bill = await getClientBilling(clientOrgId);
    expect(bill.revenue.offlinePendingPaise).toBe(150000);
    expect(bill.revenue.totalPaise).toBe(0);

    await expect(reviewManualPayment(p.id, true, undefined, { id: onboarderId })).rejects.toThrow(/someone else/);
    await reviewManualPayment(p.id, true, undefined, { id: financeId });

    bill = await getClientBilling(clientOrgId);
    expect(bill.revenue.offlineVerifiedPaise).toBe(150000);
    expect(bill.revenue.totalPaise).toBe(150000);
    expect(bill.onboarder?.id).toBe(onboarderId);
    await expect(reviewManualPayment(p.id, false, 'dup', { id: financeId })).rejects.toThrow(/already verified/);
  });

  it('a rejection needs a reason and never counts', async () => {
    const p = await recordManualPayment(clientOrgId, { amountPaise: 5000, method: 'CASH' }, { id: onboarderId });
    await expect(reviewManualPayment(p.id, false, '', { id: financeId })).rejects.toThrow(/why/);
    await reviewManualPayment(p.id, false, 'Not received', { id: financeId });
    const bill = await getClientBilling(clientOrgId);
    expect(bill.revenue.totalPaise).toBe(150000);
  });

  it('refuses tiny amounts and future dates', async () => {
    await expect(recordManualPayment(clientOrgId, { amountPaise: 50, method: 'UPI' }, { id: onboarderId })).rejects.toThrow(/at least/);
    await expect(
      recordManualPayment(clientOrgId, { amountPaise: 1000, method: 'UPI', paidAt: new Date(Date.now() + 5 * 86_400_000).toISOString() }, { id: onboarderId })
    ).rejects.toThrow(/future/);
  });

  it('the onboarder summary counts only verified money, and the revenue report runs', async () => {
    const s = await onboarderSummary(onboarderId);
    expect(s.clients).toBe(1);
    expect(s.revenueTotalPaise).toBe(150000);
    expect(s.pendingPaise).toBe(0);
    expect(s.monthlyBilledPaise).toBeGreaterThanOrEqual(0);

    const r = await getRevenueReport(3);
    expect(r.offlinePayments.reduce((sum, m) => sum + m.paise, 0)).toBeGreaterThanOrEqual(150000);
    expect(typeof r.addOnMrrPaise).toBe('number');
  });
});
