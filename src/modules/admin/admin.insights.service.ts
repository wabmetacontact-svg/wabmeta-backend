// src/modules/admin/admin.insights.service.ts
//
// What an admin needs to see to act: one organization end to end, the
// accounts that need attention, a search across everything, and revenue.
//
// Every query here is bounded - by time window, by LIMIT, or both - because
// they run against production-sized tables (hundreds of thousands of
// messages) from a page an admin may refresh often.

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { istDayStart } from './orgControl';

const LIST_LIMIT = 20;

const monthStartIst = (now = new Date()): Date => {
  const day = istDayStart(now);
  const ist = new Date(day.getTime() + 330 * 60_000);
  ist.setUTCDate(1);
  return new Date(ist.getTime() - 330 * 60_000);
};

const orgNames = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, { name: string; planType: string; status: string }>();
  const rows = await prisma.organization.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, planType: true, status: true },
  });
  return new Map(rows.map((r) => [r.id, { name: r.name, planType: String(r.planType), status: String(r.status) }]));
};

// ─── Organization overview ─────────────────────────────────────────────────

export const getOrganizationOverview = async (organizationId: string) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      owner: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, lastLoginAt: true } },
      members: {
        select: {
          role: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true, status: true, lastLoginAt: true } },
        },
      },
      subscription: { include: { plan: { select: { id: true, name: true, type: true, monthlyPrice: true } } } },
      whatsappAccounts: {
        select: {
          id: true, phoneNumber: true, displayName: true, status: true,
          qualityRating: true, messagingLimit: true, createdAt: true,
        },
      },
      wallet: {
        select: { isActive: true, balancePaise: true, creditEnabled: true, creditLimitPaise: true, creditUsedPaise: true, lowThresholdPaise: true },
      },
      _count: { select: { contacts: true, campaigns: true, templates: true, chatbots: true, automations: true, conversations: true } },
    },
  });
  if (!org) throw new AppError('Organization not found', 404);

  const today = istDayStart();
  const monthStart = monthStartIst();

  const [messagesToday, messagesThisMonth, lastOutbound, payments, notes, audit, security, campaigns] =
    await Promise.all([
      prisma.message.count({
        where: { conversation: { organizationId }, direction: 'OUTBOUND', createdAt: { gte: today } },
      }),
      prisma.message.count({
        where: { conversation: { organizationId }, direction: 'OUTBOUND', createdAt: { gte: monthStart } },
      }),
      prisma.message.findFirst({
        where: { conversation: { organizationId }, direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.payment.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, amount: true, status: true, planName: true, billingCycle: true, paidAt: true, createdAt: true, razorpayPaymentId: true },
      }),
      prisma.organizationNote.findMany({
        where: { organizationId },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
      prisma.adminAuditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { id: true, adminEmail: true, action: true, reason: true, statusCode: true, createdAt: true },
      }),
      prisma.securityEvent.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.campaign.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, status: true, createdAt: true, totalContacts: true, sentCount: true, failedCount: true } as any,
      }),
    ]);

  const totalPaidPaise = payments.filter((p) => p.status === 'SUCCESS').reduce((sum, p) => sum + p.amount, 0);

  return {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
      deletedAt: org.deletedAt,
      planType: org.planType,
      status: org.status,
      statusReason: org.statusReason,
      statusChangedAt: org.statusChangedAt,
      statusChangedBy: org.statusChangedBy,
      adminTags: org.adminTags,
      limitOverrides: org.limitOverrides,
    },
    owner: org.owner,
    members: org.members.map((m) => ({ role: m.role, ...m.user })),
    subscription: org.subscription,
    whatsappAccounts: org.whatsappAccounts,
    wallet: org.wallet,
    counts: org._count,
    usage: {
      messagesToday,
      messagesThisMonth,
      lastOutboundAt: lastOutbound?.createdAt ?? null,
    },
    payments,
    totalPaidPaise,
    recentCampaigns: campaigns,
    notes,
    recentAdminActions: audit,
    securityEvents: security,
  };
};

// ─── Risk dashboard ────────────────────────────────────────────────────────

type Row = Record<string, any>;

/**
 * Accounts that need a human to look at them, grouped by why. Each list is
 * capped; the counts say how many there are in total where that is cheap.
 */
export const getRiskReport = async () => {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);
  const ago7Days = new Date(now.getTime() - 7 * 86_400_000);

  const [
    blocked,
    lowQuality,
    expiringSoon,
    recentlyExpired,
    lowWallets,
    failedPayments,
    spikes,
    highFailure,
    inactive,
  ] = await Promise.all([
    prisma.organization.findMany({
      where: { status: { not: 'ACTIVE' }, deletedAt: null },
      select: { id: true, name: true, status: true, statusReason: true, statusChangedAt: true },
      orderBy: { statusChangedAt: 'desc' },
      take: LIST_LIMIT,
    }),
    prisma.whatsAppAccount.findMany({
      where: { qualityRating: { in: ['RED', 'YELLOW', 'red', 'yellow', 'LOW', 'MEDIUM'] }, status: 'CONNECTED' },
      select: {
        id: true, phoneNumber: true, displayName: true, qualityRating: true, messagingLimit: true,
        organization: { select: { id: true, name: true } },
      },
      take: LIST_LIMIT,
    }),
    prisma.subscription.findMany({
      where: { status: 'ACTIVE', currentPeriodEnd: { gte: now, lte: in7Days } },
      select: {
        currentPeriodEnd: true, billingCycle: true,
        plan: { select: { name: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { currentPeriodEnd: 'asc' },
      take: LIST_LIMIT,
    }),
    prisma.subscription.findMany({
      where: { currentPeriodEnd: { gte: ago7Days, lt: now } },
      select: {
        currentPeriodEnd: true, status: true,
        plan: { select: { name: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { currentPeriodEnd: 'desc' },
      take: LIST_LIMIT,
    }),
    prisma.$queryRaw<Row[]>`
      SELECT w."organizationId" AS "organizationId", w."balancePaise" AS "balancePaise",
             w."lowThresholdPaise" AS "lowThresholdPaise"
      FROM "Wallet" w
      WHERE w."isActive" = true AND w."balancePaise" < w."lowThresholdPaise"
      ORDER BY w."balancePaise" ASC
      LIMIT ${LIST_LIMIT}`,
    prisma.payment.findMany({
      where: { status: 'FAILED', createdAt: { gte: ago7Days } },
      select: { id: true, amount: true, planName: true, createdAt: true, organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    }),
    // Sending three times its usual daily volume, and at least 500 today.
    prisma.$queryRaw<Row[]>`
      WITH v AS (
        SELECT c."organizationId" AS org,
               COUNT(*) FILTER (WHERE m."createdAt" >= NOW() - INTERVAL '1 day')::int AS last24,
               COUNT(*) FILTER (WHERE m."createdAt" <  NOW() - INTERVAL '1 day')::int AS prev7
        FROM "Message" m
        JOIN "Conversation" c ON c.id = m."conversationId"
        WHERE m.direction = 'OUTBOUND' AND m."createdAt" >= NOW() - INTERVAL '8 days'
        GROUP BY c."organizationId"
      )
      SELECT org AS "organizationId", last24, prev7
      FROM v
      WHERE last24 >= 500 AND last24 > 3 * (prev7 / 7.0)
      ORDER BY last24 DESC
      LIMIT ${LIST_LIMIT}`,
    // Campaign failure rate over the last week, where there is enough volume
    // for the rate to mean something.
    prisma.$queryRaw<Row[]>`
      SELECT ca."organizationId" AS "organizationId",
             COUNT(*) FILTER (WHERE cc.status = 'FAILED')::int AS failed,
             COUNT(*) FILTER (WHERE cc.status IN ('SENT','DELIVERED','READ','FAILED'))::int AS total
      FROM "CampaignContact" cc
      JOIN "Campaign" ca ON ca.id = cc."campaignId"
      WHERE cc."updatedAt" >= NOW() - INTERVAL '7 days'
      GROUP BY ca."organizationId"
      HAVING COUNT(*) FILTER (WHERE cc.status IN ('SENT','DELIVERED','READ','FAILED')) >= 50
         AND COUNT(*) FILTER (WHERE cc.status = 'FAILED')
             >= 0.2 * COUNT(*) FILTER (WHERE cc.status IN ('SENT','DELIVERED','READ','FAILED'))
      ORDER BY failed DESC
      LIMIT ${LIST_LIMIT}`,
    // Paying (active, unexpired) but has sent nothing for 14 days: churn risk.
    prisma.$queryRaw<Row[]>`
      SELECT s."organizationId" AS "organizationId", s."currentPeriodEnd" AS "currentPeriodEnd"
      FROM "Subscription" s
      JOIN "Organization" o ON o.id = s."organizationId" AND o."deletedAt" IS NULL
      WHERE s.status = 'ACTIVE' AND s."currentPeriodEnd" > NOW()
        AND o."planType" <> 'FREE_DEMO'
        AND NOT EXISTS (
          SELECT 1 FROM "Message" m
          JOIN "Conversation" c ON c.id = m."conversationId"
          WHERE c."organizationId" = s."organizationId"
            AND m.direction = 'OUTBOUND'
            AND m."createdAt" >= NOW() - INTERVAL '14 days'
        )
      ORDER BY s."currentPeriodEnd" ASC
      LIMIT ${LIST_LIMIT}`,
  ]);

  const names = await orgNames([
    ...lowWallets.map((r) => r.organizationId),
    ...spikes.map((r) => r.organizationId),
    ...highFailure.map((r) => r.organizationId),
    ...inactive.map((r) => r.organizationId),
  ]);
  const named = (rows: Row[]) =>
    rows.map((r) => ({ ...r, organizationName: names.get(r.organizationId)?.name ?? r.organizationId }));

  return {
    generatedAt: now.toISOString(),
    blocked,
    lowQuality,
    expiringSoon,
    recentlyExpired,
    lowWallets: named(lowWallets),
    failedPayments,
    sendingSpikes: named(spikes),
    highCampaignFailure: named(
      highFailure.map((r) => ({ ...r, failureRate: r.total ? Math.round((r.failed / r.total) * 100) : 0 }))
    ),
    inactivePaying: named(inactive),
  };
};

// ─── Global search ─────────────────────────────────────────────────────────

export const globalSearch = async (rawQuery: string) => {
  const q = String(rawQuery || '').trim();
  if (q.length < 2) return { users: [], organizations: [], whatsappAccounts: [], payments: [] };

  const digits = q.replace(/\D/g, '');
  const contains = { contains: q, mode: 'insensitive' as const };

  const [users, organizations, whatsappAccounts, payments] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { email: contains },
          { firstName: contains },
          { lastName: contains },
          { id: q },
          ...(digits.length >= 5 ? [{ phone: { contains: digits } }] : []),
        ],
      },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, status: true },
      take: 8,
    }),
    prisma.organization.findMany({
      where: { deletedAt: null, OR: [{ name: contains }, { slug: contains }, { id: q }] },
      select: { id: true, name: true, planType: true, status: true },
      take: 8,
    }),
    prisma.whatsAppAccount.findMany({
      where: {
        OR: [
          { displayName: contains },
          { phoneNumberId: q },
          { wabaId: q },
          ...(digits.length >= 5 ? [{ phoneNumber: { contains: digits } }] : []),
        ],
      },
      select: {
        id: true, phoneNumber: true, displayName: true, status: true,
        organization: { select: { id: true, name: true } },
      },
      take: 8,
    }),
    prisma.payment.findMany({
      where: { OR: [{ razorpayPaymentId: q }, { razorpayOrderId: q }, { id: q }] },
      select: {
        id: true, amount: true, status: true, planName: true, paidAt: true, razorpayPaymentId: true,
        organization: { select: { id: true, name: true } },
      },
      take: 5,
    }),
  ]);

  return { users, organizations, whatsappAccounts, payments };
};

// ─── Revenue ───────────────────────────────────────────────────────────────

/**
 * Money that actually came in, by month (India time), and the recurring run
 * rate implied by what active customers last paid.
 *
 * MRR is not read from plan prices: grandfathered plans, coupons and
 * admin-assigned plans all make list prices wrong. Each active paid
 * subscription contributes its last payment spread over its period.
 */
export const getRevenueReport = async (months = 6) => {
  const n = Math.min(24, Math.max(1, Math.floor(months) || 6));

  const [byMonth, walletByMonth, activeSubs, churned, manualByMonth, monthlyAddOns, coupons] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT to_char(date_trunc('month', COALESCE(p."paidAt", p."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
             SUM(p.amount)::bigint AS paise,
             COUNT(*)::int AS payments,
             COUNT(DISTINCT p."organizationId")::int AS customers
      FROM "Payment" p
      WHERE p.status = 'SUCCESS'
        AND COALESCE(p."paidAt", p."createdAt") >= date_trunc('month', NOW()) - make_interval(months => ${n - 1}::int)
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT to_char(date_trunc('month', t."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
             SUM(t."amountPaise")::bigint AS paise,
             COUNT(*)::int AS topups
      FROM "WalletTransaction" t
      WHERE t.type = 'credit' AND t.status = 'completed' AND t."razorpayPaymentId" IS NOT NULL
        AND t."createdAt" >= date_trunc('month', NOW()) - make_interval(months => ${n - 1}::int)
      GROUP BY 1 ORDER BY 1`,
    prisma.subscription.findMany({
      where: { status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } },
      select: {
        organizationId: true, currentPeriodStart: true, currentPeriodEnd: true,
        plan: { select: { type: true, name: true } },
      },
    }),
    prisma.subscription.count({
      where: {
        currentPeriodEnd: { gte: new Date(Date.now() - 30 * 86_400_000), lt: new Date() },
        status: { in: ['EXPIRED', 'CANCELLED', 'ACTIVE'] },
      },
    }),
    // Offline payments count only once verified.
    prisma.$queryRaw<Row[]>`
      SELECT to_char(date_trunc('month', m."paidAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
             SUM(m."amountPaise")::bigint AS paise,
             COUNT(*)::int AS payments
      FROM "ManualPayment" m
      WHERE m.status = 'VERIFIED'
        AND m."paidAt" >= date_trunc('month', NOW()) - make_interval(months => ${n - 1}::int)
      GROUP BY 1 ORDER BY 1`,
    prisma.clientAddOn.findMany({
      where: { removedAt: null, billing: 'MONTHLY', startsAt: { lte: new Date() } },
      select: { quantity: true, unitPricePaise: true, endsAt: true },
    }),
    prisma.couponRedemption.aggregate({
      _sum: { discountPaise: true },
      _count: true,
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    }),
  ]);

  // Last successful payment per active subscriber.
  const orgIds = activeSubs.map((s) => s.organizationId);
  const lastPayments = orgIds.length
    ? await prisma.payment.findMany({
        where: { organizationId: { in: orgIds }, status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
        distinct: ['organizationId'],
        select: { organizationId: true, amount: true },
      })
    : [];
  const lastPaid = new Map(lastPayments.map((p) => [p.organizationId, p.amount]));

  let mrrPaise = 0;
  let paying = 0;
  let complimentary = 0;
  const byPlan: Record<string, { customers: number; mrrPaise: number }> = {};

  for (const s of activeSubs) {
    const planType = String(s.plan?.type ?? 'UNKNOWN');
    if (planType === 'FREE_DEMO') continue;

    const amount = lastPaid.get(s.organizationId);
    const days = Math.max(1, (s.currentPeriodEnd.getTime() - s.currentPeriodStart.getTime()) / 86_400_000);
    const monthly = amount ? Math.round((amount * 30) / days) : 0;

    if (amount) paying++;
    else complimentary++;
    mrrPaise += monthly;
    byPlan[planType] = byPlan[planType] || { customers: 0, mrrPaise: 0 };
    byPlan[planType].customers++;
    byPlan[planType].mrrPaise += monthly;
  }

  const num = (v: unknown) => Number(v ?? 0);

  return {
    months: byMonth.map((r) => ({ month: r.month, paise: num(r.paise), payments: num(r.payments), customers: num(r.customers) })),
    walletTopups: walletByMonth.map((r) => ({ month: r.month, paise: num(r.paise), topups: num(r.topups) })),
    offlinePayments: manualByMonth.map((r) => ({ month: r.month, paise: num(r.paise), payments: num(r.payments) })),
    // Monthly add-ons billed on top of plans; not in mrrPaise, which is what
    // plan payments imply.
    addOnMrrPaise: monthlyAddOns
      .filter((a) => !a.endsAt || a.endsAt > new Date())
      .reduce((s, a) => s + a.quantity * a.unitPricePaise, 0),
    mrrPaise,
    arrPaise: mrrPaise * 12,
    payingCustomers: paying,
    complimentaryCustomers: complimentary,
    byPlan,
    endedLast30Days: churned,
    couponsLast30Days: { redemptions: coupons._count, discountPaise: num(coupons._sum.discountPaise) },
  };
};
