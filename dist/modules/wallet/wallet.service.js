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
exports.retryTopUpVerification = retryTopUpVerification;
exports.getPendingTopUpOrders = getPendingTopUpOrders;
exports.deductBalance = deductBalance;
exports.getAccessRequests = getAccessRequests;
exports.reviewWalletRequest = reviewWalletRequest;
exports.getAllWallets = getAllWallets;
exports.adminAdjustBalance = adminAdjustBalance;
exports.setCreditLimit = setCreditLimit;
exports.flagWallet = flagWallet;
exports.setWalletActive = setWalletActive;
exports.getWalletMessageAnalytics = getWalletMessageAnalytics;
exports.creditWalletFromWebhook = creditWalletFromWebhook;
const database_1 = __importDefault(require("../../config/database"));
const crypto_1 = __importDefault(require("crypto"));
const errorHandler_1 = require("../../middleware/errorHandler");
const db = database_1.default;
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
// ─── 4. Create TopUp Order (FIXED with tracking) ───────────────────────────
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
    if (updatedWallet.currentMonthPaise + amountPaise > updatedWallet.maxMonthlyPaise) {
        const remainingPaise = updatedWallet.maxMonthlyPaise - updatedWallet.currentMonthPaise;
        throw new errorHandler_1.AppError(`Monthly limit exceeded. Remaining: ₹${toRupees(remainingPaise).toLocaleString('en-IN')}`, 400);
    }
    const { instance: rzp, keyId } = getWalletRazorpay();
    const timestamp = Date.now().toString().slice(-8);
    const orgShort = organizationId.replace(/[^a-zA-Z0-9]/g, '').slice(-6);
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
            amountPaise: String(amountPaise),
            amountRupees: String(amountRupees),
        },
    });
    // ✅ CRITICAL: Save order to DB for tracking
    await db.walletTopUpOrder.create({
        data: {
            organizationId,
            walletId: wallet.id,
            razorpayOrderId: order.id,
            amountPaise,
            currency: 'INR',
            status: 'PENDING',
        },
    });
    console.log('✅ Wallet TopUp order created & tracked:', {
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
// ─── 5. BULLETPROOF Credit Function - Idempotent & Atomic ────────────────
async function creditWalletAtomic(params) {
    const { organizationId, razorpayOrderId, razorpayPaymentId, razorpaySignature, amountPaise, creditedVia } = params;
    return await database_1.default.$transaction(async (tx) => {
        const txDb = tx;
        // ✅ STEP 1: Check duplicate (by orderId OR paymentId)
        const existingTxn = await tx.walletTransaction.findFirst({
            where: {
                OR: [
                    { razorpayPaymentId },
                    { razorpayOrderId },
                ],
            },
        });
        if (existingTxn) {
            // Update topup order status if needed
            await txDb.walletTopUpOrder.updateMany({
                where: { razorpayOrderId, status: { not: 'COMPLETED' } },
                data: {
                    status: 'COMPLETED',
                    razorpayPaymentId,
                    completedAt: new Date(),
                    transactionId: existingTxn.id,
                    creditedVia,
                },
            });
            return {
                alreadyCredited: true,
                transaction: existingTxn,
                newBalance: 0, // Will be fetched
            };
        }
        // ✅ STEP 2: Get wallet with lock
        const wallet = await tx.wallet.findUnique({
            where: { organizationId },
        });
        if (!wallet) {
            throw new errorHandler_1.AppError(`Wallet not found for org ${organizationId}. Payment ID: ${razorpayPaymentId}`, 404);
        }
        if (!wallet.isActive) {
            throw new errorHandler_1.AppError(`Wallet inactive. Payment ID: ${razorpayPaymentId}`, 403);
        }
        // ✅ STEP 3: Credit atomically
        const balanceBeforePaise = wallet.balancePaise;
        const balanceAfterPaise = balanceBeforePaise + amountPaise;
        const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: {
                balancePaise: balanceAfterPaise,
                totalCreditedPaise: { increment: amountPaise },
                currentMonthPaise: { increment: amountPaise },
                lastTransactionAt: new Date(),
                lowAlertSent: false,
            },
        });
        // ✅ STEP 4: Create transaction record
        const transaction = await tx.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'credit',
                amountPaise,
                balanceBeforePaise,
                balanceAfterPaise,
                description: `Wallet top-up via Razorpay - ₹${toRupees(amountPaise)}`,
                status: 'completed',
                razorpayOrderId,
                razorpayPaymentId,
                note: `Credited via: ${creditedVia}`,
            },
        });
        // ✅ STEP 5: Update topup order
        await txDb.walletTopUpOrder.upsert({
            where: { razorpayOrderId },
            create: {
                organizationId,
                walletId: wallet.id,
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
                amountPaise,
                status: 'COMPLETED',
                completedAt: new Date(),
                transactionId: transaction.id,
                creditedVia,
            },
            update: {
                razorpayPaymentId,
                razorpaySignature,
                status: 'COMPLETED',
                completedAt: new Date(),
                transactionId: transaction.id,
                creditedVia,
            },
        });
        return {
            alreadyCredited: false,
            transaction,
            wallet: updatedWallet,
            newBalance: toRupees(updatedWallet.balancePaise),
            amountAdded: toRupees(amountPaise),
        };
    }, {
        isolationLevel: 'Serializable', // ✅ Highest isolation for race conditions
        timeout: 15000,
    });
}
// ─── 5B. Verify & Process TopUp (BULLETPROOF) ─────────────────────────────
async function processTopUp(organizationId, data) {
    console.log('💳 Processing wallet top-up:', {
        orderId: data.razorpayOrderId,
        paymentId: data.razorpayPaymentId,
        claimedAmount: data.amount,
        org: organizationId,
    });
    // ── Step 1: Signature verify ─────────────────────────────────────────────
    const walletSecret = process.env.WALLET_RAZORPAY_KEY_SECRET;
    if (!walletSecret) {
        throw new errorHandler_1.AppError('Wallet payment gateway not configured', 500);
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
        // ✅ Mark order as failed
        await db.walletTopUpOrder.updateMany({
            where: { razorpayOrderId: data.razorpayOrderId },
            data: {
                status: 'FAILED',
                failureReason: 'Invalid signature',
                attemptCount: { increment: 1 },
                lastAttemptAt: new Date(),
            },
        });
        throw new errorHandler_1.AppError('Payment verification failed: Invalid signature', 400);
    }
    console.log('✅ Signature verified');
    // ── Step 2: Fetch actual amount from Razorpay ────────────────────────────
    let actualAmountPaise;
    try {
        const { instance: rzp } = getWalletRazorpay();
        const order = await rzp.orders.fetch(data.razorpayOrderId);
        actualAmountPaise = Number(order.amount);
        const orderOrg = order.notes?.organizationId;
        if (orderOrg && orderOrg !== organizationId) {
            throw new errorHandler_1.AppError('Payment order does not belong to this organization', 400);
        }
        if (order.notes?.purpose && order.notes.purpose !== 'wallet_topup') {
            throw new errorHandler_1.AppError('This payment order is not for wallet top-up', 400);
        }
        console.log('✅ Razorpay order verified:', {
            orderId: order.id,
            status: order.status,
            actualAmount: `₹${toRupees(actualAmountPaise)}`,
        });
        if (order.status !== 'paid') {
            throw new errorHandler_1.AppError(`Payment not completed. Order status: ${order.status}`, 400);
        }
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            throw err;
        console.error('⚠️ Razorpay API error, using claimed amount:', err.message);
        actualAmountPaise = toPaise(data.amount);
    }
    // ── Step 3: Credit atomically (idempotent) ───────────────────────────────
    try {
        const result = await creditWalletAtomic({
            organizationId,
            razorpayOrderId: data.razorpayOrderId,
            razorpayPaymentId: data.razorpayPaymentId,
            razorpaySignature: data.razorpaySignature,
            amountPaise: actualAmountPaise,
            creditedVia: 'user_verify',
        });
        // If already credited (by webhook), fetch current balance
        if (result.alreadyCredited) {
            const wallet = await database_1.default.wallet.findUnique({
                where: { organizationId },
            });
            console.log('✅ Payment already processed - returning success');
            return {
                success: true,
                newBalance: wallet ? toRupees(wallet.balancePaise) : 0,
                amountAdded: toRupees(actualAmountPaise),
                alreadyProcessed: true,
                transaction: formatTransaction(result.transaction),
            };
        }
        console.log('✅ Wallet credited via verify:', {
            org: organizationId,
            amount: `₹${result.amountAdded}`,
            newBalance: `₹${result.newBalance}`,
        });
        return {
            success: true,
            newBalance: result.newBalance,
            amountAdded: result.amountAdded,
            transaction: formatTransaction(result.transaction),
        };
    }
    catch (err) {
        // ✅ Update order tracking on failure
        await db.walletTopUpOrder.updateMany({
            where: { razorpayOrderId: data.razorpayOrderId },
            data: {
                razorpayPaymentId: data.razorpayPaymentId,
                status: 'FAILED',
                failureReason: err.message,
                attemptCount: { increment: 1 },
                lastAttemptAt: new Date(),
            },
        });
        throw err;
    }
}
// ─── 5C. NEW: Manual Retry Function ──────────────────────────────────────
// User can retry a failed payment verification
async function retryTopUpVerification(organizationId, razorpayOrderId, razorpayPaymentId) {
    console.log('🔄 Retrying topup verification:', { organizationId, razorpayOrderId });
    // ✅ Verify order belongs to this org
    const topupOrder = await db.walletTopUpOrder.findUnique({
        where: { razorpayOrderId },
    });
    if (!topupOrder) {
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    if (topupOrder.organizationId !== organizationId) {
        throw new errorHandler_1.AppError('Order does not belong to your organization', 403);
    }
    if (topupOrder.status === 'COMPLETED') {
        const wallet = await database_1.default.wallet.findUnique({
            where: { organizationId },
        });
        return {
            success: true,
            alreadyProcessed: true,
            newBalance: wallet ? toRupees(wallet.balancePaise) : 0,
            amountAdded: toRupees(topupOrder.amountPaise),
            message: 'Payment already credited',
        };
    }
    // ✅ Fetch from Razorpay
    const { instance: rzp } = getWalletRazorpay();
    const order = await rzp.orders.fetch(razorpayOrderId);
    if (order.status !== 'paid') {
        throw new errorHandler_1.AppError(`Payment not completed on Razorpay. Status: ${order.status}. Please contact support.`, 400);
    }
    // ✅ Fetch payments for this order
    const payments = await rzp.orders.fetchPayments(razorpayOrderId);
    const capturedPayment = payments.items.find((p) => p.status === 'captured');
    if (!capturedPayment) {
        throw new errorHandler_1.AppError('No successful payment found for this order', 400);
    }
    // ✅ Credit wallet
    const result = await creditWalletAtomic({
        organizationId,
        razorpayOrderId,
        razorpayPaymentId: capturedPayment.id,
        amountPaise: Number(order.amount),
        creditedVia: 'user_verify',
    });
    if (result.alreadyCredited) {
        const wallet = await database_1.default.wallet.findUnique({ where: { organizationId } });
        return {
            success: true,
            alreadyProcessed: true,
            newBalance: wallet ? toRupees(wallet.balancePaise) : 0,
            amountAdded: toRupees(Number(order.amount)),
            message: 'Payment already credited',
        };
    }
    return {
        success: true,
        newBalance: result.newBalance,
        amountAdded: result.amountAdded,
        message: `₹${result.amountAdded} added to wallet successfully!`,
    };
}
// ─── 5D. NEW: Get Pending Orders (for user to see stuck payments) ────────
async function getPendingTopUpOrders(organizationId) {
    const pendingOrders = await db.walletTopUpOrder.findMany({
        where: {
            organizationId,
            status: { in: ['PENDING', 'FAILED'] },
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
    });
    return pendingOrders.map((o) => ({
        id: o.id,
        orderId: o.razorpayOrderId,
        paymentId: o.razorpayPaymentId,
        amount: toRupees(o.amountPaise),
        status: o.status,
        attemptCount: o.attemptCount,
        createdAt: o.createdAt,
        failureReason: o.failureReason,
        canRetry: o.status === 'FAILED' ||
            (o.status === 'PENDING' &&
                Date.now() - new Date(o.createdAt).getTime() > 5 * 60 * 1000),
    }));
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
    const { getRateForCategory, DEFAULT_RATE, LANGUAGE_TO_PREFIX, COUNTRY_RATES, COUNTRY_NAMES_MAP, } = await Promise.resolve().then(() => __importStar(require('./wallet.deduction.service')));
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    // Date range - default last 30 days
    const endDate = options?.endDate || new Date();
    const startDate = options?.startDate ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateFilter = { gte: startDate, lte: endDate };
    // ============================================
    // 1. FETCH ALL OUTBOUND MESSAGES
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
    // 2. BULK FETCH TEMPLATES
    // ============================================
    const templateIds = Array.from(new Set(outboundMessages
        .map((m) => m.templateId)
        .filter((id) => !!id)));
    const templateNames = Array.from(new Set(outboundMessages
        .map((m) => m.templateName)
        .filter((n) => !!n)));
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
    // 4. FREE WINDOW DETECTION (24-hour rule)
    // ============================================
    const conversationIds = Array.from(new Set(outboundMessages
        .map((m) => m.conversation?.id)
        .filter((id) => !!id)));
    const inboundMessagesInPeriod = await database_1.default.message.findMany({
        where: {
            conversationId: { in: conversationIds },
            direction: 'INBOUND',
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
    const inboundTimesByConv = new Map();
    for (const msg of inboundMessagesInPeriod) {
        if (!msg.conversationId)
            continue;
        const times = inboundTimesByConv.get(msg.conversationId) || [];
        times.push(msg.createdAt);
        inboundTimesByConv.set(msg.conversationId, times);
    }
    const isWithinFreeWindow = (conversationId, outboundTime) => {
        const inboundTimes = inboundTimesByConv.get(conversationId);
        if (!inboundTimes || inboundTimes.length === 0)
            return false;
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
    // ============================================
    // 5. COUNTRY DETECTION HELPER
    // ============================================
    const getCountryFromPhone = (phone) => {
        if (!phone)
            return { code: 'UNKNOWN', name: 'Unknown', flag: '🌐' };
        const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
        for (const len of [4, 3, 2, 1]) {
            const prefix = digits.slice(0, len);
            if (COUNTRY_RATES[prefix]) {
                const name = COUNTRY_NAMES_MAP[prefix] || 'Unknown';
                return {
                    code: prefix,
                    name,
                    flag: getCountryFlag(prefix),
                };
            }
        }
        return { code: 'UNKNOWN', name: 'Unknown', flag: '🌐' };
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
    const countryStats = new Map();
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
        const isTemplateMsg = msg.type === 'TEMPLATE' ||
            !!msg.templateId ||
            !!msg.templateName;
        const template = (msg.templateId ? templateById.get(msg.templateId) : undefined) ||
            (msg.templateName ? templateByName.get(msg.templateName) : undefined);
        const category = (template && typeof template === 'object' && 'category' in template
            ? template.category
            : 'SERVICE').toUpperCase();
        const language = template?.language;
        const recipientPhone = msg.conversation?.contact?.phone;
        const country = getCountryFromPhone(recipientPhone);
        // Country stats update
        if (!countryStats.has(country.code)) {
            countryStats.set(country.code, {
                code: country.code,
                name: country.name,
                flag: country.flag,
                sent: 0,
                delivered: 0,
                failed: 0,
                costPaise: 0,
                categories: {
                    MARKETING: 0,
                    UTILITY: 0,
                    AUTHENTICATION: 0,
                    SERVICE: 0,
                },
            });
        }
        const cStats = countryStats.get(country.code);
        cStats.sent++;
        if (isDelivered)
            cStats.delivered++;
        if (isFailed)
            cStats.failed++;
        // Free window check
        let isFreeWindow = false;
        if (!isTemplateMsg && msg.conversation?.id) {
            isFreeWindow = isWithinFreeWindow(msg.conversation.id, msg.createdAt);
        }
        // Route to correct bucket
        if (!isTemplateMsg && isFreeWindow) {
            freeStats.customerService.sent++;
            if (isDelivered)
                freeStats.customerService.delivered++;
            if (isFailed)
                freeStats.customerService.failed++;
            if (isRead)
                freeStats.customerService.read++;
        }
        else if (!isTemplateMsg) {
            paidStats.SERVICE.sent++;
            if (isDelivered)
                paidStats.SERVICE.delivered++;
            if (isFailed)
                paidStats.SERVICE.failed++;
            if (isRead)
                paidStats.SERVICE.read++;
            cStats.categories.SERVICE++;
        }
        else {
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
            // Country category count
            const catKey = category === 'AUTHENTICATION'
                ? 'AUTHENTICATION'
                : (category in cStats.categories ? category : 'MARKETING');
            cStats.categories[catKey]++;
            // Cost calculation
            if (isDelivered) {
                const rateRupees = getRateForCategory(category, recipientPhone || undefined, language || undefined);
                const ratePaise = Math.round(rateRupees * 100);
                paidStats[bucketKey].estimatedCostPaise += ratePaise;
                cStats.costPaise += ratePaise;
            }
        }
    }
    // ============================================
    // 7. TOTAL COST + WALLET DEBITS
    // ============================================
    const totalEstimatedCostPaise = Object.values(paidStats).reduce((sum, s) => sum + s.estimatedCostPaise, 0);
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
                (desc.includes('INTL') || desc.includes('INTERNATIONAL'))) {
                actualDebitByCategory.AUTHENTICATION_INTERNATIONAL += d.amountPaise;
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
    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
    const readRate = totalDelivered > 0
        ? Math.round((totalRead / totalDelivered) * 100)
        : 0;
    const freeTotal = freeStats.customerService.delivered + freeStats.entryPoint.delivered;
    const paidTotal = Object.values(paidStats).reduce((sum, s) => sum + s.delivered, 0);
    // ✅ Country stats sorted by cost/count
    const countryBreakdown = Array.from(countryStats.values())
        .sort((a, b) => b.sent - a.sent)
        .map((c) => ({
        code: c.code,
        name: c.name,
        flag: c.flag,
        sent: c.sent,
        delivered: c.delivered,
        failed: c.failed,
        cost: toRupees(c.costPaise),
        costPaise: c.costPaise,
        deliveryRate: c.sent > 0 ? Math.round((c.delivered / c.sent) * 100) : 0,
        categories: c.categories,
    }));
    return {
        period: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        },
        allMessages: {
            sent: totalSent,
            delivered: totalDelivered,
            failed: totalFailed,
            read: totalRead,
            received: messagesReceived,
            deliveryRate,
            readRate,
        },
        messagesDelivered: {
            total: totalDelivered,
            byCategory: categoryOrder.map((cat) => ({
                category: cat,
                label: categoryLabels[cat],
                delivered: paidStats[cat].delivered +
                    (cat === 'SERVICE' ? freeStats.customerService.delivered : 0),
            })),
        },
        freeMessagesDelivered: {
            freeCustomerService: freeStats.customerService.delivered,
            freeEntryPoint: freeStats.entryPoint.delivered,
            total: freeTotal,
            sent: freeStats.customerService.sent + freeStats.entryPoint.sent,
        },
        paidMessagesDelivered: {
            total: paidTotal,
            byCategory: categoryOrder.map((cat) => ({
                category: cat,
                label: categoryLabels[cat],
                delivered: paidStats[cat].delivered,
                sent: paidStats[cat].sent,
            })),
        },
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
        actualCharges: {
            total: toRupees(actualDebitedPaise),
            totalPaise: actualDebitedPaise,
            byCategory: categoryOrder.map((cat) => ({
                category: cat,
                label: categoryLabels[cat],
                cost: toRupees(actualDebitByCategory[cat] || 0),
            })),
        },
        // ✅ NEW: Country-wise breakdown
        countryBreakdown,
        countrySummary: {
            totalCountries: countryStats.size,
            topCountry: countryBreakdown[0] || null,
        },
        rates: {
            currency: 'INR',
            unit: 'per delivered message',
            note: 'Rates vary by recipient country. Below are India rates for reference.',
            india: {
                MARKETING: DEFAULT_RATE.marketing,
                UTILITY: DEFAULT_RATE.utility,
                AUTHENTICATION: DEFAULT_RATE.authentication,
                AUTHENTICATION_INTERNATIONAL: 2.5,
                SERVICE: 0,
            },
        },
    };
}
// ============================================
// HELPER: Country Flag Emoji
// ============================================
function getCountryFlag(prefix) {
    const flagMap = {
        '91': '🇮🇳', '1': '🇺🇸', '44': '🇬🇧', '61': '🇦🇺',
        '86': '🇨🇳', '81': '🇯🇵', '49': '🇩🇪', '33': '🇫🇷',
        '39': '🇮🇹', '34': '🇪🇸', '7': '🇷🇺', '55': '🇧🇷',
        '52': '🇲🇽', '62': '🇮🇩', '234': '🇳🇬', '27': '🇿🇦',
        '971': '🇦🇪', '966': '🇸🇦', '65': '🇸🇬', '60': '🇲🇾',
        '92': '🇵🇰', '880': '🇧🇩', '94': '🇱🇰', '977': '🇳🇵',
        '20': '🇪🇬', '90': '🇹🇷', '31': '🇳🇱', '46': '🇸🇪',
        '47': '🇳🇴', '45': '🇩🇰', '32': '🇧🇪', '41': '🇨🇭',
        '43': '🇦🇹', '30': '🇬🇷', '351': '🇵🇹', '48': '🇵🇱',
        '82': '🇰🇷', '66': '🇹🇭', '84': '🇻🇳', '63': '🇵🇭',
        '972': '🇮🇱', '974': '🇶🇦', '965': '🇰🇼', '973': '🇧🇭',
        '968': '🇴🇲', '54': '🇦🇷', '56': '🇨🇱', '57': '🇨🇴',
        '51': '🇵🇪', '58': '🇻🇪', '254': '🇰🇪', '256': '🇺🇬',
        '255': '🇹🇿', '233': '🇬🇭', '212': '🇲🇦', '213': '🇩🇿',
    };
    return flagMap[prefix] || '🌐';
}
// ─── WEBHOOK: Credit wallet from Razorpay webhook ────────────────────────────
// Called by webhook handler - fully idempotent
async function creditWalletFromWebhook(params) {
    console.log('📥 Webhook credit request:', params);
    const result = await creditWalletAtomic({
        organizationId: params.organizationId,
        razorpayOrderId: params.razorpayOrderId,
        razorpayPaymentId: params.razorpayPaymentId,
        amountPaise: params.amountPaise,
        creditedVia: 'webhook',
    });
    if (result.alreadyCredited) {
        console.log('✅ Webhook: Payment already credited (idempotent)');
        return { alreadyCredited: true };
    }
    console.log('✅ Webhook: Wallet credited successfully', {
        org: params.organizationId,
        amount: `₹${result.amountAdded}`,
        newBalance: `₹${result.newBalance}`,
    });
    // Emit socket event
    try {
        const { webhookEvents } = await Promise.resolve().then(() => __importStar(require('../webhooks/webhook.service')));
        webhookEvents.emit('walletCredited', {
            organizationId: params.organizationId,
            amount: result.amountAdded,
            newBalance: result.newBalance,
        });
    }
    catch { }
    return {
        alreadyCredited: false,
        newBalance: result.newBalance,
        amountAdded: result.amountAdded,
    };
}
//# sourceMappingURL=wallet.service.js.map