// src/middleware/rateLimit.ts - PRODUCTION READY
// ✅ IPv6 compliant (uses ipKeyGenerator helper)
// ✅ Optimized for Render Paid Plan
// ✅ Trust proxy aware

import rateLimit, {
  RateLimitRequestHandler,
  ipKeyGenerator,
} from 'express-rate-limit';
import { Request, Response } from 'express';

// ============================================
// ✅ IPv6-safe key generator
// ============================================

const safeKeyGenerator = (req: Request): string => {
  const forwardedIp = (req.headers['x-forwarded-for'] as string)
    ?.split(',')[0]
    ?.trim();
  
  const ip = forwardedIp || req.ip || 'unknown';
  
  // ✅ CRITICAL: ipKeyGenerator handles IPv6 subnet grouping
  return ipKeyGenerator(ip);
};

// ============================================
// ✅ CORE FACTORY
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

  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,

    keyGenerator: safeKeyGenerator,

    skip: (req) => {
      return (
        req.path === '/health' ||
        req.path === '/api/health' ||
        req.path === '/'
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
// ✅ PRE-BUILT LIMITERS (Paid Plan Optimized)
// ============================================

export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  keyPrefix: 'auth',
});

export const authLimiter = authRateLimit;

export const otpRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Too many OTP requests. Please wait 1 minute.',
  keyPrefix: 'otp',
});

export const apiRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: 'Too many API requests.',
  keyPrefix: 'api',
});

export const apiLimiter = apiRateLimit;

export const campaignRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many campaign requests.',
  keyPrefix: 'campaign',
});

export const campaignLimiter = campaignRateLimit;

export const webhookRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 2000,
  message: 'Webhook rate limit exceeded.',
  keyPrefix: 'webhook',
});

export const uploadRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many upload requests.',
  keyPrefix: 'upload',
});

// ============================================
// ✅ GENERIC rateLimit() FUNCTION
// ============================================

export const rateLimit_fn = (options: {
  windowMs: number;
  max: number;
  message?: string;
}): RateLimitRequestHandler => createRateLimiter(options);

export { rateLimit_fn as rateLimit };

export default {
  createRateLimiter,
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