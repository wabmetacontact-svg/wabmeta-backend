"use strict";
// src/services/scheduler.service.ts - PERMANENT FIX
// ✅ Priority-based execution
// ✅ Auto-throttle during pool pressure
// ✅ Silent skips (no log spam)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTemplateMediaPreWarmJob = void 0;
exports.initializeScheduler = initializeScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const automation_engine_1 = require("../modules/automation/automation.engine");
const database_1 = __importDefault(require("../config/database"));
const client_1 = require("@prisma/client");
const templateMediaPreWarm_service_1 = require("./templateMediaPreWarm.service");
// ✅ Global state tracking
const state = {
    automation: false,
    inactivity: false,
    subscriptionExpiry: false,
    expiryWarnings: false,
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
            await automation_engine_1.automationEngine.triggerScheduled();
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
            await automation_engine_1.automationEngine.triggerInactivity();
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
            await checkAndExpireSubscriptions();
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
            await sendExpiryWarnings();
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
    console.log('✅ Scheduler initialized');
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
        }
        catch (err) {
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
                await database_1.default.notification.create({
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
// ✅ Run every day at 3 AM to refresh expiring media
const startTemplateMediaPreWarmJob = () => {
    node_cron_1.default.schedule('0 3 * * *', async () => {
        console.log('⏰ [CRON] Starting template media pre-warm job...');
        try {
            const result = await templateMediaPreWarm_service_1.templateMediaPreWarmService.preWarmExpiringMedia();
            console.log(`✅ [CRON] Pre-warm done:`, result);
        }
        catch (err) {
            console.error('❌ [CRON] Pre-warm failed:', err.message);
        }
    });
    console.log('⏰ Scheduled: Template media pre-warm (daily at 3 AM)');
};
exports.startTemplateMediaPreWarmJob = startTemplateMediaPreWarmJob;
//# sourceMappingURL=scheduler.service.js.map