/**
 * Durable follow-ups against a real Postgres: AutomationJob claiming, delay and
 * wait_for_response resume, reply handling, the resume guards, and the
 * NO_REPLY / TASK_DUE / LEAD_STAGE_CHANGED triggers.
 *
 * WhatsApp sends, wallet debits and push notifications are mocked, so nothing
 * leaves the machine. Everything else is the real engine and real SQL.
 *
 * Requires the local throwaway DB:
 *   docker start wabmeta-testdb
 *   DATABASE_URL=postgresql://wabmeta:testpass@localhost:5433/wabmeta_test
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { sent, notified } = vi.hoisted(() => ({
  sent: [] as Array<{ to: string; text?: string; template?: string }>,
  notified: [] as any[],
}));

vi.mock('../whatsapp/whatsapp.service', () => ({
  whatsappService: {
    sendTextMessage: vi.fn(async (_accountId: string, to: string, text: string) => {
      sent.push({ to, text });
      return {};
    }),
    sendTemplateMessage: vi.fn(async (o: any) => {
      sent.push({ to: o.to, template: o.templateName });
      return { waMessageId: `wamid.test.${sent.length}` };
    }),
    sendMediaMessage: vi.fn(async () => ({})),
    sendMessage: vi.fn(async () => ({})),
  },
}));

vi.mock('../wallet/wallet.deduction.service', () => ({
  deductWalletForTemplate: vi.fn(async () => ({ deducted: false, amount: 0 })),
}));

vi.mock('../notifications/notifications.service', () => ({
  notificationsService: {
    create: vi.fn(async (n: any) => {
      notified.push(n);
      return n;
    }),
  },
}));

import prisma from '../../config/database';
import { automationEngine } from './automation.engine';
import { claimDueJobs } from './automation.jobs';
import { minuteOfDayIn } from './automation.timing';
import { crmService } from '../crm/crm.service';

const SUFFIX = `jobs-${Date.now()}`;
const HOUR = 60 * 60 * 1000;

let organizationId: string;
let userId: string;
let templateId: string;
let templateName: string;

// ── helpers ──────────────────────────────────────────────────────────────

const openWindow = () => ({
  lastCustomerMessageAt: new Date(),
  lastMessageAt: new Date(),
  windowExpiresAt: new Date(Date.now() + 23 * HOUR),
  isWindowOpen: true,
});

async function makeContact(i: number, conversation: Record<string, any> = openWindow()) {
  const phone = `+9199${String(i).padStart(8, '0')}`;
  const contact = await prisma.contact.create({
    data: { organizationId, phone, countryCode: '91', firstName: `C${i}` },
  });
  const conv = await prisma.conversation.create({
    data: { organizationId, contactId: contact.id, channel: 'WHATSAPP', ...conversation },
  });
  return { contactId: contact.id, phone, conversationId: conv.id };
}

async function makeAutomation(actions: any[], extra: Record<string, any> = {}) {
  return prisma.automation.create({
    data: {
      organizationId,
      name: `A ${Math.random().toString(36).slice(2)}`,
      trigger: 'KEYWORD',
      triggerConfig: {},
      actions,
      isActive: true,
      ...extra,
    },
  });
}

const text = (id: string, body: string, config: Record<string, any> = {}) => ({
  id,
  type: 'send_text',
  config: { text: body, ...config },
});

const delayAction = (id: string) => ({ id, type: 'delay', config: { value: 2, unit: 'days' } });

/** Pull every PENDING job for this contact into the past so runDueJobs picks it up. */
async function makeJobsDue(contactId: string) {
  await prisma.automationJob.updateMany({
    where: { contactId, status: 'PENDING' },
    data: { runAt: new Date(Date.now() - 1000) },
  });
}

const texts = () => sent.map((s) => s.text ?? `tpl:${s.template}`);

const seq = (automationId: string, contactId: string) =>
  prisma.automationSequence.findUnique({
    where: { automationId_contactId: { automationId, contactId } },
  });

const onlyJob = (automationId: string, contactId: string) =>
  prisma.automationJob.findFirstOrThrow({ where: { automationId, contactId } });

async function run(actions: any[], contact: { contactId: string; phone: string }, extra: Record<string, any> = {}) {
  const automation = await makeAutomation(actions, extra);
  await automationEngine.executeActions(automation.id, actions as any, {
    organizationId,
    contactId: contact.contactId,
    phone: contact.phone,
  });
  return automation;
}

async function cleanOrg() {
  await prisma.automationJob.deleteMany({ where: { organizationId } });
  await prisma.automationSequence.deleteMany({ where: { automation: { organizationId } } });
  await prisma.lead.deleteMany({ where: { organizationId } });
  await prisma.pipeline.deleteMany({ where: { organizationId } });
  await prisma.conversation.deleteMany({ where: { organizationId } });
  await prisma.contact.deleteMany({ where: { organizationId } });
  await prisma.automation.deleteMany({ where: { organizationId } });
  await prisma.organizationSettings.deleteMany({ where: { organizationId } });
}

// ── lifecycle ────────────────────────────────────────────────────────────

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }

  const user = await prisma.user.create({
    data: { email: `${SUFFIX}@wabmeta.local`, firstName: 'Jobs', status: 'ACTIVE', emailVerified: true },
  });
  userId = user.id;

  const org = await prisma.organization.create({
    data: { name: `Jobs ${SUFFIX}`, slug: SUFFIX, ownerId: user.id },
  });
  organizationId = org.id;

  await prisma.whatsAppAccount.create({
    data: {
      organizationId, phoneNumberId: `pn-${SUFFIX}`, wabaId: `waba-${SUFFIX}`,
      phoneNumber: '+10000000000', displayName: 'Test', accessToken: 'x', status: 'CONNECTED',
    },
  });

  templateName = `followup_${SUFFIX.replace(/-/g, '_')}`;
  const tpl = await prisma.template.create({
    data: {
      organizationId, name: templateName, category: 'MARKETING', language: 'en',
      status: 'APPROVED', bodyText: 'Still interested?',
    },
  });
  templateId = tpl.id;
});

beforeEach(async () => {
  sent.length = 0;
  notified.length = 0;
  await cleanOrg();
});

afterAll(async () => {
  // afterAll runs even when beforeAll threw; with undefined ids Prisma would
  // read these filters as "no filter" -- every row in the table.
  if (!organizationId || !userId) {
    await prisma.$disconnect();
    return;
  }

  await cleanOrg();
  await prisma.template.deleteMany({ where: { organizationId } });
  await prisma.whatsAppAccount.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

// ── tests ────────────────────────────────────────────────────────────────

describe('claimDueJobs', () => {
  it('two workers claim disjoint due jobs and leave future ones alone', async () => {
    const c = await makeContact(1);
    const a = await makeAutomation([]);
    const past = new Date(Date.now() - 60_000);

    await prisma.automationJob.createMany({
      data: Array.from({ length: 40 }, () => ({
        organizationId, automationId: a.id, contactId: c.contactId,
        type: 'RESUME_SEQUENCE', runAt: past, payload: { fromStep: 3 },
      })),
    });
    const future = await prisma.automationJob.create({
      data: {
        organizationId, automationId: a.id, contactId: c.contactId,
        type: 'RESUME_SEQUENCE', runAt: new Date(Date.now() + HOUR), payload: { fromStep: 3 },
      },
    });

    const drain = async (bucket: any[]) => {
      for (;;) {
        const jobs = await claimDueJobs(7);
        if (jobs.length === 0) break;
        bucket.push(...jobs);
      }
    };
    const x: any[] = [];
    const y: any[] = [];
    await Promise.all([drain(x), drain(y)]);

    const ids = [...x, ...y].map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(40);
    expect(ids).not.toContain(future.id);
    // payload comes back as parsed JSON
    expect(x.concat(y)[0].payload.fromStep).toBe(3);

    const rows = await prisma.automationJob.findMany({ where: { id: { in: ids } } });
    expect(rows.every((r) => r.status === 'RUNNING' && r.attempts === 1)).toBe(true);
  });

  it('reclaims a RUNNING job abandoned for more than 10 minutes, not a live one', async () => {
    const c = await makeContact(1);
    const a = await makeAutomation([]);
    const base = {
      organizationId, automationId: a.id, contactId: c.contactId,
      type: 'RESUME_SEQUENCE', status: 'RUNNING', runAt: new Date(Date.now() - HOUR), payload: { fromStep: 0 },
    };
    const stale = await prisma.automationJob.create({ data: base });
    const live = await prisma.automationJob.create({ data: base });
    await prisma.$executeRaw`
      UPDATE "AutomationJob" SET "updatedAt" = now() - interval '11 minutes' WHERE "id" = ${stale.id}
    `;

    const ids = (await claimDueJobs(10)).map((j) => j.id);
    expect(ids).toContain(stale.id);
    expect(ids).not.toContain(live.id);
  });
});

describe('delay', () => {
  const actions = [text('s1', 'first'), delayAction('s2'), text('s3', 'second')];

  it('a long delay becomes a job and resumes at the next step', async () => {
    const c = await makeContact(1);
    const a = await run(actions, c);

    expect(texts()).toEqual(['first']);
    const job = await onlyJob(a.id, c.contactId);
    expect(job.type).toBe('RESUME_SEQUENCE');
    expect(job.status).toBe('PENDING');
    expect(job.runAt.getTime() - Date.now()).toBeGreaterThan(47 * HOUR);
    expect((await seq(a.id, c.contactId))?.status).toBe('SCHEDULED');

    await makeJobsDue(c.contactId);
    await automationEngine.runDueJobs();

    expect(texts()).toEqual(['first', 'second']);
    expect((await prisma.automationJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('DONE');
    expect((await seq(a.id, c.contactId))?.status).toBe('COMPLETED');
  });

  it('a customer reply cancels the pending follow-up', async () => {
    const c = await makeContact(1);
    const a = await run(actions, c);

    await automationEngine.onInboundMessage({ organizationId, contactId: c.contactId, message: 'ok thanks' });

    expect((await onlyJob(a.id, c.contactId)).status).toBe('CANCELLED');
    expect((await seq(a.id, c.contactId))?.status).toBe('REPLIED');

    await makeJobsDue(c.contactId);
    await automationEngine.runDueJobs();
    expect(texts()).toEqual(['first']);
  });

  it('stopOnReply: false keeps the follow-up after a reply', async () => {
    const c = await makeContact(1);
    const a = await run(actions, c, { triggerConfig: { stopOnReply: false } });

    await automationEngine.onInboundMessage({ organizationId, contactId: c.contactId, message: 'ok' });
    expect((await onlyJob(a.id, c.contactId)).status).toBe('PENDING');

    await makeJobsDue(c.contactId);
    await automationEngine.runDueJobs();
    expect(texts()).toEqual(['first', 'second']);
  });

  it('a new trigger replaces the old run and its pending follow-up', async () => {
    const c = await makeContact(1);
    const a = await run(actions, c);
    const first = await onlyJob(a.id, c.contactId);

    await automationEngine.executeActions(a.id, actions as any, {
      organizationId, contactId: c.contactId, phone: c.phone,
    });

    expect((await prisma.automationJob.findUniqueOrThrow({ where: { id: first.id } })).status).toBe('CANCELLED');
    expect(await prisma.automationJob.count({ where: { automationId: a.id, status: 'PENDING' } })).toBe(1);
  });
});

describe('wait_for_response', () => {
  it('resumes on text replies, each time from the right step', async () => {
    const c = await makeContact(1);
    const actions = [
      text('w1', 'q1'),
      { id: 'w2', type: 'wait_for_response', config: {} },
      text('w3', 'q2'),
      { id: 'w4', type: 'wait_for_response', config: {} },
      text('w5', 'done'),
    ];
    const a = await run(actions, c);
    expect(texts()).toEqual(['q1']);
    expect(await seq(a.id, c.contactId)).toMatchObject({ status: 'WAITING', currentStep: 1 });

    await automationEngine.onInboundMessage({ organizationId, contactId: c.contactId, message: 'yes' });
    expect(texts()).toEqual(['q1', 'q2']);
    expect(await seq(a.id, c.contactId)).toMatchObject({ status: 'WAITING', currentStep: 3 });

    await automationEngine.onInboundMessage({ organizationId, contactId: c.contactId, message: 'yes again' });
    expect(texts()).toEqual(['q1', 'q2', 'done']);
    expect((await seq(a.id, c.contactId))?.status).toBe('COMPLETED');
  });

  it('only a matching keyword resumes when keywords are set', async () => {
    const c = await makeContact(1);
    const actions = [
      { id: 'k1', type: 'wait_for_response', config: { keywords: ['price'] } },
      text('k2', 'price list'),
    ];
    const a = await run(actions, c);

    await automationEngine.onInboundMessage({ organizationId, contactId: c.contactId, message: 'hello' });
    expect(texts()).toEqual([]);
    expect((await seq(a.id, c.contactId))?.status).toBe('WAITING');

    await automationEngine.onInboundMessage({ organizationId, contactId: c.contactId, message: 'What is the PRICE?' });
    expect(texts()).toEqual(['price list']);
  });

  const followUp = (onTimeout: 'continue' | 'stop') => [
    text('t1', 'quote'),
    {
      id: 't2',
      type: 'wait_for_response',
      config: { onReply: 'stop', onTimeout, timeoutValue: 24, timeoutUnit: 'hours' },
    },
    text('t3', 'follow-up'),
  ];

  it('onTimeout continue sends the follow-up when nobody replies', async () => {
    const c = await makeContact(1);
    const a = await run(followUp('continue'), c);

    const job = await onlyJob(a.id, c.contactId);
    expect(job.type).toBe('WAIT_TIMEOUT');
    expect(job.runAt.getTime() - Date.now()).toBeGreaterThan(23 * HOUR);

    await makeJobsDue(c.contactId);
    await automationEngine.runDueJobs();
    expect(texts()).toEqual(['quote', 'follow-up']);
    expect((await seq(a.id, c.contactId))?.status).toBe('COMPLETED');
  });

  it('onReply stop ends the run on a reply and cancels the timeout', async () => {
    const c = await makeContact(1);
    const a = await run(followUp('continue'), c);

    await automationEngine.onInboundMessage({ organizationId, contactId: c.contactId, message: 'interested' });

    expect((await seq(a.id, c.contactId))?.status).toBe('REPLIED');
    expect((await onlyJob(a.id, c.contactId)).status).toBe('CANCELLED');
    await makeJobsDue(c.contactId);
    await automationEngine.runDueJobs();
    expect(texts()).toEqual(['quote']);
  });

  it('onTimeout stop marks the run TIMED_OUT without sending', async () => {
    const c = await makeContact(1);
    const a = await run(followUp('stop'), c);

    await makeJobsDue(c.contactId);
    await automationEngine.runDueJobs();
    expect(texts()).toEqual(['quote']);
    expect((await seq(a.id, c.contactId))?.status).toBe('TIMED_OUT');
    expect((await onlyJob(a.id, c.contactId)).status).toBe('DONE');
  });
});

describe('guards when a job fires', () => {
  const actions = [text('g1', 'first'), delayAction('g2'), text('g3', 'second')];

  it('an opted-out contact gets nothing', async () => {
    const c = await makeContact(1);
    const a = await run(actions, c);
    await prisma.contact.update({ where: { id: c.contactId }, data: { status: 'UNSUBSCRIBED' } });

    await makeJobsDue(c.contactId);
    await automationEngine.runDueJobs();
    expect(texts()).toEqual(['first']);
    expect((await onlyJob(a.id, c.contactId)).status).toBe('CANCELLED');
    expect((await seq(a.id, c.contactId))?.status).toBe('STOPPED');
  });

  it('a chat an agent took over gets nothing', async () => {
    const c = await makeContact(1);
    const a = await run(actions, c);
    await prisma.conversation.update({ where: { id: c.conversationId }, data: { automationPaused: true } });

    await makeJobsDue(c.contactId);
    await automationEngine.runDueJobs();
    expect(texts()).toEqual(['first']);
    expect((await onlyJob(a.id, c.contactId)).status).toBe('CANCELLED');
  });

  it('a deactivated automation gets nothing', async () => {
    const c = await makeContact(1);
    const a = await run(actions, c);
    await prisma.automation.update({ where: { id: a.id }, data: { isActive: false } });

    await makeJobsDue(c.contactId);
    await automationEngine.runDueJobs();
    expect(texts()).toEqual(['first']);
    expect((await onlyJob(a.id, c.contactId)).status).toBe('CANCELLED');
  });

  it('quiet hours push the job to the end of the window without counting an attempt', async () => {
    const hhmm = (m: number) => {
      const x = ((m % 1440) + 1440) % 1440;
      return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
    };
    const nowMin = minuteOfDayIn(new Date(), 'Asia/Kolkata');
    await prisma.organizationSettings.create({
      data: {
        organizationId,
        quietHoursEnabled: true,
        quietHoursStart: hhmm(nowMin - 60),
        quietHoursEnd: hhmm(nowMin + 60),
        quietHoursTimezone: 'Asia/Kolkata',
      },
    });

    const c = await makeContact(1);
    const a = await run(actions, c);
    await makeJobsDue(c.contactId);
    await automationEngine.runDueJobs();

    expect(texts()).toEqual(['first']);
    const job = await onlyJob(a.id, c.contactId);
    expect(job).toMatchObject({ status: 'PENDING', attempts: 0, lastError: 'quiet hours' });
    const minutesAhead = (job.runAt.getTime() - Date.now()) / 60_000;
    expect(minutesAhead).toBeGreaterThan(55);
    expect(minutesAhead).toBeLessThanOrEqual(61);
  });

  it('a closed 24h window sends the fallback template, and skips text without one', async () => {
    const c = await makeContact(1, {
      lastCustomerMessageAt: new Date(Date.now() - 30 * HOUR),
      lastMessageAt: new Date(Date.now() - 30 * HOUR),
      windowExpiresAt: new Date(Date.now() - 6 * HOUR),
      isWindowOpen: false,
    });
    await run([
      text('f1', 'hello', { fallbackTemplateId: templateId }),
      text('f2', 'no fallback here'),
    ], c);

    expect(texts()).toEqual([`tpl:${templateName}`]);
  });
});

describe('NO_REPLY trigger', () => {
  it('picks only engaged chats that went silent after our message, once per silence', async () => {
    const now = Date.now();
    const silent = await makeContact(1, {
      lastCustomerMessageAt: new Date(now - 30 * HOUR),
      lastMessageAt: new Date(now - 26 * HOUR),
      windowExpiresAt: new Date(now - 6 * HOUR),
      isWindowOpen: false,
    });
    // campaign recipient who never answered
    await makeContact(2, { lastCustomerMessageAt: null, lastMessageAt: new Date(now - 26 * HOUR), isWindowOpen: false });
    // customer spoke last - it is our turn, not theirs
    await makeContact(3, { lastCustomerMessageAt: new Date(now - 26 * HOUR), lastMessageAt: new Date(now - 26 * HOUR) });
    // silent, but not for 24h yet
    await makeContact(4, { lastCustomerMessageAt: new Date(now - 5 * HOUR), lastMessageAt: new Date(now - 2 * HOUR) });
    // silent for so long it is out of the 7-day look-back
    await makeContact(5, { lastCustomerMessageAt: new Date(now - 20 * 24 * HOUR), lastMessageAt: new Date(now - 19 * 24 * HOUR) });

    const a = await makeAutomation(
      [text('n1', 'still interested?', { fallbackTemplateId: templateId })],
      { trigger: 'NO_REPLY', triggerConfig: { hours: 24 } }
    );

    await automationEngine.triggerNoReply();

    const seqs = await prisma.automationSequence.findMany({ where: { automationId: a.id } });
    expect(seqs.map((s) => s.contactId)).toEqual([silent.contactId]);
    expect(sent).toEqual([{ to: silent.phone, template: templateName }]);

    // Same silence, second scan: nothing new.
    await automationEngine.triggerNoReply();
    expect(sent).toHaveLength(1);
  });
});

describe('TASK_DUE trigger', () => {
  it('notifies the assignee once per due task, not for future tasks', async () => {
    const lead = await prisma.lead.create({ data: { organizationId, title: 'Big deal', assignedToId: userId } });
    const due = await prisma.leadTask.create({
      data: { leadId: lead.id, title: 'Call back', dueDate: new Date(Date.now() - 60_000) },
    });
    const later = await prisma.leadTask.create({
      data: { leadId: lead.id, title: 'Later', dueDate: new Date(Date.now() + HOUR) },
    });

    await automationEngine.triggerTasksDue();
    const forDue = notified.filter((n) => n.metadata?.taskId === due.id);
    expect(forDue).toHaveLength(1);
    expect(forDue[0]).toMatchObject({ userId, type: 'alert' });
    expect(notified.some((n) => n.metadata?.taskId === later.id)).toBe(false);

    await automationEngine.triggerTasksDue();
    expect(notified.filter((n) => n.metadata?.taskId === due.id)).toHaveLength(1);
  });

  it('runs TASK_DUE automations on the lead contact', async () => {
    const c = await makeContact(1);
    const lead = await prisma.lead.create({ data: { organizationId, title: 'Deal', contactId: c.contactId } });
    await prisma.leadTask.create({ data: { leadId: lead.id, title: 'Remind', dueDate: new Date(Date.now() - 60_000) } });
    await makeAutomation([text('d1', 'gentle reminder')], { trigger: 'TASK_DUE' });

    await automationEngine.triggerTasksDue();
    expect(texts()).toEqual(['gentle reminder']);
  });
});

describe('LEAD_STAGE_CHANGED trigger', () => {
  async function setup() {
    const c = await makeContact(1);
    const pipeline = await prisma.pipeline.create({
      data: {
        organizationId,
        name: `P ${SUFFIX}`,
        stages: {
          create: [
            { name: 'New', order: 0 },
            { name: 'Proposal', order: 1 },
            { name: 'Won', order: 2, isWon: true },
          ],
        },
      },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    const [s0, s1, s2] = pipeline.stages;
    const lead = await prisma.lead.create({
      data: { organizationId, title: 'L', contactId: c.contactId, pipelineId: pipeline.id, stageId: s0.id },
    });
    await makeAutomation([text('l1', 'here is your quote')], {
      trigger: 'LEAD_STAGE_CHANGED',
      triggerConfig: { toStageId: s1.id },
    });
    return { lead, s0, s1, s2 };
  }

  it('fires only for the configured target stage', async () => {
    const { lead, s0, s1, s2 } = await setup();

    await automationEngine.triggerLeadStageChanged({ organizationId, leadId: lead.id, fromStageId: s0.id, toStageId: s2.id });
    expect(texts()).toEqual([]);

    await automationEngine.triggerLeadStageChanged({ organizationId, leadId: lead.id, fromStageId: s0.id, toStageId: s1.id });
    expect(texts()).toEqual(['here is your quote']);
  });

  it('crm.updateLead fires it when a lead is moved', async () => {
    const { lead, s1 } = await setup();

    await crmService.updateLead(organizationId, lead.id, userId, { stageId: s1.id });
    await vi.waitFor(() => expect(texts()).toEqual(['here is your quote']), { timeout: 5000 });
  });
});
