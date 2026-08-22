/**
 * Wallet debit must survive concurrent sends.
 *
 * Campaigns send with a concurrency of up to 20 (campaigns.service.ts), and each
 * send fires a wallet debit without awaiting it (whatsapp.service.ts). So the
 * debit path is genuinely called in parallel against one wallet row.
 *
 * The invariant this asserts is the only one that matters for billing:
 *
 *     balanceAfter === balanceBefore - (sum of the debit rows that were written)
 *
 * It deliberately does not hard-code a rate. If N debits are recorded, the
 * balance must reflect all N. A lost update shows up as a balance that is
 * higher than the recorded debits account for -- i.e. messages sent for free.
 *
 * Requires the local throwaway database:
 *   docker start wabmeta-testdb
 *   DATABASE_URL=postgresql://wabmeta:testpass@localhost:5433/wabmeta_test
 */
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { deductWalletForTemplate } from './wallet.deduction.service';

const prisma = new PrismaClient();

const SUFFIX = `test-${Date.now()}`;
const START_PAISE = 10_000_00; // ₹10,000 — comfortably more than any rate × 20
const PARALLEL = 20; // matches the campaign sender's max concurrency

let organizationId: string;
let userId: string;
let walletId: string;

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error(
      'Refusing to run: DATABASE_URL must point at the local test database on port 5433.'
    );
  }

  const user = await prisma.user.create({
    data: {
      email: `wallet-${SUFFIX}@wabmeta.local`,
      firstName: 'Wallet',
      lastName: 'Test',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
  userId = user.id;

  const org = await prisma.organization.create({
    data: { name: `Wallet Test ${SUFFIX}`, slug: `wallet-${SUFFIX}`, ownerId: user.id },
  });
  organizationId = org.id;
});

beforeEach(async () => {
  await prisma.walletTransaction.deleteMany({ where: { wallet: { organizationId } } });
  await prisma.wallet.deleteMany({ where: { organizationId } });

  const wallet = await prisma.wallet.create({
    data: {
      organizationId,
      userId,
      isActive: true,
      balancePaise: START_PAISE,
      monthResetDate: new Date(),
    },
  });
  walletId = wallet.id;
});

afterAll(async () => {
  await prisma.walletTransaction.deleteMany({ where: { wallet: { organizationId } } });
  await prisma.wallet.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

const debitOnce = (n: number) =>
  deductWalletForTemplate({
    organizationId,
    templateName: 'audit_test_template',
    templateCategory: 'MARKETING',
    recipientPhone: '+919876543210',
    waMessageId: `wamid.${SUFFIX}.${n}`,
  });

describe('wallet debit under concurrency', () => {
  it('applies every debit when they run one after another', async () => {
    for (let i = 0; i < 5; i++) await debitOnce(i);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
    const debits = await prisma.walletTransaction.findMany({
      where: { walletId, type: 'debit' },
    });

    const charged = debits.reduce((sum, t) => sum + t.amountPaise, 0);
    expect(debits.length).toBe(5);
    expect(wallet.balancePaise).toBe(START_PAISE - charged);
  });

  it('applies every debit when they run in parallel', async () => {
    await Promise.all(Array.from({ length: PARALLEL }, (_, i) => debitOnce(i)));

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
    const debits = await prisma.walletTransaction.findMany({
      where: { walletId, type: 'debit' },
    });

    const charged = debits.reduce((sum, t) => sum + t.amountPaise, 0);

    // Every debit that was recorded must be reflected in the balance.
    expect(wallet.balancePaise).toBe(START_PAISE - charged);
  });

  it('never lets the balance go negative under parallel debits', async () => {
    // Only enough for a couple of messages, then hammer it.
    await prisma.wallet.update({ where: { id: walletId }, data: { balancePaise: 200 } });

    await Promise.all(Array.from({ length: PARALLEL }, (_, i) => debitOnce(i)));

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
    expect(wallet.balancePaise).toBeGreaterThanOrEqual(0);
  });
});
