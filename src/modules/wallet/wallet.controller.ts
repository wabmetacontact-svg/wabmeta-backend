import { Request, Response } from 'express';
import * as walletService from './wallet.service';
import { sendSuccess, errorResponse } from '../../utils/response';

// ─── User Controllers ──────────────────────────────────────────────────────────
export const getWallet = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return errorResponse(res, 'Organization not found', 400);

    const data = await walletService.getWalletDetails(organizationId);
    return sendSuccess(res, data, 'Wallet retrieved successfully');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const requestAccess = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!organizationId || !userId) {
      return errorResponse(res, 'Authentication required', 401);
    }

    const { reason, additionalInfo } = req.body;
    if (!reason || reason.trim().length < 20) {
      return errorResponse(
        res,
        'Please provide a detailed reason (minimum 20 characters)',
        400
      );
    }

    const result = await walletService.requestWalletAccess(
      organizationId,
      userId,
      { reason: reason.trim(), additionalInfo }
    );

    return sendSuccess(res, result, result.message);
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return errorResponse(res, 'Organization not found', 400);

    const { page, limit, type, startDate, endDate } = req.query;

    const result = await walletService.getTransactionHistory(organizationId, {
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100), // Max 100 per page
      type: typeof type === 'string' ? type : undefined,
      startDate: typeof startDate === 'string' ? new Date(startDate) : undefined,
      endDate: typeof endDate === 'string' ? new Date(endDate) : undefined,
    });

    return sendSuccess(res, result, 'Transactions retrieved');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const createTopUp = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return errorResponse(res, 'Organization not found', 400);

    const { amount } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return errorResponse(res, 'Valid amount required', 400);
    }

    const order = await walletService.createTopUpOrder(
      organizationId,
      Number(amount)
    );
    return sendSuccess(res, order, 'Order created successfully');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const verifyTopUp = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return errorResponse(res, 'Organization not found', 400);

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      amount,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return errorResponse(res, 'Payment details incomplete', 400);
    }

    const result = await walletService.processTopUp(organizationId, {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      amount: Number(amount),
    });

    return sendSuccess(res, result, '₹' + amount + ' added to wallet!');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const getMessageAnalytics = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return errorResponse(res, 'Organization not found', 400);

    const data = await walletService.getWalletMessageAnalytics(organizationId);
    return sendSuccess(res, data, 'Analytics retrieved');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};


// ─── Admin Controllers ─────────────────────────────────────────────────────────
export const adminGetRequests = async (req: Request, res: Response) => {
  try {
    const { status, page, limit } = req.query;
    const result = await walletService.getAccessRequests({
      status: typeof status === 'string' ? status : undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    return sendSuccess(res, result, 'Requests retrieved');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const adminReviewRequest = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin?.id;
    const { requestId } = req.params;
    const { action, note } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return errorResponse(res, "Action must be 'approve' or 'reject'", 400);
    }

    const result = await walletService.reviewWalletRequest(
      requestId as string,
      adminId,
      action,
      note
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
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      flagged: flagged === 'true' ? true : flagged === 'false' ? false : undefined,
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    return sendSuccess(res, result, 'Wallets retrieved');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const adminAdjustBalance = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin?.id;
    const { organizationId } = req.params;
    const { type, amount, note } = req.body;

    if (!['admin_credit', 'admin_debit'].includes(type)) {
      return errorResponse(res, "Type must be 'admin_credit' or 'admin_debit'", 400);
    }

    const result = await walletService.adminAdjustBalance(
      organizationId as string,
      adminId,
      { type, amountRupees: Number(amount), note }
    );

    return sendSuccess(res, result, 'Balance adjusted successfully');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const adminSetCredit = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { creditLimit, enable } = req.body;

    const result = await walletService.setCreditLimit(
      organizationId as string,
      Number(creditLimit),
      Boolean(enable)
    );

    return sendSuccess(res, result, 'Credit limit updated');
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};

export const adminFlagWallet = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin?.id;
    const { organizationId } = req.params;
    const { reason, unflag } = req.body;

    if (!unflag && (!reason || reason.trim().length < 5)) {
      return errorResponse(res, 'Flag reason required (min 5 chars)', 400);
    }

    const result = await walletService.flagWallet(
      organizationId as string,
      adminId,
      reason,
      unflag
    );

    return sendSuccess(res, result, result.message);
  } catch (err: any) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
};
