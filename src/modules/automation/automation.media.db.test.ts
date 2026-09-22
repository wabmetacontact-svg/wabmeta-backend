/**
 * MEDIA_RECEIVED automations end to end against a real Postgres: an image
 * arrives, the automation sends buttons and creates a CRM lead on the
 * configured stage with the configured value.
 *
 * Requires the local test DB:
 *   DATABASE_URL=postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { sent } = vi.hoisted(() => ({ sent: [] as any[] }));

vi.mock('../whatsapp/whatsapp.service', () => ({
  whatsappService: {
    sendTextMessage: vi.fn(async (_a: string, to: string, text: string) => {
      sent.push({ kind: 'text', to, text });
      return {};
    }),
    sendTemplateMessage: vi.fn(async () => ({ waMessageId: 'wamid.t' })),
    sendMediaMessage: vi.fn(async () => ({})),
    sendMessage: vi.fn(async (o: any) => {
      sent.push({ kind: o.type, to: o.to, content: o.content });
      return {};
    }),
  },
}));
vi.mock('../wallet/wallet.deduction.service', () => ({
  deductWalletForTemplate: vi.fn(async () => ({ deducted: false, amount: 0 })),
}));
vi.mock('../notifications/notifications.service', () => ({
  notificationsService: { create: vi.fn(async (n: any) => n) },
}));

import prisma from '../../config/database';
import { automationEngine } from './automation.engine';

const SUFFIX = `media-${Date.now()}`;
let organizationId: string;
let userId: string;
let contactId: string;
let conversationId: string;
let stageId: string;
let pipelineId: string;
const phone = `+9198${Date.now().toString().slice(-8)}`;

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }
  userId = (await prisma.user.create({ data: { email: `${SUFFIX}@t.local`, firstName: 'O', status: 'ACTIVE' } })).id;
  organizationId = (await prisma.organization.create({ data: { name: 'Media', slug: SUFFIX, ownerId: userId } })).id;
  await prisma.whatsAppAccount.create({
    data: {
      organizationId, phoneNumberId: `pn-${SUFFIX}`, wabaId: `waba-${SUFFIX}`, phoneNumber: '+10000000009',
      displayName: 'Media', accessToken: 'x', status: 'CONNECTED', isDefault: true,
    } as any,
  });
  const contact = await prisma.contact.create({ data: { organizationId, phone, countryCode: '91', firstName: 'Asha' } });
  contactId = contact.id;
  conversationId = (
    await prisma.conversation.create({
      data: {
        organizationId, contactId, channel: 'WHATSAPP', lastCustomerMessageAt: new Date(),
        windowExpiresAt: new Date(Date.now() + 23 * 3600_000), isWindowOpen: true,
      },
    })
  ).id;
  const pipeline = await prisma.pipeline.create({
    data: {
      organizationId, name: 'Sales', isDefault: true,
      stages: { create: [{ name: 'New', order: 0 }, { name: 'Proof received', order: 1 }] },
    },
    include: { stages: true },
  });
  pipelineId = pipeline.id;
  stageId = pipeline.stages.find((s) => s.name === 'Proof received')!.id;
});

beforeEach(async () => {
  sent.length = 0;
  await prisma.automationSequence.deleteMany({ where: { automation: { organizationId } } });
  await prisma.automation.deleteMany({ where: { organizationId } });
  await prisma.lead.deleteMany({ where: { organizationId } });
});

afterAll(async () => {
  if (!organizationId) {
    await prisma.$disconnect();
    return;
  }
  await prisma.leadActivity.deleteMany({ where: { lead: { organizationId } } }).catch(() => undefined);
  await prisma.lead.deleteMany({ where: { organizationId } });
  await prisma.automationJob.deleteMany({ where: { organizationId } });
  await prisma.automationSequence.deleteMany({ where: { automation: { organizationId } } });
  await prisma.automation.deleteMany({ where: { organizationId } });
  await prisma.pipeline.deleteMany({ where: { organizationId } });
  await prisma.conversation.deleteMany({ where: { organizationId } });
  await prisma.contact.deleteMany({ where: { organizationId } });
  await prisma.whatsAppAccount.deleteMany({ where: { organizationId } });
  await prisma.organizationSettings.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

const makeMediaAutomation = (triggerConfig: any, actions: any[]) =>
  prisma.automation.create({
    data: { organizationId, name: `M ${Math.random()}`, trigger: 'MEDIA_RECEIVED' as any, triggerConfig, actions, isActive: true },
  });

const image = (caption?: string) =>
  automationEngine.triggerMediaReceived({
    organizationId, contactId, phone, conversationId,
    message: caption || '[Image]',
    media: { type: 'IMAGE', id: 'media-1', caption },
  });

describe('MEDIA_RECEIVED', () => {
  it('an image sends buttons and creates a lead on the chosen stage with a value', async () => {
    await makeMediaAutomation({ mediaTypes: ['IMAGE'] }, [
      {
        id: 'b', type: 'send_buttons',
        config: { text: 'Thanks {{name}}! Got your {{media_type}}. Is this the payment proof?', buttons: [{ text: 'Yes' }, { text: 'No' }] },
      },
      { id: 'l', type: 'create_lead', config: { title: 'Proof from {{name}}', stageId, value: 2999, priority: 'HIGH' } },
    ]);

    expect(await image('paid')).toBe(true);

    const buttons = sent.find((s) => s.kind === 'interactive');
    expect(buttons.to).toBe(phone);
    expect(buttons.content.interactive.body.text).toBe('Thanks Asha! Got your image. Is this the payment proof?');
    expect(buttons.content.interactive.action.buttons).toHaveLength(2);

    const lead = await prisma.lead.findFirst({ where: { organizationId, contactId } });
    expect(lead!.title).toBe('Proof from Asha');
    expect(lead!.stageId).toBe(stageId);
    expect(lead!.pipelineId).toBe(pipelineId);
    expect(Number(lead!.value)).toBe(2999);
    expect(lead!.priority).toBe('HIGH');
    expect(lead!.source).toBe('automation');
  });

  it('does not fire for a video when only images are chosen, or without the caption word', async () => {
    await makeMediaAutomation({ mediaTypes: ['IMAGE'], captionKeywords: ['receipt'] }, [
      { id: 't', type: 'send_text', config: { text: 'got it' } },
    ]);
    expect(await image('hello')).toBe(false);
    expect(
      await automationEngine.triggerMediaReceived({
        organizationId, contactId, phone, conversationId, media: { type: 'VIDEO', caption: 'receipt' },
      })
    ).toBe(false);
    expect(await image('my receipt')).toBe(true);
  });

  it('an existing open lead is left alone unless the step says to move it', async () => {
    const newStage = await prisma.pipelineStage.findFirst({ where: { pipelineId, name: 'New' } });
    await prisma.lead.create({ data: { organizationId, contactId, title: 'Old', pipelineId, stageId: newStage!.id } });

    await makeMediaAutomation({}, [{ id: 'l', type: 'create_lead', config: { stageId } }]);
    await image();
    let lead = await prisma.lead.findFirst({ where: { organizationId, contactId } });
    expect(lead!.stageId).toBe(newStage!.id);
    expect(await prisma.lead.count({ where: { organizationId, contactId } })).toBe(1);

    await prisma.automation.deleteMany({ where: { organizationId } });
    await prisma.automationSequence.deleteMany({ where: { contactId } });
    await makeMediaAutomation({}, [{ id: 'l', type: 'create_lead', config: { stageId, ifExists: 'move_stage' } }]);
    await image();
    lead = await prisma.lead.findFirst({ where: { organizationId, contactId } });
    expect(lead!.stageId).toBe(stageId);
  });

  it('a link button goes out as cta_url', async () => {
    await makeMediaAutomation({}, [
      { id: 'u', type: 'send_buttons', config: { mode: 'url', text: 'Pay here', url: 'https://example.com/pay', urlText: 'Pay now' } },
    ]);
    await image();
    const msg = sent.find((s) => s.kind === 'interactive');
    expect(msg.content.interactive.type).toBe('cta_url');
    expect(msg.content.interactive.action.parameters.url).toBe('https://example.com/pay');
  });
});
