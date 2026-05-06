"use strict";
// src/modules/admin/admin.billing.service.ts - FIXED VERSION
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminBillingService = exports.AdminBillingService = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
// ============================================
// ✅ SLUG TO PLAN TYPE MAPPING (IMPORTANT!)
// ============================================
const SLUG_TO_PLAN_TYPE = {
    'free-demo': client_1.PlanType.FREE_DEMO,
    'free': client_1.PlanType.FREE_DEMO,
    'freedemo': client_1.PlanType.FREE_DEMO,
    'monthly': client_1.PlanType.MONTHLY,
    'month': client_1.PlanType.MONTHLY,
    '1-month': client_1.PlanType.MONTHLY,
    '3-month': client_1.PlanType.QUARTERLY,
    '3month': client_1.PlanType.QUARTERLY,
    'quarterly': client_1.PlanType.QUARTERLY,
    'quarter': client_1.PlanType.QUARTERLY,
    '6-month': client_1.PlanType.BIANNUAL,
    '6month': client_1.PlanType.BIANNUAL,
    'biannual': client_1.PlanType.BIANNUAL,
    'half-yearly': client_1.PlanType.BIANNUAL,
    'halfyearly': client_1.PlanType.BIANNUAL,
    '1-year': client_1.PlanType.ANNUAL,
    '1year': client_1.PlanType.ANNUAL,
    'annual': client_1.PlanType.ANNUAL,
    'yearly': client_1.PlanType.ANNUAL,
    '12-month': client_1.PlanType.ANNUAL,
    '12month': client_1.PlanType.ANNUAL,
};
class AdminBillingService {
    // ============================================
    // ✅ HELPER: Get Plan by Slug (FIXED)
    // ============================================
    async getPlanBySlugOrType(slugOrType) {
        const normalizedSlug = slugOrType.toLowerCase().trim().replace(/\s+/g, '-');
        console.log('🔍 Looking for plan:', { input: slugOrType, normalized: normalizedSlug });
        // First: Try exact slug match
        let plan = await database_1.default.plan.findFirst({
            where: {
                slug: normalizedSlug,
                isActive: true,
            },
        });
        if (plan) {
            console.log('✅ Found by slug:', plan.name);
            return plan;
        }
        // Second: Try mapped PlanType
        const mappedType = SLUG_TO_PLAN_TYPE[normalizedSlug];
        if (mappedType) {
            console.log('🔄 Mapped to PlanType:', mappedType);
            plan = await database_1.default.plan.findFirst({
                where: {
                    type: mappedType,
                    isActive: true,
                },
            });
            if (plan) {
                console.log('✅ Found by type:', plan.name);
                return plan;
            }
        }
        // Third: Try if it's already a valid PlanType enum
        const upperType = normalizedSlug.toUpperCase().replace(/-/g, '_');
        const validPlanTypes = Object.values(client_1.PlanType);
        if (validPlanTypes.includes(upperType)) {
            plan = await database_1.default.plan.findFirst({
                where: {
                    type: upperType,
                    isActive: true,
                },
            });
            if (plan) {
                console.log('✅ Found by direct enum:', plan.name);
                return plan;
            }
        }
        console.log('❌ Plan not found for:', slugOrType);
        return null;
    }
    // ============================================
    // ✅ ASSIGN PLAN TO ORGANIZATION (FIXED)
    // ============================================
    async assignPlanToOrganization(params) {
        const { organizationId, planSlug, validityDays, customEndDate, adminId, adminName, reason } = params;
        console.log('\n🔧 ========== ADMIN PLAN ASSIGNMENT ==========');
        console.log('   Organization ID:', organizationId);
        console.log('   Plan Slug:', planSlug);
        console.log('   Validity Days:', validityDays);
        console.log('   Custom End Date:', customEndDate);
        console.log('   Admin:', adminName);
        // Verify organization exists
        const organization = await database_1.default.organization.findUnique({
            where: { id: organizationId },
            include: { owner: true },
        });
        if (!organization) {
            throw new errorHandler_1.AppError('Organization not found', 404);
        }
        console.log('✅ Organization found:', organization.name);
        // ✅ USE FIXED METHOD - Find plan
        const plan = await this.getPlanBySlugOrType(planSlug);
        if (!plan) {
            // List available plans for debugging
            const availablePlans = await database_1.default.plan.findMany({
                where: { isActive: true },
                select: { slug: true, type: true, name: true },
            });
            console.log('📋 Available plans:', availablePlans);
            throw new errorHandler_1.AppError(`Plan '${planSlug}' not found. Available: ${availablePlans.map(p => p.slug).join(', ')}`, 404);
        }
        console.log('✅ Plan found:', plan.name, '(', plan.type, ')');
        // Calculate dates
        const now = new Date();
        let periodEnd;
        if (customEndDate) {
            periodEnd = new Date(customEndDate);
            console.log('📅 Using custom end date:', periodEnd);
        }
        else if (validityDays) {
            periodEnd = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
            console.log('📅 Using custom validity days:', validityDays);
        }
        else {
            const defaultValidity = plan.validityDays || 30;
            periodEnd = new Date(now.getTime() + defaultValidity * 24 * 60 * 60 * 1000);
            console.log('📅 Using default validity:', defaultValidity);
        }
        // Get existing subscription for logging
        const existingSubscription = await database_1.default.subscription.findUnique({
            where: { organizationId },
            include: { plan: true },
        });
        // Create/Update subscription
        const subscription = await database_1.default.subscription.upsert({
            where: { organizationId },
            create: {
                organizationId,
                planId: plan.id,
                status: client_1.SubscriptionStatus.ACTIVE,
                billingCycle: 'manual',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                paymentMethod: 'admin_assigned',
                lastPaymentAt: now,
                messagesUsed: 0,
                contactsUsed: 0,
            },
            update: {
                planId: plan.id,
                status: client_1.SubscriptionStatus.ACTIVE,
                billingCycle: 'manual',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                paymentMethod: 'admin_assigned',
                lastPaymentAt: now,
                cancelledAt: null,
            },
            include: { plan: true },
        });
        console.log('✅ Subscription created/updated:', subscription.id);
        // Update organization plan type
        await database_1.default.organization.update({
            where: { id: organizationId },
            data: { planType: plan.type },
        });
        console.log('✅ Organization planType updated to:', plan.type);
        // Create activity log
        await database_1.default.activityLog.create({
            data: {
                organizationId,
                action: 'UPDATE',
                entity: 'subscription',
                entityId: subscription.id,
                metadata: {
                    action: 'admin_plan_assignment',
                    adminId,
                    adminName,
                    previousPlan: existingSubscription?.plan?.name || 'None',
                    newPlan: plan.name,
                    planType: plan.type,
                    validityDays: validityDays || plan.validityDays || 30,
                    periodStart: now.toISOString(),
                    periodEnd: periodEnd.toISOString(),
                    reason: reason || 'Manual assignment by admin',
                    assignedBy: adminName,
                    assignedAt: now.toISOString(),
                },
            },
        });
        console.log('✅ Activity log created');
        console.log('🔧 ========== ASSIGNMENT COMPLETE ==========\n');
        return {
            subscription,
            plan,
            organization: {
                id: organization.id,
                name: organization.name,
                ownerEmail: organization.owner.email,
            },
            validFrom: now,
            validUntil: periodEnd,
            message: `${plan.name} assigned to ${organization.name} until ${periodEnd.toLocaleDateString('en-IN')}`,
        };
    }
    // ============================================
    // EXTEND SUBSCRIPTION
    // ============================================
    async extendSubscription(params) {
        const { organizationId, additionalDays, adminId, adminName, reason } = params;
        console.log('🔧 Admin extending subscription:', {
            organizationId,
            additionalDays,
            adminId,
        });
        const subscription = await database_1.default.subscription.findUnique({
            where: { organizationId },
            include: { plan: true, organization: true },
        });
        if (!subscription) {
            throw new errorHandler_1.AppError('No active subscription found', 404);
        }
        const now = new Date();
        const currentEnd = new Date(subscription.currentPeriodEnd);
        const extendFrom = currentEnd > now ? currentEnd : now;
        const newEndDate = new Date(extendFrom.getTime() + additionalDays * 24 * 60 * 60 * 1000);
        const updated = await database_1.default.subscription.update({
            where: { organizationId },
            data: {
                currentPeriodEnd: newEndDate,
                status: client_1.SubscriptionStatus.ACTIVE,
                cancelledAt: null,
            },
            include: { plan: true, organization: true },
        });
        // Log activity
        await database_1.default.activityLog.create({
            data: {
                organizationId,
                action: 'UPDATE',
                entity: 'subscription',
                entityId: subscription.id,
                metadata: {
                    action: 'admin_subscription_extension',
                    adminId,
                    adminName,
                    additionalDays,
                    previousEndDate: currentEnd.toISOString(),
                    newEndDate: newEndDate.toISOString(),
                    reason: reason || 'Subscription extended by admin',
                    extendedBy: adminName,
                    extendedAt: now.toISOString(),
                },
            },
        });
        console.log('✅ Subscription extended:', {
            organization: updated.organization.name,
            newEndDate,
        });
        return {
            subscription: updated,
            previousEndDate: currentEnd,
            newEndDate,
            daysAdded: additionalDays,
            message: `Subscription extended by ${additionalDays} days until ${newEndDate.toLocaleDateString('en-IN')}`,
        };
    }
    // ============================================
    // REVOKE SUBSCRIPTION
    // ============================================
    async revokeSubscription(params) {
        const { organizationId, adminId, adminName, reason, immediate = false } = params;
        console.log('🔧 Admin revoking subscription:', {
            organizationId,
            immediate,
            adminId,
        });
        const subscription = await database_1.default.subscription.findUnique({
            where: { organizationId },
            include: { plan: true, organization: true },
        });
        if (!subscription) {
            throw new errorHandler_1.AppError('No subscription found', 404);
        }
        const now = new Date();
        const updateData = {
            status: client_1.SubscriptionStatus.CANCELLED,
            cancelledAt: now,
        };
        if (immediate) {
            updateData.currentPeriodEnd = now;
        }
        const updated = await database_1.default.subscription.update({
            where: { organizationId },
            data: updateData,
            include: { plan: true, organization: true },
        });
        // Downgrade to free plan
        await database_1.default.organization.update({
            where: { id: organizationId },
            data: { planType: client_1.PlanType.FREE_DEMO },
        });
        // Log activity
        await database_1.default.activityLog.create({
            data: {
                organizationId,
                action: 'UPDATE',
                entity: 'subscription',
                entityId: subscription.id,
                metadata: {
                    action: 'admin_subscription_revocation',
                    adminId,
                    adminName,
                    previousPlan: subscription.plan.name,
                    immediate,
                    reason: reason || 'Subscription revoked by admin',
                    revokedBy: adminName,
                    revokedAt: now.toISOString(),
                },
            },
        });
        console.log('✅ Subscription revoked:', {
            organization: updated.organization.name,
            immediate,
        });
        return {
            subscription: updated,
            message: immediate
                ? 'Subscription revoked immediately'
                : 'Subscription will expire at the end of current period',
        };
    }
    // ============================================
    // GET ALL SUBSCRIPTIONS
    // ============================================
    async getAllSubscriptions(params) {
        const { page = 1, limit = 20, status, planType, excludePlanType, search } = params;
        const skip = (page - 1) * limit;
        const where = {};
        if (status) {
            where.status = status;
        }
        if (planType) {
            where.plan = { type: planType };
        }
        else if (excludePlanType) {
            where.plan = {
                type: { not: excludePlanType }
            };
        }
        if (search) {
            where.organization = {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { owner: { email: { contains: search, mode: 'insensitive' } } },
                ],
            };
        }
        const [subscriptions, total] = await Promise.all([
            database_1.default.subscription.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    plan: true,
                    organization: {
                        include: {
                            owner: {
                                select: {
                                    email: true,
                                    firstName: true,
                                    lastName: true,
                                },
                            },
                        },
                    },
                },
            }),
            database_1.default.subscription.count({ where }),
        ]);
        const subscriptionsWithStats = subscriptions.map((sub) => {
            const now = new Date();
            const daysRemaining = Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            const isExpired = sub.currentPeriodEnd < now;
            return {
                ...sub,
                daysRemaining,
                isExpired,
                isManual: sub.paymentMethod === 'admin_assigned',
            };
        });
        return {
            subscriptions: subscriptionsWithStats,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    // ============================================
    // GET SUBSCRIPTION STATS
    // ============================================
    async getSubscriptionStats() {
        const [totalSubscriptions, activeSubscriptions, expiredSubscriptions, cancelledSubscriptions, planBreakdown,] = await Promise.all([
            database_1.default.subscription.count(),
            database_1.default.subscription.count({
                where: { status: client_1.SubscriptionStatus.ACTIVE },
            }),
            database_1.default.subscription.count({
                where: { status: client_1.SubscriptionStatus.EXPIRED },
            }),
            database_1.default.subscription.count({
                where: { status: client_1.SubscriptionStatus.CANCELLED },
            }),
            database_1.default.subscription.groupBy({
                by: ['planId'],
                _count: true,
            }),
        ]);
        // Get plans for breakdown
        const plans = await database_1.default.plan.findMany({
            where: {
                id: { in: planBreakdown.map((pb) => pb.planId) },
            },
        });
        const planStats = planBreakdown.map((pb) => {
            const plan = plans.find((p) => p.id === pb.planId);
            return {
                planName: plan?.name || 'Unknown',
                planType: plan?.type || 'UNKNOWN',
                count: pb._count,
            };
        });
        // Get recent activity
        const recentActivity = await database_1.default.activityLog.findMany({
            where: {
                entity: 'subscription',
                action: 'UPDATE',
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
                organization: {
                    select: { name: true },
                },
            },
        });
        return {
            total: totalSubscriptions,
            active: activeSubscriptions,
            expired: expiredSubscriptions,
            cancelled: cancelledSubscriptions,
            planBreakdown: planStats,
            recentActivity,
        };
    }
}
exports.AdminBillingService = AdminBillingService;
exports.adminBillingService = new AdminBillingService();
exports.default = exports.adminBillingService;
//# sourceMappingURL=admin.billing.service.js.map