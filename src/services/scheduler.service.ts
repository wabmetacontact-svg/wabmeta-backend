// src/services/scheduler.service.ts - FIXED: Overlap-safe, pool-friendly

import cron from 'node-cron';
import { automationEngine } from '../modules/automation/automation.engine';
import prisma from '../config/database';
import { SubscriptionStatus, PlanType } from '@prisma/client';

// ✅ Overlap prevention flags
const runningFlags = {
  automation: false,
  inactivity: false,
  subscriptionExpiry: false,
  expiryWarnings: false,
};

export function initializeScheduler() {
  console.log('⏰ Initializing scheduler...');

  // ============================================
  // 1. AUTOMATION - Every 2 minutes (was 1 min - too frequent)
  // ============================================
  cron.schedule('*/2 * * * *', async () => {
    if (runningFlags.automation) {
      console.log('⏭️  Automation trigger already running, skipping');
      return;
    }
    runningFlags.automation = true;
    try {
      await automationEngine.triggerScheduled();
    } catch (error: any) {
      // ✅ Pool timeout - silently skip
      if (error?.code === 'P2024') {
        console.warn('⚠️  Automation trigger skipped: DB pool busy');
      } else {
        console.error('🤖 Scheduled automation trigger error:', error);
      }
    } finally {
      runningFlags.automation = false;
    }
  });

  // ============================================
  // 2. INACTIVITY CHECK - Every hour
  // ============================================
  cron.schedule('0 * * * *', async () => {
    if (runningFlags.inactivity) return;
    runningFlags.inactivity = true;
    try {
      await automationEngine.triggerInactivity();
    } catch (error: any) {
      if (error?.code !== 'P2024') {
        console.error('Inactivity automation error:', error);
      }
    } finally {
      runningFlags.inactivity = false;
    }
  });

  // ============================================
  // 3. SUBSCRIPTION EXPIRY - Every 2 hours (was 1 hour)
  // ============================================
  cron.schedule('0 */2 * * *', async () => {
    if (runningFlags.subscriptionExpiry) return;
    runningFlags.subscriptionExpiry = true;
    try {
      await checkAndExpireSubscriptions();
    } catch (error: any) {
      if (error?.code !== 'P2024') {
        console.error('Subscription expiry check error:', error);
      }
    } finally {
      runningFlags.subscriptionExpiry = false;
    }
  });

  // ============================================
  // 4. EXPIRY WARNINGS - Daily at 9 AM
  // ============================================
  cron.schedule('0 9 * * *', async () => {
    if (runningFlags.expiryWarnings) return;
    runningFlags.expiryWarnings = true;
    try {
      await sendExpiryWarnings();
    } catch (error: any) {
      if (error?.code !== 'P2024') {
        console.error('Expiry warning error:', error);
      }
    } finally {
      runningFlags.expiryWarnings = false;
    }
  });

  console.log('✅ Scheduler initialized');
}

// ============================================
// SUBSCRIPTION EXPIRY
// ============================================
async function checkAndExpireSubscriptions() {
  const now = new Date();

  let expiredSubscriptions: any[] = [];

  try {
    expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { lt: now },
      },
      include: {
        plan: true,
        organization: {
          select: { id: true, name: true, ownerId: true },
        },
      },
      // ✅ Limit to prevent huge queries
      take: 50,
    });
  } catch (error: any) {
    if (error?.code === 'P2024') {
      console.warn('⚠️  Subscription check skipped: DB pool busy');
      return;
    }
    throw error;
  }

  if (expiredSubscriptions.length === 0) return;

  console.log(`⏰ Expiring ${expiredSubscriptions.length} subscription(s)`);

  // ✅ Sequential - not parallel
  for (const subscription of expiredSubscriptions) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.EXPIRED },
        });

        await tx.organization.update({
          where: { id: subscription.organizationId },
          data: { planType: PlanType.FREE_DEMO },
        });

        await tx.activityLog.create({
          data: {
            organizationId: subscription.organizationId,
            action: 'UPDATE',
            entity: 'subscription',
            entityId: subscription.id,
            metadata: {
              event: 'subscription_auto_expired',
              previousPlan: subscription.plan.name,
              expiredAt: now.toISOString(),
              endDate: subscription.currentPeriodEnd.toISOString(),
            },
          },
        });

        await tx.notification.create({
          data: {
            userId: subscription.organization.ownerId,
            organizationId: subscription.organizationId,
            type: 'billing',
            title: 'Subscription Expired',
            description: `Your ${subscription.plan.name} subscription has expired. Please renew to restore full access.`,
            actionUrl: '/dashboard/billing',
            metadata: {
              planName: subscription.plan.name,
              expiredAt: now.toISOString(),
            },
          },
        });
      });

      console.log(`✅ Expired: ${subscription.organization.name}`);
    } catch (err: any) {
      if (err?.code === 'P2024') {
        console.warn(`⚠️  Could not expire sub ${subscription.id}: pool busy`);
      } else {
        console.error(`❌ Expire failed for ${subscription.organizationId}:`, err);
      }
    }
  }

  // Cancelled subscriptions cleanup
  try {
    const cancelledEnded = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.CANCELLED,
        currentPeriodEnd: { lt: now },
      },
      include: {
        organization: { select: { id: true, planType: true } },
      },
      take: 50,
    });

    for (const sub of cancelledEnded) {
      if (sub.organization.planType !== PlanType.FREE_DEMO) {
        try {
          await prisma.organization.update({
            where: { id: sub.organizationId },
            data: { planType: PlanType.FREE_DEMO },
          });
        } catch (err: any) {
          if (err?.code !== 'P2024') {
            console.error(`❌ Downgrade failed for ${sub.id}:`, err);
          }
        }
      }
    }
  } catch (error: any) {
    if (error?.code !== 'P2024') throw error;
  }
}

// ============================================
// EXPIRY WARNINGS
// ============================================
async function sendExpiryWarnings() {
  const now = new Date();
  const warningDays = [7, 3, 1];

  for (const days of warningDays) {
    const warningDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const windowStart = new Date(warningDate.getTime());
    const windowEnd = new Date(warningDate.getTime() + 25 * 60 * 60 * 1000);

    let expiringSubscriptions: any[] = [];

    try {
      expiringSubscriptions = await prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: { gte: windowStart, lt: windowEnd },
        },
        include: {
          plan: true,
          organization: {
            select: { id: true, name: true, ownerId: true },
          },
        },
        take: 100,
      });
    } catch (error: any) {
      if (error?.code === 'P2024') {
        console.warn(`⚠️  Warning check (${days}d) skipped: pool busy`);
        continue;
      }
      throw error;
    }

    for (const sub of expiringSubscriptions) {
      try {
        const alreadySent = await prisma.notification.findFirst({
          where: {
            userId: sub.organization.ownerId,
            organizationId: sub.organizationId,
            type: 'billing_warning',
            createdAt: {
              gte: new Date(now.getTime() - 20 * 60 * 60 * 1000),
            },
            metadata: {
              path: ['warningDays'],
              equals: days,
            },
          },
        });

        if (alreadySent) continue;

        await prisma.notification.create({
          data: {
            userId: sub.organization.ownerId,
            organizationId: sub.organizationId,
            type: 'billing_warning',
            title: `Subscription Expiring in ${days} Day${days > 1 ? 's' : ''}`,
            description: `Your ${sub.plan.name} subscription expires on ${sub.currentPeriodEnd.toLocaleDateString('en-IN')}. Renew now to avoid interruption.`,
            actionUrl: '/dashboard/billing',
            metadata: {
              planName: sub.plan.name,
              expiresAt: sub.currentPeriodEnd.toISOString(),
              warningDays: days,
            },
          },
        });

        console.log(`📧 ${days}d warning sent: ${sub.organization.name}`);
      } catch (err: any) {
        if (err?.code !== 'P2024') {
          console.error(`❌ Warning failed for ${sub.organizationId}:`, err);
        }
      }
    }
  }
}
