import { Router } from 'express';
import multer from 'multer';
import {
  getBots,
  connectBot,
  disconnectBot,
  sendMessage,
  sendMediaMessage,
  webhook,
  getMedia,
  getAnalytics,
  getBroadcasts,
  getBroadcastAudience,
  createBroadcast,
  getAutomations,
  createAutomation,
  updateAutomation,
  toggleAutomation,
  deleteAutomation,
  getCommands,
  setCommands,
  getWebhookHealth,
} from './telegram.controller';
import { authenticate } from '../../middleware/auth';
import { checkConnectionLock } from '../../middleware/connectionLock';
import { gateMutations, requireAdmin, OPERATOR_ROLES } from '../../middleware/requireRole';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Media is forwarded straight to Telegram, so keep it in memory (no disk write).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ── Public webhook (verified by the secret_token header, not JWT) ──────────
// Telegram calls this; it must sit before `authenticate`.
router.post('/webhook/:botUserId', asyncHandler(webhook));

// ── Everything else is tenant data behind the JWT ──────────────────────────
router.use(authenticate);
// Writes need at least an operator; connect/disconnect additionally need admin.
router.use(gateMutations(...OPERATOR_ROLES));

// GET  /api/telegram/bots
router.get('/bots', asyncHandler(getBots));

// GET  /api/telegram/analytics
router.get('/analytics', asyncHandler(getAnalytics));

// Broadcasts (to bot subscribers)
router.get('/broadcasts', asyncHandler(getBroadcasts));
router.get('/broadcasts/audience', asyncHandler(getBroadcastAudience));
router.post('/broadcasts', asyncHandler(createBroadcast));

// POST /api/telegram/connect        { token }
router.post('/connect', requireAdmin, checkConnectionLock, asyncHandler(connectBot));

// DELETE /api/telegram/bots/:id
router.delete('/bots/:id', requireAdmin, asyncHandler(disconnectBot));

// Live webhook health straight from Telegram's getWebhookInfo.
router.get('/bots/:id/webhook', asyncHandler(getWebhookHealth));

// Bot command menu (the "/" list users see in Telegram)
router.get('/bots/:id/commands', asyncHandler(getCommands));
router.put('/bots/:id/commands', asyncHandler(setCommands));

// GET  /api/telegram/media/:messageId   (authenticated via ?token= for <img> use)
router.get('/media/:messageId', asyncHandler(getMedia));

// POST /api/telegram/send           { conversationId, text }
router.post('/send', asyncHandler(sendMessage));

// POST /api/telegram/send-media     multipart: file + conversationId + caption?
router.post('/send-media', upload.single('file'), asyncHandler(sendMediaMessage));

// Auto-reply automations
router.get('/automations', asyncHandler(getAutomations));
router.post('/automations', asyncHandler(createAutomation));
router.patch('/automations/:id', asyncHandler(updateAutomation));
router.patch('/automations/:id/toggle', asyncHandler(toggleAutomation));
router.delete('/automations/:id', asyncHandler(deleteAutomation));

export default router;
