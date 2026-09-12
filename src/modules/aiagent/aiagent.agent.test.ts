/**
 * AI agent against a real Postgres: routing guards, the four tools, the
 * server-side high-value handoff, and the dry-run "Try it".
 *
 * Gemini is scripted (runToolTurn mock calls the real tool executor), and
 * WhatsApp / push / AI quota are mocked. Everything else is the real code.
 *
 * Requires the local test DB:
 *   DATABASE_URL=postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  script: {
    calls: [] as Array<{ name: string; args: Record<string, any> }>,
    text: '',
    errorCode: undefined as string | undefined,
  },
  lastOpts: null as any,
  sent: [] as Array<{ to: string; text: string }>,
  notified: [] as any[],
  modelCalls: 0,
}));

vi.mock('../chatbot/ai.service', () => ({
  aiService: {
    runToolTurn: vi.fn(async (opts: any) => {
      h.modelCalls++;
      h.lastOpts = opts;
      const toolCalls = [];
      for (const c of h.script.calls) {
        const result = await opts.onToolCall(c.name, c.args);
        toolCalls.push({ name: c.name, args: c.args, result });
      }
      return { text: h.script.text, toolCalls, errorCode: h.script.errorCode };
    }),
  },
}));

vi.mock('../chatbot/ai.ratelimit', () => ({ consumeAiQuota: vi.fn(async () => true) }));

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
import { aiAgentEngine, HANDOFF_REPLY } from './aiagent.engine';
import { aiAgentService } from './aiagent.service';

const SUFFIX = `aiagent-${Date.now()}`;
let organizationId: string;
let userId: string;
let accountId: string;
let stages: Record<string, string> = {};

let contactId: string;
let conversationId: string;
const PHONE = '+919812345678';

const script = (calls: Array<{ name: string; args: Record<string, any> }>, text = '', errorCode?: string) => {
  h.script = { calls, text, errorCode };
};

const inbound = async (text: string) => {
  const msg = await prisma.message.create({
    data: { conversationId, direction: 'INBOUND', type: 'TEXT', content: text, status: 'DELIVERED' },
  });
  return aiAgentEngine.handleInbound({
    organizationId, conversationId, contactId, phone: PHONE, text,
    whatsappAccountId: accountId, excludeMessageId: msg.id,
  });
};

const setAgent = (data: Record<string, any>) =>
  prisma.aiAgent.upsert({
    where: { organizationId },
    create: { organizationId, isEnabled: true, name: 'Riya', handoffDealAbove: 100000, ...data },
    update: data,
  });

const openLead = () =>
  prisma.lead.findFirst({ where: { organizationId, contactId }, include: { stage: true, tasks: true } });

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }
  const user = await prisma.user.create({
    data: { email: `${SUFFIX}@wabmeta.local`, firstName: 'Owner', status: 'ACTIVE', emailVerified: true },
  });
  userId = user.id;
  const org = await prisma.organization.create({ data: { name: 'Acme Web', slug: SUFFIX, ownerId: userId } });
  organizationId = org.id;
  const wa = await prisma.whatsAppAccount.create({
    data: {
      organizationId, phoneNumberId: `pn-${SUFFIX}`, wabaId: `waba-${SUFFIX}`,
      phoneNumber: '+10000000001', displayName: 'Acme', accessToken: 'x', status: 'CONNECTED',
    },
  });
  accountId = wa.id;
  const pipeline = await prisma.pipeline.create({
    data: {
      organizationId, name: 'Sales', isDefault: true,
      stages: {
        create: [
          { name: 'New Lead', order: 0 },
          { name: 'Qualified', order: 1 },
          { name: 'Proposal', order: 2 },
          { name: 'Won', order: 3, isWon: true },
          { name: 'Lost', order: 4, isLost: true },
        ],
      },
    },
    include: { stages: true },
  });
  stages = Object.fromEntries(pipeline.stages.map((s) => [s.name, s.id]));
  await prisma.knowledgeItem.create({
    data: { organizationId, type: 'PRODUCT', title: 'Business website', content: '5 pages', price: 25000 },
  });
});

beforeEach(async () => {
  h.sent.length = 0;
  h.notified.length = 0;
  h.modelCalls = 0;
  h.lastOpts = null;
  script([], '');

  await prisma.lead.deleteMany({ where: { organizationId } });
  await prisma.message.deleteMany({ where: { conversation: { organizationId } } });
  await prisma.conversation.deleteMany({ where: { organizationId } });
  await prisma.contact.deleteMany({ where: { organizationId } });
  await prisma.aiAgent.deleteMany({ where: { organizationId } });

  const contact = await prisma.contact.create({
    data: { organizationId, phone: PHONE, countryCode: '91', firstName: 'Unknown' },
  });
  contactId = contact.id;
  const conv = await prisma.conversation.create({
    data: {
      organizationId, contactId, channel: 'WHATSAPP', lastCustomerMessageAt: new Date(),
      windowExpiresAt: new Date(Date.now() + 23 * 3600_000), isWindowOpen: true,
    },
  });
  conversationId = conv.id;
});

afterAll(async () => {
  if (!organizationId || !userId) {
    await prisma.$disconnect();
    return;
  }
  await prisma.lead.deleteMany({ where: { organizationId } });
  await prisma.pipeline.deleteMany({ where: { organizationId } });
  await prisma.knowledgeItem.deleteMany({ where: { organizationId } });
  await prisma.aiAgent.deleteMany({ where: { organizationId } });
  await prisma.message.deleteMany({ where: { conversation: { organizationId } } });
  await prisma.conversation.deleteMany({ where: { organizationId } });
  await prisma.contact.deleteMany({ where: { organizationId } });
  await prisma.organizationSettings.deleteMany({ where: { organizationId } });
  await prisma.whatsAppAccount.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('routing guards', () => {
  it('stays silent when the agent is off (or not set up)', async () => {
    expect(await inbound('hi')).toBe(false);
    await setAgent({ isEnabled: false });
    expect(await inbound('hi')).toBe(false);
    expect(h.modelCalls).toBe(0);
    expect(h.sent).toEqual([]);
  });

  it('replies with the model text and a prompt built from the knowledge base', async () => {
    await setAgent({});
    await prisma.message.create({
      data: { conversationId, direction: 'OUTBOUND', type: 'TEXT', content: 'Hello from Acme', status: 'SENT' },
    });
    script([], 'Hi! Our business website is ₹25,000.');

    expect(await inbound('website price?')).toBe(true);
    expect(h.sent).toEqual([{ to: PHONE, text: 'Hi! Our business website is ₹25,000.' }]);
    expect(h.lastOpts.systemPrompt).toContain('- Business website - ₹25,000');
    expect(h.lastOpts.userMessage).toBe('website price?');
    // The current message is the userMessage, never duplicated into history
    expect(JSON.stringify(h.lastOpts.history)).not.toContain('website price?');
    const toolNames = h.lastOpts.tools.map((t: any) => t.name);
    expect(toolNames).toEqual(expect.arrayContaining(['save_customer_details', 'schedule_callback', 'update_lead_stage', 'handoff_to_human']));
  });

  it('stays silent in a chat a person has taken over, and for opted-out contacts', async () => {
    await setAgent({});
    script([], 'should not be sent');
    await prisma.conversation.update({ where: { id: conversationId }, data: { automationPaused: true } });
    expect(await inbound('hello?')).toBe(false);

    await prisma.conversation.update({ where: { id: conversationId }, data: { automationPaused: false } });
    await prisma.contact.update({ where: { id: contactId }, data: { status: 'UNSUBSCRIBED' } });
    expect(await inbound('hello?')).toBe(false);
    expect(h.sent).toEqual([]);
  });
});

describe('tools', () => {
  it('save_customer_details fills the contact and creates a scored lead', async () => {
    await setAgent({});
    script([{
      name: 'save_customer_details',
      args: { name: 'Priya Sharma', city: 'Pune', service_interest: 'Business website', budget_amount: 40000, interest_level: 'hot' },
    }], 'Thanks Priya!');

    await inbound('I am Priya from Pune, need a website, budget 40k');

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    expect(contact).toMatchObject({ firstName: 'Priya', lastName: 'Sharma' });
    const lead = await openLead();
    expect(lead).toMatchObject({ source: 'ai_agent', score: 80, city: 'Pune', budget: '₹40,000', serviceInterest: 'Business website' });
    expect(lead?.stage?.name).toBe('New Lead');
    expect(h.sent[0].text).toBe('Thanks Priya!');
  });

  it('a budget above the threshold hands off on the server, even if the model does not', async () => {
    await setAgent({});
    script([{ name: 'save_customer_details', args: { budget_amount: 150000, service_interest: 'App' } }], '');

    await inbound('budget is 1.5 lakh');

    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    expect(conv).toMatchObject({ automationPaused: true, aiHandoffReason: 'high_value' });
    // (the CRM also sends its own "new lead" notification for the new lead)
    const handoffAlerts = h.notified.filter((n) => n.type === 'alert');
    expect(handoffAlerts).toHaveLength(1);
    expect(handoffAlerts[0]).toMatchObject({ userId, title: '🙋 Customer needs a person' });
    expect(h.sent).toEqual([{ to: PHONE, text: HANDOFF_REPLY }]);

    // Paused now: the next message gets no AI reply
    expect(await inbound('hello?')).toBe(false);
  });

  it('update_lead_stage moves the lead but never to Won/Lost', async () => {
    await setAgent({});
    script([{ name: 'update_lead_stage', args: { stage: 'proposal' } }], 'Sending the proposal!');
    await inbound('please send a quote');
    expect((await openLead())?.stageId).toBe(stages['Proposal']);

    script([{ name: 'update_lead_stage', args: { stage: 'Won' } }], 'ok');
    await inbound('done deal');
    expect(h.lastOpts).toBeTruthy();
    expect((await openLead())?.stageId).toBe(stages['Proposal']);
  });

  it('schedule_callback creates a task at the right time and refuses a time without an offset', async () => {
    await setAgent({});
    const when = new Date(Date.now() + 26 * 3600_000);
    const iso = new Date(when.getTime() + 5.5 * 3600_000).toISOString().replace('Z', '+05:30');

    script([{ name: 'schedule_callback', args: { when: iso, note: 'discuss pricing' } }], 'Done, we will call you.');
    await inbound('call me tomorrow');
    const lead = await openLead();
    expect(lead?.tasks).toHaveLength(1);
    expect(lead?.tasks[0].title).toContain('discuss pricing');
    expect(Math.abs(lead!.tasks[0].dueDate!.getTime() - when.getTime())).toBeLessThan(1000);

    script([{ name: 'schedule_callback', args: { when: '2027-01-01T10:00:00' } }], 'ok');
    await inbound('and another call');
    expect((await openLead())?.tasks).toHaveLength(1);
  });

  it('handoff_to_human pauses the chat, notes the lead, and notifies', async () => {
    await setAgent({});
    script([{ name: 'save_customer_details', args: { name: 'Ravi' } }], 'noted');
    await inbound('I am Ravi');

    script([{ name: 'handoff_to_human', args: { reason: 'complaint', summary: 'Site is down, wants refund' } }], 'Sorry! Our team will reply shortly.');
    await inbound('your site is broken, I want a refund');

    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    expect(conv).toMatchObject({ automationPaused: true, aiHandoffReason: 'complaint' });
    const notes = await prisma.leadNote.findMany({ where: { lead: { organizationId, contactId } } });
    expect(notes.some((n) => n.content.includes('Site is down, wants refund'))).toBe(true);
    expect(h.notified.at(-1)?.description).toContain('Ravi');
  });

  it('a handoff reason the owner switched off is refused', async () => {
    await setAgent({ handoffOnComplaint: false });
    script([{ name: 'handoff_to_human', args: { reason: 'complaint', summary: 'angry' } }], 'I understand, let me help.');
    await inbound('this is bad');
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    expect(conv?.automationPaused).toBe(false);
    expect(h.sent.at(-1)?.text).toBe('I understand, let me help.');
  });
});

describe('Try it (dry run)', () => {
  it('runs the tools without writing anything', async () => {
    await setAgent({ isEnabled: false }); // works before the agent is switched on
    script([
      { name: 'save_customer_details', args: { name: 'Test', budget_amount: 200000 } },
      { name: 'schedule_callback', args: { when: new Date(Date.now() + 86_400_000).toISOString() } },
    ], '');

    const before = await prisma.lead.count({ where: { organizationId } });
    const result = await aiAgentService.test(organizationId, {
      messages: [
        { role: 'user', text: 'hi' },
        { role: 'assistant', text: 'Hello! How can I help?' },
        { role: 'user', text: 'I need an app, budget 2 lakh' },
      ],
    });

    expect(result.handoff).toBe('high_value');
    expect(result.reply).toBe(HANDOFF_REPLY);
    expect(result.toolCalls.map((t) => t.result.dryRun)).toEqual([true, true]);
    expect(await prisma.lead.count({ where: { organizationId } })).toBe(before);
    expect((await prisma.conversation.findUnique({ where: { id: conversationId } }))?.automationPaused).toBe(false);
    expect(h.sent).toEqual([]);
    expect(h.notified).toEqual([]);
  });

  it('explains a broken AI key instead of returning an empty reply', async () => {
    script([], '', 'KEY_INVALID');
    await expect(aiAgentService.test(organizationId, { messages: [{ role: 'user', text: 'hi' }] }))
      .rejects.toThrow(/Gemini API key is missing or invalid/);

    script([], '', 'FAILED');
    await expect(aiAgentService.test(organizationId, { messages: [{ role: 'user', text: 'hi' }] }))
      .rejects.toThrow(/did not answer/);
  });

  it('validates its input', async () => {
    await expect(aiAgentService.test(organizationId, { messages: [] })).rejects.toThrow(/1-40/);
    await expect(aiAgentService.test(organizationId, { messages: [{ role: 'assistant', text: 'hi' }] }))
      .rejects.toThrow(/last message must be from the customer/);
  });
});

describe('settings and knowledge validation', () => {
  it('rejects bad settings', async () => {
    await expect(aiAgentService.updateSettings(organizationId, { timezone: 'Mars/Base' })).rejects.toThrow(/IANA/);
    await expect(aiAgentService.updateSettings(organizationId, { handoffDealAbove: -5 })).rejects.toThrow(/whole amount/);
    await expect(aiAgentService.updateSettings(organizationId, { notifyUserId: 'someone-else' })).rejects.toThrow(/member/);
    const ok = await aiAgentService.updateSettings(organizationId, { isEnabled: true, name: 'Riya', handoffDealAbove: '' });
    expect(ok).toMatchObject({ isEnabled: true, name: 'Riya', handoffDealAbove: null });
  });

  it('rejects bad knowledge items', async () => {
    await expect(aiAgentService.createKnowledge(organizationId, { type: 'FAQ', title: 'Refunds?' })).rejects.toThrow(/answer/);
    await expect(aiAgentService.createKnowledge(organizationId, { type: 'BLOG', title: 'x' })).rejects.toThrow(/PRODUCT or FAQ/);
    await expect(aiAgentService.createKnowledge(organizationId, { type: 'PRODUCT', title: 'x', price: -1 })).rejects.toThrow(/price/);
    await expect(aiAgentService.deleteKnowledge(organizationId, 'nope')).rejects.toThrow(/not found/);
  });
});
