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
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminToggleWallet = exports.adminFlagWallet = exports.adminSetCredit = exports.adminAdjustBalance = exports.adminGetAllWallets = exports.adminReviewRequest = exports.adminGetRequests = exports.getMessageAnalytics = exports.retryTopUp = exports.getPendingTopUps = exports.verifyTopUp = exports.createTopUp = exports.getTransactions = exports.requestAccess = exports.getWallet = void 0;
const walletService = __importStar(require("./wallet.service"));
const response_1 = require("../../utils/response");
// ─── Helpers ──────────────────────────────────────────────────
const getOrgId = (req) => req.user?.organizationId || null;
const getUserId = (req) => req.user?.id || null;
// ✅ End of day helper (inclusive date range)
const endOfDay = (date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};
// ─── User Controllers ─────────────────────────────────────────
const getWallet = async (req, res) => {
    try {
        const organizationId = getOrgId(req);
        if (!organizationId)
            return (0, response_1.errorResponse)(res, 'Organization not found', 400);
        const data = await walletService.getWalletDetails(organizationId);
        return (0, response_1.sendSuccess)(res, data, 'Wallet retrieved successfully');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.getWallet = getWallet;
const requestAccess = async (req, res) => {
    try {
        const organizationId = getOrgId(req);
        const userId = getUserId(req);
        if (!organizationId || !userId)
            return (0, response_1.errorResponse)(res, 'Authentication required', 401);
        const { reason, additionalInfo } = req.body;
        if (!reason || typeof reason !== 'string' || reason.trim().length < 20) {
            return (0, response_1.errorResponse)(res, 'Please provide a detailed reason (minimum 20 characters)', 400);
        }
        const result = await walletService.requestWalletAccess(organizationId, userId, { reason: reason.trim(), additionalInfo });
        return (0, response_1.sendSuccess)(res, result, result.message);
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.requestAccess = requestAccess;
const getTransactions = async (req, res) => {
    try {
        const organizationId = getOrgId(req);
        if (!organizationId)
            return (0, response_1.errorResponse)(res, 'Organization not found', 400);
        const { page, limit, type, startDate, endDate } = req.query;
        // ✅ FIX Bug1: Parse dates properly with end-of-day for endDate
        let parsedStart;
        let parsedEnd;
        if (typeof startDate === 'string' && startDate) {
            const d = new Date(startDate);
            if (!isNaN(d.getTime()))
                parsedStart = d;
        }
        if (typeof endDate === 'string' && endDate) {
            const d = new Date(endDate);
            if (!isNaN(d.getTime()))
                parsedEnd = endOfDay(d); // ✅ inclusive
        }
        const result = await walletService.getTransactionHistory(organizationId, {
            page: Math.max(1, Number(page) || 1),
            limit: Math.min(100, Math.max(1, Number(limit) || 20)),
            type: typeof type === 'string' && type ? type : undefined,
            startDate: parsedStart,
            endDate: parsedEnd,
        });
        return (0, response_1.sendSuccess)(res, result, 'Transactions retrieved');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.getTransactions = getTransactions;
const createTopUp = async (req, res) => {
    try {
        const organizationId = getOrgId(req);
        if (!organizationId)
            return (0, response_1.errorResponse)(res, 'Organization not found', 400);
        const rawAmount = req.body.amount;
        // ✅ FIX Bug2: Validate amount in controller
        if (rawAmount === undefined || rawAmount === null || rawAmount === '') {
            return (0, response_1.errorResponse)(res, 'Amount is required', 400);
        }
        const amount = Number(rawAmount);
        if (isNaN(amount) || amount <= 0) {
            return (0, response_1.errorResponse)(res, 'Amount must be a positive number', 400);
        }
        if (amount < 100) {
            return (0, response_1.errorResponse)(res, 'Minimum top-up amount is ₹100', 400);
        }
        if (amount > 100_000) {
            return (0, response_1.errorResponse)(res, 'Maximum top-up is ₹1,00,000 per transaction', 400);
        }
        const order = await walletService.createTopUpOrder(organizationId, amount);
        return (0, response_1.sendSuccess)(res, order, 'Order created successfully');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.createTopUp = createTopUp;
const verifyTopUp = async (req, res) => {
    try {
        const organizationId = getOrgId(req);
        if (!organizationId)
            return (0, response_1.errorResponse)(res, 'Organization not found', 400);
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amount, } = req.body;
        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return (0, response_1.errorResponse)(res, 'Payment details incomplete', 400);
        }
        // ✅ FIX Bug4: amount can be undefined - handle gracefully
        const parsedAmount = amount !== undefined ? Number(amount) : 0;
        const result = await walletService.processTopUp(organizationId, {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            amount: isNaN(parsedAmount) ? 0 : parsedAmount,
        });
        return (0, response_1.sendSuccess)(res, result, `₹${result.amountAdded?.toFixed(2) || '0'} added to wallet!`);
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.verifyTopUp = verifyTopUp;
const getPendingTopUps = async (req, res) => {
    try {
        const organizationId = getOrgId(req);
        if (!organizationId)
            return (0, response_1.errorResponse)(res, 'Organization not found', 400);
        const orders = await walletService.getPendingTopUpOrders(organizationId);
        return (0, response_1.sendSuccess)(res, { orders }, 'Pending orders retrieved');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.getPendingTopUps = getPendingTopUps;
const retryTopUp = async (req, res) => {
    try {
        const organizationId = getOrgId(req);
        if (!organizationId)
            return (0, response_1.errorResponse)(res, 'Organization not found', 400);
        const { razorpayOrderId, razorpayPaymentId } = req.body;
        if (!razorpayOrderId || typeof razorpayOrderId !== 'string') {
            return (0, response_1.errorResponse)(res, 'Order ID required', 400);
        }
        const result = await walletService.retryTopUpVerification(organizationId, razorpayOrderId, razorpayPaymentId);
        return (0, response_1.sendSuccess)(res, result, result.message || 'Payment verified');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.retryTopUp = retryTopUp;
const getMessageAnalytics = async (req, res) => {
    try {
        const organizationId = getOrgId(req);
        if (!organizationId)
            return (0, response_1.errorResponse)(res, 'Organization not found', 400);
        const { startDate, endDate, days } = req.query;
        let start;
        let end;
        if (days && !isNaN(Number(days))) {
            const n = Math.min(Number(days), 365);
            end = new Date();
            start = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
        }
        else {
            if (typeof startDate === 'string' && startDate) {
                const d = new Date(startDate);
                if (!isNaN(d.getTime()))
                    start = d;
            }
            if (typeof endDate === 'string' && endDate) {
                const d = new Date(endDate);
                if (!isNaN(d.getTime()))
                    end = endOfDay(d); // ✅ inclusive
            }
        }
        const data = await walletService.getWalletMessageAnalytics(organizationId, { startDate: start, endDate: end });
        return (0, response_1.sendSuccess)(res, data, 'Analytics retrieved');
    }
    catch (err) {
        console.error('Analytics error:', err);
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.getMessageAnalytics = getMessageAnalytics;
// ─── Admin Controllers ────────────────────────────────────────
const adminGetRequests = async (req, res) => {
    try {
        const { status, page, limit } = req.query;
        const result = await walletService.getAccessRequests({
            status: typeof status === 'string' && status ? status : undefined,
            page: Math.max(1, Number(page) || 1),
            limit: Math.min(100, Number(limit) || 20),
        });
        return (0, response_1.sendSuccess)(res, result, 'Requests retrieved');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.adminGetRequests = adminGetRequests;
const adminReviewRequest = async (req, res) => {
    try {
        // ✅ FIX Bug3: Admin ID properly extracted
        const adminId = req.admin?.id || req.user?.id;
        const requestId = req.params.requestId;
        const { action, note } = req.body;
        if (!adminId) {
            return (0, response_1.errorResponse)(res, 'Admin authentication required', 401);
        }
        if (!requestId) {
            return (0, response_1.errorResponse)(res, 'Request ID required', 400);
        }
        if (!action || !['approve', 'reject'].includes(action)) {
            return (0, response_1.errorResponse)(res, "Action must be 'approve' or 'reject'", 400);
        }
        const result = await walletService.reviewWalletRequest(requestId, adminId, action, note);
        return (0, response_1.sendSuccess)(res, result, result.message);
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.adminReviewRequest = adminReviewRequest;
const adminGetAllWallets = async (req, res) => {
    try {
        const { page, limit, flagged, isActive } = req.query;
        const result = await walletService.getAllWallets({
            page: Math.max(1, Number(page) || 1),
            limit: Math.min(100, Number(limit) || 20),
            flagged: flagged === 'true' ? true : flagged === 'false' ? false : undefined,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        });
        return (0, response_1.sendSuccess)(res, result, 'Wallets retrieved');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.adminGetAllWallets = adminGetAllWallets;
const adminAdjustBalance = async (req, res) => {
    try {
        const adminId = req.admin?.id || req.user?.id;
        const organizationId = req.params.organizationId;
        const { type, amount, note } = req.body;
        if (!adminId) {
            return (0, response_1.errorResponse)(res, 'Admin authentication required', 401);
        }
        if (!organizationId) {
            return (0, response_1.errorResponse)(res, 'Organization ID required', 400);
        }
        if (!type || !['admin_credit', 'admin_debit'].includes(type)) {
            return (0, response_1.errorResponse)(res, "Type must be 'admin_credit' or 'admin_debit'", 400);
        }
        const parsedAmount = Number(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return (0, response_1.errorResponse)(res, 'Valid amount required', 400);
        }
        if (!note || typeof note !== 'string' || note.trim().length < 5) {
            return (0, response_1.errorResponse)(res, 'Reason required (min 5 characters)', 400);
        }
        const result = await walletService.adminAdjustBalance(organizationId, adminId, { type, amountRupees: parsedAmount, note: note.trim() });
        return (0, response_1.sendSuccess)(res, result, 'Balance adjusted successfully');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.adminAdjustBalance = adminAdjustBalance;
const adminSetCredit = async (req, res) => {
    try {
        const organizationId = req.params.organizationId;
        const { creditLimit, enable } = req.body;
        if (!organizationId) {
            return (0, response_1.errorResponse)(res, 'Organization ID required', 400);
        }
        const parsedLimit = Number(creditLimit);
        if (isNaN(parsedLimit) || parsedLimit < 0) {
            return (0, response_1.errorResponse)(res, 'Valid credit limit required', 400);
        }
        if (typeof enable !== 'boolean') {
            return (0, response_1.errorResponse)(res, "'enable' must be a boolean", 400);
        }
        const result = await walletService.setCreditLimit(organizationId, parsedLimit, enable);
        return (0, response_1.sendSuccess)(res, result, 'Credit limit updated');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.adminSetCredit = adminSetCredit;
const adminFlagWallet = async (req, res) => {
    try {
        const adminId = req.admin?.id || req.user?.id;
        const organizationId = req.params.organizationId;
        const { reason, unflag } = req.body;
        if (!adminId) {
            return (0, response_1.errorResponse)(res, 'Admin authentication required', 401);
        }
        if (!organizationId) {
            return (0, response_1.errorResponse)(res, 'Organization ID required', 400);
        }
        if (!unflag && (!reason || typeof reason !== 'string' || reason.trim().length < 5)) {
            return (0, response_1.errorResponse)(res, 'Flag reason required (min 5 chars)', 400);
        }
        const result = await walletService.flagWallet(organizationId, adminId, reason, unflag);
        return (0, response_1.sendSuccess)(res, result, result.message);
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.adminFlagWallet = adminFlagWallet;
const adminToggleWallet = async (req, res) => {
    try {
        const adminId = req.admin?.id || req.user?.id;
        const organizationId = req.params.organizationId;
        const { activate, reason } = req.body;
        if (!adminId) {
            return (0, response_1.errorResponse)(res, 'Admin authentication required', 401);
        }
        if (!organizationId) {
            return (0, response_1.errorResponse)(res, 'Organization ID required', 400);
        }
        if (typeof activate !== 'boolean') {
            return (0, response_1.errorResponse)(res, "'activate' must be a boolean", 400);
        }
        const result = await walletService.setWalletActive(organizationId, adminId, activate, reason);
        return (0, response_1.sendSuccess)(res, result, result.message);
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.adminToggleWallet = adminToggleWallet;
//# sourceMappingURL=wallet.controller.js.map