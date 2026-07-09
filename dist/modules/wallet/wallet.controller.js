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
exports.adminToggleWallet = exports.adminFlagWallet = exports.adminSetCredit = exports.adminAdjustBalance = exports.adminGetAllWallets = exports.adminReviewRequest = exports.adminGetRequests = exports.getMessageAnalytics = exports.verifyTopUp = exports.createTopUp = exports.getTransactions = exports.requestAccess = exports.getWallet = void 0;
const walletService = __importStar(require("./wallet.service"));
const response_1 = require("../../utils/response");
// ─── User Controllers ──────────────────────────────────────────────────────────
const getWallet = async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
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
        const organizationId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!organizationId || !userId) {
            return (0, response_1.errorResponse)(res, 'Authentication required', 401);
        }
        const { reason, additionalInfo } = req.body;
        if (!reason || reason.trim().length < 20) {
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
        const organizationId = req.user?.organizationId;
        if (!organizationId)
            return (0, response_1.errorResponse)(res, 'Organization not found', 400);
        const { page, limit, type, startDate, endDate } = req.query;
        const result = await walletService.getTransactionHistory(organizationId, {
            page: Number(page) || 1,
            limit: Math.min(Number(limit) || 20, 100), // Max 100 per page
            type: typeof type === 'string' ? type : undefined,
            startDate: typeof startDate === 'string' ? new Date(startDate) : undefined,
            endDate: typeof endDate === 'string' ? new Date(endDate) : undefined,
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
        const organizationId = req.user?.organizationId;
        if (!organizationId)
            return (0, response_1.errorResponse)(res, 'Organization not found', 400);
        const { amount } = req.body;
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            return (0, response_1.errorResponse)(res, 'Valid amount required', 400);
        }
        const order = await walletService.createTopUpOrder(organizationId, Number(amount));
        return (0, response_1.sendSuccess)(res, order, 'Order created successfully');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.createTopUp = createTopUp;
const verifyTopUp = async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId)
            return (0, response_1.errorResponse)(res, 'Organization not found', 400);
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amount, } = req.body;
        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return (0, response_1.errorResponse)(res, 'Payment details incomplete', 400);
        }
        const result = await walletService.processTopUp(organizationId, {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            amount: Number(amount),
        });
        return (0, response_1.sendSuccess)(res, result, '₹' + amount + ' added to wallet!');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.verifyTopUp = verifyTopUp;
const getMessageAnalytics = async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId)
            return (0, response_1.errorResponse)(res, 'Organization not found', 400);
        // ✅ Date range support
        const { startDate, endDate, days } = req.query;
        let start;
        let end;
        if (days && !isNaN(Number(days))) {
            const n = Math.min(Number(days), 365); // Max 1 year
            end = new Date();
            start = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
        }
        else {
            if (typeof startDate === 'string') {
                const s = new Date(startDate);
                if (!isNaN(s.getTime()))
                    start = s;
            }
            if (typeof endDate === 'string') {
                const e = new Date(endDate);
                if (!isNaN(e.getTime()))
                    end = e;
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
// ─── Admin Controllers ─────────────────────────────────────────────────────────
const adminGetRequests = async (req, res) => {
    try {
        const { status, page, limit } = req.query;
        const result = await walletService.getAccessRequests({
            status: typeof status === 'string' ? status : undefined,
            page: Number(page) || 1,
            limit: Number(limit) || 20,
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
        const adminId = req.admin?.id;
        const { requestId } = req.params;
        const { action, note } = req.body;
        if (!['approve', 'reject'].includes(action)) {
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
            page: Number(page) || 1,
            limit: Number(limit) || 20,
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
        const adminId = req.admin?.id;
        const { organizationId } = req.params;
        const { type, amount, note } = req.body;
        if (!['admin_credit', 'admin_debit'].includes(type)) {
            return (0, response_1.errorResponse)(res, "Type must be 'admin_credit' or 'admin_debit'", 400);
        }
        const result = await walletService.adminAdjustBalance(organizationId, adminId, { type, amountRupees: Number(amount), note });
        return (0, response_1.sendSuccess)(res, result, 'Balance adjusted successfully');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.adminAdjustBalance = adminAdjustBalance;
const adminSetCredit = async (req, res) => {
    try {
        const { organizationId } = req.params;
        const { creditLimit, enable } = req.body;
        const result = await walletService.setCreditLimit(organizationId, Number(creditLimit), Boolean(enable));
        return (0, response_1.sendSuccess)(res, result, 'Credit limit updated');
    }
    catch (err) {
        return (0, response_1.errorResponse)(res, err.message, err.statusCode || 500);
    }
};
exports.adminSetCredit = adminSetCredit;
const adminFlagWallet = async (req, res) => {
    try {
        const adminId = req.admin?.id;
        const { organizationId } = req.params;
        const { reason, unflag } = req.body;
        if (!unflag && (!reason || reason.trim().length < 5)) {
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
        const adminId = req.admin?.id;
        const { organizationId } = req.params;
        const { activate, reason } = req.body;
        if (typeof activate !== 'boolean') {
            return (0, response_1.errorResponse)(res, "'activate' must be a boolean (true to activate, false to deactivate)", 400);
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