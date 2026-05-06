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
const express_1 = require("express");
const walletController = __importStar(require("./wallet.controller"));
const auth_1 = require("../../middleware/auth"); // existing middleware
const admin_middleware_1 = require("../admin/admin.middleware"); // existing middleware
const router = (0, express_1.Router)();
// ─── User Routes ──────────────────────────────────────────────────────────────
router.get('/wallet', auth_1.authenticate, walletController.getWallet);
router.post('/wallet/request-access', auth_1.authenticate, walletController.requestAccess);
router.get('/wallet/analytics', auth_1.authenticate, walletController.getMessageAnalytics);
router.get('/wallet/transactions', auth_1.authenticate, walletController.getTransactions);
router.post('/wallet/topup/create-order', auth_1.authenticate, walletController.createTopUp);
router.post('/wallet/topup/verify', auth_1.authenticate, walletController.verifyTopUp);
// ─── Admin Routes ──────────────────────────────────────────────────────────────
router.get('/admin/wallets', admin_middleware_1.authenticateAdmin, walletController.adminGetAllWallets);
router.get('/admin/wallets/requests', admin_middleware_1.authenticateAdmin, walletController.adminGetRequests);
router.patch('/admin/wallets/requests/:requestId/review', admin_middleware_1.authenticateAdmin, walletController.adminReviewRequest);
router.patch('/admin/wallets/:organizationId/adjust', admin_middleware_1.authenticateAdmin, walletController.adminAdjustBalance);
router.patch('/admin/wallets/:organizationId/credit', admin_middleware_1.authenticateAdmin, walletController.adminSetCredit);
router.patch('/admin/wallets/:organizationId/flag', admin_middleware_1.authenticateAdmin, walletController.adminFlagWallet);
router.patch('/admin/wallets/:organizationId/toggle', admin_middleware_1.authenticateAdmin, walletController.adminToggleWallet);
exports.default = router;
//# sourceMappingURL=wallet.routes.js.map