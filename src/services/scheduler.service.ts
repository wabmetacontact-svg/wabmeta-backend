// src/services/scheduler.service.ts - COMPLETE WITH SUBSCRIPTION EXPIRY

import cron from 'node-cron';
import { automationEngine } from '../modules/automation/automation.engine';
import prisma from '../config/database';
import { SubscriptionStatus, PlanType } from '@prisma/client';

export function initializeScheduler() {
  console.log('⏰ Initializing scheduler...');

  // ============================================
  // 1. AUTOMATION - Every minute
  // ============================================
  cron.schedule('* * * * *', async () => {
    try {
      await automationEngine.triggerScheduled();
    } catch (error) {
      console.error('Scheduled automation error:', error);
    }
  });

  // ============================================
  // 2. AUTOMATION - Inactivity check - Every hour
  // ============================================
  cron.schedule('0 * * * *', async () => {
    try {
      await automationEngine.triggerInactivity();
    } catch (error) {
      console.error('Inactivity automation error:', error);
    }
  });

  // ============================================
  // ✅ 3. SUBSCRIPTION EXPIRY CHECK - Every hour
  // ============================================
  cron.schedule('0 * * * *', async () => {
    try {
      await checkAndExpireSubscriptions();
    } catch (error) {
      console.error('Subscription expiry check error:', error);
    }
  });

  // ============================================
  // ✅ 4. EXPIRY WARNING NOTIFICATIONS - Daily at 9 AM
  // ============================================
  cron.schedule('0 9 * * *', async () => {
    try {
      await sendExpiryWarnings();
    } catch (error) {
      console.error('Expiry warning error:', error);
    }
  });

  console.log('✅ Scheduler initialized (automations + subscription expiry)');
}

// ============================================
// ✅ SUBSCRIPTION EXPIRY LOGIC
// ============================================
async function checkAndExpireSubscriptions() {
  const now = new Date();

  console.log('🔍 Checking expired subscriptions...');

  // Find all active subscriptions that have expired
  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      status:           SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { lt: now },
    },
    include: {
      plan:         true,
      organization: {
        select: {
          id:      true,
          name:    true,
          ownerId: true,
        },
      },
    },
  });

  if (expiredSubscriptions.length === 0) {
    return;
  }

  console.log(`⏰ Found ${expiredSubscriptions.length} expired subscription(s)`);

  for (const subscription of expiredSubscriptions) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Mark subscription as EXPIRED
        await tx.subscription.update({
          where: { id: subscription.id },
          data:  { status: SubscriptionStatus.EXPIRED },
        });

        // 2. ✅ Downgrade org to FREE_DEMO
        await tx.organization.update({
          where: { id: subscription.organizationId },
          data:  { planType: PlanType.FREE_DEMO },
        });

        // 3. Log activity
        await tx.activityLog.create({
          data: {
            organizationId: subscription.organizationId,
            action:         'UPDATE',
            entity:         'subscription',
            entityId:       subscription.id,
            metadata: {
              event:        'subscription_auto_expired',
              previousPlan: subscription.plan.name,
              expiredAt:    now.toISOString(),
              endDate:      subscription.currentPeriodEnd.toISOString(),
            },
          },
        });

        // 4. Create notification for org owner
        await tx.notification.create({
          data: {
            userId:         subscription.organization.ownerId,
            organizationId: subscription.organizationId,
            type:           'billing',
            title:          'Subscription Expired',
            description:    `Your ${subscription.plan.name} subscription has expired. Please renew to restore full access.`,
            actionUrl:      '/dashboard/billing',
            metadata: {
              planName:  subscription.plan.name,
              expiredAt: now.toISOString(),
            },
          },
        });
      });

      console.log(`✅ Expired & downgraded: ${subscription.organization.name}`);

    } catch (err) {
      console.error(
        `❌ Failed to expire subscription for org ${subscription.organizationId}:`,
        err
      );
    }
  }

  // ✅ Also handle CANCELLED subscriptions whose period has ended
  const cancelledEnded = await prisma.subscription.findMany({
    where: {
      status:           SubscriptionStatus.CANCELLED,
      currentPeriodEnd: { lt: now },
    },
    include: {
      organization: { select: { id: true, planType: true } },
    },
  });

  for (const sub of cancelledEnded) {
    try {
      if (sub.organization.planType !== PlanType.FREE_DEMO) {
        await prisma.organization.update({
          where: { id: sub.organizationId },
          data:  { planType: PlanType.FREE_DEMO },
        });
        console.log(`✅ Cancelled sub ended, org downgraded: ${sub.organizationId}`);
      }
    } catch (err) {
      console.error(`❌ Failed to downgrade cancelled sub ${sub.id}:`, err);
    }
  }
}

// ============================================
// ✅ EXPIRY WARNING NOTIFICATIONS (7 days + 3 days + 1 day)
// ============================================
async function sendExpiryWarnings() {
  const now = new Date();
  const warningDays = [7, 3, 1];

  for (const days of warningDays) {
    const warningDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Window: avoid duplicate warnings (25h window)
    const windowStart = new Date(warningDate.getTime());
    const windowEnd   = new Date(warningDate.getTime() + 25 * 60 * 60 * 1000);

    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status:           SubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          gte: windowStart,
          lt:  windowEnd,
        },
      },
      include: {
        plan:         true,
        organization: {
          select: {
            id:      true,
            name:    true,
            ownerId: true,
          },
        },
      },
    });

    for (const sub of expiringSubscriptions) {
      try {
        // Check duplicate notification (last 20 hours)
        const alreadySent = await prisma.notification.findFirst({
          where: {
            userId:         sub.organization.ownerId,
            organizationId: sub.organizationId,
            type:           'billing_warning',
            createdAt: {
              gte: new Date(now.getTime() - 20 * 60 * 60 * 1000),
            },
            metadata: {
              path:   ['warningDays'],
              equals: days,
            },
          },
        });

        if (alreadySent) continue;

        await prisma.notification.create({
          data: {
            userId:         sub.organization.ownerId,
            organizationId: sub.organizationId,
            type:           'billing_warning',
            title:          `Subscription Expiring in ${days} Day${days > 1 ? 's' : ''}`,
            description:    `Your ${sub.plan.name} subscription expires on ${sub.currentPeriodEnd.toLocaleDateString('en-IN')}. Renew now to avoid service interruption.`,
            actionUrl:      '/dashboard/billing',
            metadata: {
              planName:    sub.plan.name,
              expiresAt:   sub.currentPeriodEnd.toISOString(),
              warningDays: days,
            },
          },
        });

        console.log(`📧 ${days}-day warning sent for org: ${sub.organization.name}`);
      } catch (err) {
        console.error(`❌ Warning notification failed for ${sub.organizationId}:`, err);
      }
    }
  }
}
