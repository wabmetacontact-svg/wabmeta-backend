// src/modules/billing/billing.service.ts - COMPLETE FIXED VERSION

import { PrismaClient, PlanType, SubscriptionStatus } from '@prisma/client';
import crypto from 'crypto';
import prisma from '../../config/database';

// ============================================
// RAZORPAY INITIALIZATION
// ============================================

let razorpay: any = null;

const getRazorpayInstance = () => {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.warn('⚠️ Razorpay credentials not configured');
      return null;
    }

    try {
      const Razorpay = require('razorpay');
      razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret
      });
      console.log('✅ Razorpay initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Razorpay:', error);
      return null;
    }
  }
  return razorpay;
};

// ============================================
// ✅ SLUG TO PLAN TYPE MAPPING
// ============================================

const SLUG_TO_PLAN_TYPE: Record<string, PlanType> = {
  'free-demo': PlanType.FREE_DEMO,
  'free': PlanType.FREE_DEMO,
  'monthly': PlanType.MONTHLY,
  '3-month': PlanType.QUARTERLY,
  'quarterly': PlanType.QUARTERLY,
  '6-month': PlanType.BIANNUAL,
  'biannual': PlanType.BIANNUAL,
  '1-year': PlanType.ANNUAL,
  'annual': PlanType.ANNUAL,
  'yearly': PlanType.ANNUAL,
};

// ============================================
// ✅ PLAN LIMITS (Default values)
// ============================================

const DEFAULT_PLAN_LIMITS = {
  FREE_DEMO: {
    maxContacts: 1000,
    maxMessages: 100,
    maxCampaigns: 1,
    maxCampaignsPerMonth: 1,
    maxTeamMembers: 1,
    maxWhatsAppAccounts: 1,
    maxTemplates: 2,
    maxChatbots: 0,
    maxAutomations: 0,
    validityDays: 2,
  },
  MONTHLY: {
    maxContacts: 999999,
    maxMessages: 999999,
    maxCampaigns: 999999,
    maxCampaignsPerMonth: 999999,
    maxTeamMembers: 3,
    maxWhatsAppAccounts: 1,
    maxTemplates: 999999,
    maxChatbots: 2,
    maxAutomations: 0,
    validityDays: 30,
  },
  QUARTERLY: {
    maxContacts: 999999,
    maxMessages: 999999,
    maxCampaigns: 999999,
    maxCampaignsPerMonth: 999999,
    maxTeamMembers: 5,
    maxWhatsAppAccounts: 1,
    maxTemplates: 999999,
    maxChatbots: 5,
    maxAutomations: 10,
    validityDays: 90,
  },
  BIANNUAL: {
    maxContacts: 999999,
    maxMessages: 999999,
    maxCampaigns: 999999,
    maxCampaignsPerMonth: 999999,
    maxTeamMembers: 10,
    maxWhatsAppAccounts: 1,
    maxTemplates: 999999,
    maxChatbots: 10,
    maxAutomations: 50,
    validityDays: 180,
  },
  ANNUAL: {
    maxContacts: 999999,
    maxMessages: 999999,
    maxCampaigns: 999999,
    maxCampaignsPerMonth: 999999,
    maxTeamMembers: 999999,
    maxWhatsAppAccounts: 2,
    maxTemplates: 999999,
    maxChatbots: 999999,
    maxAutomations: 999999,
    validityDays: 365,
  },
};

class BillingService {
  // ============================================
  // ✅ GET PLAN BY SLUG (Fixed)
  // ============================================

  private async getPlanBySlug(slugOrType: string) {
    const normalizedSlug = slugOrType.toLowerCase().trim();

    // First try by slug
    let plan = await prisma.plan.findFirst({
      where: {
        slug: normalizedSlug,
        isActive: true,
      },
    });

    if (plan) return plan;

    // Try by mapped type
    const mappedType = SLUG_TO_PLAN_TYPE[normalizedSlug];
    if (mappedType) {
      plan = await prisma.plan.findFirst({
        where: {
          type: mappedType,
          isActive: true,
        },
      });
    }

    return plan;
  }

  // ============================================
  // ✅ CHECK PLAN LIMITS
  // ============================================

  async checkPlanLimit(
    organizationId: string,
    limitType: 'contacts' | 'campaigns' | 'messages' | 'teamMembers' | 'templates' | 'chatbots' | 'automations'
  ): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
    message?: string;
  }> {
    try {
      // Get subscription with plan
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
        include: { plan: true },
      });

      // Get organization's plan type
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { planType: true },
      });

      const planType = subscription?.plan?.type || org?.planType || 'FREE_DEMO';
      const planLimits = DEFAULT_PLAN_LIMITS[planType as keyof typeof DEFAULT_PLAN_LIMITS] || DEFAULT_PLAN_LIMITS.FREE_DEMO;

      let used = 0;
      let limit = 0;

      switch (limitType) {
        case 'contacts':
          used = await prisma.contact.count({ where: { organizationId } });
          limit = subscription?.plan?.maxContacts || planLimits.maxContacts;
          break;

        case 'campaigns':
          // Count campaigns this month
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          used = await prisma.campaign.count({
            where: {
              organizationId,
              createdAt: { gte: startOfMonth },
            },
          });
          limit = subscription?.plan?.maxCampaignsPerMonth || planLimits.maxCampaignsPerMonth;
          break;

        case 'messages':
          // Count messages this month
          const msgStartOfMonth = new Date();
          msgStartOfMonth.setDate(1);
          msgStartOfMonth.setHours(0, 0, 0, 0);

          used = await prisma.message.count({
            where: {
              conversation: { organizationId },
              direction: 'OUTBOUND',
              createdAt: { gte: msgStartOfMonth },
            },
          });
          limit = subscription?.plan?.maxMessagesPerMonth || planLimits.maxMessages;
          break;

        case 'teamMembers':
          used = await prisma.organizationMember.count({ where: { organizationId } });
          limit = subscription?.plan?.maxTeamMembers || planLimits.maxTeamMembers;
          break;

        case 'templates':
          used = await prisma.template.count({ where: { organizationId } });
          limit = subscription?.plan?.maxTemplates || planLimits.maxTemplates;
          break;

        case 'chatbots':
          used = await prisma.chatbot.count({ where: { organizationId } });
          limit = subscription?.plan?.maxChatbots || planLimits.maxChatbots;
          break;

        case 'automations':
          used = await prisma.automation.count({ where: { organizationId } });
          limit = subscription?.plan?.maxAutomations || planLimits.maxAutomations;
          break;
      }

      // Check if limit is unlimited (-1 or 999999)
      const isUnlimited = limit === -1 || limit >= 999999;
      const remaining = isUnlimited ? 999999 : Math.max(0, limit - used);
      const allowed = isUnlimited || used < limit;

      return {
        allowed,
        used,
        limit: isUnlimited ? -1 : limit,
        remaining,
        message: allowed
          ? undefined
          : `You've reached your ${limitType} limit (${used}/${limit}). Please upgrade your plan to continue.`,
      };
    } catch (error) {
      console.error('Check plan limit error:', error);
      // Allow on error to not block users
      return {
        allowed: true,
        used: 0,
        limit: 999999,
        remaining: 999999,
      };
    }
  }

  // ============================================
  // ✅ CHECK SUBSCRIPTION VALIDITY
  // ============================================

  async checkSubscriptionValidity(organizationId: string): Promise<{
    isValid: boolean;
    isExpired: boolean;
    daysRemaining: number;
    expiresAt?: Date;
    planName?: string;
    message?: string;
  }> {
    try {
      let subscription = await prisma.subscription.findUnique({
        where: { organizationId },
        include: { plan: true },
      });

      // ✅ SELF-HEALING: If no subscription found, assign FREE_DEMO automatically
      if (!subscription) {
        console.log(`🔍 No subscription found for Org ${organizationId}. Assigning FREE_DEMO...`);
        const freePlan = await prisma.plan.findUnique({ where: { type: 'FREE_DEMO' } });

        if (freePlan) {
          subscription = await prisma.subscription.create({
            data: {
              organizationId,
              planId: freePlan.id,
              status: SubscriptionStatus.ACTIVE,
              billingCycle: 'monthly',
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
            },
            include: { plan: true }
          });
          console.log(`✅ Assigned FREE_DEMO to Org ${organizationId}`);
        } else {
          return {
            isValid: false,
            isExpired: true,
            daysRemaining: 0,
            message: 'No active subscription found and default plan not available. Please contact support.',
          };
        }
      }

      const now = new Date();
      const expiresAt = new Date(subscription.currentPeriodEnd);
      const isExpired = expiresAt < now;
      const daysRemaining = isExpired
        ? 0
        : Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (isExpired) {
        // Update status to EXPIRED
        await prisma.subscription.update({
          where: { organizationId },
          data: { status: SubscriptionStatus.EXPIRED },
        });
      }

      return {
        isValid: !isExpired && subscription.status === SubscriptionStatus.ACTIVE,
        isExpired,
        daysRemaining,
        expiresAt,
        planName: subscription.plan?.name,
        message: isExpired
          ? 'Your subscription has expired. Please renew to continue using all features.'
          : daysRemaining <= 7
            ? `Your subscription expires in ${daysRemaining} days. Consider renewing soon.`
            : undefined,
      };
    } catch (error) {
      console.error('Check subscription validity error:', error);
      return {
        isValid: false,
        isExpired: true,
        daysRemaining: 0,
        message: 'Error checking subscription status',
      };
    }
  }

  // ============================================
  // ✅ CHECK WALLET ELIGIBILITY
  // ============================================

  async checkWalletEligibility(organizationId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      return { eligible: false, reason: 'No active subscription' };
    }

    if (subscription.plan?.type === 'FREE_DEMO') {
      return {
        eligible: false,
        reason: 'Wallet feature is not available on the Free plan. Please upgrade to a Monthly, Quarterly, or Annual plan to enable it.',
      };
    }

    return { eligible: true };
  }

  // ============================================
  // GET SUBSCRIPTION
  // ============================================

  async getSubscription(organizationId: string) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
        include: { plan: true }
      });

      if (!subscription) {
        // Return default free plan info
        return {
          plan: {
            id: 'free-demo',
            name: 'Free Demo',
            type: 'FREE_DEMO',
            slug: 'free-demo',
            monthlyPrice: 0,
            yearlyPrice: 0,
            ...DEFAULT_PLAN_LIMITS.FREE_DEMO,
          },
          status: 'active',
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
          messagesUsed: 0,
          contactsUsed: 0
        };
      }

      return {
        ...subscription,
        plan: subscription.plan || undefined
      };
    } catch (error) {
      console.error('Get subscription error:', error);
      throw error;
    }
  }

  // ============================================
  // GET PLANS
  // ============================================

  async getPlans() {
    try {
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { monthlyPrice: 'asc' }
      });

      if (plans.length === 0) {
        return this.getDefaultPlans();
      }

      return plans.map(plan => ({
        ...plan,
        popular: plan.isRecommended || plan.type === 'BIANNUAL',
        monthlyPrice: Number(plan.monthlyPrice) || 0,
        yearlyPrice: Number(plan.yearlyPrice) || 0,
        features: Array.isArray(plan.features) ? plan.features : []
      }));
    } catch (error) {
      console.error('Get plans error:', error);
      return this.getDefaultPlans();
    }
  }

  // ============================================
  // DEFAULT PLANS
  // ============================================

  private getDefaultPlans() {
    return [
      {
        id: 'free-demo',
        name: 'Free Demo',
        type: 'FREE_DEMO',
        slug: 'free-demo',
        monthlyPrice: 0,
        yearlyPrice: 0,
        ...DEFAULT_PLAN_LIMITS.FREE_DEMO,
        features: ['100 Messages', 'Limited Campaigns', '1,000 Contacts', '2-Day Trial'],
        isActive: true,
        isRecommended: false,
        popular: false,
      },
      {
        id: 'monthly',
        name: 'Monthly Plan',
        type: 'MONTHLY',
        slug: 'monthly',
        monthlyPrice: 899,
        yearlyPrice: 899,
        ...DEFAULT_PLAN_LIMITS.MONTHLY,
        features: [
          'Unlimited* messages',
          'Unlimited campaigns',
          'Unlimited contacts',
          'Webhooks',
          'Flow Builder',
          'Standard support',
        ],
        isActive: true,
        isRecommended: false,
        popular: false,
      },
      {
        id: '3-month',
        name: '3-Month Plan',
        type: 'QUARTERLY',
        slug: '3-month',
        monthlyPrice: 2500,
        yearlyPrice: 2500,
        ...DEFAULT_PLAN_LIMITS.QUARTERLY,
        features: [
          'Unlimited* messages',
          'Unlimited campaigns',
          'Unlimited contacts',
          'Basic automation',
          'Webhooks',
          'Flow Builder',
          'Standard support',
        ],
        isActive: true,
        isRecommended: false,
        popular: false,
      },
      {
        id: '6-month',
        name: '6-Month Plan ⭐',
        type: 'BIANNUAL',
        slug: '6-month',
        monthlyPrice: 5000,
        yearlyPrice: 5000,
        ...DEFAULT_PLAN_LIMITS.BIANNUAL,
        features: [
          'Unlimited* messages',
          'Unlimited campaigns',
          'Unlimited contacts',
          'Advanced automation',
          'Campaign retry ✅',
          'Webhooks',
          'Flow Builder',
          'Mobile + API same number ✅',
          'High number safety',
          'Priority support',
        ],
        isActive: true,
        isRecommended: true,
        popular: true,
      },
      {
        id: '1-year',
        name: '1-Year Plan ⭐',
        type: 'ANNUAL',
        slug: '1-year',
        monthlyPrice: 8999,
        yearlyPrice: 8999,
        ...DEFAULT_PLAN_LIMITS.ANNUAL,
        features: [
          'Unlimited* messages',
          'Unlimited campaigns',
          'Unlimited contacts',
          'Full automation',
          'Campaign retry ✅',
          'Webhooks',
          'Flow Builder',
          'Mobile + API same number ✅',
          'Maximum number safety',
          'Priority support',
          '2 WhatsApp accounts',
        ],
        isActive: true,
        isRecommended: true,
        popular: true,
      },
    ];
  }

  // ============================================
  // GET USAGE
  // ============================================

  async getUsage(organizationId: string) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
        include: { plan: true }
      });

      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { planType: true },
      });

      const now = new Date();
      const periodStart = subscription?.currentPeriodStart ||
        new Date(now.getFullYear(), now.getMonth(), 1);

      const planType = subscription?.plan?.type || org?.planType || 'FREE_DEMO';
      const planLimits = DEFAULT_PLAN_LIMITS[planType as keyof typeof DEFAULT_PLAN_LIMITS] || DEFAULT_PLAN_LIMITS.FREE_DEMO;

      const [contactCount, messageCount, campaignCount] = await Promise.all([
        prisma.contact.count({ where: { organizationId } }).catch(() => 0),
        prisma.message.count({
          where: {
            conversation: { organizationId },
            direction: 'OUTBOUND',
            createdAt: { gte: periodStart }
          }
        }).catch(() => 0),
        prisma.campaign.count({
          where: {
            organizationId,
            createdAt: { gte: periodStart }
          }
        }).catch(() => 0)
      ]);

      const maxContacts = subscription?.plan?.maxContacts || planLimits.maxContacts;
      const maxMessages = subscription?.plan?.maxMessagesPerMonth || planLimits.maxMessages;
      const maxCampaigns = subscription?.plan?.maxCampaignsPerMonth || planLimits.maxCampaignsPerMonth;

      const calcPercentage = (used: number, limit: number): number => {
        if (limit === -1 || limit >= 999999) return 0;
        if (limit === 0) return 100;
        return Math.min(Math.round((used / limit) * 100), 100);
      };

      return {
        messages: {
          used: messageCount,
          limit: maxMessages >= 999999 ? -1 : maxMessages,
          percentage: calcPercentage(messageCount, maxMessages)
        },
        contacts: {
          used: contactCount,
          limit: maxContacts >= 999999 ? -1 : maxContacts,
          percentage: calcPercentage(contactCount, maxContacts)
        },
        campaigns: {
          used: campaignCount,
          limit: maxCampaigns >= 999999 ? -1 : maxCampaigns,
          percentage: calcPercentage(campaignCount, maxCampaigns)
        },
        storage: {
          used: 0,
          limit: 1000,
          percentage: 0
        }
      };
    } catch (error) {
      console.error('Get usage error:', error);
      return {
        messages: { used: 0, limit: 100, percentage: 0 },
        contacts: { used: 0, limit: 50, percentage: 0 },
        campaigns: { used: 0, limit: 1, percentage: 0 },
        storage: { used: 0, limit: 100, percentage: 0 }
      };
    }
  }

  // ============================================
  // ✅ CREATE RAZORPAY ORDER (FIXED)
  // ============================================

  async createRazorpayOrder(params: {
    organizationId: string;
    userId: string;
    planKey: string;
    billingCycle: 'monthly' | 'yearly';
  }) {
    const { organizationId, userId, planKey, billingCycle } = params;

    console.log('Creating Razorpay order:', { organizationId, planKey, billingCycle });

    const rzp = getRazorpayInstance();
    if (!rzp) {
      throw new Error('Payment gateway not configured. Please contact support.');
    }

    // ✅ USE FIXED METHOD
    let plan = await this.getPlanBySlug(planKey);

    // If not in DB, create from defaults
    if (!plan) {
      console.log(`Plan '${planKey}' not found in DB, checking defaults...`);

      const defaultPlans = this.getDefaultPlans();
      const defaultPlan = defaultPlans.find(
        p => p.slug === planKey.toLowerCase() ||
          p.id === planKey.toLowerCase()
      );

      if (!defaultPlan) {
        throw new Error(`Plan '${planKey}' not found`);
      }

      // Get correct PlanType from mapping
      const planType = SLUG_TO_PLAN_TYPE[planKey.toLowerCase()];
      if (!planType) {
        throw new Error(`Invalid plan type for '${planKey}'`);
      }

      try {
        plan = await prisma.plan.create({
          data: {
            name: defaultPlan.name,
            type: planType,
            slug: defaultPlan.slug,
            description: `${defaultPlan.name} - ${defaultPlan.validityDays} days validity`,
            monthlyPrice: defaultPlan.monthlyPrice,
            yearlyPrice: defaultPlan.yearlyPrice,
            maxContacts: defaultPlan.maxContacts,
            maxMessages: defaultPlan.maxMessages,
            maxTeamMembers: defaultPlan.maxTeamMembers,
            maxCampaigns: defaultPlan.maxCampaigns,
            maxChatbots: defaultPlan.maxChatbots,
            maxTemplates: defaultPlan.maxTemplates,
            maxWhatsAppAccounts: defaultPlan.maxWhatsAppAccounts,
            maxMessagesPerMonth: defaultPlan.maxMessages,
            maxCampaignsPerMonth: defaultPlan.maxCampaignsPerMonth,
            maxAutomations: defaultPlan.maxAutomations,
            maxApiCalls: 10000,
            validityDays: defaultPlan.validityDays,
            features: defaultPlan.features,
            isActive: true,
            isRecommended: defaultPlan.isRecommended || false,
          }
        });
        console.log('✅ Created plan in database:', plan.name);
      } catch (createError: any) {
        // If plan already exists (race condition), fetch it
        if (createError.code === 'P2002') {
          plan = await this.getPlanBySlug(planKey);
        } else {
          console.error('Failed to create plan:', createError);
          throw new Error('Failed to initialize plan. Please try again.');
        }
      }
    }

    if (!plan) {
      throw new Error(`Plan '${planKey}' could not be found or created`);
    }

    const price = Number(plan.monthlyPrice) || 0;

    console.log('Plan details:', {
      planName: plan.name,
      price,
      planId: plan.id,
      type: plan.type,
    });

    if (price <= 0) {
      throw new Error('Cannot create order for free plan');
    }

    try {
      const timestamp = Date.now().toString().slice(-8);
      const orgShort = organizationId.replace(/[^a-zA-Z0-9]/g, '').slice(-6);
      const receipt = `wm_${orgShort}_${timestamp}`;

      const orderOptions = {
        amount: Math.round(price * 100),
        currency: 'INR',
        receipt: receipt,
        payment_capture: 1,
        notes: {
          organizationId,
          userId,
          planId: plan.id,
          planType: plan.type,
          planSlug: plan.slug,
          billingCycle,
          planName: plan.name,
          validityDays: plan.validityDays || 30,
        }
      };

      console.log('Creating order:', {
        amount: `₹${price}`,
        planName: plan.name,
      });

      const order = await rzp.orders.create(orderOptions);

      console.log('✅ Razorpay order created:', order.id);

      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        planId: plan.id,
        planName: plan.name,
        validityDays: plan.validityDays || 30,
        receipt: order.receipt
      };

    } catch (razorpayError: any) {
      console.error('❌ Razorpay order creation failed:', razorpayError);

      let errorMessage = 'Failed to create payment order';
      if (razorpayError.error?.description) {
        errorMessage = razorpayError.error.description;
      }

      throw new Error(errorMessage);
    }
  }

  // ============================================
  // ✅ VERIFY RAZORPAY PAYMENT (FIXED)
  // ============================================

  async verifyRazorpayPayment(params: {
    organizationId: string;
    userId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const {
      organizationId,
      userId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = params;

    console.log('Verifying payment:', { orderId: razorpay_order_id, paymentId: razorpay_payment_id });

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new Error('Payment verification failed: Gateway not configured');
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      throw new Error('Payment verification failed: Invalid signature');
    }

    console.log('✅ Signature verified');

    const rzp = getRazorpayInstance();
    if (!rzp) {
      throw new Error('Payment gateway not available');
    }

    try {
      const order = await rzp.orders.fetch(razorpay_order_id);
      const notes = order.notes || {};

      console.log('Order notes:', notes);

      const plan = await prisma.plan.findUnique({
        where: { id: notes.planId }
      });

      if (!plan) {
        throw new Error('Plan not found for this payment');
      }

      // Calculate subscription period based on validityDays
      const now = new Date();
      const validityDays = plan.validityDays || notes.validityDays || 30;
      const periodEnd = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

      console.log('Creating subscription:', {
        planId: plan.id,
        validityDays,
        periodEnd,
      });

      // Update or create subscription
      const subscription = await prisma.subscription.upsert({
        where: { organizationId },
        create: {
          organizationId,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          billingCycle: notes.billingCycle || 'monthly',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          paymentMethod: 'razorpay',
          lastPaymentAt: now,
          messagesUsed: 0,
          contactsUsed: 0
        },
        update: {
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          billingCycle: notes.billingCycle || 'monthly',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          paymentMethod: 'razorpay',
          lastPaymentAt: now,
          cancelledAt: null
        }
      });

      // Update organization plan type
      await prisma.organization.update({
        where: { id: organizationId },
        data: { planType: plan.type }
      });

      // ✅ Create Payment record for revenue tracking
      await prisma.payment.create({
        data: {
          organizationId,
          subscriptionId: subscription.id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          amount: Number(order.amount) || Math.round(Number(plan.monthlyPrice) * 100), // Amount in paise
          currency: 'INR',
          status: 'SUCCESS',
          planId: plan.id,
          planName: plan.name,
          billingCycle: notes.billingCycle || 'monthly',
          description: `${plan.name} subscription`,
          receipt: order.receipt || `wm_${organizationId.slice(-6)}_${Date.now().toString().slice(-8)}`,
          paidAt: now,
        },
      });

      console.log('✅ Subscription activated:', {
        subscriptionId: subscription.id,
        planName: plan.name,
        validUntil: periodEnd,
        paymentRecorded: true,
      });

      return {
        subscription,
        plan,
        validUntil: periodEnd,
        message: `Subscription activated! Valid until ${periodEnd.toLocaleDateString('en-IN')}`
      };

    } catch (error: any) {
      console.error('❌ Payment verification error:', error);
      throw new Error(error.message || 'Payment verification failed');
    }
  }

  // ============================================
  // UPGRADE PLAN
  // ============================================

  async upgradePlan(params: {
    organizationId: string;
    planType: string;
    billingCycle?: string;
  }) {
    const { organizationId, planType, billingCycle = 'monthly' } = params;

    const plan = await this.getPlanBySlug(planType);

    if (!plan) {
      throw new Error('Plan not found');
    }

    const price = Number(plan.monthlyPrice);

    if (price > 0) {
      throw new Error('Please use Razorpay checkout for paid plans');
    }

    const now = new Date();
    const validityDays = plan.validityDays || 30;
    const periodEnd = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const subscription = await prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    await prisma.organization.update({
      where: { id: organizationId },
      data: { planType: plan.type },
    });

    return subscription;
  }

  // ============================================
  // CANCEL SUBSCRIPTION
  // ============================================

  async cancelSubscription(organizationId: string, reason?: string) {
    const existingSubscription = await prisma.subscription.findUnique({
      where: { organizationId }
    });

    if (!existingSubscription) {
      throw new Error('No active subscription found');
    }

    if (existingSubscription.status === SubscriptionStatus.CANCELLED) {
      throw new Error('Subscription is already cancelled');
    }

    const subscription = await prisma.subscription.update({
      where: { organizationId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      }
    });

    console.log('Subscription cancelled:', { organizationId, reason });

    return {
      message: 'Subscription cancelled. You will have access until the end of your billing period.',
      subscription
    };
  }

  // ============================================
  // RESUME SUBSCRIPTION
  // ============================================

  async resumeSubscription(organizationId: string) {
    const subscription = await prisma.subscription.update({
      where: { organizationId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        cancelledAt: null,
      },
    });
    return subscription;
  }

  // ============================================
  // GET INVOICES
  // ============================================

  async getInvoices(organizationId: string, limit: number = 10, offset: number = 0): Promise<any[]> {
    // TODO: Integrate with Razorpay invoices
    return [];
  }

  async getInvoice(invoiceId: string, organizationId: string): Promise<any> {
    throw new Error('Invoice not found');
  }

  async generateInvoicePDF(invoiceId: string, organizationId: string): Promise<Buffer> {
    throw new Error('Invoice PDF generation not implemented');
  }

  // ============================================
  // CHECK SUBSCRIPTION STATUS
  // ============================================

  async checkSubscriptionStatus(organizationId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true }
    });

    if (!subscription) {
      return { isActive: false, message: 'No subscription found' };
    }

    const now = new Date();
    const isExpired = subscription.currentPeriodEnd < now;
    const isCancelled = subscription.status === SubscriptionStatus.CANCELLED;

    if (isExpired && subscription.status === SubscriptionStatus.ACTIVE) {
      await prisma.subscription.update({
        where: { organizationId },
        data: { status: SubscriptionStatus.EXPIRED }
      });
    }

    return {
      isActive: !isExpired && !isCancelled,
      subscription,
      daysRemaining: isExpired
        ? 0
        : Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    };
  }
}

export const billingService = new BillingService();
export default billingService;