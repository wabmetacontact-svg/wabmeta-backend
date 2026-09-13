// src/middleware/connectionLock.ts

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from './errorHandler';
import { resolveGateOrganizationId, claimsAnotherOrg } from './resolveOrg';
import { recordSecurityEvent, requestOrigin } from '../utils/securityLog';

/**
 * Connection Lock Middleware
 * 
 * Admin se enable hone par user ko WhatsApp/Meta/Instagram
 * connect ya disconnect karne se rokta hai.
 * 
 * Usage:
 *   router.delete('/accounts/:id', checkConnectionLock, controller.disconnect);
 *   router.post('/connect', checkConnectionLock, controller.connect);
 */
export const checkConnectionLock = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Verified token pehle, header sirf unauthenticated fallback ke liye.
    const organizationId = resolveGateOrganizationId(req);

    if (claimsAnotherOrg(req)) {
      console.warn(
        `⚠️ connectionLock: X-Organization-Id does not match the token's org ` +
        `(${organizationId}) - header ignored`
      );
        recordSecurityEvent({
          type: 'ORG_HEADER_MISMATCH',
          userId: (req as any).user?.id || null,
          organizationId,
          ...requestOrigin(req),
          detail: { gate: 'connectionLock', claimed: req.header('X-Organization-Id') || req.header('x-organization-id') },
        });
    }

    if (!organizationId) {
      // Agar org id nahi mila toh skip (downstream handler decide karega)
      return next();
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { featureConnectionLocked: true } as any,
    });

    if (!org) {
      return next();
    }

    if ((org as any).featureConnectionLocked === true) {
      // 🔒 Locked — block the action
      throw new AppError(
        'Connection action is locked. Please contact administrator.',
        403
      );
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

export default checkConnectionLock;
