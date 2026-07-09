"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWalletDetails = getWalletDetails;
exports.requestWalletAccess = requestWalletAccess;
exports.getTransactionHistory = getTransactionHistory;
exports.createTopUpOrder = createTopUpOrder;
exports.processTopUp = processTopUp;
exports.deductBalance = deductBalance;
exports.getAccessRequests = getAccessRequests;
exports.reviewWalletRequest = reviewWalletRequest;
exports.getAllWallets = getAllWallets;
exports.adminAdjustBalance = adminAdjustBalance;
exports.setCreditLimit = setCreditLimit;
exports.flagWallet = flagWallet;
exports.setWalletActive = setWalletActive;
exports.getWalletMessageAnalytics = getWalletMessageAnalytics;
const database_1 = __importDefault(require("../../config/database"));
const crypto_1 = __importDefault(require("crypto"));
const errorHandler_1 = require("../../middleware/errorHandler");
// ─── Constants ────────────────────────────────────────────────────────────────
const PAISE_MULTIPLIER = 100;
// ─── Helpers ──────────────────────────────────────────────────────────────────
const toPaise = (rupees) => Math.round(rupees * PAISE_MULTIPLIER);
const toRupees = (paise) => paise / PAISE_MULTIPLIER;
function getWalletRazorpay() {
    const keyId = process.env.WALLET_RAZORPAY_KEY_ID;
    const keySecret = process.env.WALLET_RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        throw new errorHandler_1.AppError('Wallet payment gateway not configured. Contact support.', 500);
    }
    const Razorpay = require('razorpay');
    return {
        instance: new Razorpay({ key_id: keyId, key_secret: keySecret }),
        keyId,
        keySecret,
    };
}
function formatWallet(wallet) {
    return {
        id: wallet.id,
        organizationId: wallet.organizationId,
        isActive: wallet.isActive,
        accessGrantedAt: wallet.accessGrantedAt,
        balance: toRupees(wallet.balancePaise),
        reservedBalance: toRupees(wallet.reservedPaise),
        availableBalance: toRupees(wallet.balancePaise - wallet.reservedPaise),
        creditEnabled: wallet.creditEnabled,
        creditLimit: toRupees(wallet.creditLimitPaise),
        creditUsed: toRupees(wallet.creditUsedPaise),
        availableCredit: wallet.creditEnabled
            ? toRupees(wallet.creditLimitPaise - wallet.creditUsedPaise)
            : 0,
        currency: wallet.currency,
        lowBalanceThreshold: toRupees(wallet.lowThresholdPaise),
        maxTopUpAmount: toRupees(wallet.maxTopUpPaise),
        maxMonthlyTopUp: toRupees(wallet.maxMonthlyPaise),
        currentMonthTopUp: toRupees(wallet.currentMonthPaise),
        totalCredited: toRupees(wallet.totalCreditedPaise),
        totalDebited: toRupees(wallet.totalDebitedPaise),
        lastTransactionAt: wallet.lastTransactionAt,
        flagged: wallet.flagged,
        flagReason: wallet.flagReason,
    };
}
function formatTransaction(txn) {
    return {
        id: txn.id,
        transactionId: txn.transactionId,
        type: txn.type,
        amount: toRupees(txn.amountPaise),
        balanceBefore: toRupees(txn.balanceBeforePaise),
        balanceAfter: toRupees(txn.balanceAfterPaise),
        currency: txn.currency,
        description: txn.description,
        status: txn.status,
        metaChargeId: txn.metaChargeId,
        metaService: txn.metaService,
        razorpayOrderId: txn.razorpayOrderId,
        razorpayPaymentId: txn.razorpayPaymentId,
        note: txn.note,
        createdAt: txn.createdAt,
    };
}
async function verifyMinimumPlan(organizationId) {
    const subscription = await database_1.default.subscription.findUnique({
        where: { organizationId },
        include: { plan: true },
    });
    if (!subscription || subscription.status !== 'ACTIVE') {
        return {
            eligible: false,
            reason: 'Active subscription required to request wallet access',
        };
    }
    if (subscription.plan?.type === 'FREE_DEMO') {
        return {
            eligible: false,
            reason: 'Wallet not available on Free plan. Upgrade to Monthly or higher.',
        };
    }
    return { eligible: true };
}
async function resetMonthlyIfNeeded(wallet) {
    if (new Date() >= new Date(wallet.monthResetDate)) {
        const nextReset = new Date();
        nextReset.setMonth(nextReset.getMonth() + 1, 1);
        nextReset.setHours(0, 0, 0, 0);
        return database_1.default.wallet.update({
            where: { id: wallet.id },
            data: { currentMonthPaise: 0, monthResetDate: nextReset },
        });
    }
    return wallet;
}
// ═══════════════════════════════════════════════════════════════════════════════
// USER-FACING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
// ─── 1. Get Wallet Details ─────────────────────────────────────────────────────
async function getWalletDetails(organizationId) {
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    const pendingRequest = await database_1.default.walletAccessRequest.findFirst({
        where: { organizationId, status: 'pending' },
        select: { id: true, status: true, requestedAt: true },
    });
    if (!wallet) {
        return {
            exists: false,
            isActive: false,
            balance: 0,
            hasPendingRequest: !!pendingRequest,
            pendingRequest: pendingRequest || null,
        };
    }
    return {
        exists: true,
        hasPendingRequest: !!pendingRequest,
        pendingRequest: pendingRequest || null,
        ...formatWallet(wallet),
    };
}
// ─── 2. Request Wallet Access ──────────────────────────────────────────────────
async function requestWalletAccess(organizationId, userId, data) {
    const existingWallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    if (existingWallet?.isActive) {
        throw new errorHandler_1.AppError('Wallet is already active for your organization', 400);
    }
    const pendingRequest = await database_1.default.walletAccessRequest.findFirst({
        where: { organizationId, status: 'pending' },
    });
    if (pendingRequest) {
        throw new errorHandler_1.AppError('A wallet access request is already pending review', 400);
    }
    const recentRejection = await database_1.default.walletAccessRequest.findFirst({
        where: {
            organizationId,
            status: 'rejected',
            reviewedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
        },
    });
    if (recentRejection) {
        throw new errorHandler_1.AppError('Your previous request was rejected. Please wait 7 days.', 400);
    }
    const planCheck = await verifyMinimumPlan(organizationId);
    const request = await database_1.default.walletAccessRequest.create({
        data: {
            organizationId,
            userId,
            reason: data.reason,
            additionalInfo: data.additionalInfo,
            planVerified: planCheck.eligible,
            status: 'pending',
        },
    });
    return {
        request,
        planEligible: planCheck.eligible,
        planMessage: planCheck.reason,
        message: planCheck.eligible
            ? 'Request submitted! Admin will review within 24 hours.'
            : `Request submitted, but note: ${planCheck.reason}`,
    };
}
// ─── 3. Get Transaction History ────────────────────────────────────────────────
async function getTransactionHistory(organizationId, options) {
    const { page = 1, limit = 20, type, startDate, endDate } = options;
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
        select: { id: true, isActive: true },
    });
    if (!wallet)
        throw new errorHandler_1.AppError('Wallet not found', 404);
    if (!wallet.isActive)
        throw new errorHandler_1.AppError('Wallet is not active', 403);
    const where = { walletId: wallet.id };
    if (type)
        where.type = type;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate)
            where.createdAt.gte = startDate;
        if (endDate)
            where.createdAt.lte = endDate;
    }
    const [transactions, total] = await Promise.all([
        database_1.default.walletTransaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        database_1.default.walletTransaction.count({ where }),
    ]);
    return {
        transactions: transactions.map(formatTransaction),
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
}
// ─── 4. Create TopUp Order ─────────────────────────────────────────────────────
async function createTopUpOrder(organizationId, amountRupees) {
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    if (!wallet)
        throw new errorHandler_1.AppError('Wallet not found', 404);
    if (!wallet.isActive)
        throw new errorHandler_1.AppError('Wallet is not active', 403);
    if (wallet.flagged) {
        throw new errorHandler_1.AppError('Wallet is flagged. Please contact support.', 403);
    }
    // ✅ FIX: Validate amount is in RUPEES range
    // Frontend galti se paise bhej sakta hai
    if (amountRupees > 100000) {
        throw new errorHandler_1.AppError(`Amount too large. Maximum is ₹1,00,000 per transaction. ` +
            `Did you enter paise instead of rupees?`, 400);
    }
    const amountPaise = toPaise(amountRupees);
    if (amountPaise < 10000) {
        throw new errorHandler_1.AppError('Minimum top-up amount is ₹100', 400);
    }
    if (amountPaise > wallet.maxTopUpPaise) {
        throw new errorHandler_1.AppError(`Maximum top-up is ₹${toRupees(wallet.maxTopUpPaise).toLocaleString('en-IN')} per transaction`, 400);
    }
    const updatedWallet = await resetMonthlyIfNeeded(wallet);
    if (updatedWallet.currentMonthPaise + amountPaise >
        updatedWallet.maxMonthlyPaise) {
        const remainingPaise = updatedWallet.maxMonthlyPaise - updatedWallet.currentMonthPaise;
        throw new errorHandler_1.AppError(`Monthly limit exceeded. Remaining: ₹${toRupees(remainingPaise).toLocaleString('en-IN')}`, 400);
    }
    const { instance: rzp, keyId } = getWalletRazorpay();
    const timestamp = Date.now().toString().slice(-8);
    const orgShort = organizationId
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(-6);
    const receipt = `wlt_${orgShort}_${timestamp}`;
    const order = await rzp.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        payment_capture: 1,
        notes: {
            organizationId,
            purpose: 'wallet_topup',
            walletId: wallet.id,
            // ✅ FIX: Amount store karo order notes mein
            // Verify step mein is amount ko use karenge
            // Frontend ka claimed amount ignore karenge
            amountPaise: String(amountPaise),
            amountRupees: String(amountRupees),
        },
    });
    console.log('✅ Wallet TopUp order created:', {
        orderId: order.id,
        amount: `₹${amountRupees}`,
        org: organizationId,
    });
    return {
        orderId: order.id,
        amount: amountRupees,
        amountPaise,
        currency: 'INR',
        razorpayKeyId: keyId,
        receipt: order.receipt,
    };
}
// ─── 5. Verify & Process TopUp ─────────────────────────────────────────────────
// ✅ CRITICAL FIX: Amount Razorpay order se lo, frontend se nahi
// ✅ FIX: Idempotency - duplicate payment check
// ✅ FIX: Order amount vs claimed amount mismatch detect
async function processTopUp(organizationId, data) {
    console.log('💳 Processing wallet top-up:', {
        orderId: data.razorpayOrderId,
        paymentId: data.razorpayPaymentId,
        claimedAmount: data.amount,
        org: organizationId,
    });
    // ── Step 1: Signature verify ────────────────────────────────────────────────
    const walletSecret = process.env.WALLET_RAZORPAY_KEY_SECRET;
    if (!walletSecret) {
        throw new errorHandler_1.AppError('Wallet payment gateway not configured. Contact support.', 500);
    }
    const body = data.razorpayOrderId + '|' + data.razorpayPaymentId;
    const expectedSignature = crypto_1.default
        .createHmac('sha256', walletSecret)
        .update(body)
        .digest('hex');
    if (expectedSignature !== data.razorpaySignature) {
        console.error('❌ Wallet TopUp: Invalid signature!', {
            orderId: data.razorpayOrderId,
            org: organizationId,
        });
        throw new errorHandler_1.AppError('Payment verification failed: Invalid signature', 400);
    }
    console.log('✅ Wallet TopUp: Signature verified');
    // ── Step 2: Duplicate payment check ────────────────────────────────────────
    // ✅ FIX: Check karo ki ye payment already process hua hai
    const existingTxn = await database_1.default.walletTransaction.findFirst({
        where: {
            OR: [
                { razorpayPaymentId: data.razorpayPaymentId },
                { razorpayOrderId: data.razorpayOrderId },
            ],
        },
        select: { id: true, amountPaise: true, status: true },
    });
    if (existingTxn) {
        console.log('⚠️ Duplicate payment detected:', data.razorpayPaymentId);
        // ✅ Idempotent response - already credited toh success do
        const wallet = await database_1.default.wallet.findUnique({
            where: { organizationId },
        });
        return {
            success: true,
            newBalance: wallet ? toRupees(wallet.balancePaise) : 0,
            amountAdded: toRupees(existingTxn.amountPaise),
            alreadyProcessed: true,
            transaction: formatTransaction(existingTxn),
        };
    }
    // ── Step 3: Razorpay order fetch → ACTUAL amount lao ───────────────────────
    // ✅ CRITICAL FIX: Frontend ka amount trust mat karo
    // Razorpay ke order se actual amount fetch karo
    let actualAmountPaise;
    try {
        const { instance: rzp } = getWalletRazorpay();
        const order = await rzp.orders.fetch(data.razorpayOrderId);
        // ✅ Razorpay order ka amount use karo
        actualAmountPaise = Number(order.amount);
        // ✅ Verify organization match
        const orderOrg = order.notes?.organizationId;
        if (orderOrg && orderOrg !== organizationId) {
            console.error('🚨 Organization mismatch!', {
                orderOrg,
                requestOrg: organizationId,
            });
            throw new errorHandler_1.AppError('Payment order does not belong to this organization', 400);
        }
        // ✅ Verify purpose is wallet_topup
        if (order.notes?.purpose &&
            order.notes.purpose !== 'wallet_topup') {
            throw new errorHandler_1.AppError('This payment order is not for wallet top-up', 400);
        }
        // ✅ Cross-check: Frontend claimed amount vs actual order amount
        const claimedAmountPaise = toPaise(data.amount);
        const tolerance = 100; // 1 rupee tolerance
        if (Math.abs(actualAmountPaise - claimedAmountPaise) > tolerance) {
            console.warn('⚠️ Amount mismatch detected:', {
                claimedRupees: data.amount,
                claimedPaise: claimedAmountPaise,
                actualPaise: actualAmountPaise,
                actualRupees: toRupees(actualAmountPaise),
                orderId: data.razorpayOrderId,
            });
            // ✅ Use Razorpay's amount (ignore frontend claim)
        }
        console.log('✅ Razorpay order verified:', {
            orderId: order.id,
            status: order.status,
            actualAmount: `₹${toRupees(actualAmountPaise)}`,
        });
        // ✅ Check order status
        if (order.status !== 'paid') {
            console.error('❌ Order not paid:', order.status);
            throw new errorHandler_1.AppError(`Payment not completed. Order status: ${order.status}`, 400);
        }
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            throw err;
        // Razorpay API call fail - fallback to signature verified amount
        console.error('⚠️ Could not fetch Razorpay order, using claimed amount:', err.message);
        actualAmountPaise = toPaise(data.amount);
    }
    // ── Step 4: Wallet fetch ────────────────────────────────────────────────────
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    if (!wallet) {
        throw new errorHandler_1.AppError('Wallet not found. Payment received but could not credit. Contact support with payment ID: ' +
            data.razorpayPaymentId, 404);
    }
    if (!wallet.isActive) {
        throw new errorHandler_1.AppError('Wallet is inactive. Contact support with payment ID: ' +
            data.razorpayPaymentId, 403);
    }
    const balanceBeforePaise = wallet.balancePaise;
    const balanceAfterPaise = balanceBeforePaise + actualAmountPaise;
    console.log('💰 Crediting wallet:', {
        before: `₹${toRupees(balanceBeforePaise)}`,
        adding: `₹${toRupees(actualAmountPaise)}`,
        after: `₹${toRupees(balanceAfterPaise)}`,
        org: organizationId,
    });
    // ── Step 5: Atomic DB transaction ───────────────────────────────────────────
    // ✅ FIX: Transaction ke andar bhi duplicate check karo
    // Race condition prevent karne ke liye
    const [updatedWallet, transaction] = await database_1.default.$transaction(async (tx) => {
        // ✅ Double-check inside transaction (race condition safe)
        const alreadyExists = await tx.walletTransaction.findFirst({
            where: {
                OR: [
                    { razorpayPaymentId: data.razorpayPaymentId },
                    { razorpayOrderId: data.razorpayOrderId },
                ],
            },
            select: { id: true },
        });
        if (alreadyExists) {
            throw new errorHandler_1.AppError('ALREADY_PROCESSED', 409);
        }
        const updated = await tx.wallet.update({
            where: { id: wallet.id },
            data: {
                balancePaise: balanceAfterPaise,
                totalCreditedPaise: { increment: actualAmountPaise },
                currentMonthPaise: { increment: actualAmountPaise },
                lastTransactionAt: new Date(),
                lowAlertSent: false,
            },
        });
        const txn = await tx.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'credit',
                amountPaise: actualAmountPaise,
                balanceBeforePaise,
                balanceAfterPaise,
                description: `Wallet top-up via Razorpay - ₹${toRupees(actualAmountPaise)}`,
                status: 'completed',
                razorpayOrderId: data.razorpayOrderId,
                razorpayPaymentId: data.razorpayPaymentId,
            },
        });
        return [updated, txn];
    }).catch(async (err) => {
        // ✅ Handle race condition gracefully
        if (err instanceof errorHandler_1.AppError &&
            err.message === 'ALREADY_PROCESSED') {
            const existingWallet = await database_1.default.wallet.findUnique({
                where: { organizationId },
            });
            const existingTxn = await database_1.default.walletTransaction.findFirst({
                where: {
                    OR: [
                        { razorpayPaymentId: data.razorpayPaymentId },
                        { razorpayOrderId: data.razorpayOrderId },
                    ],
                },
            });
            return [existingWallet, existingTxn];
        }
        throw err;
    });
    console.log('✅ Wallet credited successfully:', {
        org: organizationId,
        amount: `₹${toRupees(actualAmountPaise)}`,
        newBalance: `₹${toRupees(updatedWallet.balancePaise)}`,
        txnId: transaction?.id,
    });
    return {
        success: true,
        newBalance: toRupees(updatedWallet.balancePaise),
        amountAdded: toRupees(actualAmountPaise),
        transaction: formatTransaction(transaction),
    };
}
// ─── 6. Deduct Balance ────────────────────────────────────────────────────────
async function deductBalance(organizationId, data) {
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    if (!wallet || !wallet.isActive) {
        return {
            success: false,
            newBalance: 0,
            insufficient: true,
            message: 'Wallet not active',
        };
    }
    const amountPaise = toPaise(data.amountRupees);
    const availablePaise = wallet.balancePaise +
        (wallet.creditEnabled
            ? wallet.creditLimitPaise - wallet.creditUsedPaise
            : 0);
    if (availablePaise < amountPaise) {
        await triggerLowBalanceAlert(wallet);
        return {
            success: false,
            newBalance: toRupees(wallet.balancePaise),
            insufficient: true,
            message: `Insufficient balance. Available: ₹${toRupees(availablePaise).toFixed(2)}`,
        };
    }
    const balanceBeforePaise = wallet.balancePaise;
    let newBalancePaise;
    let creditDeductedPaise = 0;
    if (wallet.balancePaise >= amountPaise) {
        newBalancePaise = wallet.balancePaise - amountPaise;
    }
    else {
        creditDeductedPaise = amountPaise - wallet.balancePaise;
        newBalancePaise = 0;
    }
    const [updatedWallet, transaction] = await database_1.default.$transaction([
        database_1.default.wallet.update({
            where: { id: wallet.id },
            data: {
                balancePaise: newBalancePaise,
                creditUsedPaise: { increment: creditDeductedPaise },
                totalDebitedPaise: { increment: amountPaise },
                lastTransactionAt: new Date(),
            },
        }),
        database_1.default.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'debit',
                amountPaise,
                balanceBeforePaise,
                balanceAfterPaise: newBalancePaise,
                description: data.description,
                status: 'completed',
                metaChargeId: data.metaChargeId,
                metaService: data.metaService || 'message_sending',
            },
        }),
    ]);
    if (updatedWallet.balancePaise < updatedWallet.lowThresholdPaise) {
        await triggerLowBalanceAlert(updatedWallet);
    }
    return {
        success: true,
        newBalance: toRupees(updatedWallet.balancePaise),
    };
}
// ─── Low Balance Alert ────────────────────────────────────────────────────────
async function triggerLowBalanceAlert(wallet) {
    if (wallet.lowAlertSent && wallet.lastAlertSentAt) {
        const hoursDiff = (Date.now() - new Date(wallet.lastAlertSentAt).getTime()) /
            (1000 * 60 * 60);
        if (hoursDiff < 24)
            return;
    }
    await database_1.default.wallet.update({
        where: { id: wallet.id },
        data: { lowAlertSent: true, lastAlertSentAt: new Date() },
    });
    console.log(`🔔 Low balance alert: org ${wallet.organizationId}, ` +
        `balance ₹${toRupees(wallet.balancePaise)}`);
}
// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN FUNCTIONS (same as original - no changes needed)
// ═══════════════════════════════════════════════════════════════════════════════
async function getAccessRequests(options) {
    const { status, page = 1, limit = 20 } = options;
    const where = {};
    if (status)
        where.status = status;
    const [requests, total] = await Promise.all([
        database_1.default.walletAccessRequest.findMany({
            where,
            include: {
                organization: {
                    select: { id: true, name: true, planType: true },
                },
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                reviewer: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { requestedAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        database_1.default.walletAccessRequest.count({ where }),
    ]);
    return {
        requests,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
}
async function reviewWalletRequest(requestId, adminId, action, note) {
    const request = await database_1.default.walletAccessRequest.findUnique({
        where: { id: requestId },
        include: { organization: true },
    });
    if (!request)
        throw new errorHandler_1.AppError('Request not found', 404);
    if (request.status !== 'pending') {
        throw new errorHandler_1.AppError('Request has already been reviewed', 400);
    }
    await database_1.default.walletAccessRequest.update({
        where: { id: requestId },
        data: {
            status: action === 'approve' ? 'approved' : 'rejected',
            reviewedBy: adminId,
            reviewNote: note,
            reviewedAt: new Date(),
        },
    });
    if (action === 'approve') {
        const nextMonthReset = new Date();
        nextMonthReset.setMonth(nextMonthReset.getMonth() + 1, 1);
        nextMonthReset.setHours(0, 0, 0, 0);
        await database_1.default.wallet.upsert({
            where: { organizationId: request.organizationId },
            create: {
                organizationId: request.organizationId,
                userId: request.userId,
                isActive: true,
                accessGrantedAt: new Date(),
                accessGrantedBy: adminId,
                monthResetDate: nextMonthReset,
            },
            update: {
                isActive: true,
                accessGrantedAt: new Date(),
                accessGrantedBy: adminId,
            },
        });
    }
    return {
        success: true,
        action,
        message: `Wallet access request ${action}d successfully`,
    };
}
async function getAllWallets(options) {
    const { page = 1, limit = 20, flagged, isActive } = options;
    const where = {};
    if (flagged !== undefined)
        where.flagged = flagged;
    if (isActive !== undefined)
        where.isActive = isActive;
    const [wallets, total] = await Promise.all([
        database_1.default.wallet.findMany({
            where,
            include: {
                organization: {
                    select: { id: true, name: true, planType: true },
                },
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                _count: { select: { transactions: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        database_1.default.wallet.count({ where }),
    ]);
    return {
        wallets: wallets.map((w) => ({
            ...formatWallet(w),
            organization: w.organization,
            user: w.user,
            transactionCount: w._count.transactions,
        })),
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
}
async function adminAdjustBalance(organizationId, adminId, data) {
    if (!data.note || data.note.trim().length < 5) {
        throw new errorHandler_1.AppError('Please provide a reason for adjustment (min 5 chars)', 400);
    }
    let sanitizedNote = (data.note || '').trim();
    const lowerNote = sanitizedNote.toLowerCase();
    if (lowerNote.includes('manual debit by admin') ||
        lowerNote.includes('debit by admin') ||
        lowerNote === 'manual debit') {
        sanitizedNote = 'Debit by WabMeta';
    }
    else if (lowerNote.includes('manual credit by admin') ||
        lowerNote.includes('credit by admin') ||
        lowerNote === 'manual credit') {
        sanitizedNote = 'Credit by WabMeta';
    }
    else if (data.type === 'admin_credit' &&
        lowerNote === 'admin credit') {
        sanitizedNote = 'Credit by WabMeta';
    }
    else if (data.type === 'admin_debit' &&
        lowerNote === 'admin debit') {
        sanitizedNote = 'Debit by WabMeta';
    }
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    if (!wallet)
        throw new errorHandler_1.AppError('Wallet not found', 404);
    const amountPaise = toPaise(data.amountRupees);
    if (data.type === 'admin_debit' && wallet.balancePaise < amountPaise) {
        throw new errorHandler_1.AppError(`Insufficient balance. Available: ₹${toRupees(wallet.balancePaise)}`, 400);
    }
    const balanceBeforePaise = wallet.balancePaise;
    const balanceAfterPaise = data.type === 'admin_credit'
        ? balanceBeforePaise + amountPaise
        : balanceBeforePaise - amountPaise;
    const description = data.type === 'admin_credit'
        ? 'Adjustment by Meta: Credit by WabMeta'
        : 'Adjustment by Meta: Debit by WabMeta';
    const [updatedWallet, transaction] = await database_1.default.$transaction([
        database_1.default.wallet.update({
            where: { id: wallet.id },
            data: {
                balancePaise: balanceAfterPaise,
                totalCreditedPaise: data.type === 'admin_credit'
                    ? { increment: amountPaise }
                    : undefined,
                totalDebitedPaise: data.type === 'admin_debit'
                    ? { increment: amountPaise }
                    : undefined,
                lastTransactionAt: new Date(),
            },
        }),
        database_1.default.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: data.type,
                amountPaise,
                balanceBeforePaise,
                balanceAfterPaise,
                description,
                status: 'completed',
                performedBy: adminId,
                note: sanitizedNote,
            },
        }),
    ]);
    return {
        success: true,
        newBalance: toRupees(updatedWallet.balancePaise),
        transaction: formatTransaction(transaction),
    };
}
async function setCreditLimit(organizationId, creditLimitRupees, enable) {
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    if (!wallet)
        throw new errorHandler_1.AppError('Wallet not found', 404);
    const updated = await database_1.default.wallet.update({
        where: { id: wallet.id },
        data: {
            creditEnabled: enable,
            creditLimitPaise: toPaise(creditLimitRupees),
            creditUsedPaise: enable ? wallet.creditUsedPaise : 0,
        },
    });
    return {
        success: true,
        creditEnabled: updated.creditEnabled,
        creditLimit: toRupees(updated.creditLimitPaise),
    };
}
async function flagWallet(organizationId, adminId, reason, unflag = false) {
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    if (!wallet)
        throw new errorHandler_1.AppError('Wallet not found', 404);
    await database_1.default.wallet.update({
        where: { id: wallet.id },
        data: unflag
            ? {
                flagged: false,
                flagReason: null,
                flaggedAt: null,
                flaggedBy: null,
            }
            : {
                flagged: true,
                flagReason: reason,
                flaggedAt: new Date(),
                flaggedBy: adminId,
            },
    });
    return {
        success: true,
        message: unflag ? 'Wallet unflagged' : 'Wallet flagged',
    };
}
async function setWalletActive(organizationId, adminId, activate, reason) {
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
        include: {
            organization: { select: { name: true } },
        },
    });
    if (!wallet)
        throw new errorHandler_1.AppError('Wallet not found for this organization', 404);
    if (wallet.isActive === activate) {
        throw new errorHandler_1.AppError(`Wallet is already ${activate ? 'active' : 'inactive'}`, 400);
    }
    await database_1.default.$transaction([
        database_1.default.wallet.update({
            where: { id: wallet.id },
            data: activate
                ? {
                    isActive: true,
                    accessGrantedAt: new Date(),
                    accessGrantedBy: adminId,
                }
                : {
                    isActive: false,
                    accessGrantedAt: null,
                    accessGrantedBy: null,
                },
        }),
        database_1.default.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: activate ? 'admin_credit' : 'admin_debit',
                amountPaise: 0,
                balanceBeforePaise: wallet.balancePaise,
                balanceAfterPaise: wallet.balancePaise,
                description: activate
                    ? `Wallet activated by admin${reason ? ': ' + reason : ''}`
                    : `Wallet deactivated by admin${reason ? ': ' + reason : ''}`,
                status: 'completed',
                performedBy: adminId,
                note: reason ||
                    (activate ? 'Admin activation' : 'Admin deactivation'),
            },
        }),
    ]);
    return {
        success: true,
        isActive: activate,
        message: activate
            ? `Wallet activated for ${wallet.organization?.name || organizationId}`
            : `Wallet deactivated for ${wallet.organization?.name || organizationId}`,
    };
}
async function getWalletMessageAnalytics(organizationId, options) {
    // ✅ Import deduction service for accurate rates
    const { getRateForCategory, DEFAULT_RATE, LANGUAGE_TO_PREFIX, COUNTRY_RATES, } = await Promise.resolve().then(() => __importStar(require('./wallet.deduction.service')));
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    // ✅ Date range - default last 30 days
    const endDate = options?.endDate || new Date();
    const startDate = options?.startDate ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateFilter = { gte: startDate, lte: endDate };
    // ============================================
    // 1. FETCH ALL OUTBOUND MESSAGES
    // ✅ Include template info for category detection
    // ✅ Include conversation for free-tier detection
    // ============================================
    const outboundMessages = await database_1.default.message.findMany({
        where: {
            conversation: { organizationId },
            direction: 'OUTBOUND',
            createdAt: dateFilter,
        },
        select: {
            id: true,
            status: true,
            type: true,
            templateId: true,
            templateName: true,
            createdAt: true,
            conversation: {
                select: {
                    id: true,
                    contact: {
                        select: { phone: true, countryCode: true },
                    },
                },
            },
        },
    });
    // ============================================
    // 2. FETCH TEMPLATES (bulk fetch for speed)
    // ============================================
    const templateIds = Array.from(new Set(outboundMessages
        .map((m) => m.templateId)
        .filter((id) => !!id)));
    const templateNames = Array.from(new Set(outboundMessages
        .map((m) => m.templateName)
        .filter((n) => !!n)));
    // ✅ Fetch by ID first, then by name (fallback)
    const templates = await database_1.default.template.findMany({
        where: {
            organizationId,
            OR: [
                { id: { in: templateIds } },
                { name: { in: templateNames } },
            ],
        },
        select: {
            id: true,
            name: true,
            category: true,
            language: true,
        },
    });
    // ✅ Build lookup maps
    const templateById = new Map(templates.map((t) => [t.id, t]));
    const templateByName = new Map(templates.map((t) => [t.name, t]));
    // ============================================
    // 3. INBOUND MESSAGES COUNT
    // ============================================
    const messagesReceived = await database_1.default.message.count({
        where: {
            conversation: { organizationId },
            direction: 'INBOUND',
            createdAt: dateFilter,
        },
    });
    // ============================================
    // 4. FETCH LAST CUSTOMER MESSAGE TIMES
    // ✅ 24-hour free window ke liye per-conversation
    // ============================================
    const conversationIds = Array.from(new Set(outboundMessages
        .map((m) => m.conversation?.id)
        .filter((id) => !!id)));
    // ✅ Har conversation ke inbound messages fetch karo
    const inboundMessagesInPeriod = await database_1.default.message.findMany({
        where: {
            conversationId: { in: conversationIds },
            direction: 'INBOUND',
            // ✅ Include messages before period too (for context)
            createdAt: {
                gte: new Date(startDate.getTime() - 24 * 60 * 60 * 1000),
                lte: endDate,
            },
        },
        select: {
            conversationId: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
    });
    // ✅ Build conversation → sorted inbound times map
    const inboundTimesByConv = new Map();
    for (const msg of inboundMessagesInPeriod) {
        if (!msg.conversationId)
            continue;
        const times = inboundTimesByConv.get(msg.conversationId) || [];
        times.push(msg.createdAt);
        inboundTimesByConv.set(msg.conversationId, times);
    }
    // ✅ Helper: Check if outbound msg is within 24h of any inbound
    const isWithinFreeWindow = (conversationId, outboundTime) => {
        const inboundTimes = inboundTimesByConv.get(conversationId);
        if (!inboundTimes || inboundTimes.length === 0)
            return false;
        // Binary search for the closest inbound before outbound
        for (let i = inboundTimes.length - 1; i >= 0; i--) {
            const inboundTime = inboundTimes[i];
            if (inboundTime.getTime() > outboundTime.getTime())
                continue;
            const hoursDiff = (outboundTime.getTime() - inboundTime.getTime()) /
                (1000 * 60 * 60);
            return hoursDiff <= 24;
        }
        return false;
    };
    const emptyStats = () => ({
        sent: 0,
        delivered: 0,
        failed: 0,
        read: 0,
        estimatedCostPaise: 0,
    });
    const paidStats = {
        MARKETING: emptyStats(),
        UTILITY: emptyStats(),
        AUTHENTICATION: emptyStats(),
        AUTHENTICATION_INTERNATIONAL: emptyStats(),
        SERVICE: emptyStats(),
    };
    const freeStats = {
        customerService: emptyStats(),
        entryPoint: emptyStats(),
    };
    let totalSent = 0;
    let totalDelivered = 0;
    let totalFailed = 0;
    let totalRead = 0;
    for (const msg of outboundMessages) {
        totalSent++;
        const isDelivered = msg.status === 'DELIVERED' || msg.status === 'READ';
        const isFailed = msg.status === 'FAILED';
        const isRead = msg.status === 'READ';
        if (isDelivered)
            totalDelivered++;
        if (isFailed)
            totalFailed++;
        if (isRead)
            totalRead++;
        // ✅ Determine if template message
        const isTemplateMsg = msg.type === 'TEMPLATE' ||
            !!msg.templateId ||
            !!msg.templateName;
        // ✅ Get template info (from lookup maps)
        const template = (msg.templateId ? templateById.get(msg.templateId) : undefined) ||
            (msg.templateName ? templateByName.get(msg.templateName) : undefined);
        const category = (template && typeof template === 'object' && 'category' in template
            ? template.category
            : 'SERVICE').toUpperCase();
        const language = template?.language;
        const recipientPhone = msg.conversation?.contact?.phone;
        // ✅ Free window check for non-template messages
        let isFreeWindow = false;
        if (!isTemplateMsg && msg.conversation?.id) {
            isFreeWindow = isWithinFreeWindow(msg.conversation.id, msg.createdAt);
        }
        // ============================================
        // ROUTE TO CORRECT BUCKET
        // ============================================
        if (!isTemplateMsg && isFreeWindow) {
            // ✅ FREE - Customer service window
            freeStats.customerService.sent++;
            if (isDelivered)
                freeStats.customerService.delivered++;
            if (isFailed)
                freeStats.customerService.failed++;
            if (isRead)
                freeStats.customerService.read++;
            // No cost
        }
        else if (!isTemplateMsg) {
            // ✅ Non-template outside window (rare) - Service category
            paidStats.SERVICE.sent++;
            if (isDelivered)
                paidStats.SERVICE.delivered++;
            if (isFailed)
                paidStats.SERVICE.failed++;
            if (isRead)
                paidStats.SERVICE.read++;
            // Service is FREE in Meta pricing
        }
        else {
            // ✅ Template message - use category
            // Detect international authentication
            const isIntlAuth = category === 'AUTHENTICATION' &&
                language &&
                !language.startsWith('en_IN') &&
                !language.startsWith('hi') &&
                !LANGUAGE_TO_PREFIX[language]?.startsWith('91');
            const bucketKey = isIntlAuth
                ? 'AUTHENTICATION_INTERNATIONAL'
                : category in paidStats
                    ? category
                    : 'MARKETING';
            paidStats[bucketKey].sent++;
            if (isDelivered)
                paidStats[bucketKey].delivered++;
            if (isFailed)
                paidStats[bucketKey].failed++;
            if (isRead)
                paidStats[bucketKey].read++;
            // ✅ Calculate cost ONLY for delivered
            if (isDelivered) {
                const rateRupees = getRateForCategory(category, recipientPhone || undefined, language || undefined);
                const ratePaise = Math.round(rateRupees * 100);
                paidStats[bucketKey].estimatedCostPaise += ratePaise;
            }
        }
    }
    // ============================================
    // 6. TOTAL APPROXIMATE COST
    // ============================================
    const totalEstimatedCostPaise = Object.values(paidStats).reduce((sum, s) => sum + s.estimatedCostPaise, 0);
    // ============================================
    // 7. ACTUAL WALLET DEBITS (Real data)
    // ============================================
    let actualDebitedPaise = 0;
    const actualDebitByCategory = {
        MARKETING: 0,
        UTILITY: 0,
        AUTHENTICATION: 0,
        AUTHENTICATION_INTERNATIONAL: 0,
        SERVICE: 0,
    };
    if (wallet) {
        const debits = await database_1.default.walletTransaction.findMany({
            where: {
                walletId: wallet.id,
                type: 'debit',
                metaService: {
                    in: ['template_message', 'message_sending'],
                },
                createdAt: dateFilter,
            },
            select: {
                amountPaise: true,
                description: true,
            },
        });
        for (const d of debits) {
            actualDebitedPaise += d.amountPaise;
            const desc = (d.description || '').toUpperCase();
            if (desc.includes('AUTHENTICATION') &&
                (desc.includes('INTL') ||
                    desc.includes('INTERNATIONAL'))) {
                actualDebitByCategory.AUTHENTICATION_INTERNATIONAL +=
                    d.amountPaise;
            }
            else if (desc.includes('AUTHENTICATION')) {
                actualDebitByCategory.AUTHENTICATION += d.amountPaise;
            }
            else if (desc.includes('UTILITY')) {
                actualDebitByCategory.UTILITY += d.amountPaise;
            }
            else if (desc.includes('SERVICE')) {
                actualDebitByCategory.SERVICE += d.amountPaise;
            }
            else if (desc.includes('MARKETING')) {
                actualDebitByCategory.MARKETING += d.amountPaise;
            }
            else {
                // Default - assume marketing
                actualDebitByCategory.MARKETING += d.amountPaise;
            }
        }
    }
    // ============================================
    // 8. FORMAT RESPONSE
    // ============================================
    const categoryLabels = {
        MARKETING: 'Marketing',
        UTILITY: 'Utility',
        AUTHENTICATION: 'Authentication',
        AUTHENTICATION_INTERNATIONAL: 'Authentication - International',
        SERVICE: 'Service',
    };
    const categoryOrder = [
        'MARKETING',
        'UTILITY',
        'AUTHENTICATION',
        'AUTHENTICATION_INTERNATIONAL',
        'SERVICE',
    ];
    // ✅ Delivery rate
    const deliveryRate = totalSent > 0
        ? Math.round((totalDelivered / totalSent) * 100)
        : 0;
    const readRate = totalDelivered > 0
        ? Math.round((totalRead / totalDelivered) * 100)
        : 0;
    // ✅ Free totals
    const freeTotal = freeStats.customerService.delivered +
        freeStats.entryPoint.delivered;
    const paidTotal = Object.values(paidStats).reduce((sum, s) => sum + s.delivered, 0);
    return {
        // ============================================
        // PERIOD INFO
        // ============================================
        period: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            days: Math.ceil((endDate.getTime() - startDate.getTime()) /
                (1000 * 60 * 60 * 24)),
        },
        // ============================================
        // ALL MESSAGES (Top card - "All Messages")
        // ============================================
        allMessages: {
            sent: totalSent,
            delivered: totalDelivered,
            failed: totalFailed,
            read: totalRead,
            received: messagesReceived,
            deliveryRate,
            readRate,
        },
        // ============================================
        // MESSAGES DELIVERED (Middle card)
        // ✅ Breakdown by category
        // ============================================
        messagesDelivered: {
            total: totalDelivered,
            byCategory: categoryOrder.map((cat) => ({
                category: cat,
                label: categoryLabels[cat],
                delivered: paidStats[cat].delivered +
                    (cat === 'SERVICE'
                        ? freeStats.customerService.delivered
                        : 0),
            })),
        },
        // ============================================
        // FREE MESSAGES DELIVERED (Right card)
        // ✅ 24-hour window replies
        // ============================================
        freeMessagesDelivered: {
            freeCustomerService: freeStats.customerService.delivered,
            freeEntryPoint: freeStats.entryPoint.delivered,
            total: freeTotal,
            sent: freeStats.customerService.sent +
                freeStats.entryPoint.sent,
        },
        // ============================================
        // PAID MESSAGES DELIVERED (Bottom left card)
        // ============================================
        paidMessagesDelivered: {
            total: paidTotal,
            byCategory: categoryOrder.map((cat) => ({
                category: cat,
                label: categoryLabels[cat],
                delivered: paidStats[cat].delivered,
                sent: paidStats[cat].sent,
            })),
        },
        // ============================================
        // APPROXIMATE CHARGES (Bottom right card)
        // ✅ Meta rates ke hisaab se calculated
        // ============================================
        approximateCharges: {
            total: toRupees(totalEstimatedCostPaise),
            totalPaise: totalEstimatedCostPaise,
            byCategory: categoryOrder.map((cat) => ({
                category: cat,
                label: categoryLabels[cat],
                cost: toRupees(paidStats[cat].estimatedCostPaise),
                delivered: paidStats[cat].delivered,
            })),
        },
        // ============================================
        // ACTUAL CHARGES (From wallet transactions)
        // ✅ Real deducted amount
        // ============================================
        actualCharges: {
            total: toRupees(actualDebitedPaise),
            totalPaise: actualDebitedPaise,
            byCategory: categoryOrder.map((cat) => ({
                category: cat,
                label: categoryLabels[cat],
                cost: toRupees(actualDebitByCategory[cat] || 0),
            })),
        },
        // ============================================
        // RATES REFERENCE (India rates)
        // ============================================
        rates: {
            currency: 'INR',
            unit: 'per delivered message',
            note: 'Rates vary by recipient country. Below are India rates for reference.',
            india: {
                MARKETING: DEFAULT_RATE.marketing,
                UTILITY: DEFAULT_RATE.utility,
                AUTHENTICATION: DEFAULT_RATE.authentication,
                SERVICE: 0,
            },
        },
    };
}
//# sourceMappingURL=wallet.service.js.map