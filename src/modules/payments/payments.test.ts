/**
 * Client-owned Razorpay payment links against a real Postgres.
 *
 * Razorpay, WhatsApp and push notifications are mocked; everything else is the
 * real code. The important invariant: webhook and polling can both confirm the
 * same payment, so confirmation must happen exactly once.
 *
 * Requires the local test DB:
 *   DATABASE_URL=postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  // encryption util reads config.encryptionKey at import time
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef'.repeat(4);
  return {
    created: [] as Array<{ id: string; params: any }>,
    fetched: [] as string[],
    linkStatus: 'created',
    keysRejected: false,
    sent: [] as Array<{ to: string; text: string }>,
    notified: [] as any[],
  };
});

vi.mock('razorpay', () => ({
  default: vi.fn().mockImplementation(() => ({
    payments: {
      all: vi.fn(async () => {
        if (h.keysRejected) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
        return { items: [] };
      }),
    },
    paymentLink: {
      create: vi.fn(async (params: any) => {
        const id = `plink_${h.created.length + 1}`;
        h.created.push({ id, params });
        return { id, short_url: `https://rzp.io/i/${id}`, status: 'created' };
      }),
      fetch: vi.fn(async (id: string) => {
        h.fetched.push(id);
        return { id, status: h.linkStatus, payments: [{ payment_id: 'pay_test_1' }] };
      }),
    },
  })),
}));

vi.mock('../whatsapp/whatsapp.service', () => ({
  whatsappService: {
    sendTextMessage: vi.fn(async (_acc: string, to: string, text: string) => {
      h.sent.push({ to, text });
      return {};
    }),
    sendTemplateMessage: vi.fn(async () => ({ waMessageId: 'x' })),
    sendMediaMessage: vi.fn(async () => ({})),
    sendMessage: vi.fn(async () => ({})),
  },
}));

vi.mock('../notifications/notifications.service', () => ({
  notificationsService: {
    create: vi.fn(async (n: any) => {
      h.notified.push(n);
      return n;
    }),
  },
}));

import prisma from '../../config/database';
import { safeDecrypt } from '../../utils/encryption';
import { paymentsService } from './payments.service';
import { buildToolDeclarations, executeTool, ToolContext } from '../aiagent/aiagent.tools';
import { AgentConfig } from '../aiagent/aiagent.prompt';

const SUFFIX = `pay-${Date.now()}`;
const PHONE = '+919811122233';
const KEY_ID = 'rzp_test_abc123';
const KEY_SECRET = 'super-secret-value';

let organizationId: string;
let userId: string;
let contactId: string;
let conversationId: string;
let leadId: string;
let wonStageId: string;

const connect = () =>
  paymentsService.connectGateway(organizationId, { keyId: KEY_ID, keySecret: KEY_SECRET });

const createLink = (over: Record<string, any> = {}) =>
  paymentsService.createPaymentLink({
    organizationId,
    amountPaise: 2_500_000,
    description: 'Business website',
    leadId,
    createdVia: 'manual',
    createdById: userId,
    ...over,
  });

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }
  const user = await prisma.user.create({
    data: { email: `${SUFFIX}@wabmeta.local`, firstName: 'Owner', status: 'ACTIVE', emailVerified: true },
  });
  userId = user.id;
  const org = await prisma.organization.create({ data: { name: 'Pay Co', slug: SUFFIX, ownerId: userId } });
  organizationId = org.id;
  await prisma.whatsAppAccount.create({
    data: {
      organizationId, phoneNumberId: `pn-${SUFFIX}`, wabaId: `waba-${SUFFIX}`,
      phoneNumber: '+10000000002', displayName: 'Pay Co', accessToken: 'x', status: 'CONNECTED',
    },
  });
  const pipeline = await prisma.pipeline.create({
    data: {
      organizationId, name: 'Sales', isDefault: true,
      stages: {
        create: [
          { name: 'New Lead', order: 0 },
          { name: 'Proposal', order: 1 },
          { name: 'Won', order: 2, isWon: true },
        ],
      },
    },
    include: { stages: true },
  });
  wonStageId = pipeline.stages.find((s) => s.isWon)!.id;
});

beforeEach(async () => {
  h.created.length = 0;
  h.fetched.length = 0;
  h.sent.length = 0;
  h.notified.length = 0;
  h.linkStatus = 'created';
  h.keysRejected = false;

  await prisma.leadPayment.deleteMany({ where: { organizationId } });
  await prisma.lead.deleteMany({ where: { organizationId } });
  await prisma.conversation.deleteMany({ where: { organizationId } });
  await prisma.contact.deleteMany({ where: { organizationId } });
  await prisma.paymentGateway.deleteMany({ where: { organizationId } });

  const contact = await prisma.contact.create({
    data: { organizationId, phone: PHONE, countryCode: '91', firstName: 'Neha' },
  });
  contactId = contact.id;
  const conv = await prisma.conversation.create({
    data: {
      organizationId, contactId, channel: 'WHATSAPP', lastCustomerMessageAt: new Date(),
      windowExpiresAt: new Date(Date.now() + 23 * 3600_000), isWindowOpen: true,
    },
  });
  conversationId = conv.id;
  const pipeline = await prisma.pipeline.findFirstOrThrow({ where: { organizationId } });
  const lead = await prisma.lead.create({
    data: { organizationId, contactId, title: 'Neha - website', pipelineId: pipeline.id, assignedToId: userId },
  });
  leadId = lead.id;
});

afterAll(async () => {
  if (!organizationId || !userId) {
    await prisma.$disconnect();
    return;
  }
  await prisma.leadPayment.deleteMany({ where: { organizationId } });
  await prisma.lead.deleteMany({ where: { organizationId } });
  await prisma.pipeline.deleteMany({ where: { organizationId } });
  await prisma.paymentGateway.deleteMany({ where: { organizationId } });
  await prisma.conversation.deleteMany({ where: { organizationId } });
  await prisma.contact.deleteMany({ where: { organizationId } });
  await prisma.whatsAppAccount.deleteMany({ where: { organizationId } });
  await prisma.organizationSettings.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('connecting the client Razorpay account', () => {
  it('stores the secret encrypted and never returns it', async () => {
    const result = await connect();
    expect(result).toMatchObject({ connected: true, keyId: KEY_ID, webhookConfigured: false });
    expect(JSON.stringify(result)).not.toContain(KEY_SECRET);

    const row = await prisma.paymentGateway.findUniqueOrThrow({ where: { organizationId } });
    expect(row.keySecret).not.toBe(KEY_SECRET);
    expect(safeDecrypt(row.keySecret)).toBe(KEY_SECRET);
  });

  it('rejects a key that is not a Razorpay key id, and keys Razorpay refuses', async () => {
    await expect(paymentsService.connectGateway(organizationId, { keyId: 'abc', keySecret: 'x' }))
      .rejects.toThrow(/Razorpay key id/);

    h.keysRejected = true;
    await expect(paymentsService.connectGateway(organizationId, { keyId: KEY_ID, keySecret: 'wrong' }))
      .rejects.toThrow(/rejected these keys/);
    expect(await prisma.paymentGateway.count({ where: { organizationId } })).toBe(0);
  });

  it('refuses to create a link when Razorpay is not connected', async () => {
    await expect(createLink()).rejects.toThrow(/not connected/);
  });
});

describe('payment links', () => {
  it('creates the link, sends it on WhatsApp and notes it on the lead', async () => {
    await connect();
    const { payment, sent } = await createLink();

    expect(payment).toMatchObject({ status: 'PENDING', amountPaise: 2_500_000, createdVia: 'manual', leadId });
    expect(sent).toBe(true);
    expect(h.created[0].params).toMatchObject({ amount: 2_500_000, currency: 'INR' });
    expect(h.created[0].params.notify).toEqual({ sms: false, email: false });
    expect(h.sent[0].to).toBe(PHONE);
    expect(h.sent[0].text).toContain(payment.shortUrl);
    expect(h.sent[0].text).toContain('₹25,000');

    const activity = await prisma.leadActivity.findFirst({ where: { leadId }, orderBy: { createdAt: 'desc' } });
    expect(activity?.title).toContain('Payment link sent');
  });

  it('rejects silly amounts', async () => {
    await connect();
    await expect(createLink({ amountPaise: 50 })).rejects.toThrow(/at least ₹1/);
    await expect(createLink({ amountPaise: 100_000_001 })).rejects.toThrow(/too large/);
  });
});

describe('confirming a payment', () => {
  it('marks the lead Won, sends one receipt, and never acts twice', async () => {
    await connect();
    const { payment } = await createLink();
    h.sent.length = 0;

    const first = await paymentsService.markPaid(payment.id, 'pay_abc');
    const second = await paymentsService.markPaid(payment.id, 'pay_abc');

    expect(first?.status).toBe('PAID');
    expect(second).toBeNull(); // already done

    const row = await prisma.leadPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(row).toMatchObject({ status: 'PAID', providerPaymentId: 'pay_abc' });
    expect(row.paidAt).toBeTruthy();

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.stageId).toBe(wonStageId);
    expect(lead.status).toBe('WON');
    expect(Number(lead.value)).toBe(25000); // empty value filled from the payment

    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].text).toContain('received your payment');
    expect(h.notified.filter((n) => n.type === 'billing')).toHaveLength(1);
  });

  it('accepts the webhook event and the poll for the same link without doubling up', async () => {
    await connect();
    const { payment } = await createLink();
    h.sent.length = 0;

    await paymentsService.applyWebhookEvent(
      organizationId,
      'payment_link.paid',
      { id: payment.providerLinkId },
      { id: 'pay_webhook' }
    );

    h.linkStatus = 'paid';
    await paymentsService.syncPayment(payment.id); // polling right after

    const row = await prisma.leadPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(row).toMatchObject({ status: 'PAID', providerPaymentId: 'pay_webhook' });
    expect(h.sent).toHaveLength(1);
  });

  it('marks expired and cancelled links from webhook events', async () => {
    await connect();
    const a = await createLink();
    const b = await createLink();

    await paymentsService.applyWebhookEvent(organizationId, 'payment_link.expired', { id: a.payment.providerLinkId });
    await paymentsService.applyWebhookEvent(organizationId, 'payment_link.cancelled', { id: b.payment.providerLinkId });

    expect((await prisma.leadPayment.findUniqueOrThrow({ where: { id: a.payment.id } })).status).toBe('EXPIRED');
    expect((await prisma.leadPayment.findUniqueOrThrow({ where: { id: b.payment.id } })).status).toBe('CANCELLED');
  });

  it('ignores a webhook for a link that belongs to someone else', async () => {
    await connect();
    await paymentsService.applyWebhookEvent(organizationId, 'payment_link.paid', { id: 'plink_not_ours' });
    expect(await prisma.leadPayment.count({ where: { organizationId, status: 'PAID' } })).toBe(0);
  });
});

describe('polling fallback', () => {
  it('closes links whose expiry passed without asking Razorpay', async () => {
    await connect();
    const { payment } = await createLink();
    await prisma.leadPayment.update({
      where: { id: payment.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await paymentsService.pollPendingPayments();

    expect((await prisma.leadPayment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('EXPIRED');
    expect(h.fetched).toEqual([]);
  });

  it('picks up a payment the webhook never reported', async () => {
    await connect();
    const { payment } = await createLink();
    h.sent.length = 0;
    h.linkStatus = 'paid';

    await paymentsService.pollPendingPayments();

    expect(h.fetched).toContain(payment.providerLinkId);
    const row = await prisma.leadPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(row).toMatchObject({ status: 'PAID', providerPaymentId: 'pay_test_1' });
    expect(row.lastCheckedAt).toBeTruthy();
    expect(h.sent).toHaveLength(1);
  });
});

describe('AI agent payment tool', () => {
  const agent: AgentConfig = {
    name: 'Riya', businessInfo: '', instructions: '', timezone: 'Asia/Kolkata',
    handoffOnRequest: true, handoffOnComplaint: true, handoffOnUnknown: true, handoffDealAbove: null,
  };

  const ctx = (canTakePayments: boolean, dryRun = false): ToolContext => ({
    organizationId, contactId, conversationId, agent: { ...agent, notifyUserId: null },
    stageNames: ['New Lead', 'Proposal'], canTakePayments, dryRun, now: new Date(), state: {},
  });

  it('is offered only when Razorpay is connected', () => {
    const without = buildToolDeclarations(agent, [], false).map((t) => t.name);
    const withPay = buildToolDeclarations(agent, [], true).map((t) => t.name);
    expect(without).not.toContain('send_payment_link');
    expect(withPay).toContain('send_payment_link');
  });

  it('creates a link for the lead without sending a second WhatsApp message', async () => {
    await connect();
    const result = await executeTool('send_payment_link', { amount: 25000, description: 'Website' }, ctx(true));

    expect(result).toMatchObject({ ok: true, amount: 25000 });
    expect(String(result.paymentLink)).toContain('rzp.io');
    // The AI puts the link in its own reply, so the service must not message too
    expect(h.sent).toEqual([]);
    const row = await prisma.leadPayment.findFirstOrThrow({ where: { organizationId } });
    expect(row).toMatchObject({ createdVia: 'ai_agent', amountPaise: 2_500_000 });
  });

  it('refuses when payments are off, on a bad amount, and writes nothing in a dry run', async () => {
    await connect();
    expect(await executeTool('send_payment_link', { amount: 500 }, ctx(false))).toMatchObject({ ok: false });
    expect(await executeTool('send_payment_link', { amount: 0 }, ctx(true))).toMatchObject({ ok: false });

    const dry = await executeTool('send_payment_link', { amount: 999 }, ctx(true, true));
    expect(dry).toMatchObject({ ok: true, dryRun: true });
    expect(await prisma.leadPayment.count({ where: { organizationId } })).toBe(0);
  });
});
