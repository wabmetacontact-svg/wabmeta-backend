// Who answers an inbound WhatsApp message. Before this, keyword automations
// and the chatbot ran side by side on every message, so a customer who typed
// an automation keyword got the chatbot's menu as well (or only the menu).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  message: { findFirst: vi.fn() },
}));
vi.mock('../../config/database', () => ({ default: db }));

const chatbot = vi.hoisted(() => ({
  processMessage: vi.fn(),
  ownsReply: vi.fn(),
}));
vi.mock('../chatbot/chatbot.engine', () => ({ chatbotEngine: chatbot }));

const automation = vi.hoisted(() => ({
  onInboundMessage: vi.fn(),
  matchKeywordAutomations: vi.fn(),
  runKeywordAutomations: vi.fn(),
  triggerUnknownMessage: vi.fn(),
  triggerMediaReceived: vi.fn(),
  triggerNewContact: vi.fn(),
}));
vi.mock('../automation/automation.engine', () => ({ automationEngine: automation }));

vi.mock('../admin/orgControl', async (orig) => ({
  ...(await orig<any>()),
  orgCanSend: vi.fn(async () => true),
}));

const aiAgent = vi.hoisted(() => ({ handleInbound: vi.fn() }));
vi.mock('../aiagent/aiagent.engine', () => ({ aiAgentEngine: aiAgent }));

import { webhookService } from './webhook.service';

const svc = webhookService as any;
const HOUR = 60 * 60 * 1000;

const route = (over: Record<string, any> = {}) =>
  svc.routeInbound({
    wasNewlyCreated: false,
    organizationId: 'org1',
    contact: { id: 'c1' },
    content: 'hello',
    waFrom: '919800000000',
    conversation: { id: 'conv1', automationPaused: false, unreadCount: 1 },
    message: {},
    msgType: 'TEXT',
    whatsappAccountId: 'acc1',
    savedMessageId: 'm-now',
    ...over,
  });

beforeEach(() => {
  for (const fn of [
    ...Object.values(chatbot), ...Object.values(automation), aiAgent.handleInbound, db.message.findFirst,
  ]) (fn as any).mockReset();
  chatbot.processMessage.mockResolvedValue(true);
  chatbot.ownsReply.mockResolvedValue(false);
  automation.onInboundMessage.mockResolvedValue(false);
  automation.matchKeywordAutomations.mockResolvedValue([]);
  automation.runKeywordAutomations.mockResolvedValue(true);
  automation.triggerUnknownMessage.mockResolvedValue(false);
  automation.triggerMediaReceived.mockResolvedValue(false);
  automation.triggerNewContact.mockResolvedValue(false);
  db.message.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - HOUR) });
});

describe('routeInbound', () => {
  it('a keyword automation takes the message; the chatbot stays quiet', async () => {
    const kw = { id: 'a1', name: 'Price reply' };
    automation.matchKeywordAutomations.mockResolvedValue([kw]);

    await route({ content: 'price' });

    expect(automation.runKeywordAutomations).toHaveBeenCalledWith([kw], expect.objectContaining({ message: 'price' }));
    expect(chatbot.processMessage).not.toHaveBeenCalled();
    expect(aiAgent.handleInbound).not.toHaveBeenCalled();
  });

  it('without a keyword the chatbot answers', async () => {
    await route({ content: 'hello' });
    expect(chatbot.processMessage).toHaveBeenCalledTimes(1);
    expect(automation.runKeywordAutomations).not.toHaveBeenCalled();
  });

  it('a reply that resumes an automation waiting for it keeps the chatbot quiet', async () => {
    automation.onInboundMessage.mockResolvedValue(true);
    await route({ content: 'yes' });
    expect(chatbot.processMessage).not.toHaveBeenCalled();
  });

  it("a tap on the chatbot's own button goes to the chatbot, not to keyword automations", async () => {
    chatbot.ownsReply.mockResolvedValue(true);
    automation.matchKeywordAutomations.mockResolvedValue([{ id: 'a1' }]);

    await route({
      content: 'Price',
      msgType: 'INTERACTIVE',
      message: { interactive: { type: 'button_reply', button_reply: { id: 'btn-price', title: 'Price' } } },
    });

    expect(automation.matchKeywordAutomations).not.toHaveBeenCalled();
    expect(automation.onInboundMessage).toHaveBeenCalledWith(expect.objectContaining({ resume: false }));
    expect(chatbot.processMessage).toHaveBeenCalledWith('conv1', 'org1', 'btn-price', '919800000000', false, expect.anything());
  });

  it('a chat is "new" for the chatbot only when the last customer message is over 24h old', async () => {
    await route();
    expect(chatbot.processMessage.mock.calls[0][4]).toBe(false);

    chatbot.processMessage.mockClear();
    db.message.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 25 * HOUR) });
    await route();
    expect(chatbot.processMessage.mock.calls[0][4]).toBe(true);

    chatbot.processMessage.mockClear();
    db.message.findFirst.mockResolvedValue(null);
    await route();
    expect(chatbot.processMessage.mock.calls[0][4]).toBe(true);
  });

  it('an agent-paused chat gets automations but no chatbot', async () => {
    automation.matchKeywordAutomations.mockResolvedValue([]);
    await route({ conversation: { id: 'conv1', automationPaused: true } });
    expect(chatbot.processMessage).not.toHaveBeenCalled();
    expect(automation.triggerUnknownMessage).toHaveBeenCalled();
  });
});
