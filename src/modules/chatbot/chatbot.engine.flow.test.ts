// WhatsApp chatbot flow against the in-memory session store, with the DB and
// WhatsApp mocked. Before the fix a finished flow restarted on every next
// message (the same welcome/menu again), a Telegram bot could answer
// WhatsApp, and a keyword typed mid-flow did nothing.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, sent } = vi.hoisted(() => ({
  sent: [] as Array<{ kind: string; text: string }>,
  db: {
    chatbot: { findMany: vi.fn(), findFirst: vi.fn() },
    whatsAppAccount: { findFirst: vi.fn() },
    contact: { findFirst: vi.fn() },
  },
}));
vi.mock('../../config/database', () => ({ default: db }));
vi.mock('../whatsapp/whatsapp.service', () => ({
  whatsappService: {
    sendTextMessage: vi.fn(async (_a: string, _to: string, text: string) => {
      sent.push({ kind: 'text', text });
      return {};
    }),
    sendMessage: vi.fn(async (o: any) => {
      sent.push({ kind: 'interactive', text: o.content.interactive.body.text });
      return {};
    }),
    sendMediaMessage: vi.fn(async () => ({})),
  },
}));
vi.mock('./ai.service', () => ({ aiService: {} }));

import { chatbotEngine } from './chatbot.engine';

const flow = {
  nodes: [
    { id: 'start', type: 'start', data: {}, position: { x: 0, y: 0 } },
    {
      id: 'menu', type: 'button', position: { x: 0, y: 0 },
      data: {
        message: 'Choose one',
        buttons: [{ id: 'btn-price', text: 'Price' }, { id: 'btn-support', text: 'Support' }],
      },
    },
    { id: 'price', type: 'message', data: { message: 'Plans start at 999' }, position: { x: 0, y: 0 } },
    { id: 'support', type: 'message', data: { message: 'Support team will call you' }, position: { x: 0, y: 0 } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'menu' },
    { id: 'e2', source: 'menu', target: 'price', sourceHandle: 'btn-price' },
    { id: 'e3', source: 'menu', target: 'support', sourceHandle: 'btn-support' },
  ],
};

const bot = (over: Record<string, any> = {}) => ({
  id: 'bot1', name: 'Main', organizationId: 'org1', channel: 'WHATSAPP', status: 'ACTIVE',
  isDefault: true, triggerKeywords: ['menu'], welcomeMessage: '', fallbackMessage: '',
  flowData: flow, ...over,
});

let conv = 0;
const newConv = () => `conv-${++conv}-${Date.now()}`;
const send = (convId: string, text: string, isNew: boolean) =>
  chatbotEngine.processMessage(convId, 'org1', text, '919800000000', isNew);
const texts = () => sent.map((s) => s.text);

beforeEach(() => {
  sent.length = 0;
  for (const model of Object.values(db)) for (const fn of Object.values(model)) (fn as any).mockReset();
  db.whatsAppAccount.findFirst.mockResolvedValue({ id: 'acc1' });
  db.contact.findFirst.mockResolvedValue(null);
});

describe('chatbot flow', () => {
  it('follows the branch the customer tapped', async () => {
    const b = bot();
    db.chatbot.findMany.mockResolvedValue([b]);
    db.chatbot.findFirst.mockResolvedValue(b);
    const c = newConv();

    await send(c, 'hello', true);
    expect(texts()).toEqual(['Choose one']);

    sent.length = 0;
    await send(c, 'btn-support', false);
    expect(texts()).toEqual(['Support team will call you']);
  });

  it('does not restart a finished flow on the next message of the same chat', async () => {
    const b = bot();
    db.chatbot.findMany.mockResolvedValue([b]);
    db.chatbot.findFirst.mockResolvedValue(b);
    const c = newConv();

    await send(c, 'hello', true);
    await send(c, 'btn-price', false);
    sent.length = 0;

    const handled = await send(c, 'ok thanks', false);
    expect(handled).toBe(false);
    expect(sent).toEqual([]);
  });

  it('typing the bot keyword mid-flow restarts it', async () => {
    const b = bot();
    db.chatbot.findMany.mockResolvedValue([b]);
    db.chatbot.findFirst.mockResolvedValue(b);
    const c = newConv();

    await send(c, 'hello', true);
    await send(c, 'btn-price', false);
    sent.length = 0;

    await send(c, 'Menu', false);
    expect(texts()).toEqual(['Choose one']);
  });

  it('typed text that is not an option sends the fallback, then the options again', async () => {
    const b = bot({ fallbackMessage: 'Please pick an option' });
    db.chatbot.findMany.mockResolvedValue([b]);
    db.chatbot.findFirst.mockResolvedValue(b);
    const c = newConv();

    await send(c, 'hello', true);
    sent.length = 0;
    await send(c, 'something else', false);
    expect(texts()).toEqual(['Please pick an option', 'Choose one']);
  });

  it('only WhatsApp bots are considered', async () => {
    db.chatbot.findMany.mockResolvedValue([]);
    await send(newConv(), 'hello', true);
    expect(db.chatbot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ channel: 'WHATSAPP', status: 'ACTIVE' }) })
    );
    expect(sent).toEqual([]);
  });

  it('a keyword-only bot (Default OFF) stays quiet on other messages', async () => {
    const b = bot({ isDefault: false });
    db.chatbot.findMany.mockResolvedValue([b]);
    db.chatbot.findFirst.mockResolvedValue(b);

    expect(await send(newConv(), 'hello', true)).toBe(false);
    expect(sent).toEqual([]);
  });

  it('ownsReply is true only for an option of the node it is waiting on', async () => {
    const b = bot();
    db.chatbot.findMany.mockResolvedValue([b]);
    db.chatbot.findFirst.mockResolvedValue(b);
    const c = newConv();

    expect(await chatbotEngine.ownsReply('org1', c, 'btn-price')).toBe(false); // no session yet
    await send(c, 'hello', true);
    expect(await chatbotEngine.ownsReply('org1', c, 'btn-price')).toBe(true);
    expect(await chatbotEngine.ownsReply('org1', c, 'automation_btn')).toBe(false);
  });
});
