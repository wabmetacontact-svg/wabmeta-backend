/**
 * Admin insights and operations against a real Postgres. The raw SQL in the
 * risk and revenue reports is the main thing under test: a typo there only
 * shows up when Postgres parses it.
 *
 * Requires the local test DB:
 *   DATABASE_URL=postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../socket', () => ({ emitForceLogout: vi.fn() }));

import prisma from '../../config/database';
import { checkCouponForCheckout, createCoupon, deleteCoupon, recordCouponRedemption } from '../billing/coupons';
import { adminService } from './admin.service';
import { getOrganizationOverview, getRevenueReport, getRiskReport, globalSearch } from './admin.insights.service';
import {
  activeAnnouncementsFor,
  addNote,
  createAnnouncement,
  deleteAnnouncement,
  exportOrganizationsCsv,
  listAllTags,
  listNotes,
  runBulkAction,
  setOrganizationTags,
} from './admin.ops.service';

const SUFFIX = `adminops-${Date.now()}`;
const actor = { id: 'admin-test', email: 'admin@test.local' };

let organizationId: string;
let otherOrgId: string;
let userId: string;
let couponId: string;
const announcementIds: string[] = [];

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }
  const user = await prisma.user.create({
    data: { email: `${SUFFIX}@wabmeta.local`, firstName: 'Owner', status: 'ACTIVE', emailVerified: true },
  });
  userId = user.id;
  const org = await prisma.organization.create({
    data: { name: `Acme ${SUFFIX}`, slug: SUFFIX, ownerId: userId, planType: 'STARTER' },
  });
  organizationId = org.id;
  const other = await prisma.organization.create({
    data: { name: `Other ${SUFFIX}`, slug: `${SUFFIX}-o`, ownerId: userId, planType: 'PRO' },
  });
  otherOrgId = other.id;
  await prisma.organizationMember.create({ data: { organizationId, userId, role: 'OWNER' } });
});

afterAll(async () => {
  if (!organizationId || !userId) {
    await prisma.$disconnect();
    return;
  }
  for (const id of announcementIds) await prisma.announcement.deleteMany({ where: { id } });
  if (couponId) await prisma.coupon.deleteMany({ where: { id: couponId } });
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.organizationNote.deleteMany({ where: { organizationId } });
  await prisma.organizationMember.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrgId] } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('reports run against Postgres', () => {
  it('risk report', async () => {
    const r = await getRiskReport();
    for (const key of ['blocked', 'lowQuality', 'expiringSoon', 'recentlyExpired', 'lowWallets',
      'failedPayments', 'sendingSpikes', 'highCampaignFailure', 'inactivePaying']) {
      expect(Array.isArray((r as any)[key])).toBe(true);
    }
  });

  it('revenue report', async () => {
    const r = await getRevenueReport(6);
    expect(Array.isArray(r.months)).toBe(true);
    expect(Array.isArray(r.walletTopups)).toBe(true);
    expect(typeof r.mrrPaise).toBe('number');
  });

  it('organization overview', async () => {
    const o = await getOrganizationOverview(organizationId);
    expect(o.organization.id).toBe(organizationId);
    expect(o.members).toHaveLength(1);
    expect(o.usage.messagesToday).toBe(0);
  });

  it('the organization list finds an organization by the owner email', async () => {
    const r = await adminService.getOrganizations({ page: 1, limit: 10, search: `${SUFFIX}@WABMETA` });
    expect(r.organizations.map((o: any) => o.id)).toEqual(expect.arrayContaining([organizationId, otherOrgId]));
  });

  it('global search finds the org and the user', async () => {
    const r = await globalSearch(SUFFIX);
    expect(r.organizations.map((o) => o.id)).toContain(organizationId);
    expect(r.users.map((u) => u.id)).toContain(userId);
    expect(await globalSearch('a')).toEqual({ users: [], organizations: [], whatsappAccounts: [], payments: [] });
  });
});

describe('notes and tags', () => {
  it('adds notes, pinned first', async () => {
    await addNote(organizationId, 'Called about renewal', false, actor);
    await addNote(organizationId, 'VIP - handle personally', true, actor);
    const notes = await listNotes(organizationId);
    expect(notes[0].body).toBe('VIP - handle personally');
    expect(notes).toHaveLength(2);
  });

  it('sets tags and counts them', async () => {
    const r = await setOrganizationTags(organizationId, ['VIP', 'Payment Follow Up']);
    expect(r.adminTags).toEqual(['vip', 'payment-follow-up']);
    const all = await listAllTags();
    expect(all.find((t) => t.tag === 'vip')?.count).toBeGreaterThanOrEqual(1);
  });

  it('bulk adds and removes a tag, reporting each organization', async () => {
    const add = await runBulkAction([organizationId, otherOrgId, 'missing-org'], { action: 'tag_add', tag: 'diwali' }, actor);
    expect(add.succeeded).toBe(2);
    expect(add.failed).toBe(1);

    const rem = await runBulkAction([organizationId], { action: 'tag_remove', tag: 'diwali' }, actor);
    expect(rem.succeeded).toBe(1);
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    expect(org!.adminTags).not.toContain('diwali');
  });

  it('exports organizations as CSV with a header', async () => {
    const csv = await exportOrganizationsCsv({ tag: 'vip' });
    expect(csv.split('\r\n')[0]).toMatch(/^id,name,slug,owner_email/);
    expect(csv).toContain(organizationId);
  });
});

describe('announcements', () => {
  it('shows a plan-targeted announcement only to that plan, and notifies members', async () => {
    const a = await createAnnouncement(
      { title: 'Starter news', message: 'Hello Starter', audience: 'PLANS', planTypes: ['STARTER'], notify: true },
      actor
    );
    announcementIds.push(a.announcement.id);
    expect(a.notified).toBeGreaterThanOrEqual(1);

    const mine = await activeAnnouncementsFor(organizationId);
    const theirs = await activeAnnouncementsFor(otherOrgId);
    expect(mine.map((x) => x.id)).toContain(a.announcement.id);
    expect(theirs.map((x) => x.id)).not.toContain(a.announcement.id);

    const note = await prisma.notification.findFirst({ where: { userId, title: 'Starter news' } });
    expect(note).not.toBeNull();
  });

  it('does not show an announcement before it starts', async () => {
    const a = await createAnnouncement(
      { title: 'Later', message: 'x', startsAt: new Date(Date.now() + 3_600_000).toISOString() },
      actor
    );
    announcementIds.push(a.announcement.id);
    expect((await activeAnnouncementsFor(organizationId)).map((x) => x.id)).not.toContain(a.announcement.id);
    await deleteAnnouncement(a.announcement.id);
  });
});

describe('coupons', () => {
  it('checks, records once, and then refuses a second use by the same org', async () => {
    const c = await createCoupon(
      { code: `t${Date.now().toString().slice(-8)}`, discountType: 'PERCENT', value: 25, planTypes: ['STARTER'] },
      actor.id
    );
    couponId = c.id;

    const ok = await checkCouponForCheckout(c.code.toLowerCase(), organizationId, 'STARTER');
    expect(ok.id).toBe(c.id);
    await expect(checkCouponForCheckout(c.code, organizationId, 'PRO')).rejects.toThrow(/does not apply/);

    const notes = { couponId: c.id, originalPaise: 79900, discountPaise: 19975 };
    await recordCouponRedemption({ notes, organizationId, razorpayOrderId: `order_${SUFFIX}`, paidPaise: 59925 });
    // A retried verification must not count twice.
    await recordCouponRedemption({ notes, organizationId, razorpayOrderId: `order_${SUFFIX}`, paidPaise: 59925 });

    const after = await prisma.coupon.findUnique({ where: { id: c.id } });
    expect(after!.redeemedCount).toBe(1);
    await expect(checkCouponForCheckout(c.code, organizationId, 'STARTER')).rejects.toThrow(/already used/);
  });

  it('a used coupon is switched off, not deleted', async () => {
    const r = await deleteCoupon(couponId);
    expect(r).toEqual({ deleted: false, deactivated: true });
    const c = await prisma.coupon.findUnique({ where: { id: couponId } });
    expect(c!.isActive).toBe(false);
  });

  it('recording without a coupon in the notes does nothing', async () => {
    await expect(
      recordCouponRedemption({ notes: {}, organizationId, razorpayOrderId: 'x', paidPaise: 1 })
    ).resolves.toBeUndefined();
  });
});
