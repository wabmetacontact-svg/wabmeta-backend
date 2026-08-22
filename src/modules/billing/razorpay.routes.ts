// src/modules/billing/razorpay.routes.ts - COMPLETE FIXED

import { Router } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { authenticate } from "../../middleware/auth";
import { AppError } from "../../middleware/errorHandler";
import prisma from "../../config/database";
import { PlanType, SubscriptionStatus, ActivityAction } from "@prisma/client";

const router = Router();
router.use(authenticate);

console.log("✅ Razorpay routes loaded");

// ============================================
// ✅ PLAN KEY → PLAN TYPE + VALIDITY MAPPING
// ============================================
export const PLAN_KEY_MAP: Record<string, {
  amount: number;        // paise mein
  planType: PlanType;    // DB enum
  validityDays: number;  // kitne din ka subscription
  label: string;
}> = {
  monthly: {
    amount: 89900,
    planType: PlanType.MONTHLY,
    validityDays: 30,
    label: "Monthly",
  },
  three_month: {
    amount: 250000,
    planType: PlanType.QUARTERLY,
    validityDays: 90,
    label: "3-Month",
  },
  "3-month": {
    amount: 250000,
    planType: PlanType.QUARTERLY,
    validityDays: 90,
    label: "3-Month",
  },
  six_month: {
    amount: 500000,
    planType: PlanType.BIANNUAL,
    validityDays: 180,
    label: "6-Month",
  },
  "6-month": {
    amount: 500000,
    planType: PlanType.BIANNUAL,
    validityDays: 180,
    label: "6-Month",
  },
  one_year: {
    amount: 899900,
    planType: PlanType.ANNUAL,
    validityDays: 365,
    label: "1-Year",
  },
  "1-year": {
    amount: 899900,
    planType: PlanType.ANNUAL,
    validityDays: 365,
    label: "1-Year",
  },
};

// Backward compat alias (keep old PRICE_MAP callers working)
export const PRICE_MAP = PLAN_KEY_MAP;

// ============================================
// Razorpay instance (lazy init)
// ============================================
let razorpayClient: Razorpay | null = null;

function getRazorpayClient() {
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new AppError(
      "Razorpay keys missing. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env",
      500
    );
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  return razorpayClient;
}

// ============================================
// Only owner can pay
// ============================================
async function assertOwner(organizationId: string, userId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) throw new AppError("Organization not found", 404);
  if (org.ownerId !== userId)
    throw new AppError("Only the owner can make payments", 403);
}

// ============================================
// POST /billing/razorpay/create-order
// ============================================
router.post("/create-order", async (req: any, res, next) => {
  try {
    const organizationId = req.user?.organizationId as string;
    const userId         = req.user?.id as string;

    if (!organizationId) throw new AppError("Organization required", 400);
    if (!userId)         throw new AppError("Authentication required", 401);

    await assertOwner(organizationId, userId);

    const planKey = (req.body?.planKey as string)?.toLowerCase().trim();
    if (!planKey) throw new AppError("planKey is required", 400);

    const selected = PLAN_KEY_MAP[planKey];
    if (!selected) {
      throw new AppError(
        `Invalid planKey '${planKey}'. Valid: ${Object.keys(PLAN_KEY_MAP).join(", ")}`,
        400
      );
    }

    const razorpay = getRazorpayClient();

    // ✅ Store planKey + planType in notes for verify step
    const order = await razorpay.orders.create({
      amount:   selected.amount,
      currency: "INR",
      receipt:  `wm_${organizationId.slice(-6)}_${Date.now().toString().slice(-8)}`,
      notes: {
        organizationId,
        userId,
        planKey,
        planType:     selected.planType,
        validityDays: String(selected.validityDays),
        label:        selected.label,
      },
    });

    console.log("✅ Order created:", {
      orderId:  order.id,
      planKey,
      planType: selected.planType,
      amount:   `₹${selected.amount / 100}`,
    });

    return res.json({
      success: true,
      data: {
        orderId:  order.id,
        amount:   order.amount,
        currency: order.currency,
        keyId:    process.env.RAZORPAY_KEY_ID,
        planKey,
        planType: selected.planType,
        label:    selected.label,
      },
    });
  } catch (e: any) {
    console.error("❌ create-order error:", e);
    return next(e instanceof AppError ? e : new AppError(e.message, 500));
  }
});

// ============================================
// POST /billing/razorpay/verify
// ============================================
router.post("/verify", async (req: any, res, next) => {
  try {
    const organizationId = req.user?.organizationId as string;
    const userId         = req.user?.id as string;

    if (!organizationId) throw new AppError("Organization required", 400);
    if (!userId)         throw new AppError("Authentication required", 401);

    await assertOwner(organizationId, userId);

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planKey,
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planKey) {
      throw new AppError(
        "Missing: razorpay_order_id, razorpay_payment_id, razorpay_signature, planKey",
        400
      );
    }

    // ✅ Verify signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new AppError("Razorpay secret missing", 500);

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    // Constant-time compare so the signature can't be probed byte by byte.
    const sigBuf      = Buffer.from(String(razorpay_signature), "utf8");
    const expectedBuf = Buffer.from(expectedSig, "utf8");
    const signatureOk =
      sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);

    if (!signatureOk) {
      throw new AppError("Payment signature mismatch - possible fraud attempt", 400);
    }

    console.log("✅ Signature verified for:", razorpay_order_id);

    // The signature only proves that *some* payment was made against this order.
    // It says nothing about which plan was paid for, so the plan must come from
    // the order Razorpay is holding -- never from the request body. Otherwise a
    // real payment for the cheapest plan can be replayed with planKey set to the
    // most expensive one.
    const order = await getRazorpayClient().orders.fetch(razorpay_order_id);

    const orderPlanKey = String((order.notes as any)?.planKey || "").toLowerCase().trim();
    const orderOrgId   = String((order.notes as any)?.organizationId || "");

    if (!orderPlanKey) {
      throw new AppError("Order is missing plan information. Please start checkout again.", 400);
    }

    // The order must belong to the organization that is claiming it.
    if (orderOrgId && orderOrgId !== organizationId) {
      throw new AppError("This payment belongs to a different organization", 403);
    }

    if (order.status !== "paid") {
      throw new AppError(`Order is not paid (status: ${order.status})`, 400);
    }

    const normalizedKey = orderPlanKey;
    const selected = PLAN_KEY_MAP[normalizedKey];
    if (!selected) {
      throw new AppError(`Invalid plan on order: ${orderPlanKey}`, 400);
    }

    // Belt and braces: the amount Razorpay captured must match the plan's price.
    if (Number(order.amount) !== selected.amount) {
      throw new AppError(
        `Paid amount does not match the ${selected.label} plan price`,
        400
      );
    }

    // A body planKey is still accepted for backwards compatibility, but it is
    // only ever used to detect a mismatch -- never to decide what was bought.
    const bodyPlanKey = String(planKey || "").toLowerCase().trim();
    if (bodyPlanKey && bodyPlanKey !== normalizedKey) {
      console.warn(
        `⚠️ planKey mismatch — body said "${bodyPlanKey}", order says "${normalizedKey}". Using the order.`
      );
    }

    // ✅ Find correct plan in DB
    const plan = await prisma.plan.findFirst({
      where: {
        type:     selected.planType,
        isActive: true,
      },
    });

    if (!plan) {
      throw new AppError(
        `Plan '${selected.planType}' not found in database. Please contact support.`,
        404
      );
    }

    console.log("✅ Plan found:", plan.name, "| Type:", plan.type);

    // ✅ Calculate subscription period
    const now       = new Date();
    const periodEnd = new Date(
      now.getTime() + selected.validityDays * 24 * 60 * 60 * 1000
    );

    console.log("📅 Subscription period:", {
      start:        now.toISOString(),
      end:          periodEnd.toISOString(),
      validityDays: selected.validityDays,
    });

    // ✅ Atomic transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update organization planType
      await tx.organization.update({
        where: { id: organizationId },
        data:  { planType: selected.planType },
      });

      // 2. Create or update subscription
      const subscription = await tx.subscription.upsert({
        where: { organizationId },
        create: {
          organizationId,
          planId:             plan.id,
          status:             SubscriptionStatus.ACTIVE,
          billingCycle:       normalizedKey,
          currentPeriodStart: now,
          currentPeriodEnd:   periodEnd,
          paymentMethod:      "razorpay",
          lastPaymentAt:      now,
          nextPaymentAt:      periodEnd,
          messagesUsed:       0,
          contactsUsed:       0,
          cancelledAt:        null,
        },
        update: {
          planId:             plan.id,
          status:             SubscriptionStatus.ACTIVE,
          billingCycle:       normalizedKey,
          currentPeriodStart: now,
          currentPeriodEnd:   periodEnd,
          paymentMethod:      "razorpay",
          lastPaymentAt:      now,
          nextPaymentAt:      periodEnd,
          cancelledAt:        null,
        },
      });

      // 3. Record payment
      await tx.payment.create({
        data: {
          organizationId,
          subscriptionId:    subscription.id,
          razorpayOrderId:   razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          amount:            selected.amount,
          currency:          "INR",
          status:            "SUCCESS",
          planId:            plan.id,
          planName:          selected.label,
          billingCycle:      normalizedKey,
          description:       `${selected.label} plan - ${selected.validityDays} days`,
          receipt:           `wm_${organizationId.slice(-6)}_${Date.now().toString().slice(-8)}`,
          paidAt:            now,
        },
      });

      // 4. Activity log
      await tx.activityLog.create({
        data: {
          organizationId,
          userId,
          action:   ActivityAction.CREATE,
          entity:   "billing",
          entityId: organizationId,
          metadata: {
            event:           "payment_success",
            planKey:         normalizedKey,
            planType:        selected.planType,
            planName:        selected.label,
            validityDays:    selected.validityDays,
            amount:          selected.amount,
            orderId:         razorpay_order_id,
            paymentId:       razorpay_payment_id,
            subscriptionEnd: periodEnd.toISOString(),
          },
        },
      });
    });

    console.log("✅ Subscription activated:", {
      org:        organizationId,
      planType:   selected.planType,
      validUntil: periodEnd.toLocaleDateString("en-IN"),
    });

    return res.json({
      success: true,
      message: `${selected.label} plan activated! Valid until ${periodEnd.toLocaleDateString("en-IN")}`,
      data: {
        planType:     selected.planType,
        planName:     selected.label,
        validUntil:   periodEnd.toISOString(),
        validityDays: selected.validityDays,
      },
    });
  } catch (e: any) {
    console.error("❌ verify error:", e);
    return next(e instanceof AppError ? e : new AppError(e.message, 500));
  }
});

export default router;