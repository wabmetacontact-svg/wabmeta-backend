/**
 * The sales role against a real Postgres: a sales person creates a client,
 * hands it to an onboarder, and both of them - and TeamOS - see who did what.
 *
 * Requires the local test DB:
 *   DATABASE_URL=postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../socket', () => ({ emitForceLogout: vi.fn() }));

import prisma from '../../config/database';
import { hasPermission, requireOrgAccess } from './admin.permissions';
import { clientsSummary, createClient, handOffChoices, handOffClient, listMyClients } from './clientBilling';
import { projectClients, projectMembers } from '../sync/sync.project';
import { clientExternalId, memberExternalId } from '../sync/sync.types';

const SUFFIX = `sales-${Date.now()}`;
let salesId: string;
let otherSalesId: string;
let onboarderId: string;
let secondOnboarderId: string;
let offOnboarderId: string;
let financeId: string;
let orgId: string;
let userId: string;
let otherOrgId: string;
let otherUserId: string;
let createdFreePlan = false;

const sales = () => ({ id: salesId, role: 'sales' });
const runMiddleware = (mw: any, req: any) =>
  new Promise<any>((resolve) => mw(req, {}, (err?: any) => resolve(err ?? null)));

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }
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

  const mk = (role: string, tag: string, isActive = true) =>
    prisma.adminUser.create({ data: { email: `${tag}-${SUFFIX}@t.local`, password: 'x', name: tag, role, isActive } });
  salesId = (await mk('sales', 'seller')).id;
  otherSalesId = (await mk('sales', 'seller2')).id;
  onboarderId = (await mk('onboarder', 'onb')).id;
  secondOnboarderId = (await mk('onboarder', 'onb2')).id;
  offOnboarderId = (await mk('onboarder', 'onboff', false)).id;
  financeId = (await mk('finance', 'fin')).id;

  const other = await prisma.user.create({ data: { email: `other-${SUFFIX}@t.local`, firstName: 'O', status: 'ACTIVE' } });
  otherUserId = other.id;
  otherOrgId = (
    await prisma.organization.create({
      data: { name: 'Someone else', slug: `other-${SUFFIX}`, ownerId: other.id, soldById: otherSalesId, soldAt: new Date() },
    })
  ).id;
});

afterAll(async () => {
  if (!salesId) {
    await prisma.$disconnect();
    return;
  }
  const orgIds = [orgId, otherOrgId].filter(Boolean) as string[];
  await prisma.subscription.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId].filter(Boolean) as string[] } } });
  await prisma.adminUser.deleteMany({
    where: { id: { in: [salesId, otherSalesId, onboarderId, secondOnboarderId, offOnboarderId, financeId] } },
  });
  if (createdFreePlan) await prisma.plan.deleteMany({ where: { slug: `free-demo-${SUFFIX}` } });
  await prisma.$disconnect();
});

describe('the role', () => {
  it('can sell, and cannot touch plans, money or features', () => {
    expect(hasPermission('sales', 'clients.sell')).toBe(true);
    // Not clients.own: that is an onboarder's, and it carries billing.write,
    // features and "view as user" on every client it covers.
    expect(hasPermission('sales', 'clients.own')).toBe(false);
    expect(hasPermission('sales', 'billing.write')).toBe(false);
    expect(hasPermission('sales', 'orgs.features')).toBe(false);
    expect(hasPermission('sales', 'dashboard.read')).toBe(false);
  });
});

describe('a sale', () => {
  it('is credited to the seller and is not onboarded by anybody yet', async () => {
    const r = await createClient(
      { firstName: 'Meera', email: `client-${SUFFIX}@t.local`, password: 'Client#123', organizationName: 'Meera Textiles' },
      sales()
    );
    orgId = r.organization.id;
    userId = r.user.id;

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.soldById).toBe(salesId);
    expect(org.soldAt).not.toBeNull();
    // The whole point of a separate column: the seller is not the onboarder.
    expect(org.onboardedById).toBeNull();
  });

  it("shows in the seller's list and nobody else's", async () => {
    const mine = await listMyClients(sales());
    expect(mine.map((c) => c.id)).toContain(orgId);
    expect(mine.map((c) => c.id)).not.toContain(otherOrgId);
    expect(mine.find((c) => c.id === orgId)!.onboarder).toBeNull();

    const theirs = await listMyClients({ id: otherSalesId, role: 'sales' });
    expect(theirs.map((c) => c.id)).not.toContain(orgId);

    const onboarders = await listMyClients({ id: onboarderId, role: 'onboarder' });
    expect(onboarders.map((c) => c.id)).not.toContain(orgId);
  });

  it('refuses to list anything when there is no admin id, rather than listing everything', async () => {
    // `{ soldById: undefined }` is "no filter" to Prisma: every client on the
    // platform. A string passed where an actor is expected produces exactly that.
    await expect(listMyClients({ id: undefined as any, role: 'sales' })).rejects.toThrow(/No admin/);
    await expect(listMyClients('a-bare-id-string' as any)).rejects.toThrow(/No admin/);
    await expect(clientsSummary({ id: '' })).rejects.toThrow(/No admin/);
  });

  it("counts in the seller's totals", async () => {
    const s = await clientsSummary(sales());
    expect(s.clients).toBe(1);
  });
});

describe('what a seller can open', () => {
  const req = (permission: any, id: string, adminId = salesId) =>
    runMiddleware(requireOrgAccess(permission), { admin: { id: adminId, role: 'sales' }, params: { id } });

  it('reads their own client and leaves notes on it', async () => {
    expect(await req('orgs.read', orgId)).toBeNull();
    expect(await req('billing.read', orgId)).toBeNull();
    expect(await req('orgs.write', orgId)).toBeNull();
  });

  it("does not change its plan, add-ons or features, or sign in as the customer", async () => {
    for (const p of ['billing.write', 'orgs.features', 'impersonate']) {
      const err = await req(p, orgId);
      expect(err?.statusCode).toBe(403);
      expect(err?.message).toMatch(/onboarder/);
    }
  });

  it("does not open another seller's client at all", async () => {
    expect((await req('orgs.read', otherOrgId))?.statusCode).toBe(403);
  });
});

describe('handing over', () => {
  it('offers only active onboarders', async () => {
    const choices = (await handOffChoices()).map((c) => c.id);
    expect(choices).toContain(onboarderId);
    expect(choices).toContain(secondOnboarderId);
    expect(choices).not.toContain(offOnboarderId);
    expect(choices).not.toContain(financeId);
  });

  it('refuses somebody who is not an onboarder, or is switched off', async () => {
    await expect(handOffClient(orgId, financeId, sales())).rejects.toThrow(/onboarder role/);
    await expect(handOffClient(orgId, offOnboarderId, sales())).rejects.toThrow(/switched off/);
  });

  it("refuses a client this seller did not sell", async () => {
    await expect(handOffClient(otherOrgId, onboarderId, sales())).rejects.toThrow(/clients you sold/);
  });

  it('puts the client in the onboarder\'s list and keeps it in the seller\'s', async () => {
    const r = await handOffClient(orgId, onboarderId, sales());
    expect(r).toMatchObject({ changed: true, onboarder: { id: onboarderId } });

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.onboardedById).toBe(onboarderId);
    expect(org.onboardedAt).not.toBeNull();
    // The sale is not given away with the work.
    expect(org.soldById).toBe(salesId);

    const onb = await listMyClients({ id: onboarderId, role: 'onboarder' });
    const row = onb.find((c) => c.id === orgId);
    expect(row).toBeDefined();
    expect(row!.soldBy?.id).toBe(salesId);

    const mine = await listMyClients(sales());
    expect(mine.find((c) => c.id === orgId)!.onboarder?.id).toBe(onboarderId);
  });

  it('the onboarder now has the full onboarder access to it', async () => {
    const err = await runMiddleware(requireOrgAccess('billing.write'), {
      admin: { id: onboarderId, role: 'onboarder' },
      params: { id: orgId },
    });
    expect(err).toBeNull();
  });

  it('a second hand-over to the same person changes nothing', async () => {
    const r = await handOffClient(orgId, onboarderId, sales());
    expect(r.changed).toBe(false);
  });

  it('can be moved to another onboarder, and the first one loses it', async () => {
    await handOffClient(orgId, secondOnboarderId, sales());
    const first = await listMyClients({ id: onboarderId, role: 'onboarder' });
    const second = await listMyClients({ id: secondOnboarderId, role: 'onboarder' });
    expect(first.map((c) => c.id)).not.toContain(orgId);
    expect(second.map((c) => c.id)).toContain(orgId);
  });
});

describe('what TeamOS is told', () => {
  it('the seller arrives with the Sales title', async () => {
    const members = await projectMembers();
    expect(members.find((m) => m.externalId === memberExternalId(salesId))?.title).toBe('Sales');
  });

  it('credit stays with the seller after the hand-over, and the onboarder is named too', async () => {
    const clients = await projectClients('all');
    const c = clients.find((x) => x.externalId === clientExternalId(orgId))!;
    expect(c.ownerExternalId).toBe(memberExternalId(salesId));
    expect(c.onboarderExternalId).toBe(memberExternalId(secondOnboarderId));
  });

  it('a sold client counts as owned even before anybody onboards it', async () => {
    const owned = await projectClients('owned');
    const other = owned.find((x) => x.externalId === clientExternalId(otherOrgId));
    expect(other).toBeDefined();
    expect(other!.ownerExternalId).toBe(memberExternalId(otherSalesId));
    expect(other!.onboarderExternalId).toBeNull();
  });
});
