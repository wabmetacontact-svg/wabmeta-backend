// Coexistence history and contacts arrive in shapes of their own
// (value.history[].threads[].messages[], value.state_sync[]). Before this
// test the handlers read value.messages / value.contacts, found nothing and
// imported nothing. And history is old: it must not open a closed 24h
// window, count as unread, or be treated as a fresh inbound message.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  whatsAppAccount: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  contact: { findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  conversation: { upsert: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  message: { createMany: vi.fn(), findMany: vi.fn() },
  phoneNumber: { findUnique: vi.fn(), findFirst: vi.fn() },
  subscription: { updateMany: vi.fn() },
}));
vi.mock('../../config/database', () => ({ default: db }));

const recordHistoryProgress = vi.hoisted(() => vi.fn());
vi.mock('../meta/coexistence', () => ({
  recordHistoryProgress: (...a: any[]) => recordHistoryProgress(...a),
}));

const clearCache = vi.hoisted(() => vi.fn());
vi.mock('../inbox/inbox.service', () => ({ inboxService: { clearCache } }));

import { webhookService, webhookEvents } from './webhook.service';

const svc = webhookService as any;
const ACCOUNT = { id: 'acc1', organizationId: 'org1', phoneNumberId: 'pn1', phoneNumber: '919900000000' };
const BUSINESS = '919900000000';
const CUSTOMER = '919812345678';
const payload = { entry: [{ id: 'waba1' }] };
const meta = { display_phone_number: BUSINESS, phone_number_id: 'pn1' };

beforeEach(() => {
  for (const model of Object.values(db)) for (const fn of Object.values(model)) (fn as any).mockReset();
  recordHistoryProgress.mockReset();
  clearCache.mockReset();
  webhookEvents.removeAllListeners();
  db.whatsAppAccount.findUnique.mockResolvedValue(ACCOUNT);
  db.phoneNumber.findUnique.mockResolvedValue(null);
  db.phoneNumber.findFirst.mockResolvedValue(null);
  db.contact.findFirst.mockResolvedValue({ id: 'c1', phone: `+${CUSTOMER}`, firstName: 'Unknown' });
  db.conversation.upsert.mockResolvedValue({ id: 'conv1', lastMessageAt: null, lastCustomerMessageAt: null });
  db.message.createMany.mockImplementation(async ({ data }: any) => ({ count: data.length }));
  db.subscription.updateMany.mockResolvedValue({ count: 0 });
});

const ts = (msAgo: number) => String(Math.floor((Date.now() - msAgo) / 1000));
const DAY = 24 * 60 * 60 * 1000;

describe('history webhook', () => {
  it('imports both directions from threads, without opening an old window', async () => {
    await svc.handleHistorySync(payload, {
      metadata: meta,
      history: [
        {
          metadata: { phase: 1, chunk_order: 1, progress: 50 },
          threads: [
            {
              id: CUSTOMER,
              messages: [
                { from: CUSTOMER, id: 'wamid.in', timestamp: ts(10 * DAY), type: 'text', text: { body: 'Hi' } },
                {
                  from: BUSINESS, id: 'wamid.out', timestamp: ts(9 * DAY), type: 'text',
                  text: { body: 'Hello!' }, history_context: { status: 'READ' },
                },
              ],
            },
          ],
        },
      ],
    });

    // New conversation is created closed and read.
    const upsert = db.conversation.upsert.mock.calls[0][0];
    expect(upsert.create).toMatchObject({ isWindowOpen: false, unreadCount: 0, isRead: true });
    expect(upsert.update).toEqual({});

    const rows = db.message.createMany.mock.calls[0][0].data;
    expect(db.message.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
    expect(rows.map((r: any) => [r.waMessageId, r.direction, r.status, r.content])).toEqual([
      ['wamid.in', 'INBOUND', 'DELIVERED', 'Hi'],
      ['wamid.out', 'OUTBOUND', 'READ', 'Hello!'],
    ]);

    // Last message moves forward, but a 10-day-old customer message keeps the window shut.
    const patch = db.conversation.update.mock.calls[0][0].data;
    expect(patch.lastMessagePreview).toBe('Hello!');
    expect(patch.isWindowOpen).toBeUndefined();
    expect(recordHistoryProgress).toHaveBeenCalledWith('acc1', { phase: 1, progress: 50 });
  });

  it('opens the window only when the customer really wrote in the last 24 hours', async () => {
    await svc.handleHistorySync(payload, {
      metadata: meta,
      history: [{ threads: [{ id: CUSTOMER, messages: [
        { from: CUSTOMER, id: 'wamid.recent', timestamp: ts(2 * 60 * 60 * 1000), type: 'text', text: { body: 'Still there?' } },
      ] }] }],
    });
    const patch = db.conversation.update.mock.calls[0][0].data;
    expect(patch.isWindowOpen).toBe(true);
    expect(new Date(patch.windowExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('does not push back a newer live message', async () => {
    db.conversation.upsert.mockResolvedValue({
      id: 'conv1', lastMessageAt: new Date(), lastCustomerMessageAt: new Date(),
    });
    await svc.handleHistorySync(payload, {
      metadata: meta,
      history: [{ threads: [{ id: CUSTOMER, messages: [
        { from: CUSTOMER, id: 'wamid.old', timestamp: ts(30 * DAY), type: 'text', text: { body: 'old' } },
      ] }] }],
    });
    expect(db.message.createMany).toHaveBeenCalled();
    expect(db.conversation.update).not.toHaveBeenCalled();
  });

  it('records a declined history share (2593109) and imports nothing', async () => {
    await svc.handleHistorySync(payload, {
      metadata: meta,
      history: [{ errors: [{ code: 2593109, title: 'History sync is turned off' }] }],
    });
    expect(recordHistoryProgress).toHaveBeenCalledWith('acc1', { declined: true });
    expect(db.message.createMany).not.toHaveBeenCalled();
  });
});

describe('smb_app_state_sync webhook', () => {
  it('saves added contacts, fills a missing name, ignores removals', async () => {
    await svc.handleSmbStateSync(payload, {
      metadata: meta,
      state_sync: [
        { type: 'contact', action: 'add', contact: { full_name: 'Ravi Kumar', first_name: 'Ravi', phone_number: CUSTOMER } },
        { type: 'contact', action: 'remove', contact: { full_name: 'Gone', phone_number: '919800000001' } },
      ],
    });

    expect(db.contact.findFirst).toHaveBeenCalledTimes(1);
    expect(db.contact.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { firstName: 'Ravi Kumar' } });
  });

  it('keeps a name the CRM already has', async () => {
    db.contact.findFirst.mockResolvedValue({ id: 'c1', phone: `+${CUSTOMER}`, firstName: 'Ravi (VIP)' });
    await svc.handleSmbStateSync(payload, {
      metadata: meta,
      state_sync: [{ type: 'contact', action: 'add', contact: { full_name: 'Ravi', phone_number: CUSTOMER } }],
    });
    expect(db.contact.update).not.toHaveBeenCalled();
  });
});

describe('smb_message_echoes webhook', () => {
  it('saves a reply sent from the phone app as OUTBOUND and pushes it to the Inbox live', async () => {
    const saved = { id: 'm1', waMessageId: 'wamid.echo', direction: 'OUTBOUND', content: 'On my way' };
    db.message.findMany.mockResolvedValue([saved]);
    db.conversation.findUnique.mockResolvedValue({
      id: 'conv1', contact: { id: 'c1', phone: `+${CUSTOMER}`, firstName: 'Ravi', lastName: null },
    });
    const newMessage = vi.fn();
    const conversationUpdated = vi.fn();
    webhookEvents.on('newMessage', newMessage);
    webhookEvents.on('conversationUpdated', conversationUpdated);

    await svc.handleSmbMessageEchoes(payload, {
      metadata: meta,
      message_echoes: [
        { from: BUSINESS, to: CUSTOMER, id: 'wamid.echo', timestamp: ts(1000), type: 'text', text: { body: 'On my way' } },
      ],
    });

    const row = db.message.createMany.mock.calls[0][0].data[0];
    expect(row).toMatchObject({ waMessageId: 'wamid.echo', direction: 'OUTBOUND', status: 'SENT', content: 'On my way' });
    expect(row.metadata.source).toBe('business_app_echo');

    // Replying from the phone means the business has seen the chat.
    expect(db.conversation.update.mock.calls[0][0].data).toMatchObject({ isRead: true, unreadCount: 0 });

    expect(newMessage).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conv1', message: saved }));
    expect(conversationUpdated.mock.calls[0][0].conversation.contact.name).toBe('Ravi');
    await new Promise((r) => setTimeout(r, 0));
    expect(clearCache).toHaveBeenCalledWith('org1');
  });

  it('does not re-emit an echo Meta delivers twice', async () => {
    db.message.createMany.mockResolvedValue({ count: 0 });
    const newMessage = vi.fn();
    webhookEvents.on('newMessage', newMessage);

    await svc.handleSmbMessageEchoes(payload, {
      metadata: meta,
      message_echoes: [{ from: BUSINESS, to: CUSTOMER, id: 'wamid.dup', timestamp: ts(1000), type: 'text', text: { body: 'x' } }],
    });

    expect(newMessage).not.toHaveBeenCalled();
    expect(db.conversation.update).not.toHaveBeenCalled();
  });
});
