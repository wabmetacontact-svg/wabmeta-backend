// src/modules/calling/calling.service.ts
//
// WhatsApp Cloud API Calling.
//
// The voice itself never touches this server. The agent's browser runs WebRTC
// and produces the SDP; this service carries it to Meta (POST /{phone}/calls)
// and carries Meta's side back over the socket. What lives here is the record
// (CallLog), the claim on who answers, and the translation of Meta's webhooks.
//
//   Customer calls us:  webhook connect (SDP offer) -> call:incoming to the org
//                       -> an agent accepts (pre_accept + accept, SDP answer)
//                       -> webhook terminate -> call:ended
//   We call a customer: permission check -> connect (SDP offer) -> webhook
//                       status RINGING / ACCEPTED / REJECTED + connect (SDP
//                       answer) -> webhook terminate
//
// Meta docs: developers.facebook.com/docs/whatsapp/cloud-api/calling

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { metaApi } from '../meta/meta.api';
import { metaService } from '../meta/meta.service';
import { tierDailyLimit } from '../meta/accountView';
import { isWindowOpen } from '../automation/automation.timing';

/** Meta: calling needs a daily messaging limit of at least 2,000 unique recipients. */
export const CALLING_MIN_DAILY_LIMIT = 2000;

/** Meta: business-initiated calls are unavailable for numbers from these countries. */
const OUTBOUND_BLOCKED_PREFIXES: { prefix: string; country: string }[] = [
  { prefix: '1', country: 'the US and Canada' },
  { prefix: '20', country: 'Egypt' },
  { prefix: '84', country: 'Vietnam' },
  { prefix: '234', country: 'Nigeria' },
];

/** Meta gives the business 30-60 seconds to answer before the call drops. */
export const RING_WINDOW_MS = 60_000;

// ─── Webhook parsing (pure) ───────────────────────────────────────────────────

export type CallWebhookEvent =
  | {
      kind: 'connect';
      callId: string;
      direction: string; // USER_INITIATED | BUSINESS_INITIATED
      from: string | null;
      to: string | null;
      sdpType: string | null;
      sdp: string | null;
    }
  | {
      kind: 'terminate';
      callId: string;
      direction: string;
      from: string | null;
      to: string | null;
      metaStatus: string | null; // Completed | Failed
      duration: number | null;
    }
  | { kind: 'status'; callId: string; status: string; recipientId: string | null };

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : v == null ? null : String(v));

/** Meta's `calls` webhook value into events: value.calls[] and value.statuses[] (type "call"). */
export const parseCallsWebhook = (value: any): CallWebhookEvent[] => {
  const events: CallWebhookEvent[] = [];

  for (const c of Array.isArray(value?.calls) ? value.calls : []) {
    const callId = str(c?.id);
    if (!callId) continue;
    const event = String(c.event || '').toLowerCase();
    if (event === 'connect') {
      events.push({
        kind: 'connect',
        callId,
        direction: String(c.direction || '').toUpperCase(),
        from: str(c.from),
        to: str(c.to),
        sdpType: str(c.session?.sdp_type),
        sdp: str(c.session?.sdp),
      });
    } else if (event === 'terminate') {
      const duration = Number(c.duration);
      events.push({
        kind: 'terminate',
        callId,
        direction: String(c.direction || '').toUpperCase(),
        from: str(c.from),
        to: str(c.to),
        metaStatus: str(c.status),
        duration: Number.isFinite(duration) ? duration : null,
      });
    }
  }

  for (const s of Array.isArray(value?.statuses) ? value.statuses : []) {
    if (s?.type !== 'call' || !s.id) continue;
    events.push({ kind: 'status', callId: String(s.id), status: String(s.status || '').toUpperCase(), recipientId: str(s.recipient_id) });
  }

  return events;
};

/** How a call ended, from what we knew of it and Meta's terminate webhook. */
export const terminalStatus = (
  current: string,
  direction: 'INBOUND' | 'OUTBOUND',
  answered: boolean,
  metaStatus?: string | null
): string => {
  if (answered) return 'COMPLETED';
  if (current === 'REJECTED') return 'REJECTED';
  if (direction === 'OUTBOUND' && current === 'CALLING' && /fail/i.test(metaStatus || '')) return 'FAILED';
  return direction === 'INBOUND' ? 'MISSED' : 'NOT_ANSWERED';
};

/** Whether this number can use calling, per Meta's rules. */
export const callingEligibility = (account: { messagingLimit?: string | null; phoneNumber?: string | null }) => {
  const dailyLimit = tierDailyLimit(account.messagingLimit);
  const meetsLimit = !account.messagingLimit
    ? null // tier not synced yet: unknown
    : dailyLimit === null || dailyLimit >= CALLING_MIN_DAILY_LIMIT;
  const digits = String(account.phoneNumber || '').replace(/[^0-9]/g, '');
  const blocked = OUTBOUND_BLOCKED_PREFIXES.find((b) => digits.startsWith(b.prefix));
  return {
    messagingLimit: account.messagingLimit ?? null,
    dailyLimit,
    minimumDailyLimit: CALLING_MIN_DAILY_LIMIT,
    meetsLimit,
    outboundAvailable: !blocked,
    outboundBlockedReason: blocked ? `Meta does not allow businesses to call customers from numbers in ${blocked.country}.` : null,
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const digitsOf = (phone?: string | null) => String(phone || '').replace(/[^0-9]/g, '');

const emitToOrg = async (organizationId: string, event: string, data: unknown) => {
  try {
    const { getIO } = await import('../../socket');
    getIO().to(`org:${organizationId}`).emit(event, data);
  } catch (e: any) {
    console.warn(`[Calling] Could not emit ${event}:`, e?.message);
  }
};

/** Meta's error, in words an agent can act on. */
const toCallError = (err: any, fallback: string): AppError => {
  if (err instanceof AppError) return err;
  const meta = err?.metaError;
  if (meta?.code === 190) {
    return new AppError('The WhatsApp access token has expired. Reconnect your number in Settings.', 401);
  }
  const detail = meta?.error_user_msg || meta?.error_data?.details || meta?.message || err?.message || fallback;
  return new AppError(`WhatsApp Calling: ${detail}`, 400);
};

const contactName = (c: { firstName?: string | null; lastName?: string | null; whatsappProfileName?: string | null; phone?: string | null } | null) => {
  if (!c) return null;
  const name = [c.firstName, c.lastName].filter((x) => x && x !== 'Unknown').join(' ');
  return name || (c.whatsappProfileName && c.whatsappProfileName !== 'Unknown' ? c.whatsappProfileName : null) || c.phone || null;
};

const accountForOrg = async (organizationId: string, whatsappAccountId?: string) => {
  const account =
    (whatsappAccountId &&
      (await prisma.whatsAppAccount.findFirst({ where: { id: whatsappAccountId, organizationId } }))) ||
    (await prisma.whatsAppAccount.findFirst({
      where: { organizationId, status: 'CONNECTED' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    }));
  if (!account) throw new AppError('No WhatsApp number is connected. Connect one in Settings first.', 400);
  return account;
};

const tokenFor = async (accountId: string) => {
  const withToken = await metaService.getAccountWithToken(accountId);
  if (!withToken?.accessToken) {
    throw new AppError('Could not read the WhatsApp access token. Reconnect your number in Settings.', 500);
  }
  return withToken.accessToken as string;
};

const ACTIVE_STATUSES = ['RINGING', 'ANSWERING', 'ANSWERED', 'CALLING'];

/**
 * The template WabMeta submits to ask a customer for call permission outside
 * the 24-hour window. Meta's template sync does not keep the
 * call_permission_request component, so the name is how we recognise it.
 */
export const CALL_PERMISSION_TEMPLATE = 'wabmeta_call_permission';
const CALL_PERMISSION_BODY =
  'Hello! Our team would like to call you on WhatsApp about your enquiry. Tap Allow below so we can call you.';

/** This number's call permission templates, newest first. */
const permissionTemplates = (organizationId: string, whatsappAccountId: string) =>
  prisma.template.findMany({
    where: { organizationId, whatsappAccountId, name: { startsWith: CALL_PERMISSION_TEMPLATE } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, language: true, status: true, category: true, rejectionReason: true, bodyText: true },
  });

// ─── Service ──────────────────────────────────────────────────────────────────

export const callingService = {
  /** Meta's `calls` webhook. Never throws: a webhook must always be acknowledged. */
  async handleCallsWebhook(value: any) {
    const phoneNumberId = value?.metadata?.phone_number_id;
    const events = parseCallsWebhook(value);
    if (!phoneNumberId || events.length === 0) return;

    const account = await prisma.whatsAppAccount.findFirst({ where: { phoneNumberId } });
    if (!account) {
      console.warn(`[Calling] Webhook for unknown phone number ${phoneNumberId}`);
      return;
    }
    const organizationId = account.organizationId;

    for (const ev of events) {
      try {
        if (ev.kind === 'connect' && ev.direction === 'USER_INITIATED') {
          await this.onIncomingCall(organizationId, account, ev);
        } else if (ev.kind === 'connect') {
          // Our call: Meta's SDP answer, for the browser that placed it.
          if (ev.sdp) await emitToOrg(organizationId, 'call:answer-sdp', { callId: ev.callId, sdp: ev.sdp });
        } else if (ev.kind === 'status') {
          await this.onStatus(organizationId, ev.callId, ev.status);
        } else if (ev.kind === 'terminate') {
          await this.onTerminate(organizationId, account, ev);
        }
      } catch (e: any) {
        console.error(`[Calling] Webhook ${ev.kind} ${ev.callId} failed:`, e?.message);
      }
    }
  },

  async onIncomingCall(organizationId: string, account: any, ev: Extract<CallWebhookEvent, { kind: 'connect' }>) {
    const from = digitsOf(ev.from);
    let contact: any = null;
    if (from) {
      const { webhookService } = await import('../webhooks/webhook.service');
      ({ contact } = await webhookService.findOrCreateContact(organizationId, from));
    }
    const conversation = contact
      ? await prisma.conversation.findFirst({
          where: { organizationId, contactId: contact.id, channel: 'WHATSAPP' },
          orderBy: { lastMessageAt: 'desc' },
          select: { id: true },
        })
      : null;

    // Meta may deliver the same webhook twice: the unique call id keeps one
    // row, and only the delivery that created it rings the agents.
    let log;
    try {
      log = await prisma.callLog.create({
        data: {
          organizationId,
          whatsappAccountId: account.id,
          contactId: contact?.id ?? null,
          conversationId: conversation?.id ?? null,
          callId: ev.callId,
          direction: 'INBOUND',
          status: 'RINGING',
          from: from || null,
          to: digitsOf(account.phoneNumber) || null,
          offerSdp: ev.sdp,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') return; // already recorded and announced
      throw e;
    }

    await emitToOrg(organizationId, 'call:incoming', {
      callId: ev.callId,
      from,
      sdp: ev.sdp,
      conversationId: conversation?.id ?? null,
      contact: contact ? { id: contact.id, name: contactName(contact), phone: contact.phone } : null,
      startedAt: log.startedAt.toISOString(),
    });
    console.log(`📞 Incoming WhatsApp call ${ev.callId} from ${from.slice(0, 6)}…`);

    // The socket only reaches open apps; a push wakes the mobile app so an
    // agent can still answer within Meta's ~60 seconds.
    void this.pushIncomingCall(
      organizationId,
      ev.callId,
      contactName(contact) || (from ? `+${from}` : 'A customer'),
      log.startedAt
    );
  },

  /** Agents whose phones ring for a customer's call. */
  async ringingMembers(organizationId: string) {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId, role: { in: ['OWNER', 'ADMIN', 'MEMBER'] } },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  },

  /** Rings every agent's phone: the Android app as a phone call, others as a notification. */
  async pushIncomingCall(organizationId: string, callId: string, callerName: string, startedAt: Date) {
    try {
      const { notificationsService } = await import('../notifications/notifications.service');
      await notificationsService.sendCallPush(
        await this.ringingMembers(organizationId),
        { type: 'incoming_call', callId, callerName, startedAt: startedAt.toISOString(), actionUrl: '/dashboard/inbox' },
        { title: '📞 Incoming WhatsApp call', body: `${callerName} is calling. Tap to answer.` }
      );
    } catch (e: any) {
      console.warn('[Calling] Incoming call push failed:', e?.message);
    }
  },

  /** A customer's call stopped ringing (answered, declined, over): stop it on every phone. */
  async pushCallEnded(organizationId: string, callId: string) {
    try {
      const { notificationsService } = await import('../notifications/notifications.service');
      await notificationsService.sendCallPush(await this.ringingMembers(organizationId), { type: 'call_ended', callId });
    } catch (e: any) {
      console.warn('[Calling] Call ended push failed:', e?.message);
    }
  },

  async onStatus(organizationId: string, callId: string, status: string) {
    const log = await prisma.callLog.findUnique({ where: { callId } });
    if (!log || log.organizationId !== organizationId) return;

    if (status === 'RINGING' && log.status === 'CALLING') {
      await prisma.callLog.update({ where: { callId }, data: { status: 'RINGING' } });
    } else if (status === 'ACCEPTED' && !log.answeredAt) {
      await prisma.callLog.update({ where: { callId }, data: { status: 'ANSWERED', answeredAt: new Date() } });
    } else if (status === 'REJECTED') {
      await prisma.callLog.update({ where: { callId }, data: { status: 'REJECTED', endedAt: new Date() } });
    }
    await emitToOrg(organizationId, 'call:status', { callId, status });
  },

  async onTerminate(organizationId: string, account: any, ev: Extract<CallWebhookEvent, { kind: 'terminate' }>) {
    let log = await prisma.callLog.findUnique({ where: { callId: ev.callId } });
    const direction = ev.direction === 'BUSINESS_INITIATED' ? 'OUTBOUND' : 'INBOUND';

    if (!log) {
      // We never saw this call start (webhook lost, or before this code).
      log = await prisma.callLog.create({
        data: {
          organizationId,
          whatsappAccountId: account.id,
          callId: ev.callId,
          direction,
          status: 'RINGING',
          from: digitsOf(ev.from) || null,
          to: digitsOf(ev.to) || null,
        },
      });
    }

    const answered = !!log.answeredAt || (ev.duration ?? 0) > 0;
    const status = terminalStatus(log.status, log.direction as 'INBOUND' | 'OUTBOUND', answered, ev.metaStatus);
    await prisma.callLog.update({
      where: { callId: ev.callId },
      data: { status, endedAt: log.endedAt ?? new Date(), duration: ev.duration ?? log.duration, offerSdp: null },
    });
    await emitToOrg(organizationId, 'call:ended', { callId: ev.callId, status, duration: ev.duration });
    if (log.direction === 'INBOUND' && log.status === 'RINGING') void this.pushCallEnded(organizationId, ev.callId);

    if (status === 'MISSED') {
      const contact = log.contactId
        ? await prisma.contact.findUnique({ where: { id: log.contactId }, select: { firstName: true, lastName: true, whatsappProfileName: true, phone: true } })
        : null;
      const { notificationsService } = await import('../notifications/notifications.service');
      await notificationsService.notifyOrganization(organizationId, {
        type: 'whatsapp',
        title: 'Missed WhatsApp call',
        description: `Missed call from ${contactName(contact) || log.from || 'a customer'}`,
        actionUrl: log.conversationId ? `/dashboard/inbox?conversation=${log.conversationId}` : '/dashboard/inbox',
      });
    }
  },

  /** An agent answers a customer's call with their browser's SDP answer. One agent wins. */
  async acceptCall(params: { organizationId: string; userId: string; callId: string; sdp: string }) {
    const { organizationId, userId, callId, sdp } = params;

    const claim = await prisma.callLog.updateMany({
      where: {
        callId,
        organizationId,
        direction: 'INBOUND',
        status: 'RINGING',
        startedAt: { gt: new Date(Date.now() - RING_WINDOW_MS) },
      },
      data: { status: 'ANSWERING', answeredById: userId },
    });
    if (claim.count !== 1) {
      const log = await prisma.callLog.findUnique({ where: { callId } });
      if (!log || log.organizationId !== organizationId) throw new AppError('Call not found', 404);
      throw new AppError(
        log.answeredById && log.answeredById !== userId ? 'A teammate already answered this call.' : 'This call is no longer ringing.',
        409
      );
    }
    // Answered here: the other agents' phones stop ringing
    void this.pushCallEnded(organizationId, callId);

    const log = await prisma.callLog.findUniqueOrThrow({ where: { callId } });
    try {
      const account = await accountForOrg(organizationId, log.whatsappAccountId ?? undefined);
      const token = await tokenFor(account.id);
      // pre_accept connects the media path first, so the first words are not clipped.
      await metaApi.callAction(account.phoneNumberId, token, { action: 'pre_accept', callId, sdp });
      await metaApi.callAction(account.phoneNumberId, token, { action: 'accept', callId, sdp });
    } catch (err: any) {
      const e = toCallError(err, 'Could not answer the call');
      await prisma.callLog.update({ where: { callId }, data: { status: 'FAILED', failureReason: e.message, endedAt: new Date(), offerSdp: null } });
      await emitToOrg(organizationId, 'call:ended', { callId, status: 'FAILED' });
      throw e;
    }

    await prisma.callLog.update({ where: { callId }, data: { status: 'ANSWERED', answeredAt: new Date(), offerSdp: null } });
    await emitToOrg(organizationId, 'call:answered', { callId, answeredById: userId });
    return { callId };
  },

  async rejectCall(params: { organizationId: string; userId: string; callId: string }) {
    const { organizationId, userId, callId } = params;
    const claim = await prisma.callLog.updateMany({
      where: { callId, organizationId, direction: 'INBOUND', status: 'RINGING' },
      data: { status: 'REJECTED', answeredById: userId, endedAt: new Date(), offerSdp: null },
    });
    if (claim.count !== 1) throw new AppError('This call is no longer ringing.', 409);
    void this.pushCallEnded(organizationId, callId);

    const log = await prisma.callLog.findUniqueOrThrow({ where: { callId } });
    try {
      const account = await accountForOrg(organizationId, log.whatsappAccountId ?? undefined);
      await metaApi.callAction(account.phoneNumberId, await tokenFor(account.id), { action: 'reject', callId });
    } catch (err: any) {
      console.warn(`[Calling] Reject ${callId} failed:`, err?.metaError || err?.message);
    }
    await emitToOrg(organizationId, 'call:ended', { callId, status: 'REJECTED' });
    return { callId };
  },

  /** Hang up an answered or ringing call. Meta's terminate webhook fills in the duration. */
  async terminateCall(params: { organizationId: string; callId: string }) {
    const { organizationId, callId } = params;
    const log = await prisma.callLog.findUnique({ where: { callId } });
    if (!log || log.organizationId !== organizationId) throw new AppError('Call not found', 404);
    if (!ACTIVE_STATUSES.includes(log.status)) return { callId, status: log.status };

    try {
      const account = await accountForOrg(organizationId, log.whatsappAccountId ?? undefined);
      await metaApi.callAction(account.phoneNumberId, await tokenFor(account.id), { action: 'terminate', callId });
    } catch (err: any) {
      // The call may already be over on Meta's side; record it as ended anyway.
      console.warn(`[Calling] Terminate ${callId} failed:`, err?.metaError || err?.message);
    }

    const status = terminalStatus(log.status, log.direction as 'INBOUND' | 'OUTBOUND', !!log.answeredAt);
    await prisma.callLog.update({ where: { callId }, data: { status, endedAt: new Date(), offerSdp: null } });
    await emitToOrg(organizationId, 'call:ended', { callId, status });
    return { callId, status };
  },

  /** Whether this customer has given the business permission to call them. */
  async getPermission(params: { organizationId: string; phone: string; whatsappAccountId?: string }) {
    const account = await accountForOrg(params.organizationId, params.whatsappAccountId);
    try {
      return await metaApi.getCallPermission(account.phoneNumberId, await tokenFor(account.id), digitsOf(params.phone));
    } catch (err: any) {
      throw toCallError(err, 'Could not check call permission');
    }
  },

  /**
   * Ask the customer to allow calls.
   *
   * Inside the 24-hour window it goes out as a free chat message. Outside it,
   * Meta only accepts an approved template carrying the call_permission_request
   * component - the one createPermissionTemplate submits. That one is charged
   * like any template (from the wallet).
   */
  async requestPermission(params: { organizationId: string; to: string; conversationId?: string; whatsappAccountId?: string }) {
    const { organizationId } = params;
    const to = digitsOf(params.to);
    if (!to) throw new AppError('Phone number required', 400);
    const account = await accountForOrg(organizationId, params.whatsappAccountId);
    const { whatsappService } = await import('../whatsapp/whatsapp.service');

    const windowFields = { id: true, isWindowOpen: true, windowExpiresAt: true, lastCustomerMessageAt: true } as const;
    const conversation =
      (params.conversationId &&
        (await prisma.conversation.findFirst({ where: { id: params.conversationId, organizationId }, select: windowFields }))) ||
      (await prisma.conversation.findFirst({
        where: { organizationId, channel: 'WHATSAPP', contact: { phone: { in: [`+${to}`, to] } } },
        orderBy: { lastMessageAt: 'desc' },
        select: windowFields,
      }));

    if (isWindowOpen(conversation)) {
      try {
        await whatsappService.sendMessage({
          accountId: account.id,
          to,
          type: 'interactive',
          content: {
            interactive: {
              type: 'call_permission_request',
              action: { name: 'call_permission_request' },
              body: { text: 'We would like to call you on WhatsApp. Tap Allow so our team can call you.' },
            },
          },
          conversationId: conversation?.id,
          organizationId,
        });
        return { via: 'message' as const };
      } catch (err: any) {
        throw toCallError(err, 'Could not send the call permission request');
      }
    }

    const templates = await permissionTemplates(organizationId, account.id);
    const approved = templates.find((t) => t.status === 'APPROVED');
    if (!approved) {
      const pending = templates.some((t) => t.status === 'PENDING');
      throw new AppError(
        pending
          ? 'This customer has not messaged you in the last 24 hours, and your call permission template is still waiting for Meta’s approval. Try again once it is approved.'
          : 'This customer has not messaged you in the last 24 hours. To ask them now, WhatsApp needs an approved call permission template — create it in Settings › Calling.',
        409,
        'CALL_PERMISSION_TEMPLATE_REQUIRED'
      );
    }

    try {
      await whatsappService.sendTemplateMessage({
        accountId: account.id,
        to,
        templateName: approved.name,
        templateLanguage: approved.language,
        components: [],
        conversationId: conversation?.id,
        organizationId,
      });
      return { via: 'template' as const };
    } catch (err: any) {
      throw toCallError(err, 'Could not send the call permission request');
    }
  },

  /** The call permission template on this number: its latest state, or null if there is none. */
  async getPermissionTemplate(params: { organizationId: string; whatsappAccountId?: string }) {
    const account = await accountForOrg(params.organizationId, params.whatsappAccountId);
    const templates = await permissionTemplates(params.organizationId, account.id);
    const best = templates.find((t) => t.status === 'APPROVED') || templates[0];
    return best
      ? { id: best.id, name: best.name, status: best.status, category: best.category, rejectionReason: best.rejectionReason, bodyText: best.bodyText }
      : null;
  },

  /**
   * Submit the call permission template to Meta for this number. A new name
   * each time after a rejection: Meta does not let a deleted name be reused
   * for a while.
   */
  async createPermissionTemplate(params: { organizationId: string; whatsappAccountId?: string }) {
    const { organizationId } = params;
    const account = await accountForOrg(organizationId, params.whatsappAccountId);
    const templates = await permissionTemplates(organizationId, account.id);
    const live = templates.find((t) => t.status === 'APPROVED' || t.status === 'PENDING');
    if (live) return this.getPermissionTemplate({ organizationId, whatsappAccountId: account.id });

    const name = templates.length ? `${CALL_PERMISSION_TEMPLATE}_${templates.length + 1}` : CALL_PERMISSION_TEMPLATE;
    const payload = {
      name,
      language: 'en',
      category: 'UTILITY',
      components: [{ type: 'BODY', text: CALL_PERMISSION_BODY }, { type: 'call_permission_request' }],
    };

    const { whatsappApi } = await import('../whatsapp/whatsapp.api');
    let metaTemplateId: string | null = null;
    let metaStatus = 'PENDING';
    try {
      const res = await whatsappApi.createMessageTemplateByVersion(account.wabaId, await tokenFor(account.id), payload);
      metaTemplateId = res?.id ? String(res.id) : null;
      if (res?.status) metaStatus = String(res.status).toUpperCase();
    } catch (err: any) {
      const meta = err?.metaError || err?.response?.data?.error;
      throw new AppError(
        `Meta did not accept the call permission template: ${meta?.error_user_msg || meta?.message || err?.message || 'unknown error'}`,
        400
      );
    }

    await prisma.template.create({
      data: {
        organizationId,
        whatsappAccountId: account.id,
        wabaId: account.wabaId,
        metaTemplateId,
        name,
        language: 'en',
        category: 'UTILITY',
        bodyText: CALL_PERMISSION_BODY,
        status: metaStatus === 'APPROVED' ? 'APPROVED' : metaStatus === 'REJECTED' ? 'REJECTED' : 'PENDING',
      },
    });
    return this.getPermissionTemplate({ organizationId, whatsappAccountId: account.id });
  },

  /** Call a customer. The browser has already made its WebRTC offer. */
  async startCall(params: {
    organizationId: string;
    userId: string;
    to: string;
    sdp: string;
    contactId?: string;
    conversationId?: string;
    whatsappAccountId?: string;
  }) {
    const { organizationId, userId, sdp, contactId, conversationId } = params;
    const to = digitsOf(params.to);
    if (!to) throw new AppError('Phone number required', 400);

    const account = await accountForOrg(organizationId, params.whatsappAccountId);
    const eligibility = callingEligibility(account);
    if (!eligibility.outboundAvailable) throw new AppError(eligibility.outboundBlockedReason!, 400);

    const token = await tokenFor(account.id);

    let permission;
    try {
      permission = await metaApi.getCallPermission(account.phoneNumberId, token, to);
    } catch (err: any) {
      throw toCallError(err, 'Could not check call permission');
    }
    if (!permission.canStartCall) {
      throw new AppError(
        permission.status === 'no_permission'
          ? 'This customer has not allowed calls yet. Send them a call permission request first.'
          : 'Meta does not allow another call to this customer right now (call limits). Try again later.',
        409,
        permission.status === 'no_permission' ? 'CALL_PERMISSION_REQUIRED' : 'CALL_LIMIT_REACHED'
      );
    }

    let result;
    try {
      result = await metaApi.callAction(account.phoneNumberId, token, {
        action: 'connect',
        to,
        sdp,
        bizOpaqueCallbackData: `org:${organizationId}`,
      });
    } catch (err: any) {
      throw toCallError(err, 'Could not start the call');
    }
    if (!result.callId) throw new AppError('WhatsApp did not return a call id. Please try again.', 502);

    await prisma.callLog.create({
      data: {
        organizationId,
        whatsappAccountId: account.id,
        contactId: contactId || null,
        conversationId: conversationId || null,
        callId: result.callId,
        direction: 'OUTBOUND',
        status: 'CALLING',
        from: digitsOf(account.phoneNumber) || null,
        to,
        initiatedById: userId,
      },
    });
    return { callId: result.callId };
  },

  /** Can this organization's number use calling, and is calling switched on? */
  async getEligibility(organizationId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { organizationId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    if (!account) return { connected: false as const };

    let callingEnabled: boolean | null = null;
    try {
      const settings = await metaApi.getCallingSettings(account.phoneNumberId, await tokenFor(account.id));
      callingEnabled = settings.callingEnabled;
    } catch {
      callingEnabled = null;
    }
    return {
      connected: true as const,
      phoneNumber: account.phoneNumber,
      callingEnabled,
      ...callingEligibility(account),
    };
  },

  /** Customer calls still ringing - for an agent who opens the app mid-ring. */
  async getActiveCalls(organizationId: string) {
    const calls = await prisma.callLog.findMany({
      where: {
        organizationId,
        direction: 'INBOUND',
        status: 'RINGING',
        offerSdp: { not: null },
        startedAt: { gt: new Date(Date.now() - RING_WINDOW_MS) },
      },
      include: { contact: { select: { id: true, firstName: true, lastName: true, whatsappProfileName: true, phone: true } } },
      orderBy: { startedAt: 'desc' },
    });
    return calls.map((c) => ({
      callId: c.callId,
      from: c.from,
      sdp: c.offerSdp,
      conversationId: c.conversationId,
      contact: c.contact ? { id: c.contact.id, name: contactName(c.contact), phone: c.contact.phone } : null,
      startedAt: c.startedAt.toISOString(),
    }));
  },

  async getCallLogs(params: { organizationId: string; page: number; limit: number; contactId?: string; direction?: string }) {
    const where: any = { organizationId: params.organizationId };
    if (params.contactId) where.contactId = params.contactId;
    if (params.direction) where.direction = params.direction.toUpperCase();

    const [logs, total] = await Promise.all([
      prisma.callLog.findMany({
        where,
        include: { contact: { select: { id: true, phone: true, firstName: true, lastName: true, whatsappProfileName: true } } },
        orderBy: { startedAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.callLog.count({ where }),
    ]);
    return {
      logs: logs.map(({ offerSdp: _sdp, ...l }) => ({ ...l, contactName: contactName(l.contact) })),
      total,
    };
  },
};
