// src/services/scheduler.service.ts - PERMANENT FIX
// ✅ Priority-based execution
// ✅ Auto-throttle during pool pressure
// ✅ Silent skips (no log spam)

import cron from 'node-cron';
import { withAdvisoryLock } from '../utils/withLock';
import { automationEngine } from '../modules/automation/automation.engine';
import prisma from '../config/database';
import { SubscriptionStatus, PlanType } from '@prisma/client';
import { notificationsService } from '../modules/notifications/notifications.service';
import { metaService } from '../modules/meta/meta.service';
import { accountHealthService } from '../modules/meta/accountHealth.service';


// ✅ Global state tracking
const state = {
  automation: false,
  inactivity: false,
  subscriptionExpiry: false,
  expiryWarnings: false,
  webhookLogCleanup: false,
  metaSync: false,
  automationJobs: false,
  noReply: false,
  payments: false,
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
      await withAdvisoryLock('scheduler:automation', () => automationEngine.triggerScheduled());
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
      await withAdvisoryLock('scheduler:inactivity', () => automationEngine.triggerInactivity());
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
      await withAdvisoryLock('scheduler:subExpiry', () => checkAndExpireSubscriptions());
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
      await withAdvisoryLock('scheduler:expiryWarnings', () => sendExpiryWarnings());
    } catch (error: any) {
      if (error?.code !== 'P2024') {
        console.error('Expiry warning error:', error.message);
      }
    } finally {
      state.expiryWarnings = false;
    }
  });

  // ============================================
  // 5. WEBHOOK LOG CLEANUP - Daily 3:30 AM
  // WebhookLog par koi retention nahi tha - March se badhte badhte
  // 7.9 lakh rows / 784 MB ho gayi thi, poore DB ka ~46%. Chhote RDS
  // instance ke liye ye bhaari hai, aur 7 din se purane webhook logs
  // ka koi istemaal nahi hai.
  // ============================================
  cron.schedule('30 3 * * *', async () => {
    if (state.webhookLogCleanup) return;
    state.webhookLogCleanup = true;
    try {
      await withAdvisoryLock('scheduler:webhookLogCleanup', () =>
        cleanupWebhookLogs()
      );
    } catch (error: any) {
      if (error?.code !== 'P2024') {
        console.error('Webhook log cleanup error:', error.message);
      }
    } finally {
      state.webhookLogCleanup = false;
    }
  });

  // ============================================
  // 6. META SYNC - Daily 4:15 AM
  // Meta apni taraf se cheezein badalta rehta hai aur hume kabhi khabar
  // nahi hoti:
  //   - messaging tier badhta hai (TIER_250 → TIER_100K)
  //   - template ki category approval par badal jati hai
  //     (UTILITY → MARKETING) - aur billing usi category se hoti hai
  //   - template PAUSED ya REJECTED ho jate hain
  //
  // Pehle iska koi cron nahi tha, sirf manual sync tha. Isliye purana
  // data mahino baitha rehta tha: accounts sabse dheemi speed par chalte
  // the aur MARKETING templates UTILITY ke rate par charge hote the.
  // ============================================
  cron.schedule('15 4 * * *', async () => {
    if (state.metaSync) return;
    state.metaSync = true;
    try {
      await withAdvisoryLock('scheduler:metaSync', () => syncAllAccountsFromMeta());
    } catch (error: any) {
      if (error?.code !== 'P2024') {
        console.error('Meta sync error:', error.message);
      }
    } finally {
      state.metaSync = false;
    }
  });

  // ============================================
  // 7. AUTOMATION JOBS - Every minute
  // Follow-up delays aur wait_for_response timeouts (AutomationJob), aur
  // LeadTask due reminders (TASK_DUE). Jobs SKIP LOCKED se claim hote hain,
  // isliye lock chhoot bhi jaye to ek job do baar nahi chalta.
  // ============================================
  cron.schedule('* * * * *', async () => {
    if (state.automationJobs) return;
    if (shouldSkipDueToPoolPressure()) return;

    state.automationJobs = true;
    try {
      await withAdvisoryLock('scheduler:automationJobs', async () => {
        await automationEngine.runDueJobs();
        await automationEngine.triggerTasksDue();
      });
    } catch (error: any) {
      if (error?.code === 'P2024') {
        markPoolError();
      } else {
        console.error('Automation jobs error:', error.message);
      }
    } finally {
      state.automationJobs = false;
    }
  });

  // ============================================
  // 8. NO_REPLY - Every 10 minutes
  // ============================================
  cron.schedule('*/10 * * * *', async () => {
    if (state.noReply) return;
    if (shouldSkipDueToPoolPressure()) return;

    state.noReply = true;
    try {
      await withAdvisoryLock('scheduler:noReply', () => automationEngine.triggerNoReply());
    } catch (error: any) {
      if (error?.code === 'P2024') {
        markPoolError();
      } else {
        console.error('No-reply trigger error:', error.message);
      }
    } finally {
      state.noReply = false;
    }
  });

  // ============================================
  // 9. CLIENT PAYMENT LINKS - Every 3 minutes
  // Jin clients ne apne Razorpay dashboard me webhook nahi lagaya, unke payment
  // ka pata sirf isi se chalta hai. Expire ho chuke links bina Razorpay call
  // kiye band ho jate hain.
  // ============================================
  cron.schedule('*/3 * * * *', async () => {
    if (state.payments) return;
    if (shouldSkipDueToPoolPressure()) return;

    state.payments = true;
    try {
      const { paymentsService } = await import('../modules/payments/payments.service');
      await withAdvisoryLock('scheduler:payments', () => paymentsService.pollPendingPayments());
    } catch (error: any) {
      if (error?.code === 'P2024') {
        markPoolError();
      } else {
        console.error('Payment polling error:', error.message);
      }
    } finally {
      state.payments = false;
    }
  });

  console.log('✅ Scheduler initialized');
}

// ============================================
// META SYNC
// ============================================
async function syncAllAccountsFromMeta() {
  if (shouldSkipDueToPoolPressure()) return;

  const started = Date.now();

  const accounts = await prisma.whatsAppAccount.findMany({
    where: { status: 'CONNECTED', isActive: true },
    select: { id: true, organizationId: true, phoneNumber: true },
  });

  if (accounts.length === 0) return;

  console.log(`🔄 Meta sync: ${accounts.length} account(s)`);

  let healthOk = 0;
  let templatesOk = 0;
  let failed = 0;

  for (const acc of accounts) {
    // Account health - tier, quality, verification status
    try {
      await metaService.refreshAccountHealth(acc.id, acc.organizationId);
      healthOk++;
    } catch (err: any) {
      failed++;
      console.warn(`⚠️ Health sync failed for ${acc.phoneNumber}: ${err?.message}`);
    }

    // Meta ka health_status - yahi batata hai ki number business-initiated
    // messages bhej sakta hai ya nahi, aur na bhej sakne par asli wajah.
    // Roz refresh hoti hai taaki UI par taaza haal dikhe aur campaign
    // shuru hone se pehle sahi rok lag sake.
    try {
      const h = await accountHealthService.get(acc.id, { force: true });
      if (h.blocked) {
        console.warn(`🔴 [Health] ${acc.phoneNumber} BLOCKED: ${h.summary}`);
      }
    } catch {
      // health optional hai - baaki sync rukna nahi chahiye
    }

    // Templates - status aur category (billing isi par chalti hai)
    try {
      await metaService.syncTemplates(acc.id, acc.organizationId);
      templatesOk++;
    } catch (err: any) {
      failed++;
      console.warn(`⚠️ Template sync failed for ${acc.phoneNumber}: ${err?.message}`);
    }

    // Meta ki Graph API par rate limit hai, aur ye raat me chalta hai -
    // jaldi karne ki koi wajah nahi.
    await new Promise((r) => setTimeout(r, 400));

    if (shouldSkipDueToPoolPressure()) {
      console.warn('⚠️ Meta sync stopped early due to DB pool pressure');
      break;
    }
  }

  console.log(
    `✅ Meta sync done in ${Math.round((Date.now() - started) / 1000)}s - ` +
    `health ${healthOk}, templates ${templatesOk}, failed ${failed}`
  );
}

// ============================================
// WEBHOOK LOG CLEANUP
// ============================================
const WEBHOOK_LOG_RETENTION_DAYS = 7;
const WEBHOOK_LOG_BATCH = 5000;
// Ek run mein itne se zyada nahi - chhote instance ko der tak na daboye
const WEBHOOK_LOG_MAX_PER_RUN = 200000;

async function cleanupWebhookLogs() {
  if (shouldSkipDueToPoolPressure()) return;

  const started = Date.now();
  let removed = 0;

  try {
    // Batches mein delete karo. Ek hi bade DELETE se lock lamba rehta hai
    // aur WAL bhar jata hai.
    while (removed < WEBHOOK_LOG_MAX_PER_RUN) {
      const n: number = await prisma.$executeRawUnsafe(
        `DELETE FROM "WebhookLog"
         WHERE id IN (
           SELECT id FROM "WebhookLog"
           WHERE "createdAt" < now() - interval '${WEBHOOK_LOG_RETENTION_DAYS} days'
           LIMIT ${WEBHOOK_LOG_BATCH}
         )`
      );

      removed += n;
      if (n < WEBHOOK_LOG_BATCH) break;

      // DB ko saans lene do
      await new Promise((r) => setTimeout(r, 200));
    }

    if (removed > 0) {
      // Dead space reusable banao, warna table ghatne ke bawajood
      // disk par badhti rehti hai
      await prisma.$executeRawUnsafe(`VACUUM (ANALYZE) "WebhookLog"`);

      console.log(
        `🧹 Webhook logs cleaned: ${removed} rows in ${Math.round(
          (Date.now() - started) / 1000
        )}s`
      );
    }
  } catch (error: any) {
    if (error?.code === 'P2024') {
      markPoolError();
    }
    throw error;
  }
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

  // Notifications transaction ke BAAHAR bhejte hain. Push bhejna ek network
  // call hai - use DB transaction ke andar rakhne se transaction lamba khinchta
  // hai aur connection pool par dabav padta hai.
  const expiredNotifications: Array<{
    userId: string;
    organizationId: string;
    type: 'billing';
    title: string;
    description: string;
    actionUrl: string;
    metadata: Record<string, any>;
  }> = [];

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

        // Pehle yahan seedha prisma.notification.create tha - row ban jati
        // thi par push kabhi nahi jata tha. Service se jaane par phone par
        // bhi pahunchta hai.
        expiredNotifications.push({
          userId: subscription.organization.ownerId,
          organizationId: subscription.organizationId,
          type: 'billing' as const,
          title: 'Subscription Expired',
          description: `Your ${subscription.plan.name} subscription has expired.`,
          actionUrl: '/(app)/billing',
          metadata: {
            planName: subscription.plan.name,
            expiredAt: now.toISOString(),
            webUrl: '/dashboard/billing',
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

  // Sab expiry ho jaane ke baad notifications bhejo
  for (const n of expiredNotifications) {
    await notificationsService
      .create(n)
      .catch((e) => console.error('Expiry notification failed:', e?.message));
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

        await notificationsService.create({
          userId: sub.organization.ownerId,
          organizationId: sub.organizationId,
          type: 'billing_warning',
          title: `Subscription Expiring in ${days} Day${days > 1 ? 's' : ''}`,
          description: `Your ${sub.plan.name} subscription expires soon.`,
          actionUrl: '/(app)/billing',
          metadata: {
            planName: sub.plan.name,
            expiresAt: sub.currentPeriodEnd.toISOString(),
            warningDays: days,
            webUrl: '/dashboard/billing',
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


