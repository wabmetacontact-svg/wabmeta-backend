// src/middleware/requireRole.ts
import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from './errorHandler';
import { AuthRequest } from '../types/express';
import { UserRole } from '@prisma/client';

/**
 * Role gate for organization routes.
 *
 * The product defines three roles on top of the organization owner:
 *
 *   ADMIN   full access to every feature, setting and billing detail
 *   MEMBER  can run campaigns, edit templates and manage contacts
 *   VIEWER  read-only — cannot send messages or change settings
 *
 * Until this existed, none of that was enforced: `VIEWER` appeared nowhere in
 * the backend outside the Prisma enum, so anyone invited as a viewer could send
 * campaigns and delete contacts. Role checks that did exist were hand-written
 * inside individual handlers, which is how the gap went unnoticed.
 *
 * OWNER is always allowed — it is the superset of ADMIN.
 */

/** Everyone who may change day-to-day working data. Excludes VIEWER. */
export const OPERATOR_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'MEMBER'];

/** Everyone who may change settings, billing, connections and membership. */
export const ADMIN_ROLES: UserRole[] = ['OWNER', 'ADMIN'];

export const requireRole = (...allowed: UserRole[]) => {
  // OWNER is implicitly allowed wherever ADMIN is.
  const permitted = new Set<UserRole>(
    allowed.includes('ADMIN') ? [...allowed, 'OWNER'] : allowed
  );

  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId) throw new AppError('Authentication required', 401);
      if (!organizationId) throw new AppError('Organization context required', 400);

      const membership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
        select: { role: true },
      });

      if (!membership) {
        throw new AppError('You are not a member of this organization', 403);
      }

      if (!permitted.has(membership.role)) {
        // Name the role so the message is actionable rather than a bare 403.
        throw new AppError(
          membership.role === 'VIEWER'
            ? 'Your role is view-only. Ask an owner or admin to make this change.'
            : `This action needs ${[...permitted].join(' or ')} access.`,
          403
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

/** Shorthand for routes that change working data (campaigns, contacts, inbox…). */
export const requireOperator = requireRole(...OPERATOR_ROLES);

/** Shorthand for routes that change settings, billing, connections or members. */
export const requireAdmin = requireRole(...ADMIN_ROLES);

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Apply a role gate to writes only, leaving reads open.
 *
 * Mounted once per router with `router.use(...)`, so it covers every mutating
 * route in that module — including ones added later, which is the point. A
 * viewer keeps full read access; only the writes are gated.
 */
export const gateMutations = (...allowed: UserRole[]) => {
  const gate = requireRole(...allowed);
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!MUTATING.has(req.method)) return next();
    return gate(req, res, next);
  };
};

export default requireRole;
