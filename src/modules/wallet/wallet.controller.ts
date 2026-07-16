// src/modules/wallet/wallet.controller.ts - FIXED
import { Request, Response } from 'express';
import * as walletService from './wallet.service';
import { sendSuccess, errorResponse } from '../../utils/response';

// ─── Helpers ──────────────────────────────────────────────────
const getOrgId = (req: Request): string | null =>
  req.user?.organizationId || null;

const getUserId = (req: Request): string | null =>
  req.user?.id || null;

// ✅ End of day helper (inclusive date range)
const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

// ─── User Controllers ─────────────────────────────────────────

export const getWallet = async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId)
      return errorResponse(res, 'Organization not found', 400);

    const data = await walletService.getWalletDetails(organizationId);
    return sendSuccess(res, data, 'Wallet retrieved successfully');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const requestAccess = async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    const userId = getUserId(req);

    if (!organizationId || !userId)
      return errorResponse(res, 'Authentication required', 401);

    const { reason, additionalInfo } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 20) {
      return errorResponse(
        res,
        'Please provide a detailed reason (minimum 20 characters)',
        400
      );
    }

    const result = await walletService.requestWalletAccess(
      organizationId, userId,
      { reason: reason.trim(), additionalInfo }
    );

    return sendSuccess(res, result, result.message);
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId)
      return errorResponse(res, 'Organization not found', 400);

    const { page, limit, type, startDate, endDate } = req.query;

    // ✅ FIX Bug1: Parse dates properly with end-of-day for endDate
    let parsedStart: Date | undefined;
    let parsedEnd: Date | undefined;

    if (typeof startDate === 'string' && startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) parsedStart = d;
    }

    if (typeof endDate === 'string' && endDate) {
      const d = new Date(endDate);
      if (!isNaN(d.getTime())) parsedEnd = endOfDay(d); // ✅ inclusive
    }

    const result = await walletService.getTransactionHistory(
      organizationId,
      {
        page: Math.max(1, Number(page) || 1),
        limit: Math.min(100, Math.max(1, Number(limit) || 20)),
        type: typeof type === 'string' && type ? type : undefined,
        startDate: parsedStart,
        endDate: parsedEnd,
      }
    );

    return sendSuccess(res, result, 'Transactions retrieved');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const createTopUp = async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId)
      return errorResponse(res, 'Organization not found', 400);

    const rawAmount = req.body.amount;

    // ✅ FIX Bug2: Validate amount in controller
    if (rawAmount === undefined || rawAmount === null || rawAmount === '') {
      return errorResponse(res, 'Amount is required', 400);
    }

    const amount = Number(rawAmount);

    if (isNaN(amount) || amount <= 0) {
      return errorResponse(res, 'Amount must be a positive number', 400);
    }

    if (amount < 100) {
      return errorResponse(res, 'Minimum top-up amount is ₹100', 400);
    }

    if (amount > 100_000) {
      return errorResponse(
        res,
        'Maximum top-up is ₹1,00,000 per transaction',
        400
      );
    }

    const order = await walletService.createTopUpOrder(organizationId, amount);
    return sendSuccess(res, order, 'Order created successfully');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const verifyTopUp = async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId)
      return errorResponse(res, 'Organization not found', 400);

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      amount,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return errorResponse(res, 'Payment details incomplete', 400);
    }

    // ✅ FIX Bug4: amount can be undefined - handle gracefully
    const parsedAmount = amount !== undefined ? Number(amount) : 0;

    const result = await walletService.processTopUp(organizationId, {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      amount: isNaN(parsedAmount) ? 0 : parsedAmount,
    });

    return sendSuccess(
      res,
      result,
      `₹${result.amountAdded?.toFixed(2) || '0'} added to wallet!`
    );
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const getPendingTopUps = async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId)
      return errorResponse(res, 'Organization not found', 400);

    const orders = await walletService.getPendingTopUpOrders(organizationId);
    return sendSuccess(res, { orders }, 'Pending orders retrieved');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const retryTopUp = async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId)
      return errorResponse(res, 'Organization not found', 400);

    const { razorpayOrderId, razorpayPaymentId } = req.body;

    if (!razorpayOrderId || typeof razorpayOrderId !== 'string') {
      return errorResponse(res, 'Order ID required', 400);
    }

    const result = await walletService.retryTopUpVerification(
      organizationId,
      razorpayOrderId,
      razorpayPaymentId
    );

    return sendSuccess(res, result, result.message || 'Payment verified');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const getMessageAnalytics = async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId)
      return errorResponse(res, 'Organization not found', 400);

    const { startDate, endDate, days } = req.query;

    let start: Date | undefined;
    let end: Date | undefined;

    if (days && !isNaN(Number(days))) {
      const n = Math.min(Number(days), 365);
      end = new Date();
      start = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    } else {
      if (typeof startDate === 'string' && startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) start = d;
      }
      if (typeof endDate === 'string' && endDate) {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) end = endOfDay(d); // ✅ inclusive
      }
    }

    const data = await walletService.getWalletMessageAnalytics(
      organizationId, { startDate: start, endDate: end }
    );

    return sendSuccess(res, data, 'Analytics retrieved');
  } catch (err: any) {
    console.error('Analytics error:', err);
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

// ─── Admin Controllers ────────────────────────────────────────

export const adminGetRequests = async (req: Request, res: Response) => {
  try {
    const { status, page, limit } = req.query;
    const result = await walletService.getAccessRequests({
      status: typeof status === 'string' && status ? status : undefined,
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(100, Number(limit) || 20),
    });
    return sendSuccess(res, result, 'Requests retrieved');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const adminReviewRequest = async (req: Request, res: Response) => {
  try {
    // ✅ FIX Bug3: Admin ID properly extracted
    const adminId = (req as any).admin?.id || (req as any).user?.id;
    const requestId = req.params.requestId as string;
    const { action, note } = req.body;

    if (!adminId) {
      return errorResponse(res, 'Admin authentication required', 401);
    }

    if (!requestId) {
      return errorResponse(res, 'Request ID required', 400);
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return errorResponse(
        res, "Action must be 'approve' or 'reject'", 400
      );
    }

    const result = await walletService.reviewWalletRequest(
      requestId, adminId, action, note
    );

    return sendSuccess(res, result, result.message);
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const adminGetAllWallets = async (req: Request, res: Response) => {
  try {
    const { page, limit, flagged, isActive } = req.query;
    const result = await walletService.getAllWallets({
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(100, Number(limit) || 20),
      flagged: flagged === 'true' ? true : flagged === 'false' ? false : undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    return sendSuccess(res, result, 'Wallets retrieved');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const adminAdjustBalance = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin?.id || (req as any).user?.id;
    const organizationId = req.params.organizationId as string;
    const { type, amount, note } = req.body;

    if (!adminId) {
      return errorResponse(res, 'Admin authentication required', 401);
    }

    if (!organizationId) {
      return errorResponse(res, 'Organization ID required', 400);
    }

    if (!type || !['admin_credit', 'admin_debit'].includes(type)) {
      return errorResponse(
        res, "Type must be 'admin_credit' or 'admin_debit'", 400
      );
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return errorResponse(res, 'Valid amount required', 400);
    }

    if (!note || typeof note !== 'string' || note.trim().length < 5) {
      return errorResponse(res, 'Reason required (min 5 characters)', 400);
    }

    const result = await walletService.adminAdjustBalance(
      organizationId, adminId,
      { type, amountRupees: parsedAmount, note: note.trim() }
    );

    return sendSuccess(res, result, 'Balance adjusted successfully');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const adminSetCredit = async (req: Request, res: Response) => {
  try {
    const organizationId = req.params.organizationId as string;
    const { creditLimit, enable } = req.body;

    if (!organizationId) {
      return errorResponse(res, 'Organization ID required', 400);
    }

    const parsedLimit = Number(creditLimit);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      return errorResponse(res, 'Valid credit limit required', 400);
    }

    if (typeof enable !== 'boolean') {
      return errorResponse(
        res, "'enable' must be a boolean", 400
      );
    }

    const result = await walletService.setCreditLimit(
      organizationId, parsedLimit, enable
    );

    return sendSuccess(res, result, 'Credit limit updated');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const adminFlagWallet = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin?.id || (req as any).user?.id;
    const organizationId = req.params.organizationId as string;
    const { reason, unflag } = req.body;

    if (!adminId) {
      return errorResponse(res, 'Admin authentication required', 401);
    }

    if (!organizationId) {
      return errorResponse(res, 'Organization ID required', 400);
    }

    if (!unflag && (!reason || typeof reason !== 'string' || reason.trim().length < 5)) {
      return errorResponse(res, 'Flag reason required (min 5 chars)', 400);
    }

    const result = await walletService.flagWallet(
      organizationId, adminId, reason, unflag
    );

    return sendSuccess(res, result, result.message);
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const adminToggleWallet = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin?.id || (req as any).user?.id;
    const organizationId = req.params.organizationId as string;
    const { activate, reason } = req.body;

    if (!adminId) {
      return errorResponse(res, 'Admin authentication required', 401);
    }

    if (!organizationId) {
      return errorResponse(res, 'Organization ID required', 400);
    }

    if (typeof activate !== 'boolean') {
      return errorResponse(
        res, "'activate' must be a boolean", 400
      );
    }

    const result = await walletService.setWalletActive(
      organizationId, adminId, activate, reason
    );

    return sendSuccess(res, result, result.message);
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};