import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';
import { authenticate } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import { checkConnectionLock } from '../../middleware/connectionLock';

const router = Router();

router.use(authenticate);

// ============================================
// ACCOUNTS APIs
// ============================================

router.get(
  '/accounts',
  whatsappController.getAccounts.bind(whatsappController)
);

router.get(
  '/accounts/:accountId',
  whatsappController.getAccount.bind(whatsappController)
);

router.post(
  '/accounts/:accountId/default',
  whatsappController.setDefaultAccount.bind(whatsappController)
);

router.delete(
  '/accounts/:accountId',
  checkConnectionLock,
  whatsappController.disconnectAccount.bind(whatsappController)
);

// ✅ NEW: Quality Rating Sync Routes
const syncRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 sync requests per minute
  message: 'Too many sync requests. Please wait a moment.',
});

router.post(
  '/accounts/sync-all',
  syncRateLimit,
  whatsappController.syncAllAccountsQuality.bind(whatsappController)
);

router.post(
  '/accounts/:accountId/sync-quality',
  syncRateLimit,
  whatsappController.syncAccountQuality.bind(whatsappController)
);

// ============================================
// MESSAGING APIs
// ============================================

const sendRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many messages sent. Please wait a moment.',
});

router.post(
  '/send/text',
  sendRateLimit,
  whatsappController.sendText.bind(whatsappController)
);

router.post(
  '/send/template',
  authenticate,
  whatsappController.sendTemplate
);

router.post(
  '/send/media',
  sendRateLimit,
  whatsappController.sendMedia.bind(whatsappController)
);

router.post(
  '/read',
  whatsappController.markAsRead.bind(whatsappController)
);

export default router;