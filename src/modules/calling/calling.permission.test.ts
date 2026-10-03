// Asking a customer for call permission: a free chat message inside the
// 24-hour window, the approved call permission template outside it.
// Prisma and the senders are mocked - no database needed.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  whatsAppAccount: { findFirst: vi.fn() },
  conversation: { findFirst: vi.fn() },
  template: { findMany: vi.fn(), create: vi.fn() },
}));
const wa = vi.hoisted(() => ({ sendMessage: vi.fn(), sendTemplateMessage: vi.fn() }));
const api = vi.hoisted(() => ({ createMessageTemplateByVersion: vi.fn() }));

vi.mock('../../config/database', () => ({ default: db }));
vi.mock('../meta/meta.api', () => ({ metaApi: {} }));
vi.mock('../meta/meta.service', () => ({ metaService: { getAccountWithToken: vi.fn(async () => ({ accessToken: 'tok' })) } }));
vi.mock('../whatsapp/whatsapp.service', () => ({ whatsappService: wa }));
vi.mock('../whatsapp/whatsapp.api', () => ({ whatsappApi: api }));

import { callingService, CALL_PERMISSION_TEMPLATE } from './calling.service';

const ACCOUNT = { id: 'wa1', organizationId: 'org1', wabaId: 'waba1', phoneNumberId: 'pn1', status: 'CONNECTED' };
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

beforeEach(() => {
  vi.clearAllMocks();
  db.whatsAppAccount.findFirst.mockResolvedValue(ACCOUNT);
  db.template.findMany.mockResolvedValue([]);
  wa.sendMessage.mockResolvedValue({});
  wa.sendTemplateMessage.mockResolvedValue({});
});

describe('requestPermission', () => {
  it('sends the free interactive request while the 24-hour window is open', async () => {
    db.conversation.findFirst.mockResolvedValue({ id: 'c1', windowExpiresAt: new Date(Date.now() + 3600_000) });
    const r = await callingService.requestPermission({ organizationId: 'org1', to: '+91 79827 22016' });
    expect(r).toEqual({ via: 'message' });
    expect(wa.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      to: '917982722016', type: 'interactive', conversationId: 'c1',
      content: { interactive: expect.objectContaining({ type: 'call_permission_request' }) },
    }));
    expect(wa.sendTemplateMessage).not.toHaveBeenCalled();
  });

  it('uses the approved template once the window has closed', async () => {
    db.conversation.findFirst.mockResolvedValue({ id: 'c1', lastCustomerMessageAt: hoursAgo(30) });
    db.template.findMany.mockResolvedValue([
      { name: `${CALL_PERMISSION_TEMPLATE}_2`, language: 'en', status: 'PENDING' },
      { name: CALL_PERMISSION_TEMPLATE, language: 'en', status: 'APPROVED' },
    ]);
    const r = await callingService.requestPermission({ organizationId: 'org1', to: '917982722016' });
    expect(r).toEqual({ via: 'template' });
    expect(wa.sendTemplateMessage).toHaveBeenCalledWith(expect.objectContaining({
      to: '917982722016', templateName: CALL_PERMISSION_TEMPLATE, templateLanguage: 'en', conversationId: 'c1',
    }));
    expect(wa.sendMessage).not.toHaveBeenCalled();
  });

  it('uses the template for a customer who never messaged (no conversation)', async () => {
    db.conversation.findFirst.mockResolvedValue(null);
    db.template.findMany.mockResolvedValue([{ name: CALL_PERMISSION_TEMPLATE, language: 'en', status: 'APPROVED' }]);
    expect(await callingService.requestPermission({ organizationId: 'org1', to: '917982722016' })).toEqual({ via: 'template' });
  });

  it('says to create the template when there is none', async () => {
    db.conversation.findFirst.mockResolvedValue(null);
    await expect(callingService.requestPermission({ organizationId: 'org1', to: '917982722016' }))
      .rejects.toMatchObject({ statusCode: 409, code: 'CALL_PERMISSION_TEMPLATE_REQUIRED', message: expect.stringMatching(/Settings › Calling/) });
  });

  it('says to wait while the template is still under review', async () => {
    db.conversation.findFirst.mockResolvedValue(null);
    db.template.findMany.mockResolvedValue([{ name: CALL_PERMISSION_TEMPLATE, language: 'en', status: 'PENDING' }]);
    await expect(callingService.requestPermission({ organizationId: 'org1', to: '917982722016' }))
      .rejects.toMatchObject({ code: 'CALL_PERMISSION_TEMPLATE_REQUIRED', message: expect.stringMatching(/waiting for Meta/) });
  });
});

describe('createPermissionTemplate', () => {
  it("submits Meta's call_permission_request component and stores the template as pending", async () => {
    api.createMessageTemplateByVersion.mockResolvedValue({ id: 'meta-123', status: 'PENDING' });
    db.template.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 't1', name: CALL_PERMISSION_TEMPLATE, status: 'PENDING', category: 'UTILITY', rejectionReason: null, bodyText: 'x' }]);

    const r = await callingService.createPermissionTemplate({ organizationId: 'org1' });

    const [waba, , payload] = api.createMessageTemplateByVersion.mock.calls[0];
    expect(waba).toBe('waba1');
    expect(payload).toMatchObject({ name: CALL_PERMISSION_TEMPLATE, language: 'en', category: 'UTILITY' });
    expect(payload.components).toEqual([expect.objectContaining({ type: 'BODY' }), { type: 'call_permission_request' }]);
    expect(db.template.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: CALL_PERMISSION_TEMPLATE, metaTemplateId: 'meta-123', status: 'PENDING', whatsappAccountId: 'wa1' }) });
    expect(r).toMatchObject({ status: 'PENDING' });
  });

  it('does not submit a second one while one is pending or approved', async () => {
    db.template.findMany.mockResolvedValue([{ id: 't1', name: CALL_PERMISSION_TEMPLATE, status: 'APPROVED' }]);
    await callingService.createPermissionTemplate({ organizationId: 'org1' });
    expect(api.createMessageTemplateByVersion).not.toHaveBeenCalled();
  });

  it('uses a fresh name after a rejection', async () => {
    api.createMessageTemplateByVersion.mockResolvedValue({ id: 'meta-9' });
    db.template.findMany.mockResolvedValue([{ id: 't1', name: CALL_PERMISSION_TEMPLATE, status: 'REJECTED' }]);
    await callingService.createPermissionTemplate({ organizationId: 'org1' });
    expect(api.createMessageTemplateByVersion.mock.calls[0][2].name).toBe(`${CALL_PERMISSION_TEMPLATE}_2`);
  });
});
