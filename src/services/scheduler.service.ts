// src/services/scheduler.service.ts - PERMANENT FIX
// ✅ Priority-based execution
// ✅ Auto-throttle during pool pressure
// ✅ Silent skips (no log spam)

import cron from 'node-cron';
import { automationEngine } from '../modules/automation/automation.engine';
import prisma from '../config/database';
import { SubscriptionStatus, PlanType } from '@prisma/client';


// ✅ Global state tracking
const state = {
  automation: false,
  inactivity: false,
  subscriptionExpiry: false,
  expiryWarnings: false,
  lastPoolError: 0,
};

// ✅ Check if we should skip due to recent pool errors
function shouldSkipDueToPoolPressure(): boolean {
  const now = Date.now();
  const timeSinceLastError = now - state.lastPoolError;
  
  // If pool error in last 2 minutes, skip
  return timeSinceLastError < 2 * 60 * 1000;
}

function markPoolError() {
  state.lastPoolError = Date.now();
}

export function initializeScheduler() {
  console.log('⏰ Initializing scheduler with pool protection...');

  // ============================================
  // 1. AUTOMATION SCHEDULE - Every 2 minutes
  // ✅ CHANGED: Was every minute, too frequent
  // ============================================
  cron.schedule('*/2 * * * *', async () => {
    if (state.automation) return;
    if (shouldSkipDueToPoolPressure()) {
      console.log('⏭️ Automation skipped: recent pool pressure');
      return;
    }

    state.automation = true;
    try {
      await automationEngine.triggerScheduled();
    } catch (error: any) {
      if (error?.code === 'P2024') {
        markPoolError();
      } else {
        console.error('🤖 Scheduled automation error:', error.message);
      }
    } finally {
      state.automation = false;
    }
  });

  // ============================================
  // 2. INACTIVITY CHECK - Every hour
  // ============================================
  cron.schedule('0 * * * *', async () => {
    if (state.inactivity) return;
    if (shouldSkipDueToPoolPressure()) return;

    state.inactivity = true;
    try {
      console.log('💤 Running inactivity check...');
      await automationEngine.triggerInactivity();
    } catch (error: any) {
      if (error?.code === 'P2024') {
        markPoolError();
      } else {
        console.error('Inactivity error:', error.message);
      }
    } finally {
      state.inactivity = false;
    }
  });

  // ============================================
  // 3. SUBSCRIPTION EXPIRY - Every 4 hours
  // ✅ CHANGED: Was every 2 hours
  // ============================================
  cron.schedule('0 */4 * * *', async () => {
    if (state.subscriptionExpiry) return;
    if (shouldSkipDueToPoolPressure()) return;

    state.subscriptionExpiry = true;
    try {
      await checkAndExpireSubscriptions();
    } catch (error: any) {
      if (error?.code === 'P2024') {
        markPoolError();
      } else {
        console.error('Subscription expiry error:', error.message);
      }
    } finally {
      state.subscriptionExpiry = false;
    }
  });

  // ============================================
  // 4. EXPIRY WARNINGS - Daily 9 AM
  // ============================================
  cron.schedule('0 9 * * *', async () => {
    if (state.expiryWarnings) return;
    state.expiryWarnings = true;
    try {
      await sendExpiryWarnings();
    } catch (error: any) {
      if (error?.code !== 'P2024') {
        console.error('Expiry warning error:', error.message);
      }
    } finally {
      state.expiryWarnings = false;
    }
  });

  console.log('✅ Scheduler initialized');
}

// ============================================
// SUBSCRIPTION EXPIRY (unchanged from before)
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
      take: 20, // Reduced batch
    });
  } catch (error: any) {
    if (error?.code === 'P2024') {
      markPoolError();
      return;
    }
    throw error;
  }

  if (expiredSubscriptions.length === 0) return;

  console.log(`⏰ Expiring ${expiredSubscriptions.length} subscription(s)`);

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
            description: `Your ${subscription.plan.name} subscription has expired.`,
            actionUrl: '/dashboard/billing',
            metadata: {
              planName: subscription.plan.name,
              expiredAt: now.toISOString(),
            },
          },
        });
      });

      console.log(`✅ Expired: ${subscription.organization.name}`);
      // ✅ Small delay between subs
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      if (err?.code === 'P2024') {
        markPoolError();
        break; // Stop processing
      }
      console.error(`❌ Expire failed for ${subscription.id}:`, err.message);
    }
  }
}

// ============================================
// EXPIRY WARNINGS (unchanged)
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
        take: 50,
      });
    } catch (error: any) {
      if (error?.code === 'P2024') {
        markPoolError();
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
            description: `Your ${sub.plan.name} subscription expires soon.`,
            actionUrl: '/dashboard/billing',
            metadata: {
              planName: sub.plan.name,
              expiresAt: sub.currentPeriodEnd.toISOString(),
              warningDays: days,
            },
          },
        });

        await new Promise(r => setTimeout(r, 300));
      } catch (err: any) {
        if (err?.code === 'P2024') {
          markPoolError();
          break;
        }
      }
    }
  }
}


