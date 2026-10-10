// The Gupshup client authenticates two ways. With the partner's email and
// client secret it logs in for a 24h partner token and fetches a
// never-expiring app token per app (partner-docs.gupshup.io). With a
// Universal Token it uses the Bizgate endpoints, whose docs disagree on the
// "Bearer" prefix. Either way a stale token must be renewed once on 401, and
// Meta's own error message must come through when a send is rejected.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const request = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { create: () => ({ request, post }) } }));

const cfg = vi.hoisted(() => ({
  baseUrl: 'https://partner.gupshup.io',
  universalToken: '',
  partnerEmail: 'contact@wabmeta.com',
  clientSecret: 'secret123',
}));
vi.mock('../../config', () => ({
  config: { app: { isProduction: false, isDevelopment: true, env: 'test' }, gupshup: cfg },
}));

const authOf = (call: any[]) => call[0].headers.Authorization;

async function freshApi() {
  vi.resetModules();
  return import('./gupshup.api');
}

beforeEach(() => {
  request.mockReset();
  post.mockReset();
  cfg.universalToken = '';
});

describe('email + client secret', () => {
  it('logs in for a partner token and links the app with it', async () => {
    const { gupshupApi } = await freshApi();
    post.mockResolvedValueOnce({ status: 200, data: { token: 'PT1' } });
    request.mockResolvedValueOnce({ data: { status: 'success', appId: 'app1' } });

    const res = await gupshupApi.linkApp({ name: 'WABMeta919812345678', wabaId: 'waba1', phone: '919812345678', callbackUrl: 'https://x/y?key=k' });

    expect(res.appId).toBe('app1');
    const [loginUrl, loginBody] = post.mock.calls[0];
    expect(loginUrl).toBe('/partner/account/login');
    expect(Object.fromEntries(new URLSearchParams(loginBody))).toEqual({ email: 'contact@wabmeta.com', secret: 'secret123' });

    const req = request.mock.calls[0][0];
    expect(req.url).toBe('/partner/tpp/app');
    expect(authOf(request.mock.calls[0])).toBe('PT1');
    expect(Object.fromEntries(new URLSearchParams(req.data))).toEqual({
      name: 'WABMeta919812345678', wabaId: 'waba1', phone: '919812345678', callbackUrl: 'https://x/y?key=k',
    });
  });

  it('reuses the partner token instead of logging in every call', async () => {
    const { gupshupApi } = await freshApi();
    post.mockResolvedValue({ status: 200, data: { token: 'PT1' } });
    request.mockResolvedValue({ data: { status: 'success', whatsapp: {} } });

    await gupshupApi.getPipeline('app1');
    await gupshupApi.getPipeline('app1');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('sends with the app token on the documented v3 endpoint', async () => {
    const { gupshupApi } = await freshApi();
    post.mockResolvedValue({ status: 200, data: { token: 'PT1' } });
    request
      .mockResolvedValueOnce({ data: { status: 'success', token: { token: 'sk_app1', expiresOn: 0 } } })
      .mockResolvedValueOnce({ data: { messages: [{ id: 'gs-1' }] } })
      .mockResolvedValueOnce({ data: { messages: [{ id: 'gs-2' }] } });

    const r1 = await gupshupApi.sendPassthrough('app1', { to: '91' });
    await gupshupApi.sendPassthrough('app1', { to: '91' });

    expect(r1.messages[0].id).toBe('gs-1');
    expect(request.mock.calls[0][0].url).toBe('/partner/app/app1/token');
    expect(authOf(request.mock.calls[0])).toBe('PT1');
    expect(request.mock.calls[1][0].url).toBe('/partner/app/app1/v3/message');
    expect(authOf(request.mock.calls[1])).toBe('sk_app1');
    // the app token is cached - no second token fetch
    expect(request.mock.calls[2][0].url).toBe('/partner/app/app1/v3/message');
  });

  it('renews the token once on 401', async () => {
    const { gupshupApi } = await freshApi();
    post
      .mockResolvedValueOnce({ status: 200, data: { token: 'OLD' } })
      .mockResolvedValueOnce({ status: 200, data: { token: 'NEW' } });
    request
      .mockRejectedValueOnce({ response: { status: 401, data: { message: 'expired' } } })
      .mockResolvedValueOnce({ data: { status: 'success', whatsapp: { creationStage: 'X' } } });

    const p = await gupshupApi.getPipeline('app1');
    expect(p.creationStage).toBe('X');
    expect(authOf(request.mock.calls[1])).toBe('NEW');
  });

  it('renews on 403 "Invalid Access Token" and sends the token header too', async () => {
    const { gupshupApi } = await freshApi();
    post
      .mockResolvedValueOnce({ status: 200, data: { token: 'OLD' } })
      .mockResolvedValueOnce({ status: 200, data: { token: 'NEW' } });
    request
      .mockRejectedValueOnce({ response: { status: 403, data: { status: 'error', message: 'Invalid Access Token' } } })
      .mockResolvedValueOnce({ data: { status: 'success', token: { token: 'sk_app1', expiresOn: 0 } } })
      .mockResolvedValueOnce({ data: { messages: [{ id: 'gs-1' }] } });

    await gupshupApi.sendPassthrough('app1', { to: '91' });

    const tokenCall = request.mock.calls[1][0];
    expect(tokenCall.url).toBe('/partner/app/app1/token');
    expect(tokenCall.headers).toMatchObject({ Authorization: 'NEW', token: 'NEW' });
  });

  it('does not retry a permissions 403', async () => {
    const { gupshupApi } = await freshApi();
    post.mockResolvedValue({ status: 200, data: { token: 'PT1' } });
    request.mockRejectedValueOnce({
      response: { status: 403, data: { status: 'error', message: 'You do not have the required permissions to access this API' } },
    });

    const err = await gupshupApi.getPipeline('app1').catch((e) => e);
    expect(err.status).toBe(403);
    expect(request).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('subscribes with the app token on the partner endpoint', async () => {
    const { gupshupApi } = await freshApi();
    post.mockResolvedValue({ status: 200, data: { token: 'PT1' } });
    request
      .mockResolvedValueOnce({ data: { token: { token: 'sk_app1' } } })
      .mockResolvedValueOnce({ data: { status: 'success', subscription: { id: 'sub1' } } });

    const res = await gupshupApi.createSubscription('app1', 'https://cb', 'MESSAGE,READ');
    expect(res.subscriptionId).toBe('sub1');
    const req = request.mock.calls[1][0];
    expect(req.url).toBe('/partner/app/app1/subscription');
    expect(authOf(request.mock.calls[1])).toBe('sk_app1');
    expect(Object.fromEntries(new URLSearchParams(req.data))).toMatchObject({ modes: 'MESSAGE,READ', version: '3', url: 'https://cb' });
  });

  it("surfaces Meta's error message from a rejected send", async () => {
    const { gupshupApi, GupshupApiError } = await freshApi();
    post.mockResolvedValue({ status: 200, data: { token: 'PT1' } });
    request
      .mockResolvedValueOnce({ data: { token: { token: 'sk_app1' } } })
      .mockRejectedValueOnce({ response: { status: 400, data: { error: { code: 131047, message: 'Re-engagement message' } } } });

    const err = await gupshupApi.sendPassthrough('app1', { to: '91' }).catch((e) => e);
    expect(err).toBeInstanceOf(GupshupApiError);
    expect(err.status).toBe(400);
    expect(err.message).toContain('Re-engagement message');
  });
});

describe('universal token', () => {
  it('uses the Bizgate endpoints and falls back to the bare token on 401', async () => {
    cfg.universalToken = 'UT123';
    const { gupshupApi } = await freshApi();
    request
      .mockRejectedValueOnce({ response: { status: 401, data: {} } })
      .mockResolvedValueOnce({ data: { messages: [{ id: 'gs-1' }] } })
      .mockResolvedValueOnce({ data: { messages: [{ id: 'gs-2' }] } });

    await gupshupApi.sendPassthrough('app1', { to: '91' });
    await gupshupApi.sendPassthrough('app1', { to: '91' });

    expect(request.mock.calls[0][0].url).toBe('/partner/bizgate/app/app1/messaging');
    expect(authOf(request.mock.calls[0])).toBe('Bearer UT123');
    expect(authOf(request.mock.calls[1])).toBe('UT123');
    expect(authOf(request.mock.calls[2])).toBe('UT123');
    expect(post).not.toHaveBeenCalled();
  });
});
