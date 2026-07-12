// src/modules/wallet/wallet.webhook.ts - BULLETPROOF

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../config/database';

const db = prisma as any;

const router = Router();

function verifyRazorpayWebhook(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
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

router.post('/razorpay', async (req: Request, res: Response) => {
  // ✅ Respond immediately (Razorpay expects 200 fast)
  res.status(200).json({ status: 'ok' });

  const rawBody = (req as any).rawBody;
  const signature = req.headers['x-razorpay-signature'] as string;

  if (!rawBody || !signature) {
    console.warn('⚠️ Razorpay webhook: missing body or signature');
    return;
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const walletWebhookSecret = process.env.WALLET_RAZORPAY_WEBHOOK_SECRET;

  let isValid = false;

  if (walletWebhookSecret) {
    isValid = verifyRazorpayWebhook(rawBody, signature, walletWebhookSecret);
  }
  if (!isValid && webhookSecret) {
    isValid = verifyRazorpayWebhook(rawBody, signature, webhookSecret);
  }

  if (!isValid) {
    console.error('🚨 Razorpay webhook: Invalid signature!');
    return;
  }

  const event = req.body;
  const eventType = event?.event;

  console.log('📥 Razorpay webhook:', eventType);

  try {
    switch (eventType) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;

      case 'order.paid':
        await handleOrderPaid(event.payload.order.entity, event.payload.payment?.entity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;

      default:
        console.log(`ℹ️ Unhandled event: ${eventType}`);
    }
  } catch (err: any) {
    console.error('❌ Razorpay webhook processing error:', err.message, err.stack);
  }
});

// ─── Payment Captured ─────────────────────────────────────────────────────────
async function handlePaymentCaptured(payment: any) {
  console.log('💳 Payment captured:', {
    paymentId: payment.id,
    orderId: payment.order_id,
    amount: payment.amount,
  });

  const notes = payment.notes || {};
  const purpose = notes.purpose;

  if (purpose !== 'wallet_topup') {
    console.log('ℹ️ Non-wallet payment, skipping:', purpose || 'unknown');
    return;
  }

  const organizationId = notes.organizationId;
  if (!organizationId) {
    console.error('❌ No organizationId in payment notes:', payment.id);
    return;
  }

  // Import service function
  const { creditWalletFromWebhook } = await import('./wallet.service');
  
  try {
    await creditWalletFromWebhook({
      organizationId,
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      amountPaise: Number(payment.amount),
    });
  } catch (err: any) {
    console.error('❌ Failed to credit wallet from webhook:', err.message);
    // ✅ Mark order as failed but keep it for reconciliation
    await db.walletTopUpOrder.updateMany({
      where: { razorpayOrderId: payment.order_id },
      data: {
        razorpayPaymentId: payment.id,
        failureReason: `Webhook credit failed: ${err.message}`,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
  }
}

// ─── Order Paid (fallback) ────────────────────────────────────────────────────
async function handleOrderPaid(order: any, payment?: any) {
  const notes = order.notes || {};
  if (notes.purpose !== 'wallet_topup') return;

  console.log('📦 Order paid event:', order.id);

  // If payment entity is provided, use it as fallback
  if (payment) {
    await handlePaymentCaptured(payment);
  }
}

// ─── Payment Failed ───────────────────────────────────────────────────────────
async function handlePaymentFailed(payment: any) {
  console.log('❌ Payment failed:', payment.id);

  const notes = payment.notes || {};
  if (notes.purpose !== 'wallet_topup') return;

  await db.walletTopUpOrder.updateMany({
    where: { razorpayOrderId: payment.order_id },
    data: {
      razorpayPaymentId: payment.id,
      status: 'FAILED',
      failureReason: payment.error_description || 'Payment failed on Razorpay',
      lastAttemptAt: new Date(),
    },
  });
}

export default router;
