import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../config/database';

const router = Router();

// ─── Razorpay Webhook Signature Verify ───────────────────────────────────────
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

// ─── POST /api/webhooks/razorpay ─────────────────────────────────────────────
router.post(
  '/razorpay',
  async (req: Request, res: Response) => {
    // ✅ Step 1: Respond immediately (Razorpay needs 200 fast)
    res.status(200).json({ status: 'ok' });

    const rawBody = (req as any).rawBody;
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!rawBody || !signature) {
      console.warn('⚠️ Razorpay webhook: missing body or signature');
      return;
    }

    // ✅ Step 2: Verify signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const walletWebhookSecret =
      process.env.WALLET_RAZORPAY_WEBHOOK_SECRET;

    // Try wallet secret first, then main secret
    let isValid = false;
    let isWalletPayment = false;

    if (walletWebhookSecret) {
      isValid = verifyRazorpayWebhook(
        rawBody,
        signature,
        walletWebhookSecret
      );
      if (isValid) isWalletPayment = true;
    }

    if (!isValid && webhookSecret) {
      isValid = verifyRazorpayWebhook(
        rawBody,
        signature,
        webhookSecret
      );
    }

    if (!isValid) {
      console.error('🚨 Razorpay webhook: Invalid signature!');
      return;
    }

    const event = req.body;
    const eventType = event?.event;

    console.log('📥 Razorpay webhook event:', eventType);

    try {
      switch (eventType) {
        case 'payment.captured':
          await handlePaymentCaptured(event.payload.payment.entity);
          break;

        case 'order.paid':
          await handleOrderPaid(event.payload.order.entity);
          break;

        default:
          console.log(
            `ℹ️ Razorpay webhook: Unhandled event: ${eventType}`
          );
      }
    } catch (err: any) {
      console.error(
        '❌ Razorpay webhook processing error:',
        err.message
      );
    }
  }
);

// ─── Handle Payment Captured ──────────────────────────────────────────────────
async function handlePaymentCaptured(payment: any) {
  console.log('💳 Payment captured:', {
    paymentId: payment.id,
    orderId: payment.order_id,
    amount: payment.amount,
    notes: payment.notes,
  });

  const notes = payment.notes || {};
  const purpose = notes.purpose;

  // ✅ Sirf wallet topup handle karo
  if (purpose !== 'wallet_topup') {
    // Subscription payment - billing.service handle karta hai
    console.log(
      'ℹ️ Non-wallet payment, skipping:',
      purpose || 'no purpose'
    );
    return;
  }

  const organizationId = notes.organizationId;
  if (!organizationId) {
    console.error(
      '❌ No organizationId in payment notes:',
      payment.id
    );
    return;
  }

  // ✅ Duplicate check - pehle se credited hai?
  const existingTxn = await prisma.walletTransaction.findFirst({
    where: {
      OR: [
        { razorpayPaymentId: payment.id },
        { razorpayOrderId: payment.order_id },
      ],
    },
  });

  if (existingTxn) {
    console.log(
      '✅ Payment already processed (webhook idempotent):',
      payment.id
    );
    return;
  }

  // ✅ Wallet find karo
  const wallet = await prisma.wallet.findUnique({
    where: { organizationId },
  });

  if (!wallet) {
    console.error(
      '❌ Wallet not found for org:',
      organizationId,
      'payment:',
      payment.id
    );
    // TODO: Alert admin
    return;
  }

  if (!wallet.isActive) {
    console.error(
      '❌ Wallet inactive for org:',
      organizationId
    );
    return;
  }

  // ✅ Amount - Razorpay se lo (paise mein already hai)
  const amountPaise = Number(payment.amount);
  const balanceBeforePaise = wallet.balancePaise;
  const balanceAfterPaise = balanceBeforePaise + amountPaise;

  // ✅ Atomic credit
  try {
    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePaise: balanceAfterPaise,
          totalCreditedPaise: { increment: amountPaise },
          currentMonthPaise: { increment: amountPaise },
          lastTransactionAt: new Date(),
          lowAlertSent: false,
        },
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'credit',
          amountPaise,
          balanceBeforePaise,
          balanceAfterPaise,
          description: `Wallet top-up via Razorpay (webhook) - ₹${
            amountPaise / 100
          }`,
          status: 'completed',
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id,
        },
      }),
    ]);

    console.log(
      '✅ Wallet credited via webhook:',
      organizationId,
      `₹${amountPaise / 100}`
    );

    // ✅ Notify user via socket
    try {
      const { webhookEvents } = await import(
        '../webhooks/webhook.service'
      );
      webhookEvents.emit('walletCredited', {
        organizationId,
        amount: amountPaise / 100,
        newBalance: balanceAfterPaise / 100,
      });
    } catch {
      // Socket optional
    }
  } catch (dbErr: any) {
    console.error(
      '❌ Failed to credit wallet via webhook:',
      dbErr.message,
      organizationId
    );
  }
}

// ─── Handle Order Paid ────────────────────────────────────────────────────────
async function handleOrderPaid(order: any) {
  // order.paid event - payment.captured ke baad aata hai
  // Usually duplicate, but handle as fallback
  const notes = order.notes || {};

  if (notes.purpose !== 'wallet_topup') return;

  console.log('📦 Order paid event for wallet:', order.id);
  // payment.captured already handle kar chuka hoga
  // Duplicate check inside handlePaymentCaptured handles this
}

export default router;
