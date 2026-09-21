// src/modules/admin/admin.control.service.ts
//
// The admin actions that control a customer: block or reopen an
// organization, change its limits, end sessions, and look at the app through
// a user's eyes. Enforcement of what is decided here lives in orgControl.ts
// and middleware/auth.ts.

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { invalidateUserAuthCache } from '../../middleware/auth';
import { emitForceLogout } from '../../socket';
import { generateImpersonationToken, IMPERSONATION_TTL_SECONDS } from '../../utils/jwt';
import { aiDailyLimit } from '../chatbot/ai.ratelimit';
import {
  invalidateOrgControl,
  LIMIT_KEYS,
  LimitKey,
  LimitOverrides,
  OrgStatus,
  parseLimitOverrides,
  UNLIMITED,
} from './orgControl';

interface Actor {
  id: string;
  email?: string;
}

// ─── Sessions ──────────────────────────────────────────────────────────────

/**
 * End every session a user has, on every device, right now.
 *
 * tokenVersion makes each access token already issued fail on its next
 * request; deleting refresh tokens stops new ones being minted; the socket
 * event sends open tabs to the login screen without waiting for a request.
 */
export const forceLogoutUser = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new AppError('User not found', 404);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);

  await invalidateUserAuthCache(userId);
  try {
    emitForceLogout(userId, 'security_update');
  } catch {
    // Socket not up (tests, worker): the token checks above already hold.
  }
};

export const forceLogoutOrganization = async (organizationId: string): Promise<number> => {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  for (const m of members) await forceLogoutUser(m.userId);
  return members.length;
};

export const listUserSessions = async (userId: string) => {
  const sessions = await prisma.refreshToken.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true, expiresAt: true, userAgent: true, ipAddress: true },
    orderBy: { createdAt: 'desc' },
  });
  return sessions;
};

/**
 * End one session. Its refresh token goes, so the device is signed out the
 * next time its short-lived access token needs renewing. To cut a device off
 * immediately, use forceLogoutUser.
 */
export const revokeUserSession = async (userId: string, sessionId: string): Promise<void> => {
  const { count } = await prisma.refreshToken.deleteMany({ where: { id: sessionId, userId } });
  if (count === 0) throw new AppError('Session not found', 404);
};

// ─── Organization status ───────────────────────────────────────────────────

export const setOrganizationStatus = async (
  organizationId: string,
  status: OrgStatus,
  reason: string | undefined,
  actor: Actor
) => {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!org) throw new AppError('Organization not found', 404);

  const cleanReason = (reason || '').trim();
  if (status !== 'ACTIVE' && !cleanReason) {
    throw new AppError('Give a reason. The customer sees it.', 400);
  }

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      status,
      statusReason: status === 'ACTIVE' ? null : cleanReason.slice(0, 500),
      statusChangedAt: new Date(),
      statusChangedBy: actor.email || actor.id,
    },
    select: { id: true, name: true, status: true, statusReason: true, statusChangedAt: true },
  });

  invalidateOrgControl(organizationId);

  let campaignsPaused = 0;
  let usersLoggedOut = 0;

  if (status !== 'ACTIVE') {
    // Running campaigns stop at their next batch. They stay PAUSED after a
    // reactivation - the customer decides whether to resume them.
    const paused = await prisma.campaign.updateMany({
      where: { organizationId, status: 'RUNNING' },
      data: { status: 'PAUSED' },
    });
    campaignsPaused = paused.count;
  }

  if (status === 'SUSPENDED') {
    usersLoggedOut = await forceLogoutOrganization(organizationId);
  }

  return { organization: updated, campaignsPaused, usersLoggedOut };
};

// ─── Limits ────────────────────────────────────────────────────────────────

export const getOrganizationLimits = async (organizationId: string) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      limitOverrides: true,
      subscription: {
        select: {
          plan: {
            select: {
              name: true,
              maxContacts: true,
              maxMessagesPerMonth: true,
              maxWhatsAppAccounts: true,
              maxTeamMembers: true,
            },
          },
        },
      },
    },
  });
  if (!org) throw new AppError('Organization not found', 404);

  const plan = org.subscription?.plan;
  const planLimits: Record<LimitKey, number | null> = {
    contacts: plan?.maxContacts ?? null,
    messagesPerMonth: plan?.maxMessagesPerMonth ?? null,
    whatsappNumbers: plan?.maxWhatsAppAccounts ?? null,
    teamMembers: plan?.maxTeamMembers ?? null,
    aiRepliesPerDay: aiDailyLimit,
    dailyCampaignMessages: null,
  };

  const overrides = parseLimitOverrides(org.limitOverrides);
  const effective = Object.fromEntries(
    LIMIT_KEYS.map((k) => [k, overrides[k] ?? planLimits[k]])
  ) as Record<LimitKey, number | null>;

  return { planName: plan?.name ?? null, plan: planLimits, overrides, effective, unlimited: UNLIMITED };
};

/**
 * Change some limits. A number sets the override, null removes it (back to
 * the plan), and a key that is not sent is left as it was.
 */
export const updateOrganizationLimits = async (
  organizationId: string,
  patch: Partial<Record<LimitKey, number | null>>
) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { limitOverrides: true },
  });
  if (!org) throw new AppError('Organization not found', 404);

  const next: LimitOverrides = { ...parseLimitOverrides(org.limitOverrides) };
  for (const key of LIMIT_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === null || value === undefined) delete next[key];
    else next[key] = value;
  }

  const clean = parseLimitOverrides(next);
  await prisma.organization.update({
    where: { id: organizationId },
    data: { limitOverrides: Object.keys(clean).length ? (clean as any) : null },
  });

  invalidateOrgControl(organizationId);
  return getOrganizationLimits(organizationId);
};

// ─── View as user ──────────────────────────────────────────────────────────

/**
 * A 30-minute, read-only access token for one user in one organization.
 * middleware/auth.ts refuses every non-GET request made with it, and the
 * audit log records who asked for it and why.
 */
export const impersonateUser = async (
  userId: string,
  organizationId: string | undefined,
  reason: string | undefined,
  actor: Actor
) => {
  if (!reason || !reason.trim()) {
    throw new AppError('Give a reason for viewing this account.', 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      tokenVersion: true,
      memberships: {
        select: { organizationId: true, organization: { select: { id: true, name: true, deletedAt: true } } },
      },
    },
  });
  if (!user) throw new AppError('User not found', 404);
  if (user.status === 'SUSPENDED') {
    throw new AppError('This user is suspended. Reactivate them first to view their account.', 400);
  }

  const live = user.memberships.filter((m) => !m.organization.deletedAt);
  const membership = organizationId
    ? live.find((m) => m.organizationId === organizationId)
    : live[0];
  if (!membership) {
    throw new AppError('This user is not a member of that organization.', 400);
  }

  const accessToken = generateImpersonationToken({
    userId: user.id,
    email: user.email,
    organizationId: membership.organizationId,
    tokenVersion: user.tokenVersion,
    impersonatedBy: actor.id,
  });

  return {
    accessToken,
    expiresAt: new Date(Date.now() + IMPERSONATION_TTL_SECONDS * 1000).toISOString(),
    readOnly: true,
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    organization: { id: membership.organization.id, name: membership.organization.name },
  };
};

// ─── Security events ───────────────────────────────────────────────────────

export const listSecurityEvents = async (q: {
  page?: number;
  limit?: number;
  type?: string;
  email?: string;
  userId?: string;
  organizationId?: string;
  from?: string;
  to?: string;
}) => {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));

  const where: any = {};
  if (q.type) where.type = q.type;
  if (q.email) where.email = { contains: q.email.toLowerCase() };
  if (q.userId) where.userId = q.userId;
  if (q.organizationId) where.organizationId = q.organizationId;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = new Date(q.from);
    if (q.to) where.createdAt.lte = new Date(q.to);
  }

  const [events, total] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.securityEvent.count({ where }),
  ]);

  return { events, total, page, limit, totalPages: Math.ceil(total / limit) };
};
