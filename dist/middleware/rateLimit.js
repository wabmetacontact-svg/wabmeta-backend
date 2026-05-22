"use strict";
// src/middleware/rateLimit.ts - FIXED: No module-level Redis initialization
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = exports.rateLimit_fn = exports.uploadRateLimit = exports.webhookRateLimit = exports.campaignLimiter = exports.campaignRateLimit = exports.apiLimiter = exports.apiRateLimit = exports.otpRateLimit = exports.authLimiter = exports.authRateLimit = exports.createRedisRateLimiter = exports.createRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const redis_1 = require("../config/redis");
// ============================================
// ✅ CORE FACTORY - Redis-free, crash-proof
// ============================================
const createRateLimiter = (options) => {
    const { windowMs, max, message = 'Too many requests, please try again later.', } = options;
    // ✅ NO RedisStore at module load time
    // Memory store use karo - Render single instance ke liye PERFECT hai
    // Redis store sirf multi-server cluster ke liye zaroori hota hai
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        // ✅ Memory store (default) - Redis crash nahi karega
        // store: undefined  ← express-rate-limit apna MemoryStore use karega
        // ✅ Custom key generator (IP based)
        keyGenerator: (req) => {
            return (req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                req.ip ||
                'unknown');
        },
        message: {
            success: false,
            message,
            statusCode: 429,
        },
        handler: (_req, res) => {
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
exports.createRateLimiter = createRateLimiter;
// ============================================
// ✅ REDIS STORE FACTORY - Sirf jab explicitly chahiye
// Aur sirf tab call karo jab server fully started ho
// ============================================
const createRedisRateLimiter = (options) => {
    // ✅ Pehle memory-based limiter banao
    const memoryLimiter = (0, exports.createRateLimiter)(options);
    // ✅ Redis store lazily attach karne ki koshish karo
    let redisLimiter = null;
    let redisAttempted = false;
    // ✅ Middleware jo dynamically decide kare
    const handler = (req, res, next) => {
        // Redis limiter already bana hai → use karo
        if (redisLimiter) {
            return redisLimiter(req, res, next);
        }
        // Redis limiter banane ki koshish karo (sirf ek baar)
        if (!redisAttempted) {
            redisAttempted = true;
            try {
                const redis = (0, redis_1.getRedis)();
                if (redis && redis.status === 'ready') {
                    // ✅ Dynamic import to avoid module-load crash
                    const RedisStore = require('rate-limit-redis');
                    const store = new RedisStore.default({
                        sendCommand: async (...args) => {
                            const r = (0, redis_1.getRedis)();
                            if (!r || r.status !== 'ready') {
                                throw new Error('Redis not ready');
                            }
                            // @ts-ignore
                            return r.call(...args);
                        },
                        prefix: `${options.keyPrefix || 'rl'}:`,
                    });
                    redisLimiter = (0, express_rate_limit_1.default)({
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
                        handler: (_req, res) => {
                            res.status(429).json({
                                success: false,
                                message: options.message || 'Too many requests',
                                retryAfter: Math.ceil(options.windowMs / 1000),
                            });
                        },
                    });
                    console.log(`✅ Rate limiter [${options.keyPrefix}]: Upgraded to Redis store`);
                    return redisLimiter(req, res, next);
                }
            }
            catch (err) {
                console.warn(`⚠️  Redis rate limiter init failed: ${err.message}. Using memory.`);
                redisAttempted = false; // Agli request pe retry karo
            }
        }
        // Fallback: memory limiter
        return memoryLimiter(req, res, next);
    };
    // ✅ Attach methods to satisfy RateLimitRequestHandler interface
    handler.resetKey = (key) => (redisLimiter || memoryLimiter).resetKey(key);
    handler.getKey = (key) => (redisLimiter || memoryLimiter).getKey(key);
    return handler;
};
exports.createRedisRateLimiter = createRedisRateLimiter;
// ============================================
// ✅ PRE-BUILT LIMITERS - Memory based, crash-proof
// ============================================
// Auth - strict
exports.authRateLimit = (0, exports.createRateLimiter)({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 10,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    keyPrefix: 'auth',
});
exports.authLimiter = exports.authRateLimit; // alias
// OTP - very strict
exports.otpRateLimit = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000, // 1 min
    max: 3,
    message: 'Too many OTP requests. Please wait 1 minute.',
    keyPrefix: 'otp',
});
// API - general
exports.apiRateLimit = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000, // 1 min
    max: 100,
    message: 'Too many API requests.',
    keyPrefix: 'api',
});
exports.apiLimiter = exports.apiRateLimit; // alias
// Campaign - medium
exports.campaignRateLimit = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many campaign requests.',
    keyPrefix: 'campaign',
});
exports.campaignLimiter = exports.campaignRateLimit; // alias
// Webhook - high volume
exports.webhookRateLimit = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    max: 1000,
    message: 'Webhook rate limit exceeded.',
    keyPrefix: 'webhook',
});
// Upload - slow
exports.uploadRateLimit = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many upload requests.',
    keyPrefix: 'upload',
});
// ============================================
// ✅ GENERIC rateLimit() FUNCTION
// Routes mein use hota hai: rateLimit({ windowMs, max })
// ============================================
const rateLimit_fn = (options) => (0, exports.createRateLimiter)(options);
exports.rateLimit_fn = rateLimit_fn;
exports.rateLimit = exports.rateLimit_fn;
exports.default = {
    createRateLimiter: exports.createRateLimiter,
    createRedisRateLimiter: exports.createRedisRateLimiter,
    authRateLimit: exports.authRateLimit,
    authLimiter: exports.authLimiter,
    otpRateLimit: exports.otpRateLimit,
    apiRateLimit: exports.apiRateLimit,
    apiLimiter: exports.apiLimiter,
    campaignRateLimit: exports.campaignRateLimit,
    campaignLimiter: exports.campaignLimiter,
    webhookRateLimit: exports.webhookRateLimit,
    uploadRateLimit: exports.uploadRateLimit,
    rateLimit: exports.rateLimit_fn,
};
//# sourceMappingURL=rateLimit.js.map