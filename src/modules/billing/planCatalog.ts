// src/modules/billing/planCatalog.ts
//
// Checkout ka plan catalogue - ab DB ki Plan table se.
//
// Pehle razorpay.routes.ts me PLAN_KEY_MAP hardcoded tha: amount paise me,
// validityDays, label. Matlab daam do jagah likhe the - Plan table me aur
// yahan - aur agar dono alag ho jaate to client se galat paisa liya jata.
// Pehle se hi plan limits do jagah ladti thi (set-billing-plans.ts vs
// billing.service.ts ka DEFAULT_PLAN_LIMITS), isliye teesri jagah banane ke
// bajay ise DB par le aaya gaya hai.
//
// Ab yahan sirf ye likha hai ki kaunsi key kis plan aur kis cycle ko kehti
// hai. Daam Plan row se aata hai.

import { PlanType } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

/**
 * term   = purane duration plans. Poore term ka ek daam (monthlyPrice) aur
 *          plan ki apni validityDays.
 * monthly/yearly = naye tiers, jinka term billing cycle se aata hai.
 */
export type BillingCycle = 'term' | 'monthly' | 'yearly';

export interface PlanKeySpec {
  type: PlanType;
  cycle: BillingCycle;
}

export const PLAN_KEYS: Record<string, PlanKeySpec> = {
  // Naye feature tiers
  starter: { type: 'STARTER', cycle: 'monthly' },
  starter_yearly: { type: 'STARTER', cycle: 'yearly' },
  growth: { type: 'GROWTH', cycle: 'monthly' },
  growth_yearly: { type: 'GROWTH', cycle: 'yearly' },
  pro: { type: 'PRO', cycle: 'monthly' },
  pro_yearly: { type: 'PRO', cycle: 'yearly' },
  business: { type: 'BUSINESS', cycle: 'monthly' },
  business_yearly: { type: 'BUSINESS', cycle: 'yearly' },

  // Purane duration keys - maujooda checkout links aur renewals ke liye
  // zinda rakhe gaye hain.
  monthly: { type: 'MONTHLY', cycle: 'term' },
  three_month: { type: 'QUARTERLY', cycle: 'term' },
  '3-month': { type: 'QUARTERLY', cycle: 'term' },
  six_month: { type: 'BIANNUAL', cycle: 'term' },
  '6-month': { type: 'BIANNUAL', cycle: 'term' },
  one_year: { type: 'ANNUAL', cycle: 'term' },
  '1-year': { type: 'ANNUAL', cycle: 'term' },
};

export interface ResolvedPlanKey {
  /** Razorpay ko jitne paise bhejne hain */
  amount: number;
  planType: PlanType;
  validityDays: number;
  label: string;
}

/** Plan row ka wo hissa jo daam tay karta hai. */
export interface PricingRow {
  name: string;
  type: PlanType;
  monthlyPrice: unknown;
  yearlyPrice: unknown;
  validityDays: number;
  isActive: boolean;
}

const MONTHLY_DAYS = 30;
const YEARLY_DAYS = 365;

/** Prisma Decimal, string ya number - teeno se rupaye nikaalo. */
const toRupees = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Plan row + cycle se checkout ki entry.
 *
 * Paise ka raasta hai, isliye har galat cheez par throw hota hai - chup-chaap
 * 0 charge kar dena ya poora saal ek mahine ke daam me de dena, dono se
 * bachna zaroori hai.
 */
export const resolvePricing = (
  plan: PricingRow | null | undefined,
  spec: PlanKeySpec
): ResolvedPlanKey => {
  if (!plan) {
    throw new AppError(`Plan '${spec.type}' is not set up. Please contact support.`, 404);
  }

  if (!plan.isActive) {
    throw new AppError(`Plan '${plan.name}' is not available right now.`, 400);
  }

  const rupees =
    spec.cycle === 'yearly' ? toRupees(plan.yearlyPrice) : toRupees(plan.monthlyPrice);

  if (!Number.isFinite(rupees) || rupees <= 0) {
    // Free plan checkout se nahi khareeda jata, aur 0 charge karna bug hai.
    throw new AppError(`Plan '${plan.name}' has no price set for this billing cycle.`, 400);
  }

  const validityDays =
    spec.cycle === 'term'
      ? plan.validityDays
      : spec.cycle === 'yearly'
      ? YEARLY_DAYS
      : MONTHLY_DAYS;

  if (!Number.isFinite(validityDays) || validityDays <= 0) {
    throw new AppError(`Plan '${plan.name}' has no valid duration.`, 400);
  }

  const label =
    spec.cycle === 'yearly'
      ? `${plan.name} (yearly)`
      : spec.cycle === 'monthly'
      ? `${plan.name} (monthly)`
      : plan.name;

  return {
    // Paise hamesha poora number - Razorpay decimal nahi leta.
    amount: Math.round(rupees * 100),
    planType: plan.type,
    validityDays,
    label,
  };
};

/** Checkout key -> daam, DB se. */
export const resolvePlanKey = async (key: string): Promise<ResolvedPlanKey> => {
  const spec = PLAN_KEYS[key];
  if (!spec) {
    throw new AppError(
      `Invalid planKey '${key}'. Valid: ${Object.keys(PLAN_KEYS).join(', ')}`,
      400
    );
  }

  const plan = await prisma.plan.findUnique({
    where: { type: spec.type },
    select: {
      name: true,
      type: true,
      monthlyPrice: true,
      yearlyPrice: true,
      validityDays: true,
      isActive: true,
    },
  });

  return resolvePricing(plan as PricingRow | null, spec);
};

export const planKeyNames = (): string[] => Object.keys(PLAN_KEYS);
