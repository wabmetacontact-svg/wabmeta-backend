"use strict";
// src/services/scheduler.service.ts - PERMANENT FIX
// ✅ Priority-based execution
// ✅ Auto-throttle during pool pressure
// ✅ Silent skips (no log spam)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeScheduler = initializeScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const withLock_1 = require("../utils/withLock");
const automation_engine_1 = require("../modules/automation/automation.engine");
const database_1 = __importDefault(require("../config/database"));
const client_1 = require("@prisma/client");
const notifications_service_1 = require("../modules/notifications/notifications.service");
const meta_service_1 = require("../modules/meta/meta.service");
const accountHealth_service_1 = require("../modules/meta/accountHealth.service");
// ✅ Global state tracking
const state = {
    automation: false,
    inactivity: false,
    subscriptionExpiry: false,
    expiryWarnings: false,
    webhookLogCleanup: false,
    metaSync: false,
    lastPoolError: 0,
};
// ✅ Check if we should skip due to recent pool errors
function shouldSkipDueToPoolPressure() {
    const now = Date.now();
    const timeSinceLastError = now - state.lastPoolError;
    // If pool error in last 2 minutes, skip
    return timeSinceLastError < 2 * 60 * 1000;
}
function markPoolError() {
    state.lastPoolError = Date.now();
}
function initializeScheduler() {
    console.log('⏰ Initializing scheduler with pool protection...');
    // ============================================
    // 1. AUTOMATION SCHEDULE - Every 2 minutes
    // ✅ CHANGED: Was every minute, too frequent
    // ============================================
    node_cron_1.default.schedule('*/2 * * * *', async () => {
        if (state.automation)
            return;
        if (shouldSkipDueToPoolPressure()) {
            console.log('⏭️ Automation skipped: recent pool pressure');
            return;
        }
        state.automation = true;
        try {
            await (0, withLock_1.withAdvisoryLock)('scheduler:automation', () => automation_engine_1.automationEngine.triggerScheduled());
        }
        catch (error) {
            if (error?.code === 'P2024') {
                markPoolError();
            }
            else {
                console.error('🤖 Scheduled automation error:', error.message);
            }
        }
        finally {
            state.automation = false;
        }
    });
    // ============================================
    // 2. INACTIVITY CHECK - Every hour
    // ============================================
    node_cron_1.default.schedule('0 * * * *', async () => {
        if (state.inactivity)
            return;
        if (shouldSkipDueToPoolPressure())
            return;
        state.inactivity = true;
        try {
            console.log('💤 Running inactivity check...');
            await (0, withLock_1.withAdvisoryLock)('scheduler:inactivity', () => automation_engine_1.automationEngine.triggerInactivity());
        }
        catch (error) {
            if (error?.code === 'P2024') {
                markPoolError();
            }
            else {
                console.error('Inactivity error:', error.message);
            }
        }
        finally {
            state.inactivity = false;
        }
    });
    // ============================================
    // 3. SUBSCRIPTION EXPIRY - Every 4 hours
    // ✅ CHANGED: Was every 2 hours
    // ============================================
    node_cron_1.default.schedule('0 */4 * * *', async () => {
        if (state.subscriptionExpiry)
            return;
        if (shouldSkipDueToPoolPressure())
            return;
        state.subscriptionExpiry = true;
        try {
            await (0, withLock_1.withAdvisoryLock)('scheduler:subExpiry', () => checkAndExpireSubscriptions());
        }
        catch (error) {
            if (error?.code === 'P2024') {
                markPoolError();
            }
            else {
                console.error('Subscription expiry error:', error.message);
            }
        }
        finally {
            state.subscriptionExpiry = false;
        }
    });
    // ============================================
    // 4. EXPIRY WARNINGS - Daily 9 AM
    // ============================================
    node_cron_1.default.schedule('0 9 * * *', async () => {
        if (state.expiryWarnings)
            return;
        state.expiryWarnings = true;
        try {
            await (0, withLock_1.withAdvisoryLock)('scheduler:expiryWarnings', () => sendExpiryWarnings());
        }
        catch (error) {
            if (error?.code !== 'P2024') {
                console.error('Expiry warning error:', error.message);
            }
        }
        finally {
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
    node_cron_1.default.schedule('30 3 * * *', async () => {
        if (state.webhookLogCleanup)
            return;
        state.webhookLogCleanup = true;
        try {
            await (0, withLock_1.withAdvisoryLock)('scheduler:webhookLogCleanup', () => cleanupWebhookLogs());
        }
        catch (error) {
            if (error?.code !== 'P2024') {
                console.error('Webhook log cleanup error:', error.message);
            }
        }
        finally {
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
    node_cron_1.default.schedule('15 4 * * *', async () => {
        if (state.metaSync)
            return;
        state.metaSync = true;
        try {
            await (0, withLock_1.withAdvisoryLock)('scheduler:metaSync', () => syncAllAccountsFromMeta());
        }
        catch (error) {
            if (error?.code !== 'P2024') {
                console.error('Meta sync error:', error.message);
            }
        }
        finally {
            state.metaSync = false;
        }
    });
    console.log('✅ Scheduler initialized');
}
// ============================================
// META SYNC
// ============================================
async function syncAllAccountsFromMeta() {
    if (shouldSkipDueToPoolPressure())
        return;
    const started = Date.now();
    const accounts = await database_1.default.whatsAppAccount.findMany({
        where: { status: 'CONNECTED', isActive: true },
        select: { id: true, organizationId: true, phoneNumber: true },
    });
    if (accounts.length === 0)
        return;
    console.log(`🔄 Meta sync: ${accounts.length} account(s)`);
    let healthOk = 0;
    let templatesOk = 0;
    let failed = 0;
    for (const acc of accounts) {
        // Account health - tier, quality, verification status
        try {
            await meta_service_1.metaService.refreshAccountHealth(acc.id, acc.organizationId);
            healthOk++;
        }
        catch (err) {
            failed++;
            console.warn(`⚠️ Health sync failed for ${acc.phoneNumber}: ${err?.message}`);
        }
        // Meta ka health_status - yahi batata hai ki number business-initiated
        // messages bhej sakta hai ya nahi, aur na bhej sakne par asli wajah.
        // Roz refresh hoti hai taaki UI par taaza haal dikhe aur campaign
        // shuru hone se pehle sahi rok lag sake.
        try {
            const h = await accountHealth_service_1.accountHealthService.get(acc.id, { force: true });
            if (h.blocked) {
                console.warn(`🔴 [Health] ${acc.phoneNumber} BLOCKED: ${h.summary}`);
            }
        }
        catch {
            // health optional hai - baaki sync rukna nahi chahiye
        }
        // Templates - status aur category (billing isi par chalti hai)
        try {
            await meta_service_1.metaService.syncTemplates(acc.id, acc.organizationId);
            templatesOk++;
        }
        catch (err) {
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
    console.log(`✅ Meta sync done in ${Math.round((Date.now() - started) / 1000)}s - ` +
        `health ${healthOk}, templates ${templatesOk}, failed ${failed}`);
}
// ============================================
// WEBHOOK LOG CLEANUP
// ============================================
const WEBHOOK_LOG_RETENTION_DAYS = 7;
const WEBHOOK_LOG_BATCH = 5000;
// Ek run mein itne se zyada nahi - chhote instance ko der tak na daboye
const WEBHOOK_LOG_MAX_PER_RUN = 200000;
async function cleanupWebhookLogs() {
    if (shouldSkipDueToPoolPressure())
        return;
    const started = Date.now();
    let removed = 0;
    try {
        // Batches mein delete karo. Ek hi bade DELETE se lock lamba rehta hai
        // aur WAL bhar jata hai.
        while (removed < WEBHOOK_LOG_MAX_PER_RUN) {
            const n = await database_1.default.$executeRawUnsafe(`DELETE FROM "WebhookLog"
         WHERE id IN (
           SELECT id FROM "WebhookLog"
           WHERE "createdAt" < now() - interval '${WEBHOOK_LOG_RETENTION_DAYS} days'
           LIMIT ${WEBHOOK_LOG_BATCH}
         )`);
            removed += n;
            if (n < WEBHOOK_LOG_BATCH)
                break;
            // DB ko saans lene do
            await new Promise((r) => setTimeout(r, 200));
        }
        if (removed > 0) {
            // Dead space reusable banao, warna table ghatne ke bawajood
            // disk par badhti rehti hai
            await database_1.default.$executeRawUnsafe(`VACUUM (ANALYZE) "WebhookLog"`);
            console.log(`🧹 Webhook logs cleaned: ${removed} rows in ${Math.round((Date.now() - started) / 1000)}s`);
        }
    }
    catch (error) {
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
    let expiredSubscriptions = [];
    try {
        expiredSubscriptions = await database_1.default.subscription.findMany({
            where: {
                status: client_1.SubscriptionStatus.ACTIVE,
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
    }
    catch (error) {
        if (error?.code === 'P2024') {
            markPoolError();
            return;
        }
        throw error;
    }
    if (expiredSubscriptions.length === 0)
        return;
    console.log(`⏰ Expiring ${expiredSubscriptions.length} subscription(s)`);
    // Notifications transaction ke BAAHAR bhejte hain. Push bhejna ek network
    // call hai - use DB transaction ke andar rakhne se transaction lamba khinchta
    // hai aur connection pool par dabav padta hai.
    const expiredNotifications = [];
    for (const subscription of expiredSubscriptions) {
        try {
            await database_1.default.$transaction(async (tx) => {
                await tx.subscription.update({
                    where: { id: subscription.id },
                    data: { status: client_1.SubscriptionStatus.EXPIRED },
                });
                await tx.organization.update({
                    where: { id: subscription.organizationId },
                    data: { planType: client_1.PlanType.FREE_DEMO },
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
                    type: 'billing',
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
        }
        catch (err) {
            if (err?.code === 'P2024') {
                markPoolError();
                break; // Stop processing
            }
            console.error(`❌ Expire failed for ${subscription.id}:`, err.message);
        }
    }
    // Sab expiry ho jaane ke baad notifications bhejo
    for (const n of expiredNotifications) {
        await notifications_service_1.notificationsService
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
        let expiringSubscriptions = [];
        try {
            expiringSubscriptions = await database_1.default.subscription.findMany({
                where: {
                    status: client_1.SubscriptionStatus.ACTIVE,
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
        }
        catch (error) {
            if (error?.code === 'P2024') {
                markPoolError();
                continue;
            }
            throw error;
        }
        for (const sub of expiringSubscriptions) {
            try {
                const alreadySent = await database_1.default.notification.findFirst({
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
                if (alreadySent)
                    continue;
                await notifications_service_1.notificationsService.create({
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
            }
            catch (err) {
                if (err?.code === 'P2024') {
                    markPoolError();
                    break;
                }
            }
        }
    }
}
//# sourceMappingURL=scheduler.service.js.map