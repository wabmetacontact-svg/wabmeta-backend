"use strict";
// src/modules/webhooks/webhook.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhook_service_1 = require("./webhook.service");
const router = (0, express_1.Router)();
console.log('📦 Webhook routes module loaded');
// GET /api/webhooks/meta - Verification
router.get('/meta', (req, res) => {
    console.log('📞 GET /api/webhooks/meta - Verification');
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN ||
        process.env.WEBHOOK_VERIFY_TOKEN ||
        'wabmeta_webhook_verify_2024';
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified');
        return res.status(200).send(challenge);
    }
    console.error('❌ Webhook verification failed');
    return res.status(403).send('Forbidden');
});
// POST /api/webhooks/meta - Receive messages
router.post('/meta', (req, res) => {
    // ✅ CRITICAL: Pehle respond karo, PHIR process karo
    // Meta ko 5 sec mein response chahiye - await use mat karo
    res.status(200).send('EVENT_RECEIVED');
    // ✅ Background processing - fire and forget
    setImmediate(async () => {
        try {
            const result = await webhook_service_1.webhookService.handleWebhook(req.body);
            // Non-blocking log
            webhook_service_1.webhookService.logWebhook(req.body, result.status, result.error || result.reason).catch((e) => console.error('Log error:', e));
            console.log('✅ Webhook processed:', result.status);
        }
        catch (error) {
            console.error('❌ Webhook processing error:', error.message);
            webhook_service_1.webhookService.logWebhook(req.body, 'failed', error.message)
                .catch((e) => console.error('Log error:', e));
        }
    });
});
// Legacy /verify route (backward compatibility)
router.get('/verify', (req, res) => {
    console.log('⚠️ GET /api/webhooks/verify called (legacy route)');
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const result = webhook_service_1.webhookService.verifyWebhook(mode, token, challenge);
    if (result) {
        res.status(200).send(result);
    }
    else {
        res.status(403).send('Forbidden');
    }
});
router.get('/test', (_req, res) => {
    res.json({
        success: true,
        message: 'Webhook routes working',
        timestamp: new Date().toISOString(),
    });
});
console.log('✅ Webhook routes configured');
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map