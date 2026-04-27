import prisma from '../../config/database';
import crypto from 'crypto';
import { AppError } from '../../middleware/errorHandler';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAISE_MULTIPLIER = 100; // ₹1 = 100 paise

// ─── Helper: Rupees ↔ Paise ───────────────────────────────────────────────────
const toPaise = (rupees: number): number => Math.round(rupees * PAISE_MULTIPLIER);
const toRupees = (paise: number): number => paise / PAISE_MULTIPLIER;

// ─── Helper: Format Wallet Response ───────────────────────────────────────────
function formatWallet(wallet: any) {
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
function formatTransaction(txn: any) {
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
async function verifyMinimumPlan(organizationId: string): Promise<{
  eligible: boolean;
  reason?: string;
  monthsActive?: number;
}> {
  const subscription = await prisma.subscription.findUnique({
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
async function resetMonthlyIfNeeded(wallet: any): Promise<any> {
  if (new Date() >= new Date(wallet.monthResetDate)) {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1, 1);
    nextReset.setHours(0, 0, 0, 0);

    return prisma.wallet.update({
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
export async function getWalletDetails(organizationId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { organizationId },
  });

  // Check pending request
  const pendingRequest = await prisma.walletAccessRequest.findFirst({
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
export async function requestWalletAccess(
  organizationId: string,
  userId: string,
  data: { reason: string; additionalInfo?: string }
) {
  // Check if wallet already active
  const existingWallet = await prisma.wallet.findUnique({
    where: { organizationId },
  });

  if (existingWallet?.isActive) {
    throw new AppError('Wallet is already active for your organization', 400);
  }

  // Check pending request
  const pendingRequest = await prisma.walletAccessRequest.findFirst({
    where: { organizationId, status: 'pending' },
  });

  if (pendingRequest) {
    throw new AppError(
      'A wallet access request is already pending review',
      400
    );
  }

  // Check rejected recently (7 days cooldown)
  const recentRejection = await prisma.walletAccessRequest.findFirst({
    where: {
      organizationId,
      status: 'rejected',
      reviewedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  if (recentRejection) {
    throw new AppError(
      'Your previous request was rejected. Please wait 7 days before submitting again.',
      400
    );
  }

  // Check plan eligibility
  const planCheck = await verifyMinimumPlan(organizationId);

  // Create request
  const request = await prisma.walletAccessRequest.create({
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
export async function getTransactionHistory(
  organizationId: string,
  options: {
    page?: number;
    limit?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }
) {
  const { page = 1, limit = 20, type, startDate, endDate } = options;

  const wallet = await prisma.wallet.findUnique({
    where: { organizationId },
    select: { id: true, isActive: true },
  });

  if (!wallet) throw new AppError('Wallet not found', 404);
  if (!wallet.isActive) throw new AppError('Wallet is not active', 403);

  const where: any = { walletId: wallet.id };
  if (type) where.type = type;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.walletTransaction.count({ where }),
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
export async function createTopUpOrder(
  organizationId: string,
  amountRupees: number
) {
  const wallet = await prisma.wallet.findUnique({
    where: { organizationId },
  });

  if (!wallet) throw new AppError('Wallet not found', 404);
  if (!wallet.isActive) throw new AppError('Wallet is not active', 403);
  if (wallet.flagged) {
    throw new AppError('Wallet is flagged. Please contact support.', 403);
  }

  const amountPaise = toPaise(amountRupees);

  // Validation
  if (amountPaise < 10000) {
    // ₹100 minimum
    throw new AppError('Minimum top-up amount is ₹100', 400);
  }

  if (amountPaise > wallet.maxTopUpPaise) {
    throw new AppError(
      `Maximum top-up per transaction is ₹${toRupees(wallet.maxTopUpPaise).toLocaleString('en-IN')}`,
      400
    );
  }

  // Reset monthly limit if needed
  const updatedWallet = await resetMonthlyIfNeeded(wallet);

  if (updatedWallet.currentMonthPaise + amountPaise > updatedWallet.maxMonthlyPaise) {
    const remainingPaise =
      updatedWallet.maxMonthlyPaise - updatedWallet.currentMonthPaise;
    throw new AppError(
      `Monthly top-up limit exceeded. Remaining this month: ₹${toRupees(remainingPaise).toLocaleString('en-IN')}`,
      400
    );
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
export async function processTopUp(
  organizationId: string,
  data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    amount: number; // rupees from frontend
  }
) {
  // Verify Razorpay signature
  const body = data.razorpayOrderId + '|' + data.razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex');

  if (expectedSignature !== data.razorpaySignature) {
    throw new AppError('Payment verification failed: Invalid signature', 400);
  }

  // Check duplicate payment
  const existingTxn = await prisma.walletTransaction.findFirst({
    where: { razorpayPaymentId: data.razorpayPaymentId },
  });

  if (existingTxn) {
    throw new AppError('This payment has already been processed', 400);
  }

  const wallet = await prisma.wallet.findUnique({
    where: { organizationId },
  });

  if (!wallet) throw new AppError('Wallet not found', 404);

  const amountPaise = toPaise(data.amount);
  const balanceBeforePaise = wallet.balancePaise;
  const balanceAfterPaise = balanceBeforePaise + amountPaise;

  // Use Prisma transaction for atomicity
  const [updatedWallet, transaction] = await prisma.$transaction([
    // Update wallet balance
    prisma.wallet.update({
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
    prisma.walletTransaction.create({
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
export async function deductBalance(
  organizationId: string,
  data: {
    amountRupees: number;
    description: string;
    metaChargeId?: string;
    metaService?: 'message_sending' | 'template_message' | 'api_usage' | 'other';
  }
): Promise<{
  success: boolean;
  newBalance: number;
  insufficient?: boolean;
  message?: string;
}> {
  const wallet = await prisma.wallet.findUnique({
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
  const availablePaise =
    wallet.balancePaise +
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
  let newBalancePaise: number;
  let creditDeductedPaise = 0;

  // Deduct from real balance first, then credit
  if (wallet.balancePaise >= amountPaise) {
    newBalancePaise = wallet.balancePaise - amountPaise;
  } else {
    creditDeductedPaise = amountPaise - wallet.balancePaise;
    newBalancePaise = 0;
  }

  const [updatedWallet, transaction] = await prisma.$transaction([
    prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balancePaise: newBalancePaise,
        creditUsedPaise: { increment: creditDeductedPaise },
        totalDebitedPaise: { increment: amountPaise },
        lastTransactionAt: new Date(),
      },
    }),

    prisma.walletTransaction.create({
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
async function triggerLowBalanceAlert(wallet: any) {
  if (wallet.lowAlertSent && wallet.lastAlertSentAt) {
    const hoursDiff =
      (Date.now() - new Date(wallet.lastAlertSentAt).getTime()) /
      (1000 * 60 * 60);
    if (hoursDiff < 24) return; // Throttle: once per 24 hours
  }

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      lowAlertSent: true,
      lastAlertSentAt: new Date(),
    },
  });

  // TODO: Integrate with your existing notification/email system
  // e.g., emailService.sendLowBalanceAlert(wallet.organizationId)
  console.log(
    `🔔 Low balance alert triggered for org: ${wallet.organizationId}`,
    `Balance: ₹${toRupees(wallet.balancePaise)}`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 8. Get All Access Requests ───────────────────────────────────────────────
export async function getAccessRequests(options: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  const { status, page = 1, limit = 20 } = options;

  const where: any = {};
  if (status) where.status = status;

  const [requests, total] = await Promise.all([
    prisma.walletAccessRequest.findMany({
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
    prisma.walletAccessRequest.count({ where }),
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
export async function reviewWalletRequest(
  requestId: string,
  adminId: string,
  action: 'approve' | 'reject',
  note?: string
) {
  const request = await prisma.walletAccessRequest.findUnique({
    where: { id: requestId },
    include: { organization: true },
  });

  if (!request) throw new AppError('Request not found', 404);
  if (request.status !== 'pending') {
    throw new AppError('Request has already been reviewed', 400);
  }

  // Update request status
  await prisma.walletAccessRequest.update({
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
    await prisma.wallet.upsert({
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
export async function getAllWallets(options: {
  page?: number;
  limit?: number;
  flagged?: boolean;
  isActive?: boolean;
}) {
  const { page = 1, limit = 20, flagged, isActive } = options;

  const where: any = {};
  if (flagged !== undefined) where.flagged = flagged;
  if (isActive !== undefined) where.isActive = isActive;

  const [wallets, total] = await Promise.all([
    prisma.wallet.findMany({
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
    prisma.wallet.count({ where }),
  ]);

  return {
    wallets: wallets.map((w: any) => ({
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
export async function adminAdjustBalance(
  organizationId: string,
  adminId: string,
  data: {
    type: 'admin_credit' | 'admin_debit';
    amountRupees: number;
    note: string;
  }
) {
  if (!data.note || data.note.trim().length < 5) {
    throw new AppError('Please provide a reason for adjustment (min 5 chars)', 400);
  }

  const wallet = await prisma.wallet.findUnique({
    where: { organizationId },
  });

  if (!wallet) throw new AppError('Wallet not found', 404);

  const amountPaise = toPaise(data.amountRupees);

  if (data.type === 'admin_debit' && wallet.balancePaise < amountPaise) {
    throw new AppError(
      `Insufficient balance. Available: ₹${toRupees(wallet.balancePaise)}`,
      400
    );
  }

  const balanceBeforePaise = wallet.balancePaise;
  const balanceAfterPaise =
    data.type === 'admin_credit'
      ? balanceBeforePaise + amountPaise
      : balanceBeforePaise - amountPaise;

  const [updatedWallet, transaction] = await prisma.$transaction([
    prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balancePaise: balanceAfterPaise,
        totalCreditedPaise:
          data.type === 'admin_credit'
            ? { increment: amountPaise }
            : undefined,
        totalDebitedPaise:
          data.type === 'admin_debit'
            ? { increment: amountPaise }
            : undefined,
        lastTransactionAt: new Date(),
      },
    }),

    prisma.walletTransaction.create({
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
export async function setCreditLimit(
  organizationId: string,
  creditLimitRupees: number,
  enable: boolean
) {
  const wallet = await prisma.wallet.findUnique({
    where: { organizationId },
  });

  if (!wallet) throw new AppError('Wallet not found', 404);

  const updated = await prisma.wallet.update({
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
export async function flagWallet(
  organizationId: string,
  adminId: string,
  reason: string,
  unflag: boolean = false
) {
  const wallet = await prisma.wallet.findUnique({
    where: { organizationId },
  });

  if (!wallet) throw new AppError('Wallet not found', 404);

  await prisma.wallet.update({
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

// ─── 14. Wallet Message Analytics (Meta-style insights) ─────────────────────
export async function getWalletMessageAnalytics(organizationId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { organizationId } });

  const RATES: Record<string, number> = {
    MARKETING: 0.90,
    UTILITY: 0.15,
    AUTHENTICATION: 0.15,
    AUTHENTICATION_INTERNATIONAL: 2.50,
    SERVICE: 0.00,
  };

  // 1. All outbound messages
  const allOutbound = await prisma.message.findMany({
    where: { conversation: { organizationId }, direction: 'OUTBOUND' },
    select: { status: true },
  });
  const messagesSent      = allOutbound.length;
  const messagesDelivered = allOutbound.filter(m => ['DELIVERED','READ'].includes(m.status)).length;
  const messagesReceived  = await prisma.message.count({
    where: { conversation: { organizationId }, direction: 'INBOUND' },
  });

  // 2. Campaign stats grouped by template category
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId },
    include: { template: { select: { category: true } } },
  });

  const categoryStats: Record<string, { sent: number; delivered: number }> = {
    MARKETING:                    { sent: 0, delivered: 0 },
    UTILITY:                      { sent: 0, delivered: 0 },
    AUTHENTICATION:               { sent: 0, delivered: 0 },
    AUTHENTICATION_INTERNATIONAL: { sent: 0, delivered: 0 },
    SERVICE:                      { sent: 0, delivered: 0 },
  };

  for (const c of campaigns) {
    const cat = (c.template?.category || 'MARKETING').toUpperCase();
    const key = Object.keys(categoryStats).find(k => cat.includes(k)) || 'MARKETING';
    categoryStats[key].sent      += c.sentCount      || 0;
    categoryStats[key].delivered += c.deliveredCount || 0;
  }

  // 3. Wallet debit transactions → cost per category
  const costByCategory: Record<string, number> = {
    MARKETING: 0, UTILITY: 0, AUTHENTICATION: 0,
    AUTHENTICATION_INTERNATIONAL: 0, SERVICE: 0,
  };
  let totalChargesPaise = 0;

  if (wallet) {
    const debits = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id, type: 'debit', metaService: 'template_message' },
      select: { amountPaise: true, description: true },
    });
    for (const d of debits) {
      totalChargesPaise += d.amountPaise;
      const desc = (d.description || '').toUpperCase();
      if (desc.includes('AUTH') && desc.includes('INTL')) {
        costByCategory.AUTHENTICATION_INTERNATIONAL += d.amountPaise;
      } else if (desc.includes('AUTH')) {
        costByCategory.AUTHENTICATION += d.amountPaise;
      } else if (desc.includes('UTILITY')) {
        costByCategory.UTILITY += d.amountPaise;
      } else if (desc.includes('SERVICE')) {
        costByCategory.SERVICE += d.amountPaise;
      } else {
        costByCategory.MARKETING += d.amountPaise;
      }
    }
  }

  const categories = [
    { key: 'MARKETING',                    label: 'Marketing',                    rate: RATES.MARKETING                    },
    { key: 'UTILITY',                      label: 'Utility',                      rate: RATES.UTILITY                      },
    { key: 'AUTHENTICATION',               label: 'Authentication',               rate: RATES.AUTHENTICATION               },
    { key: 'AUTHENTICATION_INTERNATIONAL', label: 'Authentication - International', rate: RATES.AUTHENTICATION_INTERNATIONAL },
    { key: 'SERVICE',                      label: 'Service',                      rate: RATES.SERVICE                      },
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
        label:    c.label,
        cost:     toRupees(costByCategory[c.key]),
        rate:     c.rate,
        count:    categoryStats[c.key].sent,
      })),
    },
    rates: RATES,
  };
}
