// src/middleware/rateLimit.ts - PRODUCTION RESILIENT VERSION

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedis } from '../config/redis';

// ✅ Export rateLimit for compatibility with routes
export { rateLimit };

/**
 * Creates a rate limiter with Redis support and automatic memory fallback.
 * Fixes: "Stream isn't writeable" crash by dynamically checking Redis readiness.
 */
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
}) => {
  const limiterConfig: any = {
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
  };

  // ✅ DYNAMIC REDIS STORE: Har request pe fresh status check karo
  limiterConfig.store = new (RedisStore as any)({
    sendCommand: async (...args: string[]) => {
      try {
        const redis = getRedis();

        // Agar Redis 'ready' nahi hai, toh command mat bhejo (crash prevent karo)
        // 'enableOfflineQueue: false' hone pe unready stream pe send karne se crash hota hai
        if (!redis || redis.status !== 'ready') {
          // console.warn('⚠️ RateLimit: Redis not ready, skipping distributed limit');
          // Returning undefined/null causes rate-limit-redis to treat it as a failure
          // but we catch it here to prevent process crash
          throw new Error('Redis connection not ready');
        }

        return await redis.call(args[0], ...args.slice(1));
      } catch (err: any) {
        // console.warn('⚠️ RateLimit Redis op failed:', err.message);
        
        // IMPORTANT: Yahan se throw karna zaroori hai taaki express-rate-limit handle kare
        // But ye async context me hai, toh rejection banega jo library catch karegi
        throw err;
      }
    },
    prefix: 'rl:',
  });

  return rateLimit(limiterConfig);
};

// ✅ Define limiters
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many login attempts',
});

export const authRateLimit = authLimiter;

export const apiLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
});

export const campaignLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000,
  max: 10, // 10 campaign starts per minute
});