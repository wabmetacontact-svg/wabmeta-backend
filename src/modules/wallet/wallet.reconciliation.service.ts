// src/modules/wallet/wallet.reconciliation.service.ts

import prisma from '../../config/database';

const db = prisma as any;

export class WalletReconciliationService {
  private isRunning = false;

  /**
   * ✅ Run every 5 minutes
   * Check pending orders from last 24 hours
   * If Razorpay shows payment successful → credit wallet
   */
  async runReconciliation() {
    if (this.isRunning) {
      console.log('⏳ Reconciliation already running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      // Find orders that are pending/failed from last 24 hours
      const pendingOrders = await db.walletTopUpOrder.findMany({
        where: {
          status: { in: ['PENDING', 'FAILED'] },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
            lte: new Date(Date.now() - 3 * 60 * 1000), // At least 3 min old
          },
          attemptCount: { lt: 5 }, // Max 5 retry attempts
        },
        take: 50,
        orderBy: { createdAt: 'asc' },
      });

      if (pendingOrders.length === 0) {
        return;
      }

      console.log(`🔄 Reconciliation: checking ${pendingOrders.length} pending orders`);

      const Razorpay = require('razorpay');
      const rzp = new Razorpay({
        key_id: process.env.WALLET_RAZORPAY_KEY_ID,
        key_secret: process.env.WALLET_RAZORPAY_KEY_SECRET,
      });

      const { creditWalletFromWebhook } = await import('./wallet.service');

      for (const order of pendingOrders) {
        try {
          // ✅ Fetch order status from Razorpay
          const rzpOrder = await rzp.orders.fetch(order.razorpayOrderId);

          if (rzpOrder.status !== 'paid') {
            // Update attempt count
            await db.walletTopUpOrder.update({
              where: { id: order.id },
              data: {
                attemptCount: { increment: 1 },
                lastAttemptAt: new Date(),
              },
            });
            continue;
          }

          // ✅ Order is paid on Razorpay - fetch payment
          const payments = await rzp.orders.fetchPayments(order.razorpayOrderId);
          const capturedPayment = payments.items.find((p: any) => p.status === 'captured');

          if (!capturedPayment) {
            await db.walletTopUpOrder.update({
              where: { id: order.id },
              data: {
                attemptCount: { increment: 1 },
                lastAttemptAt: new Date(),
                failureReason: 'No captured payment found',
              },
            });
            continue;
          }

          // ✅ Credit wallet
          console.log(`💰 Reconciling stuck payment: ${order.razorpayOrderId}`);
          
          const result = await creditWalletFromWebhook({
            organizationId: order.organizationId,
            razorpayOrderId: order.razorpayOrderId,
            razorpayPaymentId: capturedPayment.id,
            amountPaise: Number(rzpOrder.amount),
          });

          // Mark as credited via reconciliation
          await db.walletTopUpOrder.update({
            where: { id: order.id },
            data: {
              creditedVia: 'cron_reconciliation',
            },
          });

          console.log(`✅ Reconciled: ${order.razorpayOrderId}`, result);
        } catch (err: any) {
          console.error(`❌ Reconciliation error for ${order.razorpayOrderId}:`, err.message);
          
          await db.walletTopUpOrder.update({
            where: { id: order.id },
            data: {
              attemptCount: { increment: 1 },
              lastAttemptAt: new Date(),
              failureReason: err.message.substring(0, 500),
            },
          });
        }
      }
    } catch (err: any) {
      console.error('❌ Reconciliation cron error:', err.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start cron job - runs every 5 minutes
   */
  startCron() {
    console.log('🚀 Starting wallet reconciliation cron (every 5 min)');
    
    // Run immediately on start
    setTimeout(() => this.runReconciliation(), 30 * 1000);
    
    // Then every 5 minutes
    setInterval(() => {
      this.runReconciliation();
    }, 5 * 60 * 1000);
  }
}

export const walletReconciliationService = new WalletReconciliationService();
