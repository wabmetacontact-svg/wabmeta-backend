// A number onboarded through the Gupshup Partner Solution can only send
// through Gupshup (Meta gives "Send messages" to the partner only), every
// other number must keep going straight to Meta, and the Gupshup message id
// returned on send must be swapped for the real wamid so Meta's statuses
// still find the message.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  whatsAppAccount: { findUnique: vi.fn(), update: vi.fn() },
  message: { updateMany: vi.fn() },
  campaignContact: { updateMany: vi.fn() },
  messageQueue: { updateMany: vi.fn() },
  walletTransaction: { updateMany: vi.fn() },
}));
vi.mock('../../config/database', () => ({ default: db }));

const api = vi.hoisted(() => ({
  isConfigured: vi.fn(() => true),
  sendPassthrough: vi.fn(),
  linkApp: vi.fn(),
  getPipeline: vi.fn(),
  createSubscription: vi.fn(),
}));
vi.mock('./gupshup.api', () => ({
  gupshupApi: api,
  GupshupApiError: class GupshupApiError extends Error {
    status?: number;
    data?: any;
    constructor(m: string, s?: number, d?: any) {
      super(m);
      this.status = s;
      this.data = d;
    }
  },
}));

const wallet = vi.hoisted(() => ({
  deductWalletForService: vi.fn(),
  attachServiceChargeRef: vi.fn(async () => {}),
  refundServiceCharge: vi.fn(async () => true),
}));
vi.mock('../wallet/wallet.deduction.service', () => wallet);

const assertOrgCanSend = vi.hoisted(() => vi.fn());
vi.mock('../admin/orgControl', () => ({ assertOrgCanSend }));

const handleWebhook = vi.hoisted(() => vi.fn(async () => ({ status: 'processed' })));
vi.mock('../webhooks/webhook.service', () => ({ webhookService: { handleWebhook } }));

vi.mock('../../config', () => ({
  config: {
    app: { isProduction: false, isDevelopment: true, env: 'test' },
    gupshup: {
      solutionId: '1415965516534270',
      baseUrl: 'https://partner.gupshup.io',
      partnerEmail: 'contact@wabmeta.com',
      clientSecret: 'secret',
      universalToken: 'ut',
      callbackUrl: 'https://api.wabmeta.com/api/webhooks/gupshup',
      callbackSecret: 's3cret',
      subscriptionModes: 'MESSAGE,SENT,DELIVERED,READ,FAILED',
    },
  },
}));

import { routeSend, invalidateSendRoute } from './gupshup.router';
import { GupshupApiError } from './gupshup.api';
import {
  gupshupService,
  gupshupAppName,
  isGupshupSignup,
  pipelineOutcome,
  callbackUrlWithKey,
} from './gupshup.service';

const payload = { messaging_product: 'whatsapp', to: '919812345678', type: 'text', text: { body: 'hi' } };

beforeEach(() => {
  for (const m of Object.values(db)) for (const f of Object.values(m)) (f as any).mockReset();
  for (const f of Object.values(api)) (f as any).mockReset();
  api.isConfigured.mockReturnValue(true);
  assertOrgCanSend.mockReset();
  for (const f of Object.values(wallet)) (f as any).mockClear();
  wallet.deductWalletForService.mockResolvedValue({ deducted: true, amountPaise: 15 });
  handleWebhook.mockClear();
  invalidateSendRoute();
  db.whatsAppAccount.update.mockResolvedValue({ phoneNumberId: 'pn1' });
});

describe('routeSend', () => {
  it('sends Meta numbers straight to Meta', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue({ sendProvider: 'META', organizationId: 'o1' });
    const metaPost = vi.fn(async () => ({ data: { messages: [{ id: 'wamid.1' }] } }));

    const res = await routeSend('pn1', payload, metaPost);

    expect(metaPost).toHaveBeenCalledOnce();
    expect(api.sendPassthrough).not.toHaveBeenCalled();
    expect(res.data.messages[0].id).toBe('wamid.1');
  });

  it('sends a live Gupshup number through Gupshup with the same payload', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue({
      sendProvider: 'GUPSHUP', gupshupAppId: 'app1', gupshupStatus: 'LIVE', organizationId: 'o1',
    });
    api.sendPassthrough.mockResolvedValue({ messages: [{ id: 'gs-1' }] });
    const metaPost = vi.fn();

    const res = await routeSend('pn1', payload, metaPost);

    expect(metaPost).not.toHaveBeenCalled();
    expect(api.sendPassthrough).toHaveBeenCalledWith('app1', payload);
    expect(assertOrgCanSend).toHaveBeenCalledWith('o1');
    expect(res.data.messages[0].id).toBe('gs-1');
  });

  it('refuses while the Gupshup app is not live yet, in Meta error shape', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue({
      sendProvider: 'GUPSHUP', gupshupAppId: 'app1', gupshupStatus: 'LINKING', organizationId: 'o1',
    });
    const err: any = await routeSend('pn1', payload, vi.fn()).catch((e) => e);
    expect(err.response.status).toBe(409);
    expect(err.response.data.error.message).toMatch(/being activated/);
    expect(api.sendPassthrough).not.toHaveBeenCalled();
  });

  it('turns a Gupshup failure into a Meta-shaped error', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue({
      sendProvider: 'GUPSHUP', gupshupAppId: 'app1', gupshupStatus: 'LIVE', organizationId: 'o1',
    });
    api.sendPassthrough.mockRejectedValue(
      new GupshupApiError('[Gupshup] send: Re-engagement message', 400, { error: { code: 131047, message: 'Re-engagement message' } })
    );
    const err: any = await routeSend('pn1', payload, vi.fn()).catch((e) => e);
    expect(err.response.status).toBe(400);
    expect(err.response.data.error.code).toBe(131047);
  });

  it('caches the route but picks up a change after invalidation', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue({ sendProvider: 'META', organizationId: 'o1' });
    const metaPost = vi.fn(async () => ({ data: {} }));
    await routeSend('pn1', payload, metaPost);
    await routeSend('pn1', payload, metaPost);
    expect(db.whatsAppAccount.findUnique).toHaveBeenCalledTimes(1);

    invalidateSendRoute('pn1');
    db.whatsAppAccount.findUnique.mockResolvedValue({
      sendProvider: 'GUPSHUP', gupshupAppId: 'app1', gupshupStatus: 'LIVE', organizationId: 'o1',
    });
    api.sendPassthrough.mockResolvedValue({ messages: [{ id: 'gs' }] });
    await routeSend('pn1', payload, metaPost);
    expect(api.sendPassthrough).toHaveBeenCalled();
  });
});

describe('service message charge (Gupshup numbers)', () => {
  const live = { sendProvider: 'GUPSHUP', gupshupAppId: 'app1', gupshupStatus: 'LIVE', organizationId: 'o1' };

  it('charges the wallet before a service message and ties the charge to the message id', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue(live);
    api.sendPassthrough.mockResolvedValue({ messages: [{ id: 'gs-9' }] });

    await routeSend('pn1', payload, vi.fn());

    const call = wallet.deductWalletForService.mock.calls[0][0] as any;
    expect(call).toMatchObject({ organizationId: 'o1', recipientPhone: '919812345678' });
    expect(call.ref).toMatch(/^svc_/);
    expect(wallet.attachServiceChargeRef).toHaveBeenCalledWith(call.ref, 'gs-9');
    expect(wallet.refundServiceCharge).not.toHaveBeenCalled();
  });

  it('does not send when the wallet cannot pay', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue(live);
    wallet.deductWalletForService.mockResolvedValue({ deducted: false, amountPaise: 15, insufficient: true });

    const err: any = await routeSend('pn1', payload, vi.fn()).catch((e) => e);

    expect(err.response.status).toBe(402);
    expect(err.response.data.error.message).toMatch(/wallet balance is too low/);
    expect(api.sendPassthrough).not.toHaveBeenCalled();
  });

  it('refunds when the send fails', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue(live);
    api.sendPassthrough.mockRejectedValue(new GupshupApiError('[Gupshup] send: boom', 500));

    await routeSend('pn1', payload, vi.fn()).catch(() => {});

    const ref = (wallet.deductWalletForService.mock.calls[0][0] as any).ref;
    expect(wallet.refundServiceCharge).toHaveBeenCalledWith(ref, 'send failed');
  });

  it('does not charge templates - they have their own charge', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue(live);
    api.sendPassthrough.mockResolvedValue({ messages: [{ id: 'gs-1' }] });

    await routeSend('pn1', { ...payload, type: 'template', template: { name: 't' } }, vi.fn());

    expect(wallet.deductWalletForService).not.toHaveBeenCalled();
  });

  it('does not charge numbers that go straight to Meta', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue({ sendProvider: 'META', organizationId: 'o1' });
    await routeSend('pn1', payload, vi.fn(async () => ({ data: {} })));
    expect(wallet.deductWalletForService).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('builds a valid, unique-ish Gupshup app name', () => {
    expect(gupshupAppName('+91 98123 45678')).toBe('WABMeta919812345678');
    expect(gupshupAppName('919812345678', 1)).toMatch(/^WABMeta919812345678x[a-z0-9]+$/);
    expect(gupshupAppName('91')).toMatch(/^[A-Za-z0-9]{6,150}$/);
  });

  it('routes a signup to Gupshup only for our solution and never for coexistence', () => {
    expect(isGupshupSignup('1415965516534270', false)).toBe(true);
    expect(isGupshupSignup('1415965516534270', true)).toBe(false);
    expect(isGupshupSignup('999', false)).toBe(false);
    expect(isGupshupSignup(undefined, false)).toBe(false);
    api.isConfigured.mockReturnValue(false);
    expect(isGupshupSignup('1415965516534270', false)).toBe(false);
  });

  it('reads the pipeline', () => {
    expect(pipelineOutcome({ creationStage: 'WHATSAPP_PROVISIONING_DONE', pipeLineStage: 'FINALIZE' })).toBe('LIVE');
    expect(pipelineOutcome({ creationStage: 'ERROR', pipeLineStage: 'CREATE_DOCKER' })).toBe('ERROR');
    expect(pipelineOutcome({ creationStage: 'IN_PROGRESS' })).toBeNull();
  });

  it('puts the secret on the callback URL', () => {
    expect(callbackUrlWithKey()).toBe('https://api.wabmeta.com/api/webhooks/gupshup?key=s3cret');
  });
});

describe('linkAccount', () => {
  it('links the WABA and number and starts LINKING', async () => {
    vi.useFakeTimers();
    db.whatsAppAccount.findUnique.mockResolvedValue({
      id: 'acc1', wabaId: 'waba1', phoneNumber: '919812345678', gupshupAppId: null, gupshupStatus: null,
    });
    api.linkApp.mockResolvedValue({ appId: 'app1' });

    const res = await gupshupService.linkAccount('acc1');

    expect(res.appId).toBe('app1');
    expect(api.linkApp).toHaveBeenCalledWith({
      name: 'WABMeta919812345678',
      wabaId: 'waba1',
      phone: '919812345678',
      callbackUrl: 'https://api.wabmeta.com/api/webhooks/gupshup?key=s3cret',
    });
    expect(db.whatsAppAccount.update.mock.calls[0][0].data).toMatchObject({ gupshupAppId: 'app1', gupshupStatus: 'LINKING' });
    vi.useRealTimers();
  });

  it('retries once with a new name when the name is taken', async () => {
    vi.useFakeTimers();
    db.whatsAppAccount.findUnique.mockResolvedValue({
      id: 'acc1', wabaId: 'waba1', phoneNumber: '919812345678', gupshupAppId: null, gupshupStatus: null,
    });
    api.linkApp
      .mockRejectedValueOnce(new GupshupApiError('Bot Already Exists', 409))
      .mockResolvedValueOnce({ appId: 'app2' });

    const res = await gupshupService.linkAccount('acc1');
    expect(res.appId).toBe('app2');
    expect(api.linkApp.mock.calls[1][0].name).toMatch(/^WABMeta919812345678x/);
    vi.useRealTimers();
  });

  it('records the error when linking fails', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue({
      id: 'acc1', wabaId: 'waba1', phoneNumber: '919812345678', gupshupAppId: null, gupshupStatus: null,
    });
    api.linkApp.mockRejectedValue(new GupshupApiError('Unable to create App', 500));
    const res = await gupshupService.linkAccount('acc1');
    expect(res.error).toMatch(/Unable to create App/);
    expect(db.whatsAppAccount.update.mock.calls[0][0].data).toMatchObject({ gupshupStatus: 'ERROR' });
  });
});

describe('handleCallback', () => {
  it('marks the app live on the live event and subscribes once', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue({ id: 'acc1', gupshupStatus: 'LINKING', gupshupSubscriptionId: null });
    api.createSubscription.mockResolvedValue({ subscriptionId: 'sub1' });

    const out = await gupshupService.handleCallback({
      app: 'WABMeta919812345678', appId: 'app1', type: 'onboarding-event', version: 2,
      payload: { type: 'docker-status-event', payload: { status: 'live', waId: '919812345678' } },
    });

    expect(out).toBe('live');
    expect(api.createSubscription).toHaveBeenCalledWith(
      'app1', 'https://api.wabmeta.com/api/webhooks/gupshup?key=s3cret', 'MESSAGE,SENT,DELIVERED,READ,FAILED'
    );
    expect(db.whatsAppAccount.update.mock.calls[0][0].data).toMatchObject({ gupshupStatus: 'LIVE', gupshupSubscriptionId: 'sub1' });
  });

  it('swaps the Gupshup id for the wamid and only forwards real statuses', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue({ phoneNumberId: 'pn1', wabaId: 'waba1' });

    await gupshupService.handleCallback({
      object: 'whatsapp_business_account',
      gs_app_id: 'app1',
      entry: [{ changes: [{ field: 'messages', value: {
        messaging_product: 'whatsapp',
        statuses: [
          { gs_id: 'gs-1', id: 'wamid.A', status: 'enqueued', recipient_id: '91', timestamp: 1 },
          { gs_id: 'gs-2', id: 'wamid.B', status: 'delivered', recipient_id: '91', timestamp: 2 },
        ],
      } }] }],
    });

    expect(db.message.updateMany).toHaveBeenCalledWith({ where: { waMessageId: 'gs-1' }, data: { waMessageId: 'wamid.A' } });
    expect(db.campaignContact.updateMany).toHaveBeenCalledWith({ where: { waMessageId: 'gs-2' }, data: { waMessageId: 'wamid.B' } });
    expect(db.walletTransaction.updateMany).toHaveBeenCalledWith({
      where: { metaChargeId: 'gs-2', metaService: 'service_message' },
      data: { metaChargeId: 'wamid.B' },
    });

    const forwarded = handleWebhook.mock.calls[0][0] as any;
    const value = forwarded.entry[0].changes[0].value;
    expect(forwarded.entry[0].id).toBe('waba1');
    expect(value.metadata.phone_number_id).toBe('pn1');
    expect(value.statuses).toEqual([{ id: 'wamid.B', status: 'delivered', recipient_id: '91', timestamp: 2 }]);
  });

  it('only maps ids when nothing else is left to process', async () => {
    db.whatsAppAccount.findUnique.mockResolvedValue({ phoneNumberId: 'pn1', wabaId: 'waba1' });
    const out = await gupshupService.handleCallback({
      object: 'whatsapp_business_account',
      gs_app_id: 'app1',
      entry: [{ changes: [{ field: 'messages', value: { statuses: [{ gs_id: 'gs-1', id: 'wamid.A', status: 'enqueued' }] } }] }],
    });
    expect(out).toBe('mapped');
    expect(handleWebhook).not.toHaveBeenCalled();
  });

  it('ignores payloads it does not know', async () => {
    expect(await gupshupService.handleCallback({ type: 'message-event', payload: {} })).toBe('ignored:message-event');
    expect(handleWebhook).not.toHaveBeenCalled();
  });
});
