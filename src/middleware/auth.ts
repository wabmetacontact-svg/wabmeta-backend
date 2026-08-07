// src/middleware/auth.ts - FINAL FIX
// ✅ FIX: Token expired pe SEEDHA refresh karo, auto-heal complex logic hatao
// ✅ FIX: Race condition prevent karo - simple aur reliable

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { AppError } from './errorHandler';
import prisma from '../config/database';
import { getRedis } from '../config/redis';
import { authService } from '../modules/auth/auth.service';
import { getCookieOptions } from '../utils/cookies';

const USER_CACHE_PREFIX = 'user:auth:';
const CACHE_TTL = 300;

// ============================================
// SAFE REDIS HELPERS
// ============================================
const safeRedisGet = async (key: string): Promise<string | null> => {
  try {
    const redis = getRedis();
    if (!redis) return null;
    return await redis.get(key);
  } catch { return null; }
};

const safeRedisSet = async (key: string, value: string, ttl: number): Promise<void> => {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(key, value, 'EX', ttl);
  } catch { }
};

const safeRedisDel = async (key: string): Promise<void> => {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.del(key);
  } catch { }
};

// ============================================
// USER FETCH
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
      try { return JSON.parse(cached) as CachedUser; } catch { }
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, status: true,
        emailVerified: true, tokenVersion: true,
      },
    });
    if (user) {
      await safeRedisSet(cacheKey, JSON.stringify(user), CACHE_TTL);
    }
    return user;
  } catch (err: any) {
    if (err?.code === 'P2024') {
      const cached = await safeRedisGet(cacheKey);
      if (cached) {
        try { return JSON.parse(cached) as CachedUser; } catch { }
      }
      throw new AppError('Service temporarily busy. Please retry.', 503);
    }
    throw err;
  }
};

// ============================================
// ✅ SIMPLE TOKEN EXTRACTOR
// ============================================
const extractToken = (req: AuthRequest): string => {
  // 1. Authorization header
  const authHeader = req.headers.authorization || (req.headers as any).Authorization;
  if (authHeader && /^Bearer /i.test(authHeader)) {
    return authHeader.split(' ')[1];
  }

  // 2. x-access-token header
  if (req.headers['x-access-token']) {
    return req.headers['x-access-token'] as string;
  }

  // 3. Cookie
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  if (req.cookies?.token) return req.cookies.token;

  // 4. Query param
  if (req.query.token) return req.query.token as string;

  return '';
};

// ============================================
// ✅ REFRESH LOCK (prevent concurrent refresh)
// ============================================
const acquireRefreshLock = async (userId: string): Promise<boolean> => {
  try {
    const redis = getRedis();
    if (!redis) return true;
    const result = await redis.set(
      `refresh:lock:${userId}`, '1', 'EX', 15, 'NX'
    );
    return result === 'OK';
  } catch { return true; }
};

const releaseRefreshLock = async (userId: string): Promise<void> => {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.del(`refresh:lock:${userId}`);
  } catch { }
};

// ============================================
// MAIN AUTH MIDDLEWARE - CLEAN VERSION
// ============================================
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = extractToken(req);

    // ✅ FIX: Sirf tab refresh karo jab token bilkul nahi hai
    // Agar token hai (chahe expired ho) toh pehle verify karo
    // Expired hone pe interceptor handle karega frontend pe
    if (!token && req.cookies?.refreshToken) {
      // ✅ No token at all - try auto-refresh
      let userId: string | null = null;

      try {
        const { verifyRefreshToken } = await import('../utils/jwt');
        const payload = verifyRefreshToken(req.cookies.refreshToken);
        userId = payload.userId;
      } catch {
        // Invalid refresh token
        throw new AppError('Access token required', 401);
      }

      if (!userId) {
        throw new AppError('Access token required', 401);
      }

      // ✅ Lock prevent karo concurrent refresh
      const lockAcquired = await acquireRefreshLock(userId);

      if (!lockAcquired) {
        // Dusri request refresh kar rahi hai - 1 second wait karo
        await new Promise(r => setTimeout(r, 1000));
        token = req.cookies?.accessToken || '';

        if (!token) {
          throw new AppError('Access token expired', 401);
        }
      } else {
        try {
          const newTokens = await authService.refreshToken(req.cookies.refreshToken);

          res.cookie('refreshToken', newTokens.refreshToken, getCookieOptions(true));
          res.cookie('accessToken', newTokens.accessToken, getCookieOptions(false));
          res.setHeader('x-new-access-token', newTokens.accessToken);
          res.setHeader('x-token-refreshed', 'true');
          res.setHeader(
            'Access-Control-Expose-Headers',
            'x-new-access-token, x-token-refreshed'
          );

          token = newTokens.accessToken;
        } catch (refreshError: any) {
          console.warn('❌ Auto-refresh failed:', refreshError.message);
          throw new AppError('Access token expired', 401);
        } finally {
          await releaseRefreshLock(userId);
        }
      }
    }

    if (!token) {
      throw new AppError('Access token required', 401);
    }

    // ✅ Verify token
    let decoded: TokenPayload;
    try {
      decoded = verifyAccessToken(token) as TokenPayload;
    } catch (jwtError: any) {
      if (jwtError?.name === 'TokenExpiredError') {
        throw new AppError('Access token expired', 401);
      }
      throw new AppError('Invalid access token', 401);
    }

    // ✅ Fetch user
    let user = await fetchUser(decoded.userId);
    if (!user) throw new AppError('User not found', 401);

    // ✅ TokenVersion check
    if (
      decoded.tokenVersion !== undefined &&
      user.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      user = await fetchUser(decoded.userId, true);
      if (!user) throw new AppError('User not found', 401);

      if (decoded.tokenVersion !== user.tokenVersion) {
        await safeRedisDel(`${USER_CACHE_PREFIX}${decoded.userId}`);
        throw new AppError('Session expired. Please login again.', 401);
      }
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError('Account suspended. Please contact support.', 403);
    }

    // ✅ Organization
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
      }
    }

    req.user = { id: user.id, email: user.email, organizationId };
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
    if (!req.user) throw new AppError('Authentication required', 401);

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { emailVerified: true },
    });

    if (!user?.emailVerified) {
      throw new AppError('Email verification required', 403);
    }
    next();
  } catch (error) { next(error); }
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
      select: { id: true, name: true, slug: true, planType: true, ownerId: true },
    });

    if (!organization) throw new AppError('Organization not found', 404);
    req.organization = organization as any;
    next();
  } catch (error) { next(error); }
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
            id: user.id, email: user.email,
            organizationId: decoded.organizationId,
          };
        }
      } catch { }
    }
    next();
  } catch (error) { next(error); }
};