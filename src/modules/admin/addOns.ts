// src/modules/admin/addOns.ts
//
// Capacity add-ons sold to a client, and what they do to the client's limits.
//
// An active add-on raises one limit by quantity x perUnit on top of whatever
// the client has without it (the plan, or an admin override). Removing it, or
// its end date passing, takes the capacity away again. Features never come
// from add-ons - they stay a plan decision.

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { LimitKey, UNLIMITED } from './orgControl';

export type AddOnType = 'EXTRA_SEAT' | 'EXTRA_NUMBER' | 'AI_TOPUP' | 'CUSTOM';

interface CatalogItem {
  label: string;
  /** The limit this add-on raises; null = a bill line only. */
  limitKey: LimitKey | null;
  perUnit: number;
  defaultPricePaise: number;
  billing: 'MONTHLY' | 'ONE_TIME';
  /** One-time add-ons that expire on their own after this many days. */
  validDays?: number;
}

// Prices are the approved add-on prices; the person selling can change the
// price on each line.
export const ADDON_CATALOG: Record<AddOnType, CatalogItem> = {
  EXTRA_SEAT: {
    label: 'Extra team seat',
    limitKey: 'teamMembers',
    perUnit: 1,
    defaultPricePaise: 39900,
    billing: 'MONTHLY',
  },
  EXTRA_NUMBER: {
    label: 'Extra WhatsApp number',
    limitKey: 'whatsappNumbers',
    perUnit: 1,
    defaultPricePaise: 49900,
    billing: 'MONTHLY',
  },
  // The AI quota is counted per day, so 1,000 replies are given as 34 more
  // per day for 30 days.
  AI_TOPUP: {
    label: 'AI top-up (1,000 replies over 30 days)',
    limitKey: 'aiRepliesPerDay',
    perUnit: 34,
    defaultPricePaise: 49900,
    billing: 'ONE_TIME',
    validDays: 30,
  },
  CUSTOM: {
    label: 'Other (setup, service, custom)',
    limitKey: null,
    perUnit: 0,
    defaultPricePaise: 0,
    billing: 'ONE_TIME',
  },
};

export const isAddOnType = (v: unknown): v is AddOnType =>
  typeof v === 'string' && v in ADDON_CATALOG;

interface AddOnRow {
  type: string;
  quantity: number;
  startsAt: Date;
  endsAt: Date | null;
  removedAt: Date | null;
}

export const isAddOnActive = (a: AddOnRow, now = new Date()): boolean =>
  !a.removedAt && a.startsAt <= now && (!a.endsAt || a.endsAt > now);

/** How much each limit goes up because of the active add-ons. */
export const addOnBoosts = (rows: AddOnRow[], now = new Date()): Partial<Record<LimitKey, number>> => {
  const out: Partial<Record<LimitKey, number>> = {};
  for (const a of rows) {
    if (!isAddOnActive(a, now) || !isAddOnType(a.type)) continue;
    const item = ADDON_CATALOG[a.type];
    if (!item.limitKey) continue;
    out[item.limitKey] = (out[item.limitKey] ?? 0) + Math.max(0, a.quantity) * item.perUnit;
  }
  return out;
};

/**
 * A limit with add-ons on top. "No limit" and "unlimited" stay that way -
 * an add-on can only raise a real number.
 */
export const withBoost = <T extends number | null | undefined>(base: T, boost: number | undefined): T | number => {
  if (!boost) return base;
  if (base === null || base === undefined) return base;
  if (!Number.isFinite(base) || base <= 0 || base >= UNLIMITED) return base;
  return base + boost;
};

export const getAddOnBoosts = async (
  organizationId: string,
  db: { clientAddOn: any } = prisma as any
): Promise<Partial<Record<LimitKey, number>>> => {
  const rows = await db.clientAddOn.findMany({
    where: { organizationId, removedAt: null },
    select: { type: true, quantity: true, startsAt: true, endsAt: true, removedAt: true },
  });
  return addOnBoosts(rows);
};

// ─── Managing add-ons ──────────────────────────────────────────────────────

export const listAddOns = (organizationId: string) =>
  prisma.clientAddOn.findMany({
    where: { organizationId },
    orderBy: [{ removedAt: 'asc' }, { createdAt: 'desc' }],
  });

export const addClientAddOn = async (
  organizationId: string,
  input: { type: string; quantity?: number; unitPricePaise?: number; label?: string; note?: string; startsAt?: string },
  actor: { id: string; email?: string }
) => {
  if (!isAddOnType(input.type)) throw new AppError('Unknown add-on type', 400);
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) throw new AppError('Organization not found', 404);

  const item = ADDON_CATALOG[input.type];
  const quantity = Math.max(1, Math.floor(Number(input.quantity) || 1));
  const unitPricePaise = Math.max(0, Math.floor(Number(input.unitPricePaise ?? item.defaultPricePaise)));
  const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
  const label = (input.label?.trim() || item.label).slice(0, 120);

  if (input.type === 'CUSTOM' && !input.label?.trim()) {
    throw new AppError('Describe what this line is for.', 400);
  }

  const addOn = await prisma.clientAddOn.create({
    data: {
      organizationId,
      type: input.type,
      label,
      quantity,
      unitPricePaise,
      billing: item.billing,
      startsAt,
      endsAt: item.validDays ? new Date(startsAt.getTime() + item.validDays * 86_400_000) : null,
      note: input.note?.slice(0, 500) || null,
      createdById: actor.id,
      createdByEmail: actor.email,
    },
  });

  const { invalidateOrgControl } = await import('./orgControl');
  invalidateOrgControl(organizationId);
  return addOn;
};

/** Ends an add-on now. The row stays, so the bill keeps its history. */
export const removeClientAddOn = async (organizationId: string, addOnId: string, actor: { id: string; email?: string }) => {
  const { count } = await prisma.clientAddOn.updateMany({
    where: { id: addOnId, organizationId, removedAt: null },
    data: { removedAt: new Date(), removedBy: actor.email || actor.id },
  });
  if (count === 0) throw new AppError('Add-on not found or already removed', 404);

  const { invalidateOrgControl } = await import('./orgControl');
  invalidateOrgControl(organizationId);
};
