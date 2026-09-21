// src/modules/admin/admin.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { verifyAdminToken } from './admin.security';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

// ============================================
// TYPES
// ============================================

interface AdminJWTPayload {
  adminId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface AdminRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: string;
    name?: string;
  };
}

// ============================================
// AUTHENTICATE ADMIN MIDDLEWARE
// ============================================

export const authenticateAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError('Admin authentication required', 401);
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Invalid authorization format', 401);
    }

    const token = authHeader.substring(7);

    if (!token) {
      throw new AppError('Admin token required', 401);
    }

    // Verify token
    let decoded: AdminJWTPayload;

    try {
      decoded = verifyAdminToken(token) as AdminJWTPayload;
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new AppError('Admin token expired', 401);
      }
      if (jwtError.name === 'JsonWebTokenError') {
        throw new AppError('Invalid admin token', 401);
      }
      throw new AppError('Token verification failed', 401);
    }

    // Check if it's an admin token (has adminId, not userId)
    if (!decoded.adminId) {
      throw new AppError('Invalid admin token', 401);
    }

    // Get admin from database
    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!admin) {
      throw new AppError('Admin not found', 401);
    }

    if (!admin.isActive) {
      throw new AppError('Admin account is inactive', 403);
    }

    // Attach admin to request
    req.admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      name: admin.name,
    };

    next();
  } catch (error) {
    next(error);
  }
};

// ============================================
// REQUIRE SUPER ADMIN MIDDLEWARE
// ============================================

export const requireSuperAdmin = (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.admin) {
    return next(new AppError('Admin authentication required', 401));
  }

  if (req.admin.role !== 'super_admin') {
    return next(new AppError('Super admin access required', 403));
  }

  next();
};

// ============================================
// REQUIRE SPECIFIC ROLE MIDDLEWARE
// ============================================

export const requireRole = (...roles: string[]) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return next(new AppError('Admin authentication required', 401));
    }

    if (!roles.includes(req.admin.role)) {
      return next(
        new AppError(`Access denied. Required roles: ${roles.join(', ')}`, 403)
      );
    }

    next();
  };
};