// src/modules/billing/coupons.ts
//
// Discount codes for plan checkout.
//
// The whole discount is decided once, when the Razorpay order is created:
// the order is made for the discounted amount and the coupon is written into
// the order's notes. Verification reads the notes back and records the
// redemption. Nothing recomputes a price after the customer has paid, so what
// they were shown, what Razorpay charged and what we record cannot disagree.

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export type DiscountType = 'PERCENT' | 'FLAT';

/** Razorpay will not create an order below ₹1. */
export const MIN_ORDER_PAISE = 100;

export const normalizeCouponCode = (raw: unknown): string =>
  String(raw ?? '').trim().toUpperCase();

export const isValidCouponCode = (code: string): boolean => /^[A-Z0-9_-]{3,32}$/.test(code);

/**
 * The price after a coupon. Whole paise, never below Razorpay's minimum, and
 * the discount is whatever was actually taken off - so the two always add up
 * to the original amount.
 */
export const applyCoupon = (
  amountPaise: number,
  coupon: { discountType: string; value: number }
): { discountPaise: number; finalPaise: number } => {
  const amount = Math.max(0, Math.floor(amountPaise));

  let discount = 0;
  if (coupon.discountType === 'PERCENT') {
    const pct = Math.min(100, Math.max(0, coupon.value));
    discount = Math.floor((amount * pct) / 100);
  } else if (coupon.discountType === 'FLAT') {
    discount = Math.max(0, Math.floor(coupon.value));
  }

  const finalPaise = Math.max(Math.min(MIN_ORDER_PAISE, amount), amount - discount);
  return { discountPaise: amount - finalPaise, finalPaise };
};

interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  value: number;
  maxRedemptions: number | null;
  redeemedCount: number;
  onePerOrg: boolean;
  planTypes: string[];
  validFrom: Date;
  validUntil: Date | null;
  isActive: boolean;
}

/** Why this coupon cannot be used right now, or null if it can. */
export const couponProblem = (
  coupon: CouponRow | null,
  ctx: { planType: string; now?: Date; alreadyUsedByOrg?: boolean }
): string | null => {
  const now = ctx.now ?? new Date();
  if (!coupon || !coupon.isActive) return 'This coupon code is not valid.';
  if (coupon.validFrom > now) return 'This coupon is not active yet.';
  if (coupon.validUntil && coupon.validUntil < now) return 'This coupon has expired.';
  if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) {
    return 'This coupon has been fully used.';
  }
  if (coupon.planTypes.length > 0 && !coupon.planTypes.includes(ctx.planType)) {
    return 'This coupon does not apply to this plan.';
  }
  if (coupon.onePerOrg && ctx.alreadyUsedByOrg) return 'Your account has already used this coupon.';
  return null;
};

/** Look a code up and refuse it with the customer-facing reason. */
export const checkCouponForCheckout = async (
  rawCode: string,
  organizationId: string,
  planType: string
): Promise<CouponRow> => {
  const code = normalizeCouponCode(rawCode);
  if (!isValidCouponCode(code)) throw new AppError('This coupon code is not valid.', 400, 'COUPON_INVALID');

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  const alreadyUsedByOrg = coupon?.onePerOrg
    ? (await prisma.couponRedemption.count({ where: { couponId: coupon.id, organizationId } })) > 0
    : false;

  const problem = couponProblem(coupon, { planType, alreadyUsedByOrg });
  if (problem) throw new AppError(problem, 400, 'COUPON_INVALID');
  return coupon!;
};

/**
 * Record a paid order's coupon. Called from payment verification, so it must
 * never throw: the customer has paid, and a bookkeeping failure must not turn
 * their successful payment into an error. Recording twice is a no-op.
 */
export const recordCouponRedemption = async (params: {
  notes: Record<string, any>;
  organizationId: string;
  razorpayOrderId: string;
  paidPaise: number;
}): Promise<void> => {
  const couponId = params.notes?.couponId;
  if (!couponId) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.couponRedemption.create({
        data: {
          couponId: String(couponId),
          organizationId: params.organizationId,
          razorpayOrderId: params.razorpayOrderId,
          originalPaise: Number(params.notes.originalPaise) || params.paidPaise,
          discountPaise: Number(params.notes.discountPaise) || 0,
          paidPaise: params.paidPaise,
        },
      });
      await tx.coupon.update({
        where: { id: String(couponId) },
        data: { redeemedCount: { increment: 1 } },
      });
    });
  } catch (err: any) {
    if (err?.code === 'P2002') return; // already recorded for this order
    console.error('[coupons] could not record redemption:', err?.message);
  }
};

// ─── Admin ─────────────────────────────────────────────────────────────────

export interface CouponInput {
  code?: string;
  description?: string | null;
  discountType?: DiscountType;
  value?: number;
  maxRedemptions?: number | null;
  onePerOrg?: boolean;
  planTypes?: string[];
  validFrom?: string | Date;
  validUntil?: string | Date | null;
  isActive?: boolean;
}

const checkValue = (discountType: string, value: number) => {
  if (discountType === 'PERCENT' && (value < 1 || value > 100)) {
    throw new AppError('A percentage discount must be between 1 and 100.', 400);
  }
  if (discountType === 'FLAT' && value < 100) {
    throw new AppError('A flat discount must be at least ₹1 (100 paise).', 400);
  }
};

export const listCoupons = () =>
  prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { redemptions: true } } },
  });

export const createCoupon = async (input: CouponInput, adminId: string) => {
  const code = normalizeCouponCode(input.code);
  if (!isValidCouponCode(code)) {
    throw new AppError('Use 3-32 letters, digits, "-" or "_" for the code.', 400);
  }
  const discountType = input.discountType === 'FLAT' ? 'FLAT' : 'PERCENT';
  const value = Math.floor(Number(input.value));
  checkValue(discountType, value);

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) throw new AppError('A coupon with this code already exists.', 409);

  return prisma.coupon.create({
    data: {
      code,
      description: input.description ?? null,
      discountType,
      value,
      maxRedemptions: input.maxRedemptions ?? null,
      onePerOrg: input.onePerOrg ?? true,
      planTypes: input.planTypes ?? [],
      validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      isActive: input.isActive ?? true,
      createdBy: adminId,
    },
  });
};

/**
 * The code, type and value are fixed once created - orders already carry
 * them in their notes. Everything about availability can change.
 */
export const updateCoupon = async (id: string, input: CouponInput) => {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new AppError('Coupon not found', 404);

  return prisma.coupon.update({
    where: { id },
    data: {
      ...(input.description !== undefined && { description: input.description }),
      ...(input.maxRedemptions !== undefined && { maxRedemptions: input.maxRedemptions }),
      ...(input.onePerOrg !== undefined && { onePerOrg: input.onePerOrg }),
      ...(input.planTypes !== undefined && { planTypes: input.planTypes }),
      ...(input.validFrom !== undefined && { validFrom: new Date(input.validFrom) }),
      ...(input.validUntil !== undefined && { validUntil: input.validUntil ? new Date(input.validUntil) : null }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
};

/** A used coupon is switched off, not deleted, so its redemptions stay on record. */
export const deleteCoupon = async (id: string) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: { _count: { select: { redemptions: true } } },
  });
  if (!coupon) throw new AppError('Coupon not found', 404);

  if (coupon._count.redemptions > 0) {
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });
    return { deleted: false, deactivated: true };
  }
  await prisma.coupon.delete({ where: { id } });
  return { deleted: true, deactivated: false };
};
