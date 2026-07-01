"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_controller_1 = require("./whatsapp.controller");
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const connectionLock_1 = require("../../middleware/connectionLock");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// ============================================
// ACCOUNTS APIs
// ============================================
router.get('/accounts', whatsapp_controller_1.whatsappController.getAccounts.bind(whatsapp_controller_1.whatsappController));
router.get('/accounts/:accountId', whatsapp_controller_1.whatsappController.getAccount.bind(whatsapp_controller_1.whatsappController));
router.post('/accounts/:accountId/default', whatsapp_controller_1.whatsappController.setDefaultAccount.bind(whatsapp_controller_1.whatsappController));
router.delete('/accounts/:accountId', connectionLock_1.checkConnectionLock, whatsapp_controller_1.whatsappController.disconnectAccount.bind(whatsapp_controller_1.whatsappController));
// ✅ NEW: Quality Rating Sync Routes
const syncRateLimit = (0, rateLimit_1.rateLimit)({
    windowMs: 60 * 1000,
    max: 10, // 10 sync requests per minute
    message: 'Too many sync requests. Please wait a moment.',
});
router.post('/accounts/sync-all', syncRateLimit, whatsapp_controller_1.whatsappController.syncAllAccountsQuality.bind(whatsapp_controller_1.whatsappController));
router.post('/accounts/:accountId/sync-quality', syncRateLimit, whatsapp_controller_1.whatsappController.syncAccountQuality.bind(whatsapp_controller_1.whatsappController));
// ============================================
// MESSAGING APIs
// ============================================
const sendRateLimit = (0, rateLimit_1.rateLimit)({
    windowMs: 60 * 1000,
    max: 60,
    message: 'Too many messages sent. Please wait a moment.',
});
router.post('/send/text', sendRateLimit, whatsapp_controller_1.whatsappController.sendText.bind(whatsapp_controller_1.whatsappController));
router.post('/send/template', auth_1.authenticate, whatsapp_controller_1.whatsappController.sendTemplate);
router.post('/send/media', sendRateLimit, whatsapp_controller_1.whatsappController.sendMedia.bind(whatsapp_controller_1.whatsappController));
router.post('/read', whatsapp_controller_1.whatsappController.markAsRead.bind(whatsapp_controller_1.whatsappController));
exports.default = router;
//# sourceMappingURL=whatsapp.routes.js.map