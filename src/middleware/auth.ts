// src/middleware/auth.ts - PRODUCTION READY
// ✅ Cache TTL increased to 5 minutes (paid plan)
// ✅ Better error handling
// ✅ Pool timeout graceful degradation

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { AppError } from './errorHandler';
import prisma from '../config/database';
import { getRedis } from '../config/redis';
import { authService } from '../modules/auth/auth.service';
import { getCookieOptions } from '../utils/cookies';

const USER_CACHE_PREFIX = 'user:auth:';
const CACHE_TTL = 300; // ✅ 5 minutes (paid plan can afford longer cache)

// ============================================
// SAFE REDIS HELPERS
// ============================================

const safeRedisGet = async (key: string): Promise<string | null> => {
  try {
    const redis = getRedis();
    if (!redis) return null;
    return await redis.get(key);
  } catch {
    return null;
  }
};

const safeRedisSet = async (
  key: string,
  value: string,
  ttl: number
): Promise<void> => {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(key, value, 'EX', ttl);
  } catch {
    // Silent
  }
};

const safeRedisDel = async (key: string): Promise<void> => {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.del(key);
  } catch {
    // Silent
  }
};

// ============================================
// USER FETCH - Cache + DB fallback
// ============================================

interface CachedUser {
  id: string;
  email: string;
  status: string;
  emailVerified: boolean;
  tokenVersion: number;
}

const fetchUser = async (
  userId: string,
  forceRefresh = false
): Promise<CachedUser | null> => {
  const cacheKey = `${USER_CACHE_PREFIX}${userId}`;

  if (!forceRefresh) {
    const cached = await safeRedisGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as CachedUser;
      } catch {
        // Cache corrupt
      }
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        emailVerified: true,
        tokenVersion: true,
      },
    });

    if (user) {
      await safeRedisSet(cacheKey, JSON.stringify(user), CACHE_TTL);
    }

    return user;
  } catch (err: any) {
    if (err?.code === 'P2024') {
      console.warn('⚠️  Auth middleware: DB pool busy, trying cache fallback');
      const cached = await safeRedisGet(cacheKey);
      if (cached) {
        try {
          console.log('✅ Auth: Serving from cache during pool pressure');
          return JSON.parse(cached) as CachedUser;
        } catch {
          return null;
        }
      }
      throw new AppError('Service temporarily busy. Please retry.', 503);
    }
    throw err;
  }
};

// ============================================
// MAIN AUTH MIDDLEWARE
// ============================================

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = '';

    const authHeader =
      req.headers.authorization || (req.headers as any).Authorization;

    if (authHeader && /^Bearer /i.test(authHeader)) {
      token = authHeader.split(' ')[1];
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'] as string;
    } else if (req.cookies?.accessToken || req.cookies?.token) {
      token = req.cookies.accessToken || req.cookies.token;
    } else if (req.query.token) {
      token = req.query.token as string;
    }

    // Auto-heal via refresh token
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
        console.warn('❌ Auto-healing failed:', (refreshError as Error).message);
      }
    }

    if (!token) {
      throw new AppError('Access token required', 401);
    }

    let decoded: TokenPayload;
    try {
      decoded = verifyAccessToken(token) as TokenPayload;
    } catch (jwtError: any) {
      if (jwtError?.name === 'TokenExpiredError') {
        throw new AppError('Access token expired', 401);
      }
      throw new AppError('Invalid access token', 401);
    }

    let user = await fetchUser(decoded.userId);

    if (!user) {
      throw new AppError('User not found', 401);
    }

    // tokenVersion check with DB fallback
    if (
      decoded.tokenVersion !== undefined &&
      user.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      console.warn(
        `⚠️  tokenVersion mismatch for ${decoded.userId}: ` +
        `token=${decoded.tokenVersion}, cache=${user.tokenVersion} → refreshing from DB`
      );

      user = await fetchUser(decoded.userId, true);

      if (!user) {
        throw new AppError('User not found', 401);
      }

      if (decoded.tokenVersion !== user.tokenVersion) {
        console.warn(
          `🚨 tokenVersion CONFIRMED mismatch for ${decoded.userId}: ` +
          `token=${decoded.tokenVersion}, DB=${user.tokenVersion}`
        );
        await safeRedisDel(`${USER_CACHE_PREFIX}${decoded.userId}`);
        throw new AppError('Session expired. Please login again.', 401);
      }

      console.log(`✅ tokenVersion verified from DB for ${decoded.userId}`);
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError('Account suspended. Please contact support.', 403);
    }

    let organizationId = decoded.organizationId;

    if (!organizationId) {
      try {
        const membership = await prisma.organizationMember.findFirst({
          where: { userId: decoded.userId },
          select: { organizationId: true },
        });
        organizationId = membership?.organizationId;
      } catch (err: any) {
        if (err?.code !== 'P2024') throw err;
        console.warn('⚠️  Could not fetch organizationId: pool busy');
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      organizationId,
    };

    next();
  } catch (error) {
    next(error);
  }
};

// ============================================
// REQUIRE EMAIL VERIFIED
// ============================================
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

// ============================================
// REQUIRE ORGANIZATION
// ============================================
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
      select: {
        id: true,
        name: true,
        slug: true,
        planType: true,
        ownerId: true,
      },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    req.organization = organization as any;
    next();
  } catch (error) {
    next(error);
  }
};

// ============================================
// OPTIONAL AUTH
// ============================================
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = verifyAccessToken(token) as TokenPayload;
        const user = await fetchUser(decoded.userId);

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