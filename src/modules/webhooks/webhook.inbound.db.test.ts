/**
 * Inbound WhatsApp message end to end against a real Postgres: Meta webhook
 * payload -> contact/conversation/message saved -> routeInbound -> keyword
 * automation or chatbot reply. Only the outbound WhatsApp send is mocked.
 *
 * Requires the local test DB:
 *   DATABASE_URL=postgresql://...@localhost:5433/wabmeta_test
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { sent } = vi.hoisted(() => ({ sent: [] as Array<{ to: string; text: string }> }));

vi.mock('../whatsapp/whatsapp.service', () => ({
  whatsappService: {
    sendTextMessage: vi.fn(async (_a: string, to: string, text: string) => {
      sent.push({ to, text });
      return {};
    }),
    sendMessage: vi.fn(async (o: any) => {
      sent.push({ to: o.to, text: o.content?.interactive?.body?.text ?? o.content?.text?.body ?? o.type });
      return {};
    }),
    sendMediaMessage: vi.fn(async () => ({})),
    sendTemplateMessage: vi.fn(async () => ({ waMessageId: 'wamid.t' })),
  },
}));
vi.mock('../notifications/webpush.service', () => ({
  webpushService: { sendNotificationToUser: vi.fn(async () => undefined) },
}));

import prisma from '../../config/database';
import { webhookService } from './webhook.service';

const SUFFIX = `inb-${Date.now()}`;
const PNID = `1${Date.now()}`; // >= 10 chars, like a real phone_number_id
let organizationId: string;
let userId: string;

const flow = {
  nodes: [
    { id: 'start', type: 'start', data: {}, position: { x: 0, y: 0 } },
    {
      id: 'menu', type: 'button', position: { x: 0, y: 0 },
      data: { message: 'BOT MENU', buttons: [{ id: 'btn-a', text: 'A' }, { id: 'btn-b', text: 'B' }] },
    },
    { id: 'a', type: 'message', data: { message: 'BOT A' }, position: { x: 0, y: 0 } },
    { id: 'b', type: 'message', data: { message: 'BOT B' }, position: { x: 0, y: 0 } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'menu' },
    { id: 'e2', source: 'menu', target: 'a', sourceHandle: 'btn-a' },
    { id: 'e3', source: 'menu', target: 'b', sourceHandle: 'btn-b' },
  ],
};

let seq = 0;
const payload = (from: string, msg: Record<string, any>) => ({
  object: 'whatsapp_business_account',
  entry: [{
    id: `waba-${SUFFIX}`,
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '10000000010', phone_number_id: PNID },
        contacts: [{ profile: { name: 'Tester' }, wa_id: from }],
        messages: [{
          from, id: `wamid.${SUFFIX}.${++seq}`, timestamp: String(Math.floor(Date.now() / 1000)), ...msg,
        }],
      },
    }],
  }],
});
const text = (from: string, body: string) => payload(from, { type: 'text', text: { body } });
const tap = (from: string, id: string, title: string) =>
  payload(from, { type: 'interactive', interactive: { type: 'button_reply', button_reply: { id, title } } });

/** routeInbound runs in the background; wait until replies stop arriving. */
async function settle(ms = 4000) {
  const start = Date.now();
  let last = -1;
  let stableSince = Date.now();
  while (Date.now() - start < ms) {
    await new Promise((r) => setTimeout(r, 150));
    if (sent.length !== last) { last = sent.length; stableSince = Date.now(); }
    else if (Date.now() - stableSince > 1500) return;
  }
}
const replies = () => sent.map((s) => s.text);
const customer = () => `9198${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }
  userId = (await prisma.user.create({ data: { email: `${SUFFIX}@t.local`, firstName: 'O', status: 'ACTIVE' } })).id;
  organizationId = (await prisma.organization.create({ data: { name: 'Inbound', slug: SUFFIX, ownerId: userId } })).id;
  await prisma.whatsAppAccount.create({
    data: {
      organizationId, phoneNumberId: PNID, wabaId: `waba-${SUFFIX}`, phoneNumber: '+10000000010',
      displayName: 'Inbound', accessToken: 'x', status: 'CONNECTED', isDefault: true,
    } as any,
  });
});

beforeEach(async () => {
  sent.length = 0;
  await prisma.automationSequence.deleteMany({ where: { automation: { organizationId } } });
  await prisma.automation.deleteMany({ where: { organizationId } });
  await prisma.chatbot.deleteMany({ where: { organizationId } });
});

afterAll(async () => {
  if (!organizationId) { await prisma.$disconnect(); return; }
  await prisma.automationJob.deleteMany({ where: { organizationId } }).catch(() => undefined);
  await prisma.automationSequence.deleteMany({ where: { automation: { organizationId } } });
  await prisma.automation.deleteMany({ where: { organizationId } });
  await prisma.chatbot.deleteMany({ where: { organizationId } });
  await prisma.message.deleteMany({ where: { conversation: { organizationId } } });
  await prisma.conversation.deleteMany({ where: { organizationId } });
  await prisma.contact.deleteMany({ where: { organizationId } });
  await prisma.whatsAppAccount.deleteMany({ where: { organizationId } });
  await prisma.organizationSettings.deleteMany({ where: { organizationId } }).catch(() => undefined);
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

const keywordAutomation = (keywords: string[], reply: string) =>
  prisma.automation.create({
    data: {
      organizationId, name: `KW ${reply}`, trigger: 'KEYWORD', isActive: true,
      triggerConfig: { keywords },
      actions: [{ id: 's1', type: 'send_text', config: { message: reply } }],
    } as any,
  });
const chatbot = (over: Record<string, any> = {}) =>
  prisma.chatbot.create({
    data: {
      organizationId, name: 'Main', status: 'ACTIVE', isDefault: true, triggerKeywords: ['menu'],
      flowData: flow as any, createdById: userId, ...over,
    } as any,
  });

describe('inbound WhatsApp end to end', () => {
  it('keyword automation alone answers its keyword', async () => {
    await keywordAutomation(['price'], 'AUTO PRICE');
    await webhookService.handleWebhook(text(customer(), 'price please'));
    await settle();
    expect(replies()).toEqual(['AUTO PRICE']);
  });

  it('default chatbot alone answers the first message and follows a tap', async () => {
    await chatbot();
    const from = customer();
    await webhookService.handleWebhook(text(from, 'hi'));
    await settle();
    expect(replies()).toEqual(['BOT MENU']);

    sent.length = 0;
    await webhookService.handleWebhook(tap(from, 'btn-b', 'B'));
    await settle();
    expect(replies()).toEqual(['BOT B']);
  });

  it('with both on: keyword -> automation only; other text -> chatbot', async () => {
    await keywordAutomation(['price'], 'AUTO PRICE');
    await chatbot();
    const from = customer();

    await webhookService.handleWebhook(text(from, 'price'));
    await settle();
    expect(replies()).toEqual(['AUTO PRICE']);

    sent.length = 0;
    await webhookService.handleWebhook(text(from, 'menu'));
    await settle();
    expect(replies()).toEqual(['BOT MENU']);
  });

  it('an existing customer (messaged earlier today) saying hi after a finished flow gets the default chatbot', async () => {
    await chatbot();
    const from = customer();
    await webhookService.handleWebhook(text(from, 'hello there'));
    await settle();
    await webhookService.handleWebhook(tap(from, 'btn-a', 'A')); // flow ends here
    await settle();
    sent.length = 0;

    await webhookService.handleWebhook(text(from, 'hi'));
    await settle();
    expect(replies()).toEqual(['BOT MENU']);
  });

  it('an existing customer typing an automation keyword mid-flow gets only the automation', async () => {
    await keywordAutomation(['price'], 'AUTO PRICE');
    await chatbot();
    const from = customer();
    await webhookService.handleWebhook(text(from, 'hello'));
    await settle();
    expect(replies()).toEqual(['BOT MENU']);
    sent.length = 0;

    await webhookService.handleWebhook(text(from, 'price?'));
    await settle();
    expect(replies()).toEqual(['AUTO PRICE']);

    // the chatbot is still waiting on its menu, and a tap still works
    sent.length = 0;
    await webhookService.handleWebhook(tap(from, 'btn-b', 'B'));
    await settle();
    expect(replies()).toEqual(['BOT B']);
  });

  it('a keyword-only bot (Default OFF) answers its keyword, not other messages', async () => {
    await chatbot({ isDefault: false });
    const from = customer();
    await webhookService.handleWebhook(text(from, 'hello'));
    await settle();
    expect(replies()).toEqual([]);

    await webhookService.handleWebhook(text(from, 'menu'));
    await settle();
    expect(replies()).toEqual(['BOT MENU']);
  });
});
