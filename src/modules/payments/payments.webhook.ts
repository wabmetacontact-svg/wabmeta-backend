// src/modules/payments/payments.webhook.ts - mounted at /api/webhooks
//
// Har client ka apna webhook URL: /api/webhooks/razorpay/client/<organizationId>
// Client apne Razorpay dashboard me ye URL aur ek secret daalta hai; wahi secret
// hum encrypted rakhte hain aur signature isse verify hoti hai.
//
// Ye WabMeta ke apne Razorpay webhook (/api/webhooks/razorpay - wallet top-up)
// se bilkul alag hai. Dono ke secrets alag, dono ka kaam alag.

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../config/database';
import { safeDecrypt } from '../../utils/encryption';
import { paymentsService } from './payments.service';

const router = Router();

function verify(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

router.post('/razorpay/client/:organizationId', async (req: Request, res: Response) => {
  // Razorpay jaldi 200 chahta hai - kaam uske baad
  res.status(200).json({ status: 'ok' });

  const organizationId = String(req.params.organizationId || '');
  const rawBody = (req as any).rawBody as Buffer | undefined;
  const signature = req.headers['x-razorpay-signature'] as string;

  if (!organizationId || !rawBody || !signature) {
    console.warn('⚠️ Client Razorpay webhook: missing org, body or signature');
    return;
  }

  try {
    const gateway = await prisma.paymentGateway.findUnique({
      where: { organizationId },
      select: { webhookSecret: true, isActive: true },
    });

    if (!gateway?.isActive || !gateway.webhookSecret) {
      console.warn(`⚠️ Client Razorpay webhook: no webhook secret for org ${organizationId}`);
      return;
    }

    const secret = safeDecrypt(gateway.webhookSecret);
    if (!secret || !verify(rawBody, signature, secret)) {
      console.error(`🚨 Client Razorpay webhook: invalid signature (org ${organizationId})`);
      return;
    }

    const event = String(req.body?.event || '');
    if (!event.startsWith('payment_link.')) {
      console.log(`ℹ️ Client Razorpay webhook: ignoring ${event || 'unknown event'}`);
      return;
    }

    const linkEntity = req.body?.payload?.payment_link?.entity;
    const paymentEntity = req.body?.payload?.payment?.entity;

    console.log(`📥 Client Razorpay webhook: ${event} (org ${organizationId})`);
    await paymentsService.applyWebhookEvent(organizationId, event, linkEntity, paymentEntity);
  } catch (err: any) {
    console.error('❌ Client Razorpay webhook error:', err?.message);
  }
});

export default router;
