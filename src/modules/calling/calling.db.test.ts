/**
 * WhatsApp Calling against the real database: the call record, the claim on
 * who answers, missed-call notifications and the permission gate. Meta, the
 * socket and notifications are stubbed; everything else is real.
 *
 * Requires the local throwaway database (see src/test/guard-test-db.ts).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const meta = vi.hoisted(() => ({
  callAction: vi.fn(),
  getCallPermission: vi.fn(),
  getCallingSettings: vi.fn(),
}));
vi.mock('../meta/meta.api', () => ({ metaApi: meta }));
vi.mock('../meta/meta.service', () => ({
  metaService: { getAccountWithToken: vi.fn(async () => ({ accessToken: 'token' })) },
}));

const emitted = vi.hoisted(() => [] as { room: string; event: string; data: any }[]);
vi.mock('../../socket', () => ({
  getIO: () => ({ to: (room: string) => ({ emit: (event: string, data: any) => emitted.push({ room, event, data }) }) }),
}));

const notify = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock('../notifications/notifications.service', () => ({ notificationsService: { notifyOrganization: notify, sendCallPush: push } }));
const pushesOf = (type: string) => push.mock.calls.filter((c) => c[1]?.type === type);

import { PrismaClient } from '@prisma/client';
import { callingService } from './calling.service';

const prisma = new PrismaClient();
const SUFFIX = `call-${Date.now()}`;
const PHONE_NUMBER_ID = `pn-${SUFFIX}`;
const CUSTOMER = '919812345678';

let organizationId: string;
let ownerId: string;
let agentId: string;

const callId = (n: string) => `wacid.${SUFFIX}.${n}`;
const incoming = (id: string) =>
  callingService.handleCallsWebhook({
    metadata: { phone_number_id: PHONE_NUMBER_ID },
    calls: [{ id, from: CUSTOMER, to: '919900000000', event: 'connect', direction: 'USER_INITIATED', session: { sdp_type: 'offer', sdp: 'v=0 offer' } }],
  });
const terminate = (id: string, direction: string, duration?: number) =>
  callingService.handleCallsWebhook({
    metadata: { phone_number_id: PHONE_NUMBER_ID },
    calls: [{ id, from: CUSTOMER, to: '919900000000', event: 'terminate', direction, status: duration ? 'Completed' : 'Failed', ...(duration && { duration }) }],
  });

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must point at the local test database on port 5433.');
  }
  const owner = await prisma.user.create({ data: { email: `owner-${SUFFIX}@wabmeta.local`, firstName: 'Owner', status: 'ACTIVE', emailVerified: true } });
  const agent = await prisma.user.create({ data: { email: `agent-${SUFFIX}@wabmeta.local`, firstName: 'Agent', status: 'ACTIVE', emailVerified: true } });
  ownerId = owner.id;
  agentId = agent.id;
  const org = await prisma.organization.create({ data: { name: `Calls ${SUFFIX}`, slug: SUFFIX, ownerId } });
  organizationId = org.id;
  await prisma.organizationMember.createMany({
    data: [
      { organizationId, userId: ownerId, role: 'OWNER' },
      { organizationId, userId: agentId, role: 'MEMBER' },
    ],
  });
  await prisma.whatsAppAccount.create({
    data: {
      organizationId, phoneNumberId: PHONE_NUMBER_ID, wabaId: `waba-${SUFFIX}`, phoneNumber: '+919900000000',
      displayName: 'Test', status: 'CONNECTED', isActive: true, messagingLimit: 'TIER_2K',
    },
  });
});

beforeEach(async () => {
  emitted.length = 0;
  notify.mockReset();
  push.mockReset();
  for (const fn of Object.values(meta)) fn.mockReset();
  meta.callAction.mockResolvedValue({ callId: null, success: true });
  await prisma.callLog.deleteMany({ where: { organizationId } });
});

afterAll(async () => {
  if (!organizationId) {
    await prisma.$disconnect();
    return;
  }
  await prisma.callLog.deleteMany({ where: { organizationId } });
  await prisma.conversation.deleteMany({ where: { organizationId } });
  await prisma.contact.deleteMany({ where: { organizationId } });
  await prisma.whatsAppAccount.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, agentId].filter(Boolean) } } });
  await prisma.$disconnect();
});

describe("a customer's call", () => {
  it('rings every agent with the SDP offer and is recorded once', async () => {
    await incoming(callId('a'));
    await incoming(callId('a')); // Meta re-delivery

    const logs = await prisma.callLog.findMany({ where: { organizationId } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ direction: 'INBOUND', status: 'RINGING', offerSdp: 'v=0 offer', from: CUSTOMER });
    expect(logs[0].contactId).toBeTruthy();

    const ring = emitted.filter((e) => e.event === 'call:incoming');
    expect(ring).toHaveLength(1);
    expect(ring[0]).toMatchObject({ room: `org:${organizationId}`, data: { callId: callId('a'), sdp: 'v=0 offer' } });
    expect(await callingService.getActiveCalls(organizationId)).toHaveLength(1);

    // One push rings every member's phone
    await vi.waitFor(() => expect(pushesOf('incoming_call')).toHaveLength(1));
    const [userIds, data, alert] = pushesOf('incoming_call')[0];
    expect([...userIds].sort()).toEqual([ownerId, agentId].sort());
    expect(data).toMatchObject({ callId: callId('a'), callerName: `+${CUSTOMER}`, startedAt: logs[0].startedAt.toISOString() });
    expect(alert).toMatchObject({ title: '📞 Incoming WhatsApp call' });
  });

  it('is answered by exactly one agent when two press Accept together', async () => {
    await incoming(callId('b'));
    const results = await Promise.allSettled([
      callingService.acceptCall({ organizationId, userId: ownerId, callId: callId('b'), sdp: 'v=0 answer-1' }),
      callingService.acceptCall({ organizationId, userId: agentId, callId: callId('b'), sdp: 'v=0 answer-2' }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason.statusCode).toBe(409);

    // Meta heard pre_accept then accept, from the winner only
    expect(meta.callAction.mock.calls.map((c) => c[2].action)).toEqual(['pre_accept', 'accept']);
    const log = await prisma.callLog.findUniqueOrThrow({ where: { callId: callId('b') } });
    expect(log.status).toBe('ANSWERED');
    expect(log.offerSdp).toBeNull();
    expect(emitted.some((e) => e.event === 'call:answered')).toBe(true);
    // The loser's phone stops ringing
    await vi.waitFor(() => expect(pushesOf('call_ended')).toHaveLength(1));
    expect(pushesOf('call_ended')[0][1]).toEqual({ type: 'call_ended', callId: callId('b') });
  });

  it('ends completed with its duration after being answered', async () => {
    await incoming(callId('c'));
    await callingService.acceptCall({ organizationId, userId: agentId, callId: callId('c'), sdp: 'v=0 answer' });
    await terminate(callId('c'), 'USER_INITIATED', 95);

    const log = await prisma.callLog.findUniqueOrThrow({ where: { callId: callId('c') } });
    expect(log).toMatchObject({ status: 'COMPLETED', duration: 95, answeredById: agentId });
    expect(notify).not.toHaveBeenCalled();
  });

  it('is a missed call, with a notification, when nobody answers', async () => {
    await incoming(callId('d'));
    await terminate(callId('d'), 'USER_INITIATED');

    expect((await prisma.callLog.findUniqueOrThrow({ where: { callId: callId('d') } })).status).toBe('MISSED');
    expect(notify).toHaveBeenCalledWith(organizationId, expect.objectContaining({ title: 'Missed WhatsApp call' }));
    expect(emitted.find((e) => e.event === 'call:ended')?.data).toMatchObject({ status: 'MISSED' });
    await vi.waitFor(() => expect(pushesOf('call_ended')).toHaveLength(1));
  });

  it('can be declined', async () => {
    await incoming(callId('e'));
    await callingService.rejectCall({ organizationId, userId: agentId, callId: callId('e') });
    expect(meta.callAction.mock.calls[0][2]).toEqual({ action: 'reject', callId: callId('e') });
    expect((await prisma.callLog.findUniqueOrThrow({ where: { callId: callId('e') } })).status).toBe('REJECTED');
    await vi.waitFor(() => expect(pushesOf('call_ended')).toHaveLength(1));
  });
});

describe('calling a customer', () => {
  it('needs the customer’s permission first', async () => {
    meta.getCallPermission.mockResolvedValue({ status: 'no_permission', expiresAt: null, canStartCall: false, canSendRequest: true });
    await expect(
      callingService.startCall({ organizationId, userId: agentId, to: CUSTOMER, sdp: 'v=0 offer' })
    ).rejects.toMatchObject({ statusCode: 409, code: 'CALL_PERMISSION_REQUIRED' });
    expect(meta.callAction).not.toHaveBeenCalled();
  });

  it('connects with the SDP offer, then follows Meta’s statuses to completion', async () => {
    meta.getCallPermission.mockResolvedValue({ status: 'temporary', expiresAt: null, canStartCall: true, canSendRequest: false });
    meta.callAction.mockResolvedValue({ callId: callId('f'), success: true });

    const { callId: id } = await callingService.startCall({ organizationId, userId: agentId, to: `+${CUSTOMER}`, sdp: 'v=0 offer' });
    expect(meta.callAction.mock.calls[0][2]).toMatchObject({ action: 'connect', to: CUSTOMER, sdp: 'v=0 offer' });
    expect((await prisma.callLog.findUniqueOrThrow({ where: { callId: id } })).status).toBe('CALLING');

    const status = (s: string) =>
      callingService.handleCallsWebhook({ metadata: { phone_number_id: PHONE_NUMBER_ID }, statuses: [{ id, type: 'call', status: s, recipient_id: CUSTOMER }] });
    await status('RINGING');
    expect((await prisma.callLog.findUniqueOrThrow({ where: { callId: id } })).status).toBe('RINGING');

    // Meta's SDP answer goes to the browser that placed the call
    await callingService.handleCallsWebhook({
      metadata: { phone_number_id: PHONE_NUMBER_ID },
      calls: [{ id, from: '919900000000', to: CUSTOMER, event: 'connect', direction: 'BUSINESS_INITIATED', session: { sdp_type: 'answer', sdp: 'v=0 answer' } }],
    });
    expect(emitted.find((e) => e.event === 'call:answer-sdp')?.data).toEqual({ callId: id, sdp: 'v=0 answer' });

    await status('ACCEPTED');
    await terminate(id, 'BUSINESS_INITIATED', 42);
    expect(await prisma.callLog.findUniqueOrThrow({ where: { callId: id } })).toMatchObject({ status: 'COMPLETED', duration: 42 });
  });
});
