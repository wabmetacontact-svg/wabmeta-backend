// src/middleware/rateLimit.ts - FIXED: No module-level Redis initialization

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { getRedis } from '../config/redis';
import { Request, Response } from 'express';

// ============================================
// ✅ CORE FACTORY - Redis-free, crash-proof
// ============================================

export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}): RateLimitRequestHandler => {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
  } = options;

  // ✅ NO RedisStore at module load time
  // Memory store use karo - Render single instance ke liye PERFECT hai
  // Redis store sirf multi-server cluster ke liye zaroori hota hai

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,

    // ✅ Memory store (default) - Redis crash nahi karega
    // store: undefined  ← express-rate-limit apna MemoryStore use karega

    // ✅ Custom key generator (IP based)
    keyGenerator: (req: Request): string => {
      return (
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        'unknown'
      );
    },

    message: {
      success: false,
      message,
      statusCode: 429,
    },

    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },

    skipFailedRequests: false,
    skipSuccessfulRequests: false,
  });
};

// ============================================
// ✅ REDIS STORE FACTORY - Sirf jab explicitly chahiye
// Aur sirf tab call karo jab server fully started ho
// ============================================

export const createRedisRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}): RateLimitRequestHandler => {
  // ✅ Pehle memory-based limiter banao
  const memoryLimiter = createRateLimiter(options);

  // ✅ Redis store lazily attach karne ki koshish karo
  let redisLimiter: RateLimitRequestHandler | null = null;
  let redisAttempted = false;

  // ✅ Middleware jo dynamically decide kare
  const handler: any = (req: Request, res: Response, next: any) => {
    // Redis limiter already bana hai → use karo
    if (redisLimiter) {
      return redisLimiter(req, res, next);
    }

    // Redis limiter banane ki koshish karo (sirf ek baar)
    if (!redisAttempted) {
      redisAttempted = true;

      try {
        const redis = getRedis();

        if (redis && redis.status === 'ready') {
          // ✅ Dynamic import to avoid module-load crash
          const RedisStore = require('rate-limit-redis');

          const store = new RedisStore.default({
            sendCommand: async (...args: string[]) => {
              const r = getRedis();
              if (!r || r.status !== 'ready') {
                throw new Error('Redis not ready');
              }
              // @ts-ignore
              return r.call(...args);
            },
            prefix: `${options.keyPrefix || 'rl'}:`,
          });

          redisLimiter = rateLimit({
            windowMs: options.windowMs,
            max: options.max,
            standardHeaders: true,
            legacyHeaders: false,
            store,
            message: {
              success: false,
              message: options.message || 'Too many requests',
              statusCode: 429,
            },
            handler: (_req: Request, res: Response) => {
              res.status(429).json({
                success: false,
                message: options.message || 'Too many requests',
                retryAfter: Math.ceil(options.windowMs / 1000),
              });
            },
          });

          console.log(
            `✅ Rate limiter [${options.keyPrefix}]: Upgraded to Redis store`
          );
          return redisLimiter(req, res, next);
        }
      } catch (err: any) {
        console.warn(
          `⚠️  Redis rate limiter init failed: ${err.message}. Using memory.`
        );
        redisAttempted = false; // Agli request pe retry karo
      }
    }

    // Fallback: memory limiter
    return memoryLimiter(req, res, next);
  };

  // ✅ Attach methods to satisfy RateLimitRequestHandler interface
  handler.resetKey = (key: string) => (redisLimiter || memoryLimiter).resetKey(key);
  handler.getKey = (key: string) => (redisLimiter || memoryLimiter).getKey(key);

  return handler as RateLimitRequestHandler;
};

// ============================================
// ✅ PRE-BUILT LIMITERS - Memory based, crash-proof
// ============================================

// Auth - strict
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  keyPrefix: 'auth',
});

export const authLimiter = authRateLimit; // alias

// OTP - very strict
export const otpRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 min
  max: 3,
  message: 'Too many OTP requests. Please wait 1 minute.',
  keyPrefix: 'otp',
});

// API - general
export const apiRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 min
  max: 100,
  message: 'Too many API requests.',
  keyPrefix: 'api',
});

export const apiLimiter = apiRateLimit; // alias

// Campaign - medium
export const campaignRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many campaign requests.',
  keyPrefix: 'campaign',
});

export const campaignLimiter = campaignRateLimit; // alias

// Webhook - high volume
export const webhookRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 1000,
  message: 'Webhook rate limit exceeded.',
  keyPrefix: 'webhook',
});

// Upload - slow
export const uploadRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many upload requests.',
  keyPrefix: 'upload',
});

// ============================================
// ✅ GENERIC rateLimit() FUNCTION
// Routes mein use hota hai: rateLimit({ windowMs, max })
// ============================================

export const rateLimit_fn = (options: {
  windowMs: number;
  max: number;
  message?: string;
}): RateLimitRequestHandler => createRateLimiter(options);

// ✅ Named export jo routes mein use hota hai
export { rateLimit_fn as rateLimit };

export default {
  createRateLimiter,
  createRedisRateLimiter,
  authRateLimit,
  authLimiter,
  otpRateLimit,
  apiRateLimit,
  apiLimiter,
  campaignRateLimit,
  campaignLimiter,
  webhookRateLimit,
  uploadRateLimit,
  rateLimit: rateLimit_fn,
};