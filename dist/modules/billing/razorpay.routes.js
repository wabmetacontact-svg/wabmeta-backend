"use strict";
// src/modules/billing/razorpay.routes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICE_MAP = void 0;
const express_1 = require("express");
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const auth_1 = require("../../middleware/auth");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
const client_1 = require("@prisma/client"); // ✅ Import ActivityAction
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
console.log("✅ Razorpay routes loaded");
exports.PRICE_MAP = {
    monthly: { amount: 89900, months: 1, label: "Monthly" },
    three_month: { amount: 250000, months: 3, label: "3-Month" },
    six_month: { amount: 500000, months: 6, label: "6-Month" },
    one_year: { amount: 899900, months: 12, label: "1-Year" },
};
let razorpayClient = null;
function getRazorpayClient() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        throw new errorHandler_1.AppError("Razorpay keys missing in backend .env (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)", 500);
    }
    if (!razorpayClient) {
        razorpayClient = new razorpay_1.default({ key_id: keyId, key_secret: keySecret });
    }
    return razorpayClient;
}
async function assertOwner(organizationId, userId) {
    const org = await database_1.default.organization.findUnique({ where: { id: organizationId } });
    if (!org)
        throw new errorHandler_1.AppError("Organization not found", 404);
    if (org.ownerId !== userId)
        throw new errorHandler_1.AppError("Only owner can make payments/upgrade", 403);
}
router.post("/create-order", async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!organizationId)
            throw new errorHandler_1.AppError("Organization context required", 400);
        if (!userId)
            throw new errorHandler_1.AppError("Authentication required", 401);
        await assertOwner(organizationId, userId);
        const planKey = req.body?.planKey;
        if (!planKey)
            throw new errorHandler_1.AppError("planKey is required", 400);
        const selected = exports.PRICE_MAP[planKey];
        if (!selected)
            throw new errorHandler_1.AppError("Invalid planKey", 400);
        const razorpay = getRazorpayClient();
        const order = await razorpay.orders.create({
            amount: selected.amount,
            currency: "INR",
            receipt: `org_${organizationId}_${Date.now()}`.slice(0, 40),
            notes: { organizationId, planKey },
        });
        return res.json({
            success: true,
            data: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: process.env.RAZORPAY_KEY_ID,
                planKey,
            },
        });
    }
    catch (e) {
        console.error("❌ Razorpay create-order error:", e);
        if (e?.statusCode) {
            return next(new errorHandler_1.AppError(e?.error?.description || e?.message || "Razorpay error", e.statusCode));
        }
        return next(e);
    }
});
router.post("/verify", async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!organizationId)
            throw new errorHandler_1.AppError("Organization context required", 400);
        if (!userId)
            throw new errorHandler_1.AppError("Authentication required", 401);
        await assertOwner(organizationId, userId);
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planKey } = req.body || {};
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planKey) {
            throw new errorHandler_1.AppError("Missing payment verification fields", 400);
        }
        const selected = exports.PRICE_MAP[planKey];
        if (!selected)
            throw new errorHandler_1.AppError("Invalid planKey", 400);
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret)
            throw new errorHandler_1.AppError("Razorpay secret missing in backend .env", 500);
        const body = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expected = crypto_1.default.createHmac("sha256", secret).update(body).digest("hex");
        if (expected !== razorpay_signature) {
            throw new errorHandler_1.AppError("Payment verification failed", 400);
        }
        const planType = client_1.PlanType.BIANNUAL;
        const plan = await database_1.default.plan.findUnique({ where: { type: planType } });
        if (!plan)
            throw new errorHandler_1.AppError("PRO plan missing in DB", 404);
        const now = new Date();
        const end = new Date(now);
        end.setMonth(end.getMonth() + selected.months);
        await database_1.default.$transaction(async (tx) => {
            await tx.organization.update({
                where: { id: organizationId },
                data: { planType },
            });
            const subscription = await tx.subscription.upsert({
                where: { organizationId },
                update: {
                    planId: plan.id,
                    status: "ACTIVE",
                    billingCycle: planKey,
                    currentPeriodStart: now,
                    currentPeriodEnd: end,
                    cancelledAt: null,
                    lastPaymentAt: now,
                    nextPaymentAt: end,
                },
                create: {
                    organizationId,
                    planId: plan.id,
                    status: "ACTIVE",
                    billingCycle: planKey,
                    currentPeriodStart: now,
                    currentPeriodEnd: end,
                    lastPaymentAt: now,
                    nextPaymentAt: end,
                },
            });
            // ✅ Create Payment record for revenue tracking
            await tx.payment.create({
                data: {
                    organizationId,
                    subscriptionId: subscription.id,
                    razorpayOrderId: razorpay_order_id,
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                    amount: selected.amount, // Amount in paise from PRICE_MAP
                    currency: "INR",
                    status: "SUCCESS",
                    planId: plan.id,
                    planName: selected.label,
                    billingCycle: planKey,
                    description: `${selected.label} plan subscription`,
                    receipt: `org_${organizationId}_${Date.now()}`.slice(0, 40),
                    paidAt: now,
                },
            });
            // ✅ Fix: Use valid ActivityAction enum value
            await tx.activityLog.create({
                data: {
                    organizationId,
                    userId,
                    action: client_1.ActivityAction.CREATE, // ✅ Proper enum
                    entity: 'billing',
                    entityId: organizationId,
                    metadata: {
                        event: 'razorpay_success',
                        planKey,
                        razorpay_order_id,
                        razorpay_payment_id,
                        amount: selected.amount,
                    },
                },
            });
        });
        return res.json({
            success: true,
            message: "Payment verified & subscription activated"
        });
    }
    catch (e) {
        console.error("❌ Razorpay verify error:", e);
        if (e?.statusCode) {
            return next(new errorHandler_1.AppError(e?.error?.description || e?.message || "Razorpay error", e.statusCode));
        }
        return next(e);
    }
});
exports.default = router;
//# sourceMappingURL=razorpay.routes.js.map