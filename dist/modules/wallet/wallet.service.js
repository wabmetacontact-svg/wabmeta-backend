"use strict";
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
const PAISE_MULTIPLIER = 100; // ₹1 = 100 paise
// ─── Helper: Rupees ↔ Paise ───────────────────────────────────────────────────
const toPaise = (rupees) => Math.round(rupees * PAISE_MULTIPLIER);
const toRupees = (paise) => paise / PAISE_MULTIPLIER;
// ─── Helper: Format Wallet Response ───────────────────────────────────────────
function formatWallet(wallet) {
    return {
        id: wallet.id,
        organizationId: wallet.organizationId,
        isActive: wallet.isActive,
        accessGrantedAt: wallet.accessGrantedAt,
        // Convert paise → rupees for frontend
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
// ─── Helper: Format Transaction ────────────────────────────────────────────────
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
// ─── Helper: Verify 3-Month Plan ──────────────────────────────────────────────
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
    // Check plan duration - Only block FREE_DEMO
    if (subscription.plan?.type === 'FREE_DEMO') {
        return {
            eligible: false,
            reason: 'Wallet feature is not available on the Free plan. Please upgrade to a Monthly, Quarterly, or Annual plan to enable it.',
        };
    }
    return { eligible: true };
}
// ─── Helper: Reset Monthly Limit If Needed ────────────────────────────────────
async function resetMonthlyIfNeeded(wallet) {
    if (new Date() >= new Date(wallet.monthResetDate)) {
        const nextReset = new Date();
        nextReset.setMonth(nextReset.getMonth() + 1, 1);
        nextReset.setHours(0, 0, 0, 0);
        return database_1.default.wallet.update({
            where: { id: wallet.id },
            data: {
                currentMonthPaise: 0,
                monthResetDate: nextReset,
            },
        });
    }
    return wallet;
}
// ═══════════════════════════════════════════════════════════════════════════════
// USER-FACING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
// ─── 1. Get Wallet Details ────────────────────────────────────────────────────
async function getWalletDetails(organizationId) {
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    // Check pending request
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
// ─── 2. Request Wallet Access ─────────────────────────────────────────────────
async function requestWalletAccess(organizationId, userId, data) {
    // Check if wallet already active
    const existingWallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    if (existingWallet?.isActive) {
        throw new errorHandler_1.AppError('Wallet is already active for your organization', 400);
    }
    // Check pending request
    const pendingRequest = await database_1.default.walletAccessRequest.findFirst({
        where: { organizationId, status: 'pending' },
    });
    if (pendingRequest) {
        throw new errorHandler_1.AppError('A wallet access request is already pending review', 400);
    }
    // Check rejected recently (7 days cooldown)
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
        throw new errorHandler_1.AppError('Your previous request was rejected. Please wait 7 days before submitting again.', 400);
    }
    // Check plan eligibility
    const planCheck = await verifyMinimumPlan(organizationId);
    // Create request
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
// ─── 3. Get Transaction History ───────────────────────────────────────────────
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
// ─── 4. Create TopUp Order (Razorpay) ─────────────────────────────────────────
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
    const amountPaise = toPaise(amountRupees);
    // Validation
    if (amountPaise < 10000) {
        // ₹100 minimum
        throw new errorHandler_1.AppError('Minimum top-up amount is ₹100', 400);
    }
    if (amountPaise > wallet.maxTopUpPaise) {
        throw new errorHandler_1.AppError(`Maximum top-up per transaction is ₹${toRupees(wallet.maxTopUpPaise).toLocaleString('en-IN')}`, 400);
    }
    // Reset monthly limit if needed
    const updatedWallet = await resetMonthlyIfNeeded(wallet);
    if (updatedWallet.currentMonthPaise + amountPaise > updatedWallet.maxMonthlyPaise) {
        const remainingPaise = updatedWallet.maxMonthlyPaise - updatedWallet.currentMonthPaise;
        throw new errorHandler_1.AppError(`Monthly top-up limit exceeded. Remaining this month: ₹${toRupees(remainingPaise).toLocaleString('en-IN')}`, 400);
    }
    // Create Razorpay order - reuse existing billing pattern
    const Razorpay = require('razorpay');
    const rzp = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const timestamp = Date.now().toString().slice(-8);
    const orgShort = organizationId.replace(/[^a-zA-Z0-9]/g, '').slice(-6);
    const receipt = `wlt_${orgShort}_${timestamp}`;
    const order = await rzp.orders.create({
        amount: amountPaise, // Razorpay takes paise
        currency: 'INR',
        receipt,
        payment_capture: 1,
        notes: {
            organizationId,
            purpose: 'wallet_topup',
            walletId: wallet.id,
        },
    });
    return {
        orderId: order.id,
        amount: amountRupees,
        amountPaise,
        currency: 'INR',
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        receipt: order.receipt,
    };
}
// ─── 5. Verify & Process TopUp ────────────────────────────────────────────────
async function processTopUp(organizationId, data) {
    // Verify Razorpay signature
    const body = data.razorpayOrderId + '|' + data.razorpayPaymentId;
    const expectedSignature = crypto_1.default
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');
    if (expectedSignature !== data.razorpaySignature) {
        throw new errorHandler_1.AppError('Payment verification failed: Invalid signature', 400);
    }
    // Check duplicate payment
    const existingTxn = await database_1.default.walletTransaction.findFirst({
        where: { razorpayPaymentId: data.razorpayPaymentId },
    });
    if (existingTxn) {
        throw new errorHandler_1.AppError('This payment has already been processed', 400);
    }
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    if (!wallet)
        throw new errorHandler_1.AppError('Wallet not found', 404);
    const amountPaise = toPaise(data.amount);
    const balanceBeforePaise = wallet.balancePaise;
    const balanceAfterPaise = balanceBeforePaise + amountPaise;
    // Use Prisma transaction for atomicity
    const [updatedWallet, transaction] = await database_1.default.$transaction([
        // Update wallet balance
        database_1.default.wallet.update({
            where: { id: wallet.id },
            data: {
                balancePaise: balanceAfterPaise,
                totalCreditedPaise: { increment: amountPaise },
                currentMonthPaise: { increment: amountPaise },
                lastTransactionAt: new Date(),
                lowAlertSent: false, // Reset alert on top-up
            },
        }),
        // Create transaction record
        database_1.default.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'credit',
                amountPaise,
                balanceBeforePaise,
                balanceAfterPaise,
                description: `Wallet top-up via Razorpay`,
                status: 'completed',
                razorpayOrderId: data.razorpayOrderId,
                razorpayPaymentId: data.razorpayPaymentId,
            },
        }),
    ]);
    return {
        success: true,
        newBalance: toRupees(updatedWallet.balancePaise),
        amountAdded: data.amount,
        transaction: formatTransaction(transaction),
    };
}
// ─── 6. Deduct Balance (Meta Charges) ─────────────────────────────────────────
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
        // Trigger low balance alert
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
    // Deduct from real balance first, then credit
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
    // Check low balance after deduction
    if (updatedWallet.balancePaise < updatedWallet.lowThresholdPaise) {
        await triggerLowBalanceAlert(updatedWallet);
    }
    return {
        success: true,
        newBalance: toRupees(updatedWallet.balancePaise),
    };
}
// ─── 7. Low Balance Alert ──────────────────────────────────────────────────────
async function triggerLowBalanceAlert(wallet) {
    if (wallet.lowAlertSent && wallet.lastAlertSentAt) {
        const hoursDiff = (Date.now() - new Date(wallet.lastAlertSentAt).getTime()) /
            (1000 * 60 * 60);
        if (hoursDiff < 24)
            return; // Throttle: once per 24 hours
    }
    await database_1.default.wallet.update({
        where: { id: wallet.id },
        data: {
            lowAlertSent: true,
            lastAlertSentAt: new Date(),
        },
    });
    // TODO: Integrate with your existing notification/email system
    // e.g., emailService.sendLowBalanceAlert(wallet.organizationId)
    console.log(`🔔 Low balance alert triggered for org: ${wallet.organizationId}`, `Balance: ₹${toRupees(wallet.balancePaise)}`);
}
// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
// ─── 8. Get All Access Requests ───────────────────────────────────────────────
async function getAccessRequests(options) {
    const { status, page = 1, limit = 20 } = options;
    const where = {};
    if (status)
        where.status = status;
    const [requests, total] = await Promise.all([
        database_1.default.walletAccessRequest.findMany({
            where,
            include: {
                organization: { select: { id: true, name: true, planType: true } },
                user: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
                reviewer: { select: { id: true, name: true, email: true } },
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
// ─── 9. Review Request (Approve/Reject) ───────────────────────────────────────
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
    // Update request status
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
        // Calculate next month reset date
        const nextMonthReset = new Date();
        nextMonthReset.setMonth(nextMonthReset.getMonth() + 1, 1);
        nextMonthReset.setHours(0, 0, 0, 0);
        // Create or activate wallet using Prisma upsert
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
    // TODO: Send notification to user
    // emailService.sendWalletDecision(request.userId, action, note)
    return {
        success: true,
        action,
        message: `Wallet access request ${action}d successfully`,
    };
}
// ─── 10. Get All Wallets (Admin View) ─────────────────────────────────────────
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
                organization: { select: { id: true, name: true, planType: true } },
                user: {
                    select: { id: true, email: true, firstName: true, lastName: true },
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
// ─── 11. Admin Manual Adjust Balance ──────────────────────────────────────────
async function adminAdjustBalance(organizationId, adminId, data) {
    if (!data.note || data.note.trim().length < 5) {
        throw new errorHandler_1.AppError('Please provide a reason for adjustment (min 5 chars)', 400);
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
                description: `Admin adjustment: ${data.note}`,
                status: 'completed',
                performedBy: adminId,
                note: data.note,
            },
        }),
    ]);
    return {
        success: true,
        newBalance: toRupees(updatedWallet.balancePaise),
        transaction: formatTransaction(transaction),
    };
}
// ─── 12. Set Credit Limit ─────────────────────────────────────────────────────
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
// ─── 13. Flag/Unflag Wallet ───────────────────────────────────────────────────
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
// ─── 14. Activate / Deactivate Wallet (Admin) ────────────────────────────────
async function setWalletActive(organizationId, adminId, activate, reason) {
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
        include: { organization: { select: { name: true } } },
    });
    if (!wallet)
        throw new errorHandler_1.AppError('Wallet not found for this organization', 404);
    if (wallet.isActive === activate) {
        throw new errorHandler_1.AppError(`Wallet is already ${activate ? 'active' : 'inactive'}`, 400);
    }
    await database_1.default.$transaction([
        // 1. Update wallet status
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
        // 2. Create audit transaction record
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
                note: reason || (activate ? 'Admin activation' : 'Admin deactivation'),
            },
        }),
    ]);
    return {
        success: true,
        isActive: activate,
        message: activate
            ? `Wallet activated for ${wallet.organization?.name || organizationId}`
            : `Wallet deactivated and unlinked for ${wallet.organization?.name || organizationId}`,
    };
}
// ─── 14. Wallet Message Analytics (Meta-style insights) ─────────────────────
async function getWalletMessageAnalytics(organizationId) {
    const wallet = await database_1.default.wallet.findUnique({ where: { organizationId } });
    const RATES = {
        MARKETING: 0.90,
        UTILITY: 0.15,
        AUTHENTICATION: 0.15,
        AUTHENTICATION_INTERNATIONAL: 2.50,
        SERVICE: 0.00,
    };
    // 1. All outbound messages
    const allOutbound = await database_1.default.message.findMany({
        where: { conversation: { organizationId }, direction: 'OUTBOUND' },
        select: { status: true },
    });
    const messagesSent = allOutbound.length;
    const messagesDelivered = allOutbound.filter(m => ['DELIVERED', 'READ'].includes(m.status)).length;
    const messagesReceived = await database_1.default.message.count({
        where: { conversation: { organizationId }, direction: 'INBOUND' },
    });
    // 2. Campaign stats grouped by template category
    const campaigns = await database_1.default.campaign.findMany({
        where: { organizationId },
        include: { template: { select: { category: true } } },
    });
    const categoryStats = {
        MARKETING: { sent: 0, delivered: 0 },
        UTILITY: { sent: 0, delivered: 0 },
        AUTHENTICATION: { sent: 0, delivered: 0 },
        AUTHENTICATION_INTERNATIONAL: { sent: 0, delivered: 0 },
        SERVICE: { sent: 0, delivered: 0 },
    };
    for (const c of campaigns) {
        const cat = (c.template?.category || 'MARKETING').toUpperCase();
        const key = Object.keys(categoryStats).find(k => cat.includes(k)) || 'MARKETING';
        categoryStats[key].sent += c.sentCount || 0;
        categoryStats[key].delivered += c.deliveredCount || 0;
    }
    // 3. Wallet debit transactions → cost per category
    const costByCategory = {
        MARKETING: 0, UTILITY: 0, AUTHENTICATION: 0,
        AUTHENTICATION_INTERNATIONAL: 0, SERVICE: 0,
    };
    let totalChargesPaise = 0;
    if (wallet) {
        const debits = await database_1.default.walletTransaction.findMany({
            where: { walletId: wallet.id, type: 'debit', metaService: 'template_message' },
            select: { amountPaise: true, description: true },
        });
        for (const d of debits) {
            totalChargesPaise += d.amountPaise;
            const desc = (d.description || '').toUpperCase();
            if (desc.includes('AUTH') && desc.includes('INTL')) {
                costByCategory.AUTHENTICATION_INTERNATIONAL += d.amountPaise;
            }
            else if (desc.includes('AUTH')) {
                costByCategory.AUTHENTICATION += d.amountPaise;
            }
            else if (desc.includes('UTILITY')) {
                costByCategory.UTILITY += d.amountPaise;
            }
            else if (desc.includes('SERVICE')) {
                costByCategory.SERVICE += d.amountPaise;
            }
            else {
                costByCategory.MARKETING += d.amountPaise;
            }
        }
    }
    const categories = [
        { key: 'MARKETING', label: 'Marketing', rate: RATES.MARKETING },
        { key: 'UTILITY', label: 'Utility', rate: RATES.UTILITY },
        { key: 'AUTHENTICATION', label: 'Authentication', rate: RATES.AUTHENTICATION },
        { key: 'AUTHENTICATION_INTERNATIONAL', label: 'Authentication - International', rate: RATES.AUTHENTICATION_INTERNATIONAL },
        { key: 'SERVICE', label: 'Service', rate: RATES.SERVICE },
    ];
    return {
        allMessages: { sent: messagesSent, delivered: messagesDelivered, received: messagesReceived },
        messagesDelivered: categories.map(c => ({
            category: c.key, label: c.label, delivered: categoryStats[c.key].delivered,
        })),
        freeMessagesDelivered: { freeCustomerService: 0, freeEntryPoint: 0, total: 0 },
        paidMessagesDelivered: categories.map(c => ({
            category: c.key, label: c.label, delivered: categoryStats[c.key].delivered,
        })),
        approximateCharges: {
            total: toRupees(totalChargesPaise),
            byCategory: categories.map(c => ({
                category: c.key,
                label: c.label,
                cost: toRupees(costByCategory[c.key]),
                rate: c.rate,
                count: categoryStats[c.key].sent,
            })),
        },
        rates: RATES,
    };
}
//# sourceMappingURL=wallet.service.js.map