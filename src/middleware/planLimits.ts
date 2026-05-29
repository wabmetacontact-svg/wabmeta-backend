// src/middleware/planLimits.ts - COMPLETE FIXED

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { SubscriptionStatus, PlanType } from '@prisma/client';

type LimitType =
  | 'contacts'
  | 'campaigns'
  | 'messages'
  | 'teamMembers'
  | 'templates'
  | 'chatbots'
  | 'automations';

// ============================================
// ✅ DEFAULT LIMITS (FREE_DEMO fallback)
// ============================================
const FREE_DEMO_LIMITS: Record<LimitType, number> = {
  contacts:    50,
  campaigns:   1,
  messages:    100,
  teamMembers: 1,
  templates:   2,
  chatbots:    0,
  automations: 0,
};

// ============================================
// ✅ CORE: Check subscription validity from DB
// ============================================
async function isSubscriptionActive(organizationId: string): Promise<{
  active:        boolean;
  reason:        string;
  daysRemaining: number;
  planType:      PlanType;
}> {
  const [subscription, org] = await Promise.all([
    prisma.subscription.findUnique({
      where:   { organizationId },
      include: { plan: true },
    }),
    prisma.organization.findUnique({
      where:  { id: organizationId },
      select: { planType: true },
    }),
  ]);

  // No subscription - FREE_DEMO
  if (!subscription) {
    return {
      active:        false,
      reason:        'No active subscription',
      daysRemaining: 0,
      planType:      org?.planType || PlanType.FREE_DEMO,
    };
  }

  const now             = new Date();
  const isExpired       = subscription.currentPeriodEnd < now;
  const isCancelled     = subscription.status === SubscriptionStatus.CANCELLED;
  const isExpiredStatus = subscription.status === SubscriptionStatus.EXPIRED;

  // ✅ Auto-fix: If expired but not marked in DB, fix it non-blocking
  if (isExpired && subscription.status === SubscriptionStatus.ACTIVE) {
    prisma.subscription.update({
      where: { id: subscription.id },
      data:  { status: SubscriptionStatus.EXPIRED },
    }).catch(console.error);

    prisma.organization.update({
      where: { id: organizationId },
      data:  { planType: PlanType.FREE_DEMO },
    }).catch(console.error);
  }

  const daysRemaining = isExpired
    ? 0
    : Math.ceil(
        (subscription.currentPeriodEnd.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );

  if (isExpired || isCancelled || isExpiredStatus) {
    return {
      active:        false,
      reason:        isExpired
        ? `Subscription expired on ${subscription.currentPeriodEnd.toLocaleDateString('en-IN')}`
        : 'Subscription cancelled',
      daysRemaining: 0,
      planType:      PlanType.FREE_DEMO,
    };
  }

  return {
    active:        true,
    reason:        'Active',
    daysRemaining,
    planType:      subscription.plan?.type || org?.planType || PlanType.FREE_DEMO,
  };
}

// ============================================
// ✅ MIDDLEWARE: requireActiveSubscription
// ============================================
export const requireActiveSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization not found',
      });
    }

    const { active, reason, daysRemaining, planType } =
      await isSubscriptionActive(organizationId);

    if (!active) {
      return res.status(402).json({
        success: false,
        message:  reason,
        code:     'SUBSCRIPTION_EXPIRED',
        data: {
          isExpired:       true,
          upgradeRequired: true,
          renewUrl:        '/dashboard/billing',
        },
      });
    }

    // Pass subscription info to route handlers
    (req as any).subscriptionInfo = { active, daysRemaining, planType };
    next();
  } catch (error) {
    console.error('requireActiveSubscription error:', error);
    next(); // Fail open - jab error ho tab block mat karo
  }
};

// ============================================
// ✅ MIDDLEWARE: checkPlanLimit
// ============================================
export const checkPlanLimit = (limitType: LimitType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
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
          message:  reason,
          code:     'SUBSCRIPTION_EXPIRED',
          data: { isExpired: true, upgradeRequired: true },
        });
      }

      // 2. FREE_DEMO pe limits enforce karo
      if (planType === PlanType.FREE_DEMO) {
        const limit = FREE_DEMO_LIMITS[limitType] ?? 0;

        let used = 0;
        switch (limitType) {
          case 'contacts':
            used = await prisma.contact.count({ where: { organizationId } });
            break;
          case 'campaigns':
            used = await prisma.campaign.count({ where: { organizationId } });
            break;
          case 'templates':
            used = await prisma.template.count({ where: { organizationId } });
            break;
          case 'teamMembers':
            used = await prisma.organizationMember.count({ where: { organizationId } });
            break;
          case 'chatbots':
            used = await prisma.chatbot.count({ where: { organizationId } });
            break;
          case 'automations':
            used = await prisma.automation.count({ where: { organizationId } });
            break;
          default:
            break;
        }

        if (used >= limit) {
          return res.status(402).json({
            success: false,
            message: `Free plan limit reached: ${used}/${limit} ${limitType}. Please upgrade to continue.`,
            code:    'LIMIT_EXCEEDED',
            data: {
              limitType,
              used,
              limit,
              remaining:       0,
              upgradeRequired: true,
              upgradeUrl:      '/dashboard/billing',
            },
          });
        }

        // Pass limit info to handler
        (req as any).planLimit = { type: limitType, used, limit, remaining: limit - used };
      }

      next();
    } catch (error) {
      console.error('checkPlanLimit error:', error);
      next(); // Fail open
    }
  };
};

// ============================================
// Convenience exports
// ============================================
export const checkContactLimit    = checkPlanLimit('contacts');
export const checkCampaignLimit   = checkPlanLimit('campaigns');
export const checkMessageLimit    = checkPlanLimit('messages');
export const checkTeamMemberLimit = checkPlanLimit('teamMembers');
export const checkTemplateLimit   = checkPlanLimit('templates');
export const checkChatbotLimit    = checkPlanLimit('chatbots');
export const checkAutomationLimit = checkPlanLimit('automations');