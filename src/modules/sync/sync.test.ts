/**
 * The TeamOS outbox: what gets queued, what does not, and what happens when
 * delivery goes wrong.
 *
 * Requires the local test DB:
 *   DATABASE_URL=postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test
 *
 * `fetch` is replaced throughout. The point of these tests is the outbox's
 * behaviour against a real Postgres - the receiving end has its own suite in
 * TeamOS - and the one thing worth asserting about the HTTP call itself is that
 * a redirect is treated as a failure rather than as success.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../socket', () => ({ emitForceLogout: vi.fn() }));

import prisma from '../../config/database';
import {
  BATCH_SIZE,
  MAX_ATTEMPTS,
  backoffMs,
  claim,
  enqueue,
  fingerprintOf,
  stableStringify,
  stats,
  reviveDead,
  syncConfig,
  type SyncConfig,
} from './sync.outbox';
import { istDate, projectClients, projectMembers, projectMoney, readCursor, writeCursor, CURSOR_KEY } from './sync.project';
import { deliverBatch, deliverDue, signBody } from './sync.worker';
import { withLease } from './sync.lease';
import { clientExternalId, memberExternalId, offlineExternalId, planExternalId, refundExternalId } from './sync.types';

const SUFFIX = `sync-${Date.now()}`;
const CONFIG: SyncConfig = { url: 'https://teamos.test/api/sync/wabmeta', secret: 's3cr3t', scope: 'owned' };

let orgId = '';
let userId = '';
let adminId = '';
let planId = '';

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }

  adminId = (
    await prisma.adminUser.create({
      data: { email: `${SUFFIX}@t.local`, password: 'x', name: 'Ravi Sales', role: 'onboarder' },
    })
  ).id;

  userId = (await prisma.user.create({ data: { email: `owner-${SUFFIX}@t.local`, firstName: 'O', status: 'ACTIVE' } })).id;
  orgId = (
    await prisma.organization.create({
      data: { name: `Sharma Traders ${SUFFIX}`, slug: SUFFIX, ownerId: userId, onboardedById: adminId, onboardedAt: new Date() },
    })
  ).id;

  planId = (
    await prisma.plan
      .create({
        data: {
          name: `Plan ${SUFFIX}`, type: 'GROWTH' as any, slug: `plan-${SUFFIX}`, monthlyPrice: 1799, yearlyPrice: 17990,
          maxContacts: 1, maxMessages: 1, maxTeamMembers: 1, maxCampaigns: 1, maxChatbots: 1, maxTemplates: 1,
          maxWhatsAppAccounts: 1, maxMessagesPerMonth: 1, maxCampaignsPerMonth: 1, maxAutomations: 1, maxApiCalls: 1,
        } as any,
      })
      .catch(async () => (await prisma.plan.findUnique({ where: { type: 'GROWTH' as any } }))!)
  ).id;
});

afterAll(async () => {
  await prisma.syncEvent.deleteMany({ where: { externalId: { contains: orgId } } });
  await prisma.syncEvent.deleteMany({ where: { externalId: memberExternalId(adminId) } });
  await prisma.systemSetting.deleteMany({ where: { key: { startsWith: 'teamos.sync.' } } });
  if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  if (adminId) await prisma.adminUser.delete({ where: { id: adminId } }).catch(() => {});
  await prisma.$disconnect();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A fetch that answers like TeamOS, applying everything it is sent. */
const okFetch = (overrides: Record<string, { status: string; retry?: boolean; error?: string }> = {}) =>
  vi.fn(async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    const results = body.events.map((e: any) => ({ id: e.id, ...(overrides[e.externalId] ?? { status: 'applied' }) }));
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        applied: results.filter((r: any) => r.status === 'applied').length,
        unchanged: results.filter((r: any) => r.status === 'unchanged').length,
        failed: results.filter((r: any) => r.status === 'failed').length,
        results,
      }),
      text: async () => '',
    } as any;
  });

// ─────────────────────────────────────────────────────────────── no database ───

describe('configuration', () => {
  it('is off until both the URL and the secret are set', () => {
    expect(syncConfig({} as any)).toBeNull();
    expect(syncConfig({ TEAMOS_SYNC_URL: 'https://x/y' } as any)).toBeNull();
    expect(syncConfig({ TEAMOS_SYNC_SECRET: 's' } as any)).toBeNull();
    expect(syncConfig({ TEAMOS_SYNC_URL: 'https://x/y', TEAMOS_SYNC_SECRET: 's' } as any)).toMatchObject({
      url: 'https://x/y',
      scope: 'owned',
    });
  });

  it('can be switched off without unsetting the credentials', () => {
    const env = { TEAMOS_SYNC_URL: 'https://x/y', TEAMOS_SYNC_SECRET: 's', TEAMOS_SYNC_ENABLED: 'false' } as any;
    expect(syncConfig(env)).toBeNull();
  });

  it('mirrors only onboarder-owned clients unless told otherwise', () => {
    const base = { TEAMOS_SYNC_URL: 'https://x/y', TEAMOS_SYNC_SECRET: 's' };
    expect(syncConfig(base as any)!.scope).toBe('owned');
    expect(syncConfig({ ...base, TEAMOS_SYNC_CLIENTS: 'all' } as any)!.scope).toBe('all');
  });
});

describe('fingerprints', () => {
  it('do not depend on the order keys were built in', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it('change when the data changes', () => {
    const a = { kind: 'member.upsert', externalId: 'admin:1', name: 'A', email: null, title: null } as any;
    expect(fingerprintOf(a)).toBe(fingerprintOf({ ...a }));
    expect(fingerprintOf(a)).not.toBe(fingerprintOf({ ...a, name: 'B' }));
  });

  it('ignore undefined, which JSON would drop anyway', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });
});

describe('backoff', () => {
  it('grows and then stops growing, so an event is never parked for days', () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(MAX_ATTEMPTS)).toBeLessThanOrEqual(3_600_000);
    expect(backoffMs(50)).toBe(3_600_000);
  });
});

describe('the signature', () => {
  it('covers the timestamp as well as the body', () => {
    const a = signBody('{"x":1}', '1000', 's');
    expect(signBody('{"x":1}', '1000', 's')).toBe(a);
    expect(signBody('{"x":1}', '1001', 's')).not.toBe(a);
    expect(signBody('{"x":2}', '1000', 's')).not.toBe(a);
    expect(signBody('{"x":1}', '1000', 'other')).not.toBe(a);
  });
});

describe('IST dates', () => {
  it('file a late-evening UTC payment on the Indian day it happened', () => {
    // 2026-10-01 20:00 UTC is 2026-10-02 01:30 IST.
    expect(istDate(new Date('2026-10-01T20:00:00.000Z'))).toBe('2026-10-02');
    expect(istDate(new Date('2026-10-01T10:00:00.000Z'))).toBe('2026-10-01');
  });
});

// ───────────────────────────────────────────────────────────── with database ───

describe('projecting the team and its clients', () => {
  it('sends every admin, with a readable title and no role', async () => {
    const members = await projectMembers();
    const mine = members.find((m) => m.externalId === memberExternalId(adminId));
    expect(mine).toMatchObject({ kind: 'member.upsert', name: 'Ravi Sales', title: 'Onboarder' });
    expect(mine).not.toHaveProperty('role');
  });

  it('credits a client to its onboarder', async () => {
    const clients = await projectClients('owned');
    const mine = clients.find((c) => c.externalId === clientExternalId(orgId));
    expect(mine).toMatchObject({
      kind: 'client.upsert',
      name: `Sharma Traders ${SUFFIX}`,
      ownerExternalId: memberExternalId(adminId),
      removed: false,
    });
  });

  it('counts an active plan and its monthly add-ons as the monthly figure', async () => {
    const now = new Date();
    await prisma.subscription.create({
      data: {
        organizationId: orgId, planId, status: 'ACTIVE' as any, billingCycle: 'monthly',
        currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
      } as any,
    });
    await prisma.clientAddOn.create({
      data: {
        organizationId: orgId, type: 'EXTRA_SEAT', label: 'Extra seat', quantity: 2, unitPricePaise: 20_000,
        billing: 'MONTHLY', startsAt: new Date(now.getTime() - 86_400_000),
      } as any,
    });

    const clients = await projectClients('owned');
    const mine = clients.find((c) => c.externalId === clientExternalId(orgId))!;
    // 1799 rupees plan + 2 x 200 rupees of seats.
    expect(mine.retainerPaise).toBe(179_900 + 40_000);
  });

  it('leaves a client out when nobody is credited and the scope is owned', async () => {
    const otherUser = await prisma.user.create({
      data: { email: `plain-${SUFFIX}@t.local`, firstName: 'P', status: 'ACTIVE' },
    });
    const plain = await prisma.organization.create({
      data: { name: `No Onboarder ${SUFFIX}`, slug: `plain-${SUFFIX}`, ownerId: otherUser.id },
    });

    const owned = await projectClients('owned');
    expect(owned.find((c) => c.externalId === clientExternalId(plain.id))).toBeUndefined();

    const all = await projectClients('all');
    expect(all.find((c) => c.externalId === clientExternalId(plain.id))).toBeDefined();

    await prisma.organization.delete({ where: { id: plain.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });
});

describe('projecting money', () => {
  const since = new Date(Date.now() - 86_400_000);

  it('sends a plan payment in full and its refund as a separate entry out', async () => {
    const payment = await prisma.payment.create({
      data: {
        organizationId: orgId, razorpayOrderId: `order_${SUFFIX}`, razorpayPaymentId: `pay_${SUFFIX}`,
        amount: 179_900, refundedAmount: 50_000, status: 'REFUNDED' as any, planName: 'Growth',
        paidAt: new Date('2026-10-01T10:00:00.000Z'),
      } as any,
    });

    const money = await projectMoney(since);
    const paid = money.find((m) => m.externalId === planExternalId(payment.id));
    const refund = money.find((m) => m.externalId === refundExternalId(payment.id));

    // The payment keeps its full amount; the refund is its own row out. Net is
    // right either way, and the ledger shows what actually moved.
    expect(paid).toMatchObject({ type: 'in', amountPaise: 179_900, status: 'paid', date: '2026-10-01' });
    expect(refund).toMatchObject({ type: 'out', amountPaise: 50_000 });
    expect(paid!.clientExternalId).toBe(clientExternalId(orgId));

    await prisma.payment.delete({ where: { id: payment.id } });
  });

  it('sends a verified offline payment but not a pending or a rejected one', async () => {
    const rows = await Promise.all(
      (['PENDING', 'VERIFIED', 'REJECTED'] as const).map((status) =>
        prisma.manualPayment.create({
          data: {
            organizationId: orgId, amountPaise: 100_000, method: 'UPI', paidAt: new Date(),
            status, verifiedAt: status === 'PENDING' ? null : new Date(),
          } as any,
        }),
      ),
    );
    const [pending, verified, rejected] = rows;

    const money = await projectMoney(since);
    // A pending one could later be rejected, and there is no way to retract an
    // entry - it would sit in TeamOS as money owed for good.
    expect(money.find((m) => m.externalId === offlineExternalId(pending!.id))).toBeUndefined();
    expect(money.find((m) => m.externalId === offlineExternalId(rejected!.id))).toBeUndefined();
    expect(money.find((m) => m.externalId === offlineExternalId(verified!.id))).toMatchObject({
      type: 'in',
      amountPaise: 100_000,
      status: 'paid',
      method: 'UPI',
    });

    await prisma.manualPayment.deleteMany({ where: { id: { in: rows.map((r) => r!.id) } } });
  });

  it('leaves out money from before the cursor', async () => {
    const old = await prisma.payment.create({
      data: {
        organizationId: orgId, razorpayOrderId: `order_old_${SUFFIX}`, razorpayPaymentId: `pay_old_${SUFFIX}`,
        amount: 1000, status: 'SUCCESS' as any, paidAt: new Date('2020-01-01T00:00:00.000Z'),
      } as any,
    });
    // updatedAt is now, so a cursor in the future excludes it.
    const money = await projectMoney(new Date(Date.now() + 60_000));
    expect(money.find((m) => m.externalId === planExternalId(old.id))).toBeUndefined();
    await prisma.payment.delete({ where: { id: old.id } });
  });
});

describe('the backfill window', () => {
  // An old payment that was edited today - a refund recorded against it, say.
  // This is the row the two window modes must disagree about.
  let oldId = '';

  beforeAll(async () => {
    const p = await prisma.payment.create({
      data: {
        organizationId: orgId, razorpayOrderId: `order_bf_${SUFFIX}`, razorpayPaymentId: `pay_bf_${SUFFIX}`,
        amount: 50_000, status: 'SUCCESS' as any, planName: 'Starter',
        paidAt: new Date('2026-03-15T10:00:00.000Z'),
      } as any,
    });
    oldId = p.id;
  });

  afterAll(async () => {
    if (oldId) await prisma.payment.delete({ where: { id: oldId } }).catch(() => {});
  });

  it('by "changed" picks up an old payment that was touched recently', async () => {
    // What the live sync needs: a refund entered today against a March payment
    // has to reach TeamOS today.
    const money = await projectMoney({ since: new Date(Date.now() - 3_600_000), by: 'changed' });
    expect(money.find((m) => m.externalId === planExternalId(oldId))).toBeDefined();
  });

  it('by "received" places it in the month the money actually arrived', async () => {
    const march = await projectMoney({
      since: new Date('2026-03-01T00:00:00.000Z'),
      until: new Date('2026-04-01T00:00:00.000Z'),
      by: 'received',
    });
    expect(march.find((m) => m.externalId === planExternalId(oldId))).toBeDefined();

    // And not in a month it has nothing to do with, however recently the row
    // was edited - otherwise a backfill of "January" would drag in every old
    // payment that happened to be touched in January.
    const april = await projectMoney({
      since: new Date('2026-04-01T00:00:00.000Z'),
      until: new Date('2026-05-01T00:00:00.000Z'),
      by: 'received',
    });
    expect(april.find((m) => m.externalId === planExternalId(oldId))).toBeUndefined();
  });

  it('treats the end of the window as exclusive, so months do not overlap', async () => {
    // The payment is on 2026-03-15. A window ending exactly there excludes it;
    // the next window includes it. Chunked month by month, nothing is counted
    // twice and nothing falls between two chunks.
    const upTo = await projectMoney({
      since: new Date('2026-03-01T00:00:00.000Z'),
      until: new Date('2026-03-15T00:00:00.000Z'),
      by: 'received',
    });
    expect(upTo.find((m) => m.externalId === planExternalId(oldId))).toBeUndefined();

    const from = await projectMoney({
      since: new Date('2026-03-15T00:00:00.000Z'),
      until: new Date('2026-03-16T00:00:00.000Z'),
      by: 'received',
    });
    expect(from.find((m) => m.externalId === planExternalId(oldId))).toBeDefined();
  });

  it('still accepts a bare date, the way the live sync calls it', async () => {
    const money = await projectMoney(new Date(Date.now() - 3_600_000));
    expect(money.find((m) => m.externalId === planExternalId(oldId))).toBeDefined();
  });
});

describe('the cursor', () => {
  it('starts at now on the first run, so history is never pushed by accident', async () => {
    await prisma.systemSetting.deleteMany({ where: { key: CURSOR_KEY } });
    const now = new Date();
    const { since, firstRun } = await readCursor(now);
    expect(firstRun).toBe(true);
    expect(since).toEqual(now);
  });

  it('looks back a little further than where it stopped', async () => {
    const at = new Date('2026-10-01T12:00:00.000Z');
    await writeCursor(at);
    const { since, firstRun } = await readCursor();
    expect(firstRun).toBe(false);
    // A row written while the last run was reading must not fall between runs.
    expect(since.getTime()).toBeLessThan(at.getTime());
  });
});

describe('the queue', () => {
  const member = (name: string) => ({
    kind: 'member.upsert' as const,
    externalId: memberExternalId(adminId),
    name,
    email: null,
    title: 'Onboarder',
  });

  it('queues a thing once, however many times it is projected', async () => {
    await prisma.syncEvent.deleteMany({ where: { externalId: memberExternalId(adminId) } });

    expect(await enqueue([member('Ravi')])).toEqual({ queued: 1, unchanged: 0 });
    expect(await enqueue([member('Ravi')])).toEqual({ queued: 0, unchanged: 1 });
    expect(await enqueue([member('Ravi')])).toEqual({ queued: 0, unchanged: 1 });

    expect(await prisma.syncEvent.count({ where: { externalId: memberExternalId(adminId) } })).toBe(1);
  });

  it('queues it again when it really changed, and resets its attempts', async () => {
    await prisma.syncEvent.update({
      where: { kind_externalId: { kind: 'member.upsert', externalId: memberExternalId(adminId) } },
      data: { status: 'DELIVERED', attempts: 4, deliveredAt: new Date(), lastError: 'old' },
    });

    expect(await enqueue([member('Ravi Kumar')])).toEqual({ queued: 1, unchanged: 0 });

    const row = await prisma.syncEvent.findUniqueOrThrow({
      where: { kind_externalId: { kind: 'member.upsert', externalId: memberExternalId(adminId) } },
    });
    expect(row.status).toBe('PENDING');
    // A past failure must not count against a payload that is now different.
    expect(row.attempts).toBe(0);
    expect(row.lastError).toBeNull();
  });

  it('notices a change back to a state it held before', async () => {
    // A -> B -> A. Keyed only on the current fingerprint, the third step would
    // look like "already delivered" and TeamOS would be left showing B.
    await enqueue([member('Back To Ravi')]);
    await prisma.syncEvent.update({
      where: { kind_externalId: { kind: 'member.upsert', externalId: memberExternalId(adminId) } },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
    expect(await enqueue([member('Ravi Kumar')])).toEqual({ queued: 1, unchanged: 0 });
  });

  it('hands out members before clients before money', async () => {
    await prisma.syncEvent.deleteMany({});
    await enqueue([
      {
        kind: 'ledger.upsert', externalId: `payment:order-test-${orgId}`, type: 'in', date: '2026-10-01',
        description: 'x', category: 'WabMeta plan', amountPaise: 1, status: 'paid', paidOn: null,
        method: null, clientExternalId: clientExternalId(orgId), note: null,
      },
      {
        kind: 'client.upsert', externalId: clientExternalId(orgId), name: 'c', company: null, contact: null,
        since: null, retainerPaise: 0, ownerExternalId: null, removed: false,
      },
    ]);

    const claimed = await claim();
    const kinds = claimed.map((c) => c.kind);
    // A payment names a client, so the client has to be applied first.
    expect(kinds.indexOf('client.upsert')).toBeLessThan(kinds.indexOf('ledger.upsert'));
  });
});

describe('delivery', () => {
  // claim() hands out everything that is due, so these tests have to start
  // from an empty queue - otherwise they measure whatever an earlier describe
  // block, or an earlier aborted run against this shared test DB, left behind.
  const one = async () => {
    await prisma.syncEvent.deleteMany({});
    await enqueue([
      { kind: 'member.upsert', externalId: memberExternalId(adminId), name: 'Ravi', email: null, title: null },
    ]);
    return claim();
  };

  const row = () =>
    prisma.syncEvent.findUniqueOrThrow({
      where: { kind_externalId: { kind: 'member.upsert', externalId: memberExternalId(adminId) } },
    });

  it('marks what the receiver applied as delivered', async () => {
    const events = await one();
    vi.stubGlobal('fetch', okFetch());

    const result = await deliverBatch(CONFIG, events);
    expect(result).toMatchObject({ sent: 1, delivered: 1, failed: 0 });
    expect((await row()).status).toBe('DELIVERED');
  });

  it('signs the request and never follows a redirect', async () => {
    const events = await one();
    const spy = okFetch();
    vi.stubGlobal('fetch', spy);

    await deliverBatch(CONFIG, events);
    const [url, init] = spy.mock.calls[0] as any;
    expect(url).toBe(CONFIG.url);
    expect(init.redirect).toBe('manual');
    expect(init.headers['x-wabmeta-signature']).toBe(
      signBody(init.body, init.headers['x-wabmeta-timestamp'], CONFIG.secret),
    );
  });

  it('treats a redirect as a failure, not as a delivery', async () => {
    // The bug this guards: TeamOS once answered every API request with a 307 to
    // its login page. Following it would have returned that page with a 200 and
    // the payment would have been marked delivered and lost.
    const events = await one();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 307,
        headers: new Headers({ location: 'https://teamos.test/login' }),
        text: async () => '',
        json: async () => ({}),
      })) as any,
    );

    const result = await deliverBatch(CONFIG, events);
    expect(result.delivered).toBe(0);
    const after = await row();
    expect(after.status).toBe('PENDING');
    expect(after.lastError).toContain('redirected to');
  });

  it('stops retrying a request the receiver will never accept', async () => {
    const events = await one();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false, status: 401, headers: new Headers(), text: async () => 'unauthorized', json: async () => ({}),
      })) as any,
    );

    await deliverBatch(CONFIG, events);
    // A wrong secret is not bad luck; nine more identical attempts would only
    // bury the events that could still go out.
    expect((await row()).status).toBe('DEAD');
  });

  it('keeps retrying when the receiver is merely down', async () => {
    const events = await one();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false, status: 503, headers: new Headers(), text: async () => 'down', json: async () => ({}),
      })) as any,
    );

    await deliverBatch(CONFIG, events);
    const after = await row();
    expect(after.status).toBe('PENDING');
    expect(after.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('holds an event the receiver asked to be sent again', async () => {
    const events = await one();
    vi.stubGlobal(
      'fetch',
      okFetch({
        [memberExternalId(adminId)]: { status: 'failed', retry: true, error: 'client not synced yet' },
      }),
    );

    await deliverBatch(CONFIG, events);
    const after = await row();
    expect(after.status).toBe('PENDING');
    expect(after.lastError).toContain('client not synced yet');
  });

  it('holds an event the receiver said nothing about', async () => {
    const events = await one();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true, status: 200, headers: new Headers(),
        json: async () => ({ applied: 0, unchanged: 0, failed: 0, results: [] }),
        text: async () => '',
      })) as any,
    );

    const result = await deliverBatch(CONFIG, events);
    // A 200 that mentions nothing is not success; dropping it would be silent.
    expect(result.delivered).toBe(0);
    expect((await row()).status).toBe('PENDING');
  });

  it('does not keep hammering a receiver that is failing', async () => {
    await prisma.syncEvent.deleteMany({});
    await enqueue(
      Array.from({ length: 3 }, (_, i) => ({
        kind: 'client.upsert' as const,
        externalId: `${clientExternalId(orgId)}-${i}`,
        name: `c${i}`, company: null, contact: null, since: null,
        retainerPaise: 0, ownerExternalId: null, removed: false,
      })),
    );

    const spy = vi.fn(async () => ({
      ok: false, status: 500, headers: new Headers(), text: async () => 'boom', json: async () => ({}),
    })) as any;
    vi.stubGlobal('fetch', spy);

    await deliverDue(CONFIG);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('what the admin panel reads', () => {
  it('reports the queue and the oldest thing still waiting', async () => {
    await prisma.syncEvent.deleteMany({});
    await enqueue([
      {
        kind: 'client.upsert', externalId: clientExternalId(orgId), name: 'c', company: null, contact: null,
        since: null, retainerPaise: 0, ownerExternalId: null, removed: false,
      },
    ]);

    const s = await stats();
    expect(s.pending).toBeGreaterThan(0);
    expect(s.oldestPendingAt).toBeInstanceOf(Date);
  });

  it('can put dead events back in the queue', async () => {
    await prisma.syncEvent.updateMany({
      where: { externalId: clientExternalId(orgId) },
      data: { status: 'DEAD', attempts: MAX_ATTEMPTS, lastError: 'gave up' },
    });

    expect(await reviveDead()).toBeGreaterThan(0);
    const after = await prisma.syncEvent.findFirstOrThrow({ where: { externalId: clientExternalId(orgId) } });
    expect(after.status).toBe('PENDING');
    expect(after.attempts).toBe(0);
  });
});

describe('the lease', () => {
  const KEY = `teamos.sync.test-${SUFFIX}`;

  it('runs the work and then lets the next caller in', async () => {
    expect(await withLease(KEY, async () => 'first')).toBe('first');
    expect(await withLease(KEY, async () => 'second')).toBe('second');
  });

  it('keeps a second caller out while the first is working', async () => {
    let inner: string | undefined = 'not run';
    const outer = await withLease(KEY, async () => {
      inner = await withLease(KEY, async () => 'should not happen');
      return 'held';
    });

    expect(outer).toBe('held');
    expect(inner).toBeUndefined();
  });

  it('survives the work throwing, rather than wedging the job', async () => {
    await expect(
      withLease(KEY, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // The whole point: a crashed run must not hold the lease for ever. This is
    // what a session advisory lock stranded on a pooled connection does, and
    // why utils/withLock.ts is not used here - see sync.lease.ts.
    expect(await withLease(KEY, async () => 'after the crash')).toBe('after the crash');
  });

  it('can be taken over once it has expired', async () => {
    // A one-millisecond lease, so by the next call it is already stale.
    await withLease(KEY, async () => undefined, 1);
    await prisma.systemSetting.update({
      where: { key: KEY },
      data: { value: { holder: 'a-dead-instance', until: new Date(Date.now() - 60_000).toISOString() } },
    });

    expect(await withLease(KEY, async () => 'taken over')).toBe('taken over');
  });

  it('is not freed by somebody who does not hold it', async () => {
    await prisma.systemSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: { holder: 'other', until: new Date(Date.now() + 60_000).toISOString() } },
      update: { value: { holder: 'other', until: new Date(Date.now() + 60_000).toISOString() } },
    });

    // Releasing a lease we never held would let two instances work at once -
    // the one thing the lease is for.
    expect(await withLease(KEY, async () => 'should not run')).toBeUndefined();

    const row = await prisma.systemSetting.findUniqueOrThrow({ where: { key: KEY } });
    expect((row.value as any).holder).toBe('other');

    await prisma.systemSetting.delete({ where: { key: KEY } });
  });
});

describe('batch size', () => {
  it('stays inside what the receiver accepts', () => {
    // TeamOS validates events.max(200).
    expect(BATCH_SIZE).toBeLessThanOrEqual(200);
  });
});
