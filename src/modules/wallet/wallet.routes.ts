import { Router } from 'express';
import * as walletController from './wallet.controller';
import { authenticate } from '../../middleware/auth';       // existing middleware
import { authenticateAdmin as adminAuth } from '../admin/admin.middleware';       // existing middleware

const router = Router();

// ─── User Routes ──────────────────────────────────────────────────────────────
router.get('/wallet', authenticate, walletController.getWallet);
router.post('/wallet/request-access', authenticate, walletController.requestAccess);
router.get('/wallet/transactions', authenticate, walletController.getTransactions);
router.post('/wallet/topup/create-order', authenticate, walletController.createTopUp);
router.post('/wallet/topup/verify', authenticate, walletController.verifyTopUp);

// ─── Admin Routes ──────────────────────────────────────────────────────────────
router.get('/admin/wallets', adminAuth, walletController.adminGetAllWallets);
router.get('/admin/wallets/requests', adminAuth, walletController.adminGetRequests);
router.patch('/admin/wallets/requests/:requestId/review', adminAuth, walletController.adminReviewRequest);
router.patch('/admin/wallets/:organizationId/adjust', adminAuth, walletController.adminAdjustBalance);
router.patch('/admin/wallets/:organizationId/credit', adminAuth, walletController.adminSetCredit);
router.patch('/admin/wallets/:organizationId/flag', adminAuth, walletController.adminFlagWallet);

export default router;
