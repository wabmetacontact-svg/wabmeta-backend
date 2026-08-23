// src/middleware/featureLock.ts

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from './errorHandler';

/**
 * Feature Lock
 *
 * Ek feature do wajah se locked ho sakta hai:
 *
 *   1. Billing plan usme wo feature deta hi nahi (plan ka limit 0 hai) —
 *      jaise FREE_DEMO par maxChatbots = 0, MONTHLY par maxAutomations = 0.
 *   2. Admin ne manually lock kiya hai (featureXLocked columns).
 *
 * "Effective lock" = (1) OR (2). Clients ko yahi bheja jaata hai aur yahi
 * server par enforce hota hai, taaki dono jagah ek hi sach rahe.
 *
 * Usage:
 *   router.use(authenticate);
 *   router.use(featureLock('campaigns'));
 */

export type LockableFeature =
  | 'inbox'
  | 'campaigns'
  | 'chatbot'
  | 'automation'
  | 'connection';

export interface EffectiveFeatureLocks {
  inbox: boolean;
  campaigns: boolean;
  chatbot: boolean;
  automation: boolean;
  connection: boolean;
}

const LABEL: Record<LockableFeature, string> = {
  inbox: 'Inbox',
  campaigns: 'Campaigns',
  chatbot: 'Chatbot',
  automation: 'Automation',
  connection: 'WhatsApp Connection',
};

// Har request par org + plan fetch karna mehnga hai (app server aur DB alag
// region mein hain, ek round trip ~240ms). Isliye chhota TTL cache - aur
// admin ke flags ya plan badalne par invalidateFeatureLocks() se turant clear.
const lockCache = new Map<
  string,
  { locks: EffectiveFeatureLocks; expiresAt: number }
>();
const CACHE_TTL = 60 * 1000;

export const invalidateFeatureLocks = (organizationId?: string) => {
  if (organizationId) lockCache.delete(organizationId);
  else lockCache.clear();
};

// Plan limit 0 ka matlab hai feature plan mein shamil hi nahi.
// Limit undefined ho (plan row missing) to lock mat karo - warna plan data
// missing hone par sabka access band ho jayega.
const limitLocks = (limit: number | null | undefined): boolean => limit === 0;

export const computeFeatureLocks = (org: any): EffectiveFeatureLocks => {
  const plan = org?.subscription?.plan;

  return {
    // Inbox har plan mein hai - sirf admin lock kar sakta hai
    inbox: org?.featureInboxLocked === true,
    campaigns:
      org?.featureCampaignsLocked === true || limitLocks(plan?.maxCampaigns),
    chatbot:
      org?.featureChatbotLocked === true || limitLocks(plan?.maxChatbots),
    automation:
      org?.featureAutomationLocked === true ||
      limitLocks(plan?.maxAutomations),
    connection:
      org?.featureConnectionLocked === true ||
      limitLocks(plan?.maxWhatsAppAccounts),
  };
};

export const getFeatureLocks = async (
  organizationId: string
): Promise<EffectiveFeatureLocks | null> => {
  const cached = lockCache.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) return cached.locks;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      featureInboxLocked: true,
      featureCampaignsLocked: true,
      featureChatbotLocked: true,
      featureAutomationLocked: true,
      featureConnectionLocked: true,
      subscription: {
        select: {
          plan: {
            select: {
              maxCampaigns: true,
              maxChatbots: true,
              maxAutomations: true,
              maxWhatsAppAccounts: true,
            },
          },
        },
      },
    } as any,
  });

  if (!org) return null;

  const locks = computeFeatureLocks(org);
  lockCache.set(organizationId, {
    locks,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return locks;
};

/**
 * Org payload par effective locks chipka do. Clients (mobile/web) wahi
 * featureXLocked naam padhte hain, isliye same keys use kar rahe hain -
 * bas value ab plan ko bhi consider karti hai. Admin panel apne alag
 * endpoint se raw columns padhta hai, use isse farak nahi padta.
 */
export const withFeatureLocks = async <T extends { id: string }>(
  org: T | null
): Promise<T | null> => {
  if (!org?.id) return org;

  const locks = await getFeatureLocks(org.id);
  if (!locks) return org;

  return {
    ...org,
    featureInboxLocked: locks.inbox,
    featureCampaignsLocked: locks.campaigns,
    featureChatbotLocked: locks.chatbot,
    featureAutomationLocked: locks.automation,
    featureConnectionLocked: locks.connection,
  };
};

const resolveOrganizationId = (req: Request): string =>
  (req.header('X-Organization-Id') || req.header('x-organization-id') || '').trim() ||
  ((req as any).user?.organizationId as string) ||
  (req.body?.organizationId as string) ||
  (req.params?.organizationId as string) ||
  (typeof req.query?.organizationId === 'string' ? req.query.organizationId : '') ||
  '';

export const featureLock =
  (feature: LockableFeature) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const organizationId = resolveOrganizationId(req);

      // Org id na mile toh skip - downstream handler khud decide karega
      if (!organizationId) return next();

      const locks = await getFeatureLocks(organizationId);
      if (!locks) return next();

      if (locks[feature] === true) {
        throw new AppError(
          `${LABEL[feature]} is not available on your current plan. Please upgrade to continue.`,
          403
        );
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };

export default featureLock;
