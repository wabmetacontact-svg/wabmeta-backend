"use strict";
// src/middleware/planLimits.ts - COMPLETE FIXED
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAutomationLimit = exports.checkChatbotLimit = exports.checkTemplateLimit = exports.checkTeamMemberLimit = exports.checkMessageLimit = exports.checkCampaignLimit = exports.checkContactLimit = exports.checkPlanLimit = exports.requireActiveSubscription = void 0;
const database_1 = __importDefault(require("../config/database"));
const client_1 = require("@prisma/client");
// ============================================
// ✅ DEFAULT LIMITS (FREE_DEMO fallback)
// ============================================
const FREE_DEMO_LIMITS = {
    contacts: 50,
    campaigns: 1,
    messages: 100,
    teamMembers: 1,
    templates: 2,
    chatbots: 0,
    automations: 0,
};
// ============================================
// ✅ CORE: Check subscription validity from DB
// ============================================
async function isSubscriptionActive(organizationId) {
    const [subscription, org] = await Promise.all([
        database_1.default.subscription.findUnique({
            where: { organizationId },
            include: { plan: true },
        }),
        database_1.default.organization.findUnique({
            where: { id: organizationId },
            select: { planType: true },
        }),
    ]);
    // No subscription - FREE_DEMO
    if (!subscription) {
        return {
            active: false,
            reason: 'No active subscription',
            daysRemaining: 0,
            planType: org?.planType || client_1.PlanType.FREE_DEMO,
        };
    }
    const now = new Date();
    const isExpired = subscription.currentPeriodEnd < now;
    const isCancelled = subscription.status === client_1.SubscriptionStatus.CANCELLED;
    const isExpiredStatus = subscription.status === client_1.SubscriptionStatus.EXPIRED;
    // ✅ Auto-fix: If expired but not marked in DB, fix it non-blocking
    if (isExpired && subscription.status === client_1.SubscriptionStatus.ACTIVE) {
        database_1.default.subscription.update({
            where: { id: subscription.id },
            data: { status: client_1.SubscriptionStatus.EXPIRED },
        }).catch(console.error);
        database_1.default.organization.update({
            where: { id: organizationId },
            data: { planType: client_1.PlanType.FREE_DEMO },
        }).catch(console.error);
    }
    const daysRemaining = isExpired
        ? 0
        : Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24));
    if (isExpired || isCancelled || isExpiredStatus) {
        return {
            active: false,
            reason: isExpired
                ? `Subscription expired on ${subscription.currentPeriodEnd.toLocaleDateString('en-IN')}`
                : 'Subscription cancelled',
            daysRemaining: 0,
            planType: client_1.PlanType.FREE_DEMO,
        };
    }
    return {
        active: true,
        reason: 'Active',
        daysRemaining,
        planType: subscription.plan?.type || org?.planType || client_1.PlanType.FREE_DEMO,
    };
}
// ============================================
// ✅ MIDDLEWARE: requireActiveSubscription
// ============================================
const requireActiveSubscription = async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization not found',
            });
        }
        const { active, reason, daysRemaining, planType } = await isSubscriptionActive(organizationId);
        if (!active) {
            return res.status(402).json({
                success: false,
                message: reason,
                code: 'SUBSCRIPTION_EXPIRED',
                data: {
                    isExpired: true,
                    upgradeRequired: true,
                    renewUrl: '/dashboard/billing',
                },
            });
        }
        // Pass subscription info to route handlers
        req.subscriptionInfo = { active, daysRemaining, planType };
        next();
    }
    catch (error) {
        console.error('requireActiveSubscription error:', error);
        next(); // Fail open - jab error ho tab block mat karo
    }
};
exports.requireActiveSubscription = requireActiveSubscription;
// ============================================
// ✅ MIDDLEWARE: checkPlanLimit
// ============================================
const checkPlanLimit = (limitType) => {
    return async (req, res, next) => {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return res.status(400).json({
                    success: false,
                    message: 'Organization not found',
                });
            }
            // 1. Check subscription active
            const { active, reason, planType } = await isSubscriptionActive(organizationId);
            if (!active) {
                return res.status(402).json({
                    success: false,
                    message: reason,
                    code: 'SUBSCRIPTION_EXPIRED',
                    data: { isExpired: true, upgradeRequired: true },
                });
            }
            // 2. FREE_DEMO pe limits enforce karo
            if (planType === client_1.PlanType.FREE_DEMO) {
                const limit = FREE_DEMO_LIMITS[limitType] ?? 0;
                let used = 0;
                switch (limitType) {
                    case 'contacts':
                        used = await database_1.default.contact.count({ where: { organizationId } });
                        break;
                    case 'campaigns':
                        used = await database_1.default.campaign.count({ where: { organizationId } });
                        break;
                    case 'templates':
                        used = await database_1.default.template.count({ where: { organizationId } });
                        break;
                    case 'teamMembers':
                        used = await database_1.default.organizationMember.count({ where: { organizationId } });
                        break;
                    case 'chatbots':
                        used = await database_1.default.chatbot.count({ where: { organizationId } });
                        break;
                    case 'automations':
                        used = await database_1.default.automation.count({ where: { organizationId } });
                        break;
                    default:
                        break;
                }
                if (used >= limit) {
                    return res.status(402).json({
                        success: false,
                        message: `Free plan limit reached: ${used}/${limit} ${limitType}. Please upgrade to continue.`,
                        code: 'LIMIT_EXCEEDED',
                        data: {
                            limitType,
                            used,
                            limit,
                            remaining: 0,
                            upgradeRequired: true,
                            upgradeUrl: '/dashboard/billing',
                        },
                    });
                }
                // Pass limit info to handler
                req.planLimit = { type: limitType, used, limit, remaining: limit - used };
            }
            next();
        }
        catch (error) {
            console.error('checkPlanLimit error:', error);
            next(); // Fail open
        }
    };
};
exports.checkPlanLimit = checkPlanLimit;
// ============================================
// Convenience exports
// ============================================
exports.checkContactLimit = (0, exports.checkPlanLimit)('contacts');
exports.checkCampaignLimit = (0, exports.checkPlanLimit)('campaigns');
exports.checkMessageLimit = (0, exports.checkPlanLimit)('messages');
exports.checkTeamMemberLimit = (0, exports.checkPlanLimit)('teamMembers');
exports.checkTemplateLimit = (0, exports.checkPlanLimit)('templates');
exports.checkChatbotLimit = (0, exports.checkPlanLimit)('chatbots');
exports.checkAutomationLimit = (0, exports.checkPlanLimit)('automations');
//# sourceMappingURL=planLimits.js.map