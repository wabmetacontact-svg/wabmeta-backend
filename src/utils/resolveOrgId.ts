// src/utils/resolveOrgId.ts
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types/express';

/**
 * Resolve which organization a request is acting on.
 *
 * Several controllers used to read `x-organization-id` (or `?organizationId=`)
 * and trust it ahead of the verified JWT, which let an authenticated user act on
 * any tenant simply by naming it. Multi-org users still need a way to say which
 * organization they mean, so an explicit value is honoured — but only after
 * confirming the caller is actually a member of it.
 */
export const resolveOrganizationId = async (req: AuthRequest): Promise<string> => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const own = req.user?.organizationId?.trim() || '';

  const headerRaw = req.header('X-Organization-Id') || req.header('x-organization-id');
  const queryRaw =
    typeof req.query?.organizationId === 'string' ? req.query.organizationId : '';
  const requested = (headerRaw || queryRaw || '').trim();

  // Nothing explicit, or it matches the session's own org: use the JWT value.
  if (!requested || requested === own) {
    if (!own) throw new AppError('Organization context required', 400);
    return own;
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId, organizationId: requested },
    select: { organizationId: true },
  });

  if (!membership) {
    throw new AppError('You do not have access to that organization', 403);
  }

  return membership.organizationId;
};

export default resolveOrganizationId;
