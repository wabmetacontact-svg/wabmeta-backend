// src/middleware/featureLock.ts

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from './errorHandler';

/**
 * Feature Lock Middleware
 *
 * Plan ke hisab se features admin panel se lock kiye jaate hain. Client side
 * par locked screen dikhta hai, par API abhi bhi seedha call ki ja sakti thi -
 * ye middleware server par wahi lock enforce karta hai.
 *
 * Usage:
 *   router.use(authenticate);
 *   router.use(featureLock('campaigns'));
 *
 * Connection lock ke liye alag se checkConnectionLock hai (wo sirf connect /
 * disconnect actions par lagta hai, poore module par nahi).
 */

export type LockableFeature = 'inbox' | 'campaigns' | 'chatbot' | 'automation';

const LOCK_FIELD: Record<LockableFeature, string> = {
  inbox: 'featureInboxLocked',
  campaigns: 'featureCampaignsLocked',
  chatbot: 'featureChatbotLocked',
  automation: 'featureAutomationLocked',
};

const LABEL: Record<LockableFeature, string> = {
  inbox: 'Inbox',
  campaigns: 'Campaigns',
  chatbot: 'Chatbot',
  automation: 'Automation',
};

type LockRow = Record<string, boolean>;

// Har request par org fetch karna mehnga hai (app server aur DB alag region
// mein hain, ek round trip ~240ms). Isliye chhota TTL cache - aur admin ke
// flags badalne par invalidateFeatureLocks() se turant clear ho jata hai.
const lockCache = new Map<string, { locks: LockRow; expiresAt: number }>();
const CACHE_TTL = 60 * 1000;

export const invalidateFeatureLocks = (organizationId?: string) => {
  if (organizationId) lockCache.delete(organizationId);
  else lockCache.clear();
};

const resolveOrganizationId = (req: Request): string =>
  (req.header('X-Organization-Id') || req.header('x-organization-id') || '').trim() ||
  ((req as any).user?.organizationId as string) ||
  (req.body?.organizationId as string) ||
  (req.params?.organizationId as string) ||
  (typeof req.query?.organizationId === 'string' ? req.query.organizationId : '') ||
  '';

const getLocks = async (organizationId: string): Promise<LockRow | null> => {
  const cached = lockCache.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) return cached.locks;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      featureInboxLocked: true,
      featureCampaignsLocked: true,
      featureChatbotLocked: true,
      featureAutomationLocked: true,
    } as any,
  });

  if (!org) return null;

  const locks = org as unknown as LockRow;
  lockCache.set(organizationId, {
    locks,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return locks;
};

export const featureLock =
  (feature: LockableFeature) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const organizationId = resolveOrganizationId(req);

      // Org id na mile toh skip - downstream handler khud decide karega
      if (!organizationId) return next();

      const locks = await getLocks(organizationId);
      if (!locks) return next();

      if (locks[LOCK_FIELD[feature]] === true) {
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
