// src/modules/webhooks/webhook.routes.ts

import { Router, Request, Response } from 'express';
import { webhookService } from './webhook.service';

const router = Router();

console.log('📦 Webhook routes module loaded');

// GET /api/webhooks/meta - Verification
router.get('/meta', (req: Request, res: Response) => {
  console.log('📞 GET /api/webhooks/meta - Verification');

  const mode      = req.query['hub.mode']         as string;
  const token     = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge']    as string;

  const VERIFY_TOKEN =
    process.env.META_VERIFY_TOKEN ||
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
router.post('/meta', (req: Request, res: Response) => {
  // ✅ CRITICAL: Pehle respond karo, PHIR process karo
  // Meta ko 5 sec mein response chahiye - await use mat karo
  res.status(200).send('EVENT_RECEIVED');

  // ✅ Background processing - fire and forget
  setImmediate(async () => {
    try {
      const result = await webhookService.handleWebhook(req.body);

      // Non-blocking log
      webhookService.logWebhook(
        req.body,
        result.status,
        result.error || result.reason
      ).catch((e: any) => console.error('Log error:', e));

      console.log('✅ Webhook processed:', result.status);
    } catch (error: any) {
      console.error('❌ Webhook processing error:', error.message);

      webhookService.logWebhook(req.body, 'failed', error.message)
        .catch((e: any) => console.error('Log error:', e));
    }
  });
});

// Legacy /verify route (backward compatibility)
router.get('/verify', (req: Request, res: Response) => {
  console.log('⚠️ GET /api/webhooks/verify called (legacy route)');

  const mode      = req.query['hub.mode']         as string;
  const token     = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge']    as string;

  const result = webhookService.verifyWebhook(mode, token, challenge);

  if (result) {
    res.status(200).send(result);
  } else {
    res.status(403).send('Forbidden');
  }
});

router.get('/test', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Webhook routes working',
    timestamp: new Date().toISOString(),
  });
});

console.log('✅ Webhook routes configured');

export default router;