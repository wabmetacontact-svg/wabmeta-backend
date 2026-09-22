// src/modules/admin/orgControl.ts
//
// What an admin has decided about one organization: whether it may operate
// at all (status) and which plan limits it gets instead of the plan's
// (limitOverrides). Everything that has to obey those decisions reads them
// through here, so there is one cache and one set of rules.
//
// Status:
//   ACTIVE     normal.
//   READ_ONLY  the team can sign in, read its data and pay, but nothing is
//              sent - no campaigns, no bot or AI replies, no inbox replies.
//              Meant for "pay what you owe first".
//   SUSPENDED  nobody can sign in and nothing is sent. Inbound messages are
//              still saved, so nothing is lost if the org is reactivated.
//
// The cache is per process and lives CACHE_MS. An admin's change takes effect
// at once on the instance that served the admin request and within CACHE_MS
// everywhere else.

import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { addOnBoosts } from './addOns';

export type OrgStatus = 'ACTIVE' | 'SUSPENDED' | 'READ_ONLY';

export const LIMIT_KEYS = [
  'contacts',
  'messagesPerMonth',
  'whatsappNumbers',
  'teamMembers',
  'aiRepliesPerDay',
  'dailyCampaignMessages',
] as const;

export type LimitKey = (typeof LIMIT_KEYS)[number];
export type LimitOverrides = Partial<Record<LimitKey, number>>;

/** Same sentinel the plans use for "no limit". */
export const UNLIMITED = 999999;

export interface OrgControl {
  status: OrgStatus;
  statusReason: string | null;
  limitOverrides: LimitOverrides;
  /** Capacity added by active paid add-ons, on top of the limit. */
  addOnBoosts: LimitOverrides;
}

const CACHE_MS = 30_000;

const ACTIVE_DEFAULT: OrgControl = {
  status: 'ACTIVE',
  statusReason: null,
  limitOverrides: {},
  addOnBoosts: {},
};

// ─── Pure helpers ──────────────────────────────────────────────────────────

/**
 * Keep only known keys holding a positive whole number. Anything else is
 * dropped rather than rejected: a bad value must never turn into a limit of
 * zero that silently locks a customer out.
 */
export const parseLimitOverrides = (raw: unknown): LimitOverrides => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const out: LimitOverrides = {};
  for (const key of LIMIT_KEYS) {
    const n = Number((raw as Record<string, unknown>)[key]);
    if (Number.isFinite(n) && n >= 1) {
      out[key] = Math.min(Math.floor(n), UNLIMITED);
    }
  }
  return out;
};

/** The override for `key` if the admin set one, otherwise the plan's value. */
export const effectiveLimit = <T>(
  overrides: LimitOverrides | null | undefined,
  key: LimitKey,
  planValue: T
): number | T => overrides?.[key] ?? planValue;

export const parseOrgStatus = (raw: unknown): OrgStatus =>
  raw === 'SUSPENDED' || raw === 'READ_ONLY' ? raw : 'ACTIVE';

/** The error a blocked organization gets, with a code the client can show. */
export const orgBlockedError = (status: OrgStatus, reason?: string | null): AppError => {
  const suffix = reason ? ` Reason: ${reason}` : '';

  if (status === 'SUSPENDED') {
    return new AppError(
      `This account has been suspended. Please contact support.${suffix}`,
      403,
      'ORG_SUSPENDED'
    );
  }

  return new AppError(
    `This account is in read-only mode, so nothing can be sent or changed. Please contact support.${suffix}`,
    403,
    'ORG_READ_ONLY'
  );
};

/**
 * Whether a READ_ONLY organization may still make this request.
 *
 * Reads are always fine. Of the writes, only the ones that get the account
 * back into good standing are allowed: signing in and out, and paying.
 */
const READ_ONLY_WRITE_ALLOWED = [
  /^\/api\/auth\//,
  /^\/api\/billing\//,
  /^\/api\/wallet(\/|$)/,
  /^\/api\/notifications\//,
];

export const readOnlyAllows = (method: string, path: string): boolean => {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true;
  return READ_ONLY_WRITE_ALLOWED.some((re) => re.test(path));
};

/**
 * True for a Graph API call that delivers a message to a customer.
 *
 * Read receipts and typing indicators go to the same /messages endpoint but
 * send nothing, so they are left alone.
 */
export const isOutboundMessageCall = (config: {
  method?: string;
  url?: string;
  data?: unknown;
}): string | null => {
  if (String(config.method || '').toLowerCase() !== 'post') return null;

  const match = String(config.url || '').match(/^\/?([^/?#]+)\/messages(?:$|\?)/);
  if (!match) return null;

  let body: any = config.data;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  if (body?.status === 'read' || body?.typing_indicator) return null;

  return match[1];
};

// ─── Cache ─────────────────────────────────────────────────────────────────

const controlCache = new Map<string, { value: OrgControl; at: number }>();
const phoneOrgCache = new Map<string, { organizationId: string | null; at: number }>();

export const invalidateOrgControl = (organizationId?: string): void => {
  if (organizationId) controlCache.delete(organizationId);
  else controlCache.clear();
};

export const getOrgControl = async (organizationId: string): Promise<OrgControl> => {
  if (!organizationId) return ACTIVE_DEFAULT;

  const hit = controlCache.get(organizationId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  try {
    const [org, addOns] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { status: true, statusReason: true, limitOverrides: true },
      }),
      prisma.clientAddOn.findMany({
        where: { organizationId, removedAt: null },
        select: { type: true, quantity: true, startsAt: true, endsAt: true, removedAt: true },
      }),
    ]);

    const value: OrgControl = org
      ? {
          status: parseOrgStatus(org.status),
          statusReason: org.statusReason,
          limitOverrides: parseLimitOverrides(org.limitOverrides),
          addOnBoosts: addOnBoosts(addOns),
        }
      : ACTIVE_DEFAULT;

    controlCache.set(organizationId, { value, at: Date.now() });
    return value;
  } catch (err) {
    // A database hiccup must not stop every message on the platform. Use the
    // last known value if there is one, otherwise let the send through.
    if (hit) return hit.value;
    console.error('[orgControl] status lookup failed:', (err as Error)?.message);
    return ACTIVE_DEFAULT;
  }
};

export const getLimitOverrides = async (organizationId: string): Promise<LimitOverrides> =>
  (await getOrgControl(organizationId)).limitOverrides;

/** true when the organization may send messages right now. */
export const orgCanSend = async (organizationId: string): Promise<boolean> =>
  (await getOrgControl(organizationId)).status === 'ACTIVE';

export const assertOrgCanSend = async (organizationId: string): Promise<void> => {
  const control = await getOrgControl(organizationId);
  if (control.status !== 'ACTIVE') {
    throw orgBlockedError(control.status, control.statusReason);
  }
};

const orgForPhoneNumber = async (phoneNumberId: string): Promise<string | null> => {
  const hit = phoneOrgCache.get(phoneNumberId);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.organizationId;

  const account = await prisma.whatsAppAccount.findUnique({
    where: { phoneNumberId },
    select: { organizationId: true },
  });

  const organizationId = account?.organizationId ?? null;
  phoneOrgCache.set(phoneNumberId, { organizationId, at: Date.now() });
  return organizationId;
};

/**
 * Refuse any outbound WhatsApp message from a blocked organization.
 *
 * Installed as a request interceptor on every Graph API client, so it covers
 * senders nobody remembered to guard: chatbot, AI agent, automations, payment
 * links, inbox replies. Campaigns are paused before they get here (see
 * setOrganizationStatus); this is the backstop.
 */
export const installSendGuard = (client: AxiosInstance): void => {
  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const phoneNumberId = isOutboundMessageCall(config);
    if (!phoneNumberId) return config;

    let organizationId: string | null = null;
    try {
      organizationId = await orgForPhoneNumber(phoneNumberId);
    } catch {
      return config; // unknown number: not ours to block
    }

    if (organizationId) await assertOrgCanSend(organizationId);
    return config;
  });
};

// ─── Daily campaign cap ────────────────────────────────────────────────────

const IST_OFFSET_MS = 330 * 60_000;

/** Midnight in India, as a UTC instant. Customers read "per day" in IST. */
export const istDayStart = (now: Date = new Date()): Date => {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
};

/**
 * How many more campaign messages this organization may send today, or null
 * when no daily cap is set.
 */
export const remainingCampaignMessagesToday = async (
  organizationId: string
): Promise<number | null> => {
  const { limitOverrides } = await getOrgControl(organizationId);
  const cap = limitOverrides.dailyCampaignMessages;
  if (!cap || cap >= UNLIMITED) return null;

  const sent = await prisma.campaignContact.count({
    where: {
      campaign: { organizationId },
      sentAt: { gte: istDayStart() },
    },
  });

  return Math.max(0, cap - sent);
};
