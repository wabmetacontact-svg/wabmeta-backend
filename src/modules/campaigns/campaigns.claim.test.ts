/**
 * Campaign contact claiming must be safe across concurrent workers.
 *
 * Two backend instances (or a live sender + the boot-time recovery job) both
 * process the same RUNNING campaign. Before this, each read the same PENDING
 * rows with findMany and sent them — so a contact could be messaged, and
 * charged, twice.
 *
 * claimContactBatch uses UPDATE ... FOR UPDATE SKIP LOCKED, so two callers
 * racing over the same pool get DISJOINT sets whose union is every contact,
 * with no id claimed twice. That is exactly what this asserts.
 *
 * Requires the local throwaway DB:
 *   docker start wabmeta-testdb
 *   DATABASE_URL=postgresql://wabmeta:testpass@localhost:5433/wabmeta_test
 */
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { claimContactBatch } from './campaigns.claim';

const prisma = new PrismaClient();
const SUFFIX = `claim-${Date.now()}`;
const POOL = 200;

let organizationId: string;
let userId: string;
let templateId: string;
let waAccountId: string;
let campaignId: string;

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }

  const user = await prisma.user.create({
    data: { email: `${SUFFIX}@wabmeta.local`, firstName: 'Claim', status: 'ACTIVE', emailVerified: true },
  });
  userId = user.id;
  const org = await prisma.organization.create({
    data: { name: `Claim ${SUFFIX}`, slug: SUFFIX, ownerId: user.id },
  });
  organizationId = org.id;

  const wa = await prisma.whatsAppAccount.create({
    data: {
      organizationId, phoneNumberId: `pn-${SUFFIX}`, wabaId: `waba-${SUFFIX}`,
      phoneNumber: '+10000000000', displayName: 'Test', accessToken: 'x', status: 'CONNECTED',
    },
  });
  waAccountId = wa.id;

  const tpl = await prisma.template.create({
    data: {
      organizationId, name: `tpl_${SUFFIX}`, category: 'MARKETING', language: 'en',
      status: 'APPROVED', bodyText: 'hi',
    },
  });
  templateId = tpl.id;
});

beforeEach(async () => {
  await prisma.campaignContact.deleteMany({ where: { campaign: { organizationId } } });
  await prisma.campaign.deleteMany({ where: { organizationId } });
  await prisma.contact.deleteMany({ where: { organizationId } });

  const campaign = await prisma.campaign.create({
    data: {
      organizationId, name: 'Claim test', templateId, whatsappAccountId: waAccountId,
      createdById: userId, status: 'RUNNING', totalContacts: POOL,
    },
  });
  campaignId = campaign.id;

  // A pool of contacts + pending campaign rows.
  for (let i = 0; i < POOL; i++) {
    const c = await prisma.contact.create({
      data: { organizationId, phone: `+9199${String(i).padStart(8, '0')}`, countryCode: '91' },
    });
    await prisma.campaignContact.create({
      data: { campaignId, contactId: c.id, status: 'PENDING' },
    });
  }
});

afterAll(async () => {
  await prisma.campaignContact.deleteMany({ where: { campaign: { organizationId } } });
  await prisma.campaign.deleteMany({ where: { organizationId } });
  await prisma.contact.deleteMany({ where: { organizationId } });
  await prisma.template.deleteMany({ where: { organizationId } });
  await prisma.whatsAppAccount.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('claimContactBatch under concurrency', () => {
  it('two workers claim disjoint sets that together cover the pool', async () => {
    // Two workers repeatedly claim until the pool is drained, in parallel.
    const drain = async (bucket: string[]) => {
      for (;;) {
        const ids = await claimContactBatch(campaignId, 25);
        if (ids.length === 0) break;
        bucket.push(...ids);
      }
    };
    const a: string[] = [];
    const b: string[] = [];
    await Promise.all([drain(a), drain(b)]);

    const all = [...a, ...b];
    const unique = new Set(all);

    // No id claimed twice.
    expect(unique.size).toBe(all.length);
    // Every contact was claimed exactly once.
    expect(unique.size).toBe(POOL);
  });

  it('claims nothing once every row is QUEUED or beyond', async () => {
    let n = 0;
    for (;;) {
      const ids = await claimContactBatch(campaignId, 50);
      if (ids.length === 0) break;
      n += ids.length;
    }
    expect(n).toBe(POOL);
    // A follow-up claim finds nothing (all now QUEUED, not stale yet).
    const again = await claimContactBatch(campaignId, 50);
    expect(again.length).toBe(0);
  });
});
