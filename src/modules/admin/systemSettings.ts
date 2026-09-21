// src/modules/admin/systemSettings.ts
//
// Platform-wide switches an admin flips from the panel.
//
// These used to live in a variable inside admin.service.ts: a restart reset
// them, each server instance had its own copy, and nothing outside the admin
// module read them - so turning on maintenance mode did nothing at all. They
// are now one row in SystemSetting, and the switches below are enforced.
//
// Enforced:   maintenanceMode (+ maintenanceMessage), allowRegistration,
//             maxOrganizationsPerUser.
// Stored only: defaultPlanType, smtpEnabled - kept so the panel does not lose
//             them, but nothing acts on them yet.

import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowRegistration: boolean;
  maxOrganizationsPerUser: number;
  defaultPlanType: string;
  smtpEnabled: boolean;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  maintenanceMode: false,
  maintenanceMessage: '',
  allowRegistration: true,
  maxOrganizationsPerUser: 5,
  defaultPlanType: 'FREE_DEMO',
  smtpEnabled: true,
};

const SETTINGS_KEY = 'platform';
const CACHE_MS = 15_000;

let cache: { value: SystemSettings; at: number } | null = null;

/** Merge stored values over the defaults, ignoring anything of the wrong type. */
export const normalizeSettings = (raw: unknown): SystemSettings => {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: SystemSettings = { ...DEFAULT_SETTINGS };

  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SystemSettings)[]) {
    const value = src[key];
    if (typeof value === typeof DEFAULT_SETTINGS[key]) {
      (out as any)[key] = value;
    }
  }

  if (!Number.isFinite(out.maxOrganizationsPerUser) || out.maxOrganizationsPerUser < 1) {
    out.maxOrganizationsPerUser = DEFAULT_SETTINGS.maxOrganizationsPerUser;
  }
  out.maintenanceMessage = out.maintenanceMessage.slice(0, 500);
  return out;
};

export const getSystemSettings = async (): Promise<SystemSettings> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const value = normalizeSettings(row?.value);
    cache = { value, at: Date.now() };
    return value;
  } catch (err) {
    // Never take the platform down because the settings row could not load.
    console.error('[systemSettings] load failed:', (err as Error)?.message);
    return cache?.value ?? DEFAULT_SETTINGS;
  }
};

export const updateSystemSettings = async (
  patch: Partial<SystemSettings>,
  adminId?: string
): Promise<SystemSettings> => {
  const current = await getSystemSettings();
  const next = normalizeSettings({ ...current, ...patch });

  await prisma.systemSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: next as any, updatedBy: adminId },
    update: { value: next as any, updatedBy: adminId },
  });

  cache = { value: next, at: Date.now() };
  return next;
};

// ─── Enforcement ───────────────────────────────────────────────────────────

/**
 * Paths that keep working during maintenance: the admin panel (to switch it
 * off again), inbound webhooks (Meta and Razorpay retry for a while, but not
 * forever), health checks, and the status endpoint the apps poll.
 */
const MAINTENANCE_EXEMPT = [
  /^\/api\/admin(\/|$)/,
  /^\/api\/webhooks(\/|$)/,
  /^\/api\/health(\/|$)/,
  /^\/api\/system(\/|$)/,
];

export const maintenanceExempt = (path: string): boolean =>
  !path.startsWith('/api/') || MAINTENANCE_EXEMPT.some((re) => re.test(path));

export const maintenanceGate = async (req: Request, res: Response, next: NextFunction) => {
  const path = (req.originalUrl || req.url || '').split('?')[0];
  if (req.method === 'OPTIONS' || maintenanceExempt(path)) return next();

  const settings = await getSystemSettings();
  if (!settings.maintenanceMode) return next();

  res.status(503).json({
    success: false,
    code: 'MAINTENANCE',
    message:
      settings.maintenanceMessage ||
      'WabMeta is down for scheduled maintenance. Please try again shortly.',
  });
};

/** Public: what the web and mobile apps need to know before signing in. */
export const systemStatusHandler = async (_req: Request, res: Response) => {
  const s = await getSystemSettings();
  res.json({
    success: true,
    data: {
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
      allowRegistration: s.allowRegistration,
    },
  });
};

export const assertRegistrationOpen = async (): Promise<void> => {
  const s = await getSystemSettings();
  if (!s.allowRegistration) {
    throw new AppError(
      'New sign-ups are paused at the moment. Please try again later.',
      403,
      'REGISTRATION_CLOSED'
    );
  }
};
