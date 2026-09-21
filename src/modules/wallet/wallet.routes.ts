import { Router } from 'express';
import * as walletController from './wallet.controller';
import { authenticate } from '../../middleware/auth';       // existing middleware
import { authenticateAdmin as adminAuth } from '../admin/admin.middleware';       // existing middleware
import { featureLock } from '../../middleware/featureLock';
import { requirePermission as can } from '../admin/admin.permissions';

const router = Router();

// Wallet ko admin Feature Access Control se band kiya ja sakta hai.
// Sirf user routes par - admin wallet management isse alag hai.
const userAuth = [authenticate, featureLock('wallet')];

// ─── User Routes ──────────────────────────────────────────────────────────────
router.get('/wallet', ...userAuth, walletController.getWallet);
router.post('/wallet/request-access', ...userAuth, walletController.requestAccess);
router.get('/wallet/analytics', ...userAuth, walletController.getMessageAnalytics);
router.get('/wallet/rates', ...userAuth, walletController.getRates);
router.get('/wallet/transactions', ...userAuth, walletController.getTransactions);
router.post('/wallet/topup/create-order', ...userAuth, walletController.createTopUp);
router.post('/wallet/topup/verify', ...userAuth, walletController.verifyTopUp);

// ✅ NEW: Get pending/failed topups (user can see stuck payments)
router.get('/wallet/pending-topups', ...userAuth, walletController.getPendingTopUps);

// ✅ NEW: Retry failed topup verification
router.post('/wallet/topup/retry', ...userAuth, walletController.retryTopUp);

// ─── Admin Routes ──────────────────────────────────────────────────────────────
// These are served at /api/admin/wallets/..., the same paths admin.routes.ts
// declares. The admin router is mounted first, so for every path it also has
// it wins and these never run; /toggle exists only here. Each still checks
// the admin's permission, so reaching one by any route cannot skip RBAC.
router.get('/admin/wallets', adminAuth, can('wallet.read'), walletController.adminGetAllWallets);
router.get('/admin/wallets/requests', adminAuth, can('wallet.read'), walletController.adminGetRequests);
router.patch('/admin/wallets/requests/:requestId/review', adminAuth, can('wallet.review'), walletController.adminReviewRequest);
router.patch('/admin/wallets/:organizationId/adjust', adminAuth, can('wallet.money'), walletController.adminAdjustBalance);
router.patch('/admin/wallets/:organizationId/credit', adminAuth, can('wallet.money'), walletController.adminSetCredit);
router.patch('/admin/wallets/:organizationId/flag', adminAuth, can('wallet.review'), walletController.adminFlagWallet);
router.patch('/admin/wallets/:organizationId/toggle', adminAuth, can('wallet.review'), walletController.adminToggleWallet);

export default router;
