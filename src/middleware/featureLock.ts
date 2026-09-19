// src/middleware/featureLock.ts

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from './errorHandler';
import { resolveGateOrganizationId, claimsAnotherOrg } from './resolveOrg';
import { recordSecurityEvent, requestOrigin } from '../utils/securityLog';

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
 * Naya lockable feature add karna = neeche FEATURE_REGISTRY me ek entry +
 * Organization par ek Boolean column. Middleware, admin API aur org payload
 * sab isi registry se chalte hain, isliye kahin aur kuch nahi badalna padta.
 *
 * Usage:
 *   router.use(authenticate);
 *   router.use(featureLock('campaigns'));
 */

export type LockableFeature =
  | 'inbox'
  | 'contacts'
  | 'crm'
  | 'campaigns'
  | 'templates'
  | 'chatbot'
  | 'automation'
  | 'aiAgent'
  | 'telegram'
  | 'instagram'
  | 'reports'
  | 'wallet'
  | 'connection';

// Plan ke wo limits jinka 0 hona "feature plan me hai hi nahi" batata hai.
type PlanLimitField =
  | 'maxCampaigns'
  | 'maxChatbots'
  | 'maxAutomations'
  | 'maxWhatsAppAccounts';

interface FeatureDefinition {
  /** Organization ka Boolean column jisme admin ka manual lock rehta hai */
  column: string;
  /** 403 message aur admin panel me dikhne wala naam */
  label: string;
  /**
   * Plan limit jiska 0 hona is feature ko apne aap lock karta hai.
   * Jinke paas ye nahi hai wo sirf admin ke lock se hi band hote hain.
   */
  planLimit?: PlanLimitField;
}

export const FEATURE_REGISTRY: Record<LockableFeature, FeatureDefinition> = {
  inbox: { column: 'featureInboxLocked', label: 'Inbox' },
  contacts: { column: 'featureContactsLocked', label: 'Contacts' },
  crm: { column: 'featureCrmLocked', label: 'CRM' },
  campaigns: {
    column: 'featureCampaignsLocked',
    label: 'Campaigns',
    planLimit: 'maxCampaigns',
  },
  templates: { column: 'featureTemplatesLocked', label: 'Templates' },
  chatbot: {
    column: 'featureChatbotLocked',
    label: 'Chatbot',
    planLimit: 'maxChatbots',
  },
  automation: {
    column: 'featureAutomationLocked',
    label: 'Automation',
    planLimit: 'maxAutomations',
  },
  // AI Agent chatbot-family ka feature hai - pehle iske routes par
  // featureLock('chatbot') laga tha, isliye plan limit wahi rakhi hai.
  // Ab iska apna admin lock bhi hai.
  aiAgent: {
    column: 'featureAiAgentLocked',
    label: 'AI Agent',
    planLimit: 'maxChatbots',
  },
  telegram: { column: 'featureTelegramLocked', label: 'Telegram' },
  instagram: { column: 'featureInstagramLocked', label: 'Instagram' },
  reports: { column: 'featureReportsLocked', label: 'Reports' },
  wallet: { column: 'featureWalletLocked', label: 'Wallet' },
  connection: {
    column: 'featureConnectionLocked',
    label: 'WhatsApp Connection',
    planLimit: 'maxWhatsAppAccounts',
  },
};

export const LOCKABLE_FEATURES = Object.keys(
  FEATURE_REGISTRY
) as LockableFeature[];

export type EffectiveFeatureLocks = Record<LockableFeature, boolean>;

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

/**
 * Plan.includedFeatures - har feature ke liye saaf haan/na.
 *
 * Pehle plan sirf un 5 features ko rok sakta tha jinke paas ek numeric limit
 * thi (maxCampaigns, maxChatbots, maxAutomations, maxWhatsAppAccounts). CRM,
 * Reports, Telegram, Instagram wagairah plan se control ho hi nahi sakte the -
 * unhe sirf admin har org par alag se band kar sakta tha. Naye tiers isi par
 * tike hain (Telegram Starter me band, Growth me khula), isliye plan ab har
 * feature ke baare me bol sakta hai.
 */
export type PlanFeatureFlags = Partial<Record<LockableFeature, boolean>>;

/**
 * Plan is feature ko deta hai ya nahi.
 *
 * Tarteeb maayne rakhti hai:
 *   1. includedFeatures me saaf true/false ho to wahi final hai.
 *   2. Warna purani numeric limit (0 = nahi milta).
 *   3. Dono na hon to lock mat karo.
 *
 * Teesra niyam jaan-boojhkar hai: plan row missing ho, ya purane plans me
 * includedFeatures set hi na ho, to kisi ka access band nahi hona chahiye.
 * Isi wajah se ye change deploy hone par aaj ka behaviour bilkul nahi badalta -
 * jab tak plans par includedFeatures likha na jaye.
 */
export const planExcludesFeature = (
  plan: any,
  feature: LockableFeature
): boolean => {
  if (!plan) return false;

  const flags = (plan.includedFeatures ?? null) as PlanFeatureFlags | null;
  const explicit = flags && typeof flags === 'object' ? flags[feature] : undefined;
  if (typeof explicit === 'boolean') return !explicit;

  const limitField = FEATURE_REGISTRY[feature].planLimit;
  return limitField ? limitLocks(plan[limitField]) : false;
};

export const computeFeatureLocks = (org: any): EffectiveFeatureLocks => {
  const plan = org?.subscription?.plan;

  return LOCKABLE_FEATURES.reduce((acc, feature) => {
    const def = FEATURE_REGISTRY[feature];
    acc[feature] =
      org?.[def.column] === true || planExcludesFeature(plan, feature);
    return acc;
  }, {} as EffectiveFeatureLocks);
};

/**
 * Locks ko wapas `featureXLocked` shakl me badlo. Org payload me clients
 * yahi keys padhte hain, isliye raw columns ki jagah ye bhejte hain -
 * inki value plan ko bhi consider karti hai.
 */
export const lockColumns = (
  locks: EffectiveFeatureLocks
): Record<string, boolean> =>
  LOCKABLE_FEATURES.reduce((acc, feature) => {
    acc[FEATURE_REGISTRY[feature].column] = locks[feature];
    return acc;
  }, {} as Record<string, boolean>);

// Prisma select: plan ka includedFeatures + wo purani limits jo abhi bhi
// fallback ki tarah kaam karti hain.
export const PLAN_LIMIT_SELECT = LOCKABLE_FEATURES.reduce(
  (acc, feature) => {
    const limit = FEATURE_REGISTRY[feature].planLimit;
    if (limit) acc[limit] = true;
    return acc;
  },
  { includedFeatures: true } as Record<string, boolean>
);

/** Sirf lock columns - jab caller apna select khud bana raha ho */
export const LOCK_SELECT_COLUMNS: Record<string, boolean> =
  LOCKABLE_FEATURES.reduce((acc, feature) => {
    acc[FEATURE_REGISTRY[feature].column] = true;
    return acc;
  }, {} as Record<string, boolean>);

/** Lock columns + wo plan limits jo computeFeatureLocks ko chahiye */
export const ORG_LOCK_SELECT: Record<string, any> = {
  ...LOCK_SELECT_COLUMNS,
  subscription: {
    select: { plan: { select: PLAN_LIMIT_SELECT } },
  },
};

export const getFeatureLocks = async (
  organizationId: string
): Promise<EffectiveFeatureLocks | null> => {
  const cached = lockCache.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) return cached.locks;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: ORG_LOCK_SELECT as any,
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

  return { ...org, ...lockColumns(locks) };
};

// Verified token pehle, header baad me - warna locked plan wala user kisi
// unlocked org ka id bhej kar ye gate paar kar leta tha.
const resolveOrganizationId = resolveGateOrganizationId;

export const featureLock =
  (feature: LockableFeature) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const organizationId = resolveOrganizationId(req);

      if (claimsAnotherOrg(req)) {
        console.warn(
          `⚠️ X-Organization-Id (${req.header('X-Organization-Id') || req.header('x-organization-id')}) ` +
          `does not match the token's org (${organizationId}) - header ignored`
        );
        recordSecurityEvent({
          type: 'ORG_HEADER_MISMATCH',
          userId: (req as any).user?.id || null,
          organizationId,
          ...requestOrigin(req),
          detail: { gate: 'featureLock', claimed: req.header('X-Organization-Id') || req.header('x-organization-id') },
        });
      }

      // Org id na mile toh skip - downstream handler khud decide karega
      if (!organizationId) return next();

      const locks = await getFeatureLocks(organizationId);
      if (!locks) return next();

      if (locks[feature] === true) {
        throw new AppError(
          `${FEATURE_REGISTRY[feature].label} is not available on your current plan. Please upgrade to continue.`,
          403
        );
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };

export default featureLock;
