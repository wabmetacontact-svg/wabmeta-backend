"use strict";
// src/modules/billing/razorpay.routes.ts - COMPLETE FIXED
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICE_MAP = exports.PLAN_KEY_MAP = void 0;
const express_1 = require("express");
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const auth_1 = require("../../middleware/auth");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
console.log("✅ Razorpay routes loaded");
// ============================================
// ✅ PLAN KEY → PLAN TYPE + VALIDITY MAPPING
// ============================================
exports.PLAN_KEY_MAP = {
    monthly: {
        amount: 89900,
        planType: client_1.PlanType.MONTHLY,
        validityDays: 30,
        label: "Monthly",
    },
    three_month: {
        amount: 250000,
        planType: client_1.PlanType.QUARTERLY,
        validityDays: 90,
        label: "3-Month",
    },
    "3-month": {
        amount: 250000,
        planType: client_1.PlanType.QUARTERLY,
        validityDays: 90,
        label: "3-Month",
    },
    six_month: {
        amount: 500000,
        planType: client_1.PlanType.BIANNUAL,
        validityDays: 180,
        label: "6-Month",
    },
    "6-month": {
        amount: 500000,
        planType: client_1.PlanType.BIANNUAL,
        validityDays: 180,
        label: "6-Month",
    },
    one_year: {
        amount: 899900,
        planType: client_1.PlanType.ANNUAL,
        validityDays: 365,
        label: "1-Year",
    },
    "1-year": {
        amount: 899900,
        planType: client_1.PlanType.ANNUAL,
        validityDays: 365,
        label: "1-Year",
    },
};
// Backward compat alias (keep old PRICE_MAP callers working)
exports.PRICE_MAP = exports.PLAN_KEY_MAP;
// ============================================
// Razorpay instance (lazy init)
// ============================================
let razorpayClient = null;
function getRazorpayClient() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        throw new errorHandler_1.AppError("Razorpay keys missing. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env", 500);
    }
    if (!razorpayClient) {
        razorpayClient = new razorpay_1.default({ key_id: keyId, key_secret: keySecret });
    }
    return razorpayClient;
}
// ============================================
// Only owner can pay
// ============================================
async function assertOwner(organizationId, userId) {
    const org = await database_1.default.organization.findUnique({
        where: { id: organizationId },
    });
    if (!org)
        throw new errorHandler_1.AppError("Organization not found", 404);
    if (org.ownerId !== userId)
        throw new errorHandler_1.AppError("Only the owner can make payments", 403);
}
// ============================================
// POST /billing/razorpay/create-order
// ============================================
router.post("/create-order", async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!organizationId)
            throw new errorHandler_1.AppError("Organization required", 400);
        if (!userId)
            throw new errorHandler_1.AppError("Authentication required", 401);
        await assertOwner(organizationId, userId);
        const planKey = req.body?.planKey?.toLowerCase().trim();
        if (!planKey)
            throw new errorHandler_1.AppError("planKey is required", 400);
        const selected = exports.PLAN_KEY_MAP[planKey];
        if (!selected) {
            throw new errorHandler_1.AppError(`Invalid planKey '${planKey}'. Valid: ${Object.keys(exports.PLAN_KEY_MAP).join(", ")}`, 400);
        }
        const razorpay = getRazorpayClient();
        // ✅ Store planKey + planType in notes for verify step
        const order = await razorpay.orders.create({
            amount: selected.amount,
            currency: "INR",
            receipt: `wm_${organizationId.slice(-6)}_${Date.now().toString().slice(-8)}`,
            notes: {
                organizationId,
                userId,
                planKey,
                planType: selected.planType,
                validityDays: String(selected.validityDays),
                label: selected.label,
            },
        });
        console.log("✅ Order created:", {
            orderId: order.id,
            planKey,
            planType: selected.planType,
            amount: `₹${selected.amount / 100}`,
        });
        return res.json({
            success: true,
            data: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: process.env.RAZORPAY_KEY_ID,
                planKey,
                planType: selected.planType,
                label: selected.label,
            },
        });
    }
    catch (e) {
        console.error("❌ create-order error:", e);
        return next(e instanceof errorHandler_1.AppError ? e : new errorHandler_1.AppError(e.message, 500));
    }
});
// ============================================
// POST /billing/razorpay/verify
// ============================================
router.post("/verify", async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!organizationId)
            throw new errorHandler_1.AppError("Organization required", 400);
        if (!userId)
            throw new errorHandler_1.AppError("Authentication required", 401);
        await assertOwner(organizationId, userId);
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planKey, } = req.body || {};
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planKey) {
            throw new errorHandler_1.AppError("Missing: razorpay_order_id, razorpay_payment_id, razorpay_signature, planKey", 400);
        }
        // ✅ Verify signature
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret)
            throw new errorHandler_1.AppError("Razorpay secret missing", 500);
        const expectedSig = crypto_1.default
            .createHmac("sha256", secret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");
        if (expectedSig !== razorpay_signature) {
            throw new errorHandler_1.AppError("Payment signature mismatch - possible fraud attempt", 400);
        }
        console.log("✅ Signature verified for:", razorpay_order_id);
        // ✅ Get plan info from PLAN_KEY_MAP
        const normalizedKey = planKey.toLowerCase().trim();
        const selected = exports.PLAN_KEY_MAP[normalizedKey];
        if (!selected) {
            throw new errorHandler_1.AppError(`Invalid planKey: ${planKey}`, 400);
        }
        // ✅ Find correct plan in DB
        const plan = await database_1.default.plan.findFirst({
            where: {
                type: selected.planType,
                isActive: true,
            },
        });
        if (!plan) {
            throw new errorHandler_1.AppError(`Plan '${selected.planType}' not found in database. Please contact support.`, 404);
        }
        console.log("✅ Plan found:", plan.name, "| Type:", plan.type);
        // ✅ Calculate subscription period
        const now = new Date();
        const periodEnd = new Date(now.getTime() + selected.validityDays * 24 * 60 * 60 * 1000);
        console.log("📅 Subscription period:", {
            start: now.toISOString(),
            end: periodEnd.toISOString(),
            validityDays: selected.validityDays,
        });
        // ✅ Atomic transaction
        await database_1.default.$transaction(async (tx) => {
            // 1. Update organization planType
            await tx.organization.update({
                where: { id: organizationId },
                data: { planType: selected.planType },
            });
            // 2. Create or update subscription
            const subscription = await tx.subscription.upsert({
                where: { organizationId },
                create: {
                    organizationId,
                    planId: plan.id,
                    status: client_1.SubscriptionStatus.ACTIVE,
                    billingCycle: normalizedKey,
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    paymentMethod: "razorpay",
                    lastPaymentAt: now,
                    nextPaymentAt: periodEnd,
                    messagesUsed: 0,
                    contactsUsed: 0,
                    cancelledAt: null,
                },
                update: {
                    planId: plan.id,
                    status: client_1.SubscriptionStatus.ACTIVE,
                    billingCycle: normalizedKey,
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    paymentMethod: "razorpay",
                    lastPaymentAt: now,
                    nextPaymentAt: periodEnd,
                    cancelledAt: null,
                },
            });
            // 3. Record payment
            await tx.payment.create({
                data: {
                    organizationId,
                    subscriptionId: subscription.id,
                    razorpayOrderId: razorpay_order_id,
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                    amount: selected.amount,
                    currency: "INR",
                    status: "SUCCESS",
                    planId: plan.id,
                    planName: selected.label,
                    billingCycle: normalizedKey,
                    description: `${selected.label} plan - ${selected.validityDays} days`,
                    receipt: `wm_${organizationId.slice(-6)}_${Date.now().toString().slice(-8)}`,
                    paidAt: now,
                },
            });
            // 4. Activity log
            await tx.activityLog.create({
                data: {
                    organizationId,
                    userId,
                    action: client_1.ActivityAction.CREATE,
                    entity: "billing",
                    entityId: organizationId,
                    metadata: {
                        event: "payment_success",
                        planKey: normalizedKey,
                        planType: selected.planType,
                        planName: selected.label,
                        validityDays: selected.validityDays,
                        amount: selected.amount,
                        orderId: razorpay_order_id,
                        paymentId: razorpay_payment_id,
                        subscriptionEnd: periodEnd.toISOString(),
                    },
                },
            });
        });
        console.log("✅ Subscription activated:", {
            org: organizationId,
            planType: selected.planType,
            validUntil: periodEnd.toLocaleDateString("en-IN"),
        });
        return res.json({
            success: true,
            message: `${selected.label} plan activated! Valid until ${periodEnd.toLocaleDateString("en-IN")}`,
            data: {
                planType: selected.planType,
                planName: selected.label,
                validUntil: periodEnd.toISOString(),
                validityDays: selected.validityDays,
            },
        });
    }
    catch (e) {
        console.error("❌ verify error:", e);
        return next(e instanceof errorHandler_1.AppError ? e : new errorHandler_1.AppError(e.message, 500));
    }
});
exports.default = router;
//# sourceMappingURL=razorpay.routes.js.map