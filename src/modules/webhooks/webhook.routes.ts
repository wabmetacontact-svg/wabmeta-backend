// src/modules/webhooks/webhook.routes.ts - FINAL FIXED VERSION
// ✅ FIX 1: Signature verification yahan (app.ts se move kiya)
// ✅ FIX 2: Single handler only - no duplicate processing
// ✅ FIX 3: Instagram webhook support added
// ✅ FIX 4: setImmediate for non-blocking background processing

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { webhookService } from './webhook.service';
import { config } from '../../config';

const router = Router();

// ============================================
// META SIGNATURE VERIFICATION
// ✅ Fake/spoofed webhook requests reject karo
// ============================================
function verifyMetaSignature(req: Request): boolean {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 META_APP_SECRET not set in production!');
      return false;
    }
    console.warn('⚠️ META_APP_SECRET missing - dev mode, skipping check');
    return true;
  }

  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    console.warn('⚠️ No x-hub-signature-256 header received');
    return false;
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    console.warn('⚠️ rawBody unavailable for signature verification');
    return false;
  }

  const expected =
    'sha256=' +
    crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

// ============================================
// GET /api/webhooks/meta - Verification
// ============================================
router.get('/meta', (req: Request, res: Response) => {
  const mode      = req.query['hub.mode']         as string;
  const token     = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge']    as string;

  const VERIFY_TOKEN =
    config.meta?.webhookVerifyToken ||
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
router.post('/meta', (req: Request, res: Response) => {
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
      const result = await webhookService.handleWebhook(req.body);

      webhookService
        .logWebhook(req.body, result.status, result.error || result.reason)
        .catch((e: any) => console.error('Webhook log error:', e));

    } catch (error: any) {
      console.error('❌ Webhook processing error:', error.message);
      webhookService
        .logWebhook(req.body, 'failed', error.message)
        .catch((e: any) => console.error('Webhook log error:', e));
    }
  });
});

// ============================================
// GET /api/webhooks/instagram - Verification
// ============================================
router.get('/instagram', (req: Request, res: Response) => {
  const mode      = req.query['hub.mode']         as string;
  const token     = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge']    as string;

  const VERIFY_TOKEN =
    config.meta?.webhookVerifyToken ||
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
router.post('/instagram', (req: Request, res: Response) => {
  if (!verifyMetaSignature(req)) {
    console.error('🚨 Invalid Instagram webhook signature!');
    return res.status(403).send('Forbidden');
  }

  res.status(200).send('EVENT_RECEIVED');

  setImmediate(async () => {
    try {
      await webhookService.handleWebhook(req.body);
    } catch (error: any) {
      console.error('❌ Instagram webhook error:', error.message);
    }
  });
});

// ============================================
// LEGACY & TEST ROUTES
// ============================================
router.get('/verify', (req: Request, res: Response) => {
  const mode      = req.query['hub.mode']         as string;
  const token     = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge']    as string;

  const result = webhookService.verifyWebhook(mode, token, challenge);
  if (result) return res.status(200).send(result);
  return res.status(403).send('Forbidden');
});

router.get('/test', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Webhook routes working',
    timestamp: new Date().toISOString(),
  });
});

export default router;