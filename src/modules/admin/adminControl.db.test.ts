/**
 * Admin control against a real Postgres: blocking an organization, its
 * effect on campaigns, sessions and outbound sends, per-org limits, and the
 * read-only view-as-user token.
 *
 * Requires the local test DB:
 *   DATABASE_URL=postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../socket', () => ({ emitForceLogout: vi.fn() }));

import axios from 'axios';
import prisma from '../../config/database';
import { verifyAccessToken } from '../../utils/jwt';
import {
  forceLogoutUser,
  getOrganizationLimits,
  impersonateUser,
  setOrganizationStatus,
  updateOrganizationLimits,
} from './admin.control.service';
import {
  getOrgControl,
  installSendGuard,
  invalidateOrgControl,
  orgCanSend,
  remainingCampaignMessagesToday,
} from './orgControl';

const SUFFIX = `adminctl-${Date.now()}`;
const actor = { id: 'admin-test', email: 'admin@test.local' };

let organizationId: string;
let userId: string;
let campaignId: string;
const phoneNumberId = `pn-${SUFFIX}`;

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }
  const user = await prisma.user.create({
    data: { email: `${SUFFIX}@wabmeta.local`, firstName: 'Owner', status: 'ACTIVE', emailVerified: true },
  });
  userId = user.id;
  const org = await prisma.organization.create({ data: { name: 'Acme', slug: SUFFIX, ownerId: userId } });
  organizationId = org.id;
  await prisma.organizationMember.create({ data: { organizationId, userId, role: 'OWNER' } });

  const wa = await prisma.whatsAppAccount.create({
    data: {
      organizationId, phoneNumberId, wabaId: `waba-${SUFFIX}`,
      phoneNumber: '+10000000002', displayName: 'Acme', accessToken: 'x', status: 'CONNECTED',
    },
  });
  const template = await prisma.template.create({
    data: { organizationId, name: `t_${Date.now()}`, bodyText: 'Hi' } as any,
  });
  const campaign = await prisma.campaign.create({
    data: {
      organizationId, name: 'Promo', templateId: template.id,
      whatsappAccountId: wa.id, createdById: userId, status: 'RUNNING',
    } as any,
  });
  campaignId = campaign.id;

  await prisma.refreshToken.create({
    data: { token: `rt-${SUFFIX}`, userId, expiresAt: new Date(Date.now() + 86_400_000) },
  });
});

afterAll(async () => {
  if (!organizationId || !userId) {
    await prisma.$disconnect();
    return;
  }
  await prisma.campaignContact.deleteMany({ where: { campaign: { organizationId } } });
  await prisma.campaign.deleteMany({ where: { organizationId } });
  await prisma.template.deleteMany({ where: { organizationId } });
  await prisma.whatsAppAccount.deleteMany({ where: { organizationId } });
  await prisma.organizationMember.deleteMany({ where: { organizationId } });
  await prisma.refreshToken.deleteMany({ where: { userId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('organization status', () => {
  it('a new organization is ACTIVE and can send', async () => {
    expect((await getOrgControl(organizationId)).status).toBe('ACTIVE');
    expect(await orgCanSend(organizationId)).toBe(true);
  });

  it('refuses to block without a reason', async () => {
    await expect(setOrganizationStatus(organizationId, 'SUSPENDED', '  ', actor)).rejects.toThrow(/reason/i);
  });

  it('suspending pauses running campaigns and ends every session', async () => {
    const before = await prisma.user.findUnique({ where: { id: userId } });

    const result = await setOrganizationStatus(organizationId, 'SUSPENDED', 'Unpaid invoice', actor);

    expect(result.organization.status).toBe('SUSPENDED');
    expect(result.campaignsPaused).toBe(1);
    expect(result.usersLoggedOut).toBe(1);

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    expect(campaign?.status).toBe('PAUSED');

    const after = await prisma.user.findUnique({ where: { id: userId } });
    expect(after!.tokenVersion).toBe(before!.tokenVersion + 1);
    expect(await prisma.refreshToken.count({ where: { userId } })).toBe(0);

    expect(await orgCanSend(organizationId)).toBe(false);
  });

  it('the send guard refuses a WhatsApp message from a blocked organization', async () => {
    const client = axios.create({ baseURL: 'http://127.0.0.1:9' });
    installSendGuard(client);

    await expect(
      client.post(`${phoneNumberId}/messages`, { to: '91', type: 'text' })
    ).rejects.toMatchObject({ code: 'ORG_SUSPENDED' });

    // A read receipt is not a send and is not the guard's business: it gets
    // past the guard and fails only on the unreachable test host.
    await expect(
      client.post(`${phoneNumberId}/messages`, { status: 'read', message_id: 'm' })
    ).rejects.not.toMatchObject({ code: 'ORG_SUSPENDED' });
  });

  it('reactivating clears the reason but leaves campaigns paused', async () => {
    const result = await setOrganizationStatus(organizationId, 'ACTIVE', undefined, actor);
    expect(result.organization.status).toBe('ACTIVE');
    expect(result.organization.statusReason).toBe(null);
    expect(await orgCanSend(organizationId)).toBe(true);

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    expect(campaign?.status).toBe('PAUSED');
  });
});

describe('limits', () => {
  it('sets, reads and clears overrides', async () => {
    const set = await updateOrganizationLimits(organizationId, { contacts: 20000, dailyCampaignMessages: 3 });
    expect(set.overrides).toEqual({ contacts: 20000, dailyCampaignMessages: 3 });
    expect(set.effective.contacts).toBe(20000);

    // Leaving a key out keeps it; null removes it.
    const cleared = await updateOrganizationLimits(organizationId, { contacts: null });
    expect(cleared.overrides).toEqual({ dailyCampaignMessages: 3 });

    const read = await getOrganizationLimits(organizationId);
    expect(read.overrides).toEqual({ dailyCampaignMessages: 3 });
  });

  it('counts today\'s campaign sends against the daily cap', async () => {
    invalidateOrgControl(organizationId);
    expect(await remainingCampaignMessagesToday(organizationId)).toBe(3);

    const contact = await prisma.contact.create({
      data: { organizationId, phone: `+9199${Date.now().toString().slice(-8)}` } as any,
    });
    await prisma.campaignContact.create({
      data: { campaignId, contactId: contact.id, status: 'SENT', sentAt: new Date() },
    });

    expect(await remainingCampaignMessagesToday(organizationId)).toBe(2);

    await prisma.campaignContact.deleteMany({ where: { campaignId } });
    await prisma.contact.delete({ where: { id: contact.id } });
  });

  it('no cap means no limit', async () => {
    await updateOrganizationLimits(organizationId, { dailyCampaignMessages: null });
    expect(await remainingCampaignMessagesToday(organizationId)).toBe(null);
  });
});

describe('sessions and view-as-user', () => {
  it('force logout bumps tokenVersion', async () => {
    const before = await prisma.user.findUnique({ where: { id: userId } });
    await forceLogoutUser(userId);
    const after = await prisma.user.findUnique({ where: { id: userId } });
    expect(after!.tokenVersion).toBe(before!.tokenVersion + 1);
  });

  it('issues a read-only token scoped to the user and organization', async () => {
    await expect(impersonateUser(userId, undefined, '', actor)).rejects.toThrow(/reason/i);
    await expect(impersonateUser(userId, 'not-a-member-org', 'support ticket', actor)).rejects.toThrow(
      /not a member/
    );

    const view = await impersonateUser(userId, organizationId, 'support ticket #42', actor);
    const decoded = verifyAccessToken(view.accessToken);

    expect(view.readOnly).toBe(true);
    expect(decoded.userId).toBe(userId);
    expect(decoded.organizationId).toBe(organizationId);
    expect(decoded.impersonatedBy).toBe(actor.id);
    expect((decoded.exp! - decoded.iat!)).toBe(30 * 60);
  });
});
