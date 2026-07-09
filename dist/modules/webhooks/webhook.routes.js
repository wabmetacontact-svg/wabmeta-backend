"use strict";
// src/modules/webhooks/webhook.routes.ts - FINAL FIXED VERSION
// ✅ FIX 1: Signature verification yahan (app.ts se move kiya)
// ✅ FIX 2: Single handler only - no duplicate processing
// ✅ FIX 3: Instagram webhook support added
// ✅ FIX 4: setImmediate for non-blocking background processing
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const webhook_service_1 = require("./webhook.service");
const config_1 = require("../../config");
const router = (0, express_1.Router)();
// ============================================
// META SIGNATURE VERIFICATION
// ✅ Fake/spoofed webhook requests reject karo
// ============================================
function verifyMetaSignature(req) {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
        if (process.env.NODE_ENV === 'production') {
            console.error('🚨 META_APP_SECRET not set in production!');
            return false;
        }
        console.warn('⚠️ META_APP_SECRET missing - dev mode, skipping check');
        return true;
    }
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
        console.warn('⚠️ No x-hub-signature-256 header received');
        return false;
    }
    const rawBody = req.rawBody;
    if (!rawBody) {
        console.warn('⚠️ rawBody unavailable for signature verification');
        return false;
    }
    const expected = 'sha256=' +
        crypto_1.default
            .createHmac('sha256', appSecret)
            .update(rawBody)
            .digest('hex');
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    }
    catch {
        return false;
    }
}
// ============================================
// GET /api/webhooks/meta - Verification
// ============================================
router.get('/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const VERIFY_TOKEN = config_1.config.meta?.webhookVerifyToken ||
        process.env.META_VERIFY_TOKEN ||
        process.env.WEBHOOK_VERIFY_TOKEN ||
        'wabmeta_webhook_verify_2024';
    console.log('📞 Webhook verification:', {
        mode,
        tokenMatch: token === VERIFY_TOKEN,
    });
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified');
        return res.status(200).send(challenge);
    }
    console.error('❌ Webhook verification failed');
    return res.status(403).send('Forbidden');
});
// ============================================
// POST /api/webhooks/meta - Receive Events
// ✅ Flow:
//   1. Signature verify karo
//   2. Meta ko turant respond karo (< 5 sec required)
//   3. Background mein process karo
// ============================================
router.post('/meta', (req, res) => {
    // Step 1: Signature check
    if (!verifyMetaSignature(req)) {
        console.error('🚨 Invalid webhook signature - rejected!');
        return res.status(403).send('Forbidden');
    }
    // Step 2: Immediate response to Meta
    res.status(200).send('EVENT_RECEIVED');
    // Step 3: Background processing
    setImmediate(async () => {
        try {
            const result = await webhook_service_1.webhookService.handleWebhook(req.body);
            webhook_service_1.webhookService
                .logWebhook(req.body, result.status, result.error || result.reason)
                .catch((e) => console.error('Webhook log error:', e));
        }
        catch (error) {
            console.error('❌ Webhook processing error:', error.message);
            webhook_service_1.webhookService
                .logWebhook(req.body, 'failed', error.message)
                .catch((e) => console.error('Webhook log error:', e));
        }
    });
});
// ============================================
// GET /api/webhooks/instagram - Verification
// ============================================
router.get('/instagram', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const VERIFY_TOKEN = config_1.config.meta?.webhookVerifyToken ||
        process.env.META_VERIFY_TOKEN ||
        'wabmeta_webhook_verify_2024';
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Instagram webhook verified');
        return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
});
// ============================================
// POST /api/webhooks/instagram - Receive Events
// ============================================
router.post('/instagram', (req, res) => {
    if (!verifyMetaSignature(req)) {
        console.error('🚨 Invalid Instagram webhook signature!');
        return res.status(403).send('Forbidden');
    }
    res.status(200).send('EVENT_RECEIVED');
    setImmediate(async () => {
        try {
            await webhook_service_1.webhookService.handleWebhook(req.body);
        }
        catch (error) {
            console.error('❌ Instagram webhook error:', error.message);
        }
    });
});
// ============================================
// LEGACY & TEST ROUTES
// ============================================
router.get('/verify', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const result = webhook_service_1.webhookService.verifyWebhook(mode, token, challenge);
    if (result)
        return res.status(200).send(result);
    return res.status(403).send('Forbidden');
});
router.get('/test', (_req, res) => {
    res.json({
        success: true,
        message: 'Webhook routes working',
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map