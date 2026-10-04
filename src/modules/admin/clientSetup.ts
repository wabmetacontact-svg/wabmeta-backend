// src/modules/admin/clientSetup.ts
//
// The onboarder's setup sheet for a client - what used to be a spreadsheet:
// one line per thing set up (plan, Facebook, phone numbers, website, Udyam),
// what it was charged, the IDs, a status, and sometimes a password.
//
// Charges are a record, not revenue. Money is revenue once it is recorded as a
// payment; counting it here too would count the same rupee twice.
//
// Passwords are the reason this file is careful:
//   - stored encrypted (utils/encryption, ENCRYPTION_KEY);
//   - never part of the sheet that is read - only "this line has one";
//   - read one at a time, and only by the client's onboarder or a super admin;
//   - set or cleared only by those same people;
//   - never sent to TeamOS. One copy of a secret is one place it can leak.
// The admin audit middleware already writes any body field called "password"
// as [redacted], and every read goes through a POST, so it is audited too.

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { decrypt, encrypt } from '../../utils/encryption';

interface Actor {
  id: string;
  role?: string;
}

/** The lines every new sheet starts with - the ones on the spreadsheet. */
export const DEFAULT_ROWS = ['Plan/Email', 'Facebook', 'Phone no.', 'Website', 'Onboarding', 'Udyam'] as const;

const MAX_ROWS = 40;

/** Who may see and set this client's passwords: its onboarder, or a super admin. */
export const canSeeSecrets = (actor: Actor, org: { onboardedById: string | null }) =>
  actor.role === 'super_admin' || (!!org.onboardedById && org.onboardedById === actor.id);

export interface SetupLineInput {
  id?: string | null;
  label: string;
  chargePaise?: number | null;
  chargeNote?: string;
  details?: string;
  status?: string;
  /**
   * undefined keeps the stored password, null or "" clears it, anything else
   * replaces it. Only honoured for someone who may see secrets.
   */
  password?: string | null;
}

export interface SetupInput {
  businessType?: string | null;
  done?: boolean;
  items: SetupLineInput[];
}

/** The sheet, without any password - only whether each line has one. */
export const getSetup = async (organizationId: string, actor: Actor) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      businessType: true,
      setupDoneAt: true,
      onboardedById: true,
      setupItems: { orderBy: { position: 'asc' } },
    },
  });
  if (!org) throw new AppError('Organization not found', 404);

  // A sheet nobody has saved yet starts with the spreadsheet's lines, so the
  // onboarder fills it in rather than building it.
  const items = org.setupItems.length
    ? org.setupItems.map((i) => ({
        id: i.id as string | null,
        label: i.label,
        chargePaise: i.chargePaise,
        chargeNote: i.chargeNote,
        details: i.details,
        status: i.status,
        hasPassword: i.passwordEnc !== null,
      }))
    : DEFAULT_ROWS.map((label) => ({
        id: null,
        label,
        chargePaise: null,
        chargeNote: '',
        details: '',
        status: '',
        hasPassword: false,
      }));

  return {
    organizationId: org.id,
    businessType: org.businessType ?? '',
    done: org.setupDoneAt !== null,
    doneAt: org.setupDoneAt,
    totalPaise: items.reduce((sum, i) => sum + (i.chargePaise ?? 0), 0),
    canSeeSecrets: canSeeSecrets(actor, org),
    items,
  };
};

/**
 * Saves the whole sheet: lines kept, changed, added and removed, in one
 * transaction, in the order given.
 */
export const saveSetup = async (organizationId: string, input: SetupInput, actor: Actor) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, onboardedById: true, setupDoneAt: true },
  });
  if (!org) throw new AppError('Organization not found', 404);

  if (!Array.isArray(input.items)) throw new AppError('The sheet has no lines.', 400);
  if (input.items.length > MAX_ROWS) throw new AppError(`A sheet can have at most ${MAX_ROWS} lines.`, 400);

  const secrets = canSeeSecrets(actor, org);
  const lines = input.items.map((l, position) => {
    const label = String(l.label ?? '').trim().slice(0, 80);
    if (!label) throw new AppError(`Line ${position + 1} needs a name.`, 400);
    const charge = l.chargePaise === null || l.chargePaise === undefined ? null : Math.round(Number(l.chargePaise));
    if (charge !== null && (!Number.isFinite(charge) || charge < 0)) {
      throw new AppError(`"${label}": the charge must be zero or more.`, 400);
    }
    if (l.password !== undefined && !secrets) {
      throw new AppError("Only this client's onboarder or a super admin can set a password.", 403);
    }
    return {
      id: l.id || null,
      position,
      label,
      chargePaise: charge,
      chargeNote: String(l.chargeNote ?? '').slice(0, 120),
      details: String(l.details ?? '').slice(0, 2000),
      status: String(l.status ?? '').trim().slice(0, 40),
      password: l.password,
    };
  });

  await prisma.$transaction(async (tx) => {
    const existing = await tx.clientSetupItem.findMany({ where: { organizationId }, select: { id: true } });
    const known = new Set(existing.map((e) => e.id));
    const keep = new Set(lines.map((l) => l.id).filter((id): id is string => !!id && known.has(id)));

    // Lines that are no longer on the sheet, password and all.
    await tx.clientSetupItem.deleteMany({ where: { organizationId, id: { notIn: [...keep] } } });

    for (const l of lines) {
      const passwordData =
        l.password === undefined ? {} : { passwordEnc: l.password ? encrypt(String(l.password)) : null };
      const data = {
        position: l.position,
        label: l.label,
        chargePaise: l.chargePaise,
        chargeNote: l.chargeNote,
        details: l.details,
        status: l.status,
        updatedById: actor.id,
        ...passwordData,
      };
      if (l.id && keep.has(l.id)) {
        await tx.clientSetupItem.update({ where: { id: l.id }, data });
      } else {
        await tx.clientSetupItem.create({ data: { organizationId, ...data } });
      }
    }

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        businessType: input.businessType ? String(input.businessType).trim().slice(0, 80) : null,
        // The first time it was finished, kept while it stays finished.
        setupDoneAt: input.done ? (org.setupDoneAt ?? new Date()) : null,
      },
    });
  });

  return getSetup(organizationId, actor);
};

/** One line's password, for the client's onboarder or a super admin. */
export const revealSetupPassword = async (organizationId: string, itemId: string, actor: Actor) => {
  const item = await prisma.clientSetupItem.findFirst({
    where: { id: itemId, organizationId },
    select: { passwordEnc: true, organization: { select: { onboardedById: true } } },
  });
  if (!item) throw new AppError('That line no longer exists.', 404);
  if (!canSeeSecrets(actor, item.organization)) {
    throw new AppError("Only this client's onboarder or a super admin can see its passwords.", 403);
  }
  if (!item.passwordEnc) throw new AppError('No password is saved on this line.', 404);
  const password = decrypt(item.passwordEnc);
  if (password === null) throw new AppError('The saved password could not be read.', 500);
  return { password };
};
