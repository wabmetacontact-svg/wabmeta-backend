// src/middleware/connectionLock.ts

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from './errorHandler';

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
    // Get orgId from header / body / query / user
    const organizationId =
      (req.header('X-Organization-Id') || req.header('x-organization-id') || '').trim() ||
      (req.body?.organizationId as string) ||
      (req.params?.organizationId as string) ||
      (typeof req.query?.organizationId === 'string' ? req.query.organizationId : '') ||
      ((req as any).user?.organizationId as string) ||
      '';

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
