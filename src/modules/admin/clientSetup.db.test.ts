/**
 * The onboarder's setup sheet against a real Postgres.
 *
 * Most of what is tested is about the passwords: stored encrypted, never in the
 * sheet as read, readable only by the client's onboarder or a super admin, and
 * never in what is sent to TeamOS.
 *
 * Requires the local test DB:
 *   DATABASE_URL=postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../socket', () => ({ emitForceLogout: vi.fn() }));

import prisma from '../../config/database';
import { DEFAULT_ROWS, getSetup, revealSetupPassword, saveSetup } from './clientSetup';
import { projectClients } from '../sync/sync.project';
import { clientExternalId } from '../sync/sync.types';

const SUFFIX = `setup-${Date.now()}`;
const SECRET = `Muthu@${Date.now() % 100000}`;
let orgId = '';
let userId = '';
let onboarder = { id: '', role: 'onboarder' };
let otherOnboarder = { id: '', role: 'onboarder' };
let seller = { id: '', role: 'sales' };
let superAdmin = { id: '', role: 'super_admin' };
const admin = { id: 'some-admin', role: 'admin' };

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }
  const mk = async (role: string, tag: string) =>
    ({ id: (await prisma.adminUser.create({ data: { email: `${tag}-${SUFFIX}@t.local`, password: 'x', name: tag, role } })).id, role });
  onboarder = await mk('onboarder', 'onb');
  otherOnboarder = await mk('onboarder', 'onb2');
  seller = await mk('sales', 'seller');
  superAdmin = await mk('super_admin', 'sa');
  userId = (await prisma.user.create({ data: { email: `u-${SUFFIX}@t.local`, firstName: 'M', status: 'ACTIVE' } })).id;
  orgId = (
    await prisma.organization.create({
      data: { name: `Muthu ${SUFFIX}`, slug: SUFFIX, ownerId: userId, onboardedById: onboarder.id, soldById: seller.id },
    })
  ).id;
});

afterAll(async () => {
  if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  const ids = [onboarder.id, otherOnboarder.id, seller.id, superAdmin.id].filter(Boolean);
  await prisma.adminUser.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

const sheet = (password?: string | null) => ({
  businessType: 'Affiliate Marketing',
  done: true,
  items: [
    { label: 'Plan/Email', chargePaise: 89_900, chargeNote: '899 (B)', details: 'eswaranedits@gmail.com', status: 'Approved', ...(password !== undefined && { password }) },
    { label: 'Facebook', chargePaise: null, details: 'eswaranedits@gmail.com' },
    { label: 'Phone no.', chargePaise: 130_000, chargeNote: '700+600', details: '+447365177365\n+628386411938' },
    { label: 'Website', chargePaise: 50_000 },
    { label: 'Udyam', details: 'UDYAM-12-0195970' },
  ],
});

describe('a new sheet', () => {
  it('starts with the spreadsheet lines, unsaved', async () => {
    const s = await getSetup(orgId, onboarder);
    expect(s.items.map((i) => i.label)).toEqual([...DEFAULT_ROWS]);
    expect(s.items.every((i) => i.id === null)).toBe(true);
    expect(s.canSeeSecrets).toBe(true);
  });
});

describe('saving', () => {
  it("keeps the lines in order and adds up the charges", async () => {
    const s = await saveSetup(orgId, sheet(SECRET), onboarder);
    expect(s.items.map((i) => i.label)).toEqual(['Plan/Email', 'Facebook', 'Phone no.', 'Website', 'Udyam']);
    expect(s.totalPaise).toBe(269_900);
    expect(s.businessType).toBe('Affiliate Marketing');
    expect(s.done).toBe(true);
  });

  it('stores the password encrypted, and never returns it with the sheet', async () => {
    const row = await prisma.clientSetupItem.findFirstOrThrow({ where: { organizationId: orgId, label: 'Plan/Email' } });
    expect(row.passwordEnc).toBeTruthy();
    expect(row.passwordEnc).not.toContain(SECRET);

    const s = await getSetup(orgId, onboarder);
    const json = JSON.stringify(s);
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain(row.passwordEnc!);
    expect(s.items.find((i) => i.label === 'Plan/Email')!.hasPassword).toBe(true);
  });

  it('leaves the password alone when a save does not mention it', async () => {
    const s = await getSetup(orgId, onboarder);
    // What the screen sends back: the same lines, no password field.
    await saveSetup(orgId, { ...sheet(), items: s.items.map(({ hasPassword: _h, ...i }) => i) }, onboarder);
    const r = await revealSetupPassword(orgId, s.items[0]!.id!, onboarder);
    expect(r.password).toBe(SECRET);
  });

  it('removes lines that are no longer on the sheet', async () => {
    const s = await getSetup(orgId, onboarder);
    await saveSetup(orgId, { ...sheet(), items: s.items.slice(0, 2).map(({ hasPassword: _h, ...i }) => i) }, onboarder);
    expect(await prisma.clientSetupItem.count({ where: { organizationId: orgId } })).toBe(2);
  });

  it('refuses a line with no name, or a negative charge', async () => {
    await expect(saveSetup(orgId, { items: [{ label: ' ' }] }, onboarder)).rejects.toThrow(/needs a name/);
    await expect(saveSetup(orgId, { items: [{ label: 'X', chargePaise: -1 }] }, onboarder)).rejects.toThrow(/zero or more/);
  });
});

describe('who may see the passwords', () => {
  const itemId = async () =>
    (await prisma.clientSetupItem.findFirstOrThrow({ where: { organizationId: orgId, label: 'Plan/Email' } })).id;

  it("the client's onboarder and a super admin can", async () => {
    expect((await revealSetupPassword(orgId, await itemId(), onboarder)).password).toBe(SECRET);
    expect((await revealSetupPassword(orgId, await itemId(), superAdmin)).password).toBe(SECRET);
  });

  it('the seller, another onboarder and an ordinary admin cannot', async () => {
    for (const actor of [seller, otherOnboarder, admin]) {
      await expect(revealSetupPassword(orgId, await itemId(), actor)).rejects.toThrow(/onboarder or a super admin/);
    }
  });

  it('nor can they set or clear one, though they may edit the rest', async () => {
    const s = await getSetup(orgId, seller);
    expect(s.canSeeSecrets).toBe(false);
    const lines = s.items.map(({ hasPassword: _h, ...i }) => i);
    await expect(saveSetup(orgId, { items: [{ ...lines[0]!, password: 'hijacked' }] }, seller)).rejects.toThrow(/onboarder or a super admin/);
    await expect(saveSetup(orgId, { items: [{ ...lines[0]!, password: null }] }, seller)).rejects.toThrow(/onboarder or a super admin/);

    // Without touching the password, a seller's edit saves - and the password stays.
    await saveSetup(orgId, { businessType: 'Affiliate', items: lines.map((l) => ({ ...l, status: 'Done' })) }, seller);
    expect((await revealSetupPassword(orgId, await itemId(), onboarder)).password).toBe(SECRET);
  });

  it("a line's password can be cleared by the onboarder", async () => {
    const s = await getSetup(orgId, onboarder);
    const lines = s.items.map(({ hasPassword: _h, ...i }) => i);
    await saveSetup(orgId, { items: lines.map((l, n) => (n === 0 ? { ...l, password: null } : l)) }, onboarder);
    await expect(revealSetupPassword(orgId, await itemId(), onboarder)).rejects.toThrow(/No password/);
    await saveSetup(orgId, { items: lines.map((l, n) => (n === 0 ? { ...l, password: SECRET } : l)) }, onboarder);
  });
});

describe('what TeamOS is told', () => {
  it('the sheet, with which lines have a password - and no password at all', async () => {
    const clients = await projectClients('all');
    const c = clients.find((x) => x.externalId === clientExternalId(orgId))!;
    expect(c.setup.items.length).toBeGreaterThan(0);
    expect(c.setup.items.find((i) => i.label === 'Plan/Email')!.hasPassword).toBe(true);

    const row = await prisma.clientSetupItem.findFirstOrThrow({ where: { organizationId: orgId, label: 'Plan/Email' } });
    const json = JSON.stringify(c);
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain(row.passwordEnc!);
    expect(json).not.toContain('passwordEnc');
  });
});
