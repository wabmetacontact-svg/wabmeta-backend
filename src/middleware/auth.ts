// src/middleware/auth.ts - FIXED VERSION
// ✅ FIX: now imports shared getCookieOptions from utils/cookies.ts instead of
// defining its own conflicting cookieOptions() (was causing SameSite/Secure mismatch
// vs auth.controller.ts, which broke cookies cross-domain wabmeta.com <-> onrender.com)

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { AppError } from './errorHandler';
import prisma from '../config/database';
import { getRedis } from '../config/redis';
import { authService } from '../modules/auth/auth.service';
import { getCookieOptions } from '../utils/cookies'; // ✅ FIX: shared cookie options

const USER_CACHE_PREFIX = 'user:auth:';
const CACHE_TTL = 120;

// ✅ Safe Redis cache get - kabhi throw nahi karega
const safeRedisGet = async (key: string): Promise<string | null> => {
  try {
    const redis = getRedis();
    if (!redis) return null;
    return await redis.get(key);
  } catch (err: any) {
    return null;
  }
};

// ✅ Safe Redis cache set - kabhi throw nahi karega
const safeRedisSet = async (
  key: string,
  value: string,
  ttl: number
): Promise<void> => {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(key, value, 'EX', ttl);
  } catch (err: any) {
    // Silent fail
  }
};

// ✅ Safe Redis cache delete
const safeRedisDel = async (key: string): Promise<void> => {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.del(key);
  } catch (err: any) {
    // Silent fail
  }
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = '';

    // 1. Authorization Header
    const authHeader =
      req.headers.authorization || (req.headers as any).Authorization;
    if (authHeader && /^Bearer /i.test(authHeader)) {
      token = authHeader.split(' ')[1];
    }
    // 2. Alternative Headers
    else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'] as string;
    }
    // 3. Cookies
    else if (req.cookies?.accessToken || req.cookies?.token) {
      token = req.cookies.accessToken || req.cookies.token;
    }
    // 4. Query param (last resort)
    else if (req.query.token) {
      token = req.query.token as string;
    }

    // 🔄 AUTO-HEALING: Refresh token se recover karo
    if (!token && req.cookies?.refreshToken) {
      try {
        console.log('🛡️ Auto-healing: Attempting token refresh...');
        const newTokens = await authService.refreshToken(
          req.cookies.refreshToken
        );

        res.cookie('refreshToken', newTokens.refreshToken, getCookieOptions(true));
        res.cookie('accessToken', newTokens.accessToken, getCookieOptions(false));
        res.setHeader('x-new-access-token', newTokens.accessToken);
        res.setHeader('x-token-refreshed', 'true');
        res.setHeader(
          'Access-Control-Expose-Headers',
          'x-new-access-token, x-token-refreshed'
        );

        token = newTokens.accessToken;
        console.log('✅ Auto-healing: Session restored.');
      } catch (refreshError) {
        console.warn(
          '❌ Auto-healing failed:',
          (refreshError as Error).message
        );
      }
    }

    if (!token) {
      throw new AppError('Access token required', 401);
    }

    // Token verify karo
    const decoded = verifyAccessToken(token) as TokenPayload;

    // organizationId resolve karo
    let organizationId = decoded.organizationId;

    if (!organizationId) {
      console.log('⚠️ organizationId missing in token, fixing...');

      let membership = await prisma.organizationMember.findFirst({
        where: { userId: decoded.userId },
        include: { organization: true },
      });

      if (!membership) {
        const userToFix = await prisma.user.findUnique({
          where: { id: decoded.userId },
        });

        if (userToFix) {
          const orgName = `${userToFix.firstName || 'User'}'s Workspace`;
          const organization = await prisma.organization.create({
            data: {
              name: orgName,
              slug:
                orgName.toLowerCase().replace(/[^a-z0-9]/g, '') +
                '-' +
                Math.random().toString(36).substring(2, 7),
              ownerId: userToFix.id,
              planType: 'FREE_DEMO',
              featureSimpleBulkUpload: false,
              featureCsvUpload: false,
              featureOverrideByAdmin: false,
            } as any,
          });

          membership = await prisma.organizationMember.create({
            data: {
              organizationId: organization.id,
              userId: userToFix.id,
              role: 'OWNER',
              joinedAt: new Date(),
            },
            include: { organization: true },
          });

          const freePlan = await prisma.plan.findUnique({
            where: { type: 'FREE_DEMO' },
          });

          if (freePlan) {
            await prisma.subscription.create({
              data: {
                organizationId: organization.id,
                planId: freePlan.id,
                status: 'ACTIVE',
                billingCycle: 'monthly',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000
                ),
              },
            });
          }
        }
      }

      if (membership) {
        organizationId = membership.organization.id;
      }
    }

    // ✅ User cache - Redis optional, DB fallback guaranteed
    let user: any = null;

    const cacheKey = `${USER_CACHE_PREFIX}${decoded.userId}`;
    const cachedUser = await safeRedisGet(cacheKey);

    if (cachedUser) {
      try {
        user = JSON.parse(cachedUser);
      } catch {
        user = null;
      }
    }

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          status: true,
          emailVerified: true,
          tokenVersion: true,
        },
      });

      if (user) {
        await safeRedisSet(
          cacheKey,
          JSON.stringify({
            id: user.id,
            email: user.email,
            status: user.status,
            emailVerified: user.emailVerified,
            tokenVersion: user.tokenVersion,
          }),
          CACHE_TTL
        );
      }
    }

    if (!user) {
      throw new AppError('User not found', 401);
    }

    // tokenVersion check - password change / logoutAll ke baad purane tokens invalid
    if (
      decoded.tokenVersion !== undefined &&
      user.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      console.warn(
        `🚨 Token version mismatch for user ${decoded.userId}: ` +
        `JWT=${decoded.tokenVersion}, DB=${user.tokenVersion}`
      );

      await safeRedisDel(cacheKey);

      throw new AppError('Session expired. Please login again.', 401);
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError('Account suspended', 403);
    }

    req.user = {
      id: user.id,
      email: user.email,
      organizationId: organizationId,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireEmailVerified = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { emailVerified: true },
    });

    if (!user?.emailVerified) {
      throw new AppError('Email verification required', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireOrganization = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.organizationId) {
      throw new AppError('Organization context required', 400);
    }

    const organization = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    req.organization = organization;
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      try {
        const decoded = verifyAccessToken(token) as TokenPayload;

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, status: true },
        });

        if (user && user.status !== 'SUSPENDED') {
          req.user = {
            id: user.id,
            email: user.email,
            organizationId: decoded.organizationId,
          };
        }
      } catch {
        // Invalid token - continue without user
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};