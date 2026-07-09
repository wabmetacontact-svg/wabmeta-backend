"use strict";
// src/middleware/rateLimit.ts - PRODUCTION READY
// ✅ IPv6 compliant (uses ipKeyGenerator helper)
// ✅ Optimized for Render Paid Plan
// ✅ Trust proxy aware
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = exports.rateLimit_fn = exports.uploadRateLimit = exports.webhookRateLimit = exports.campaignLimiter = exports.campaignRateLimit = exports.apiLimiter = exports.apiRateLimit = exports.otpRateLimit = exports.authLimiter = exports.authRateLimit = exports.createRateLimiter = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
// ============================================
// ✅ IPv6-safe key generator
// ============================================
const safeKeyGenerator = (req) => {
    const forwardedIp = req.headers['x-forwarded-for']
        ?.split(',')[0]
        ?.trim();
    const ip = forwardedIp || req.ip || 'unknown';
    // ✅ CRITICAL: ipKeyGenerator handles IPv6 subnet grouping
    return (0, express_rate_limit_1.ipKeyGenerator)(ip);
};
// ============================================
// ✅ CORE FACTORY
// ============================================
const createRateLimiter = (options) => {
    const { windowMs, max, message = 'Too many requests, please try again later.', } = options;
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        keyGenerator: safeKeyGenerator,
        skip: (req) => {
            return (req.path === '/health' ||
                req.path === '/api/health' ||
                req.path === '/');
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
// ✅ PRE-BUILT LIMITERS (Paid Plan Optimized)
// ============================================
exports.authRateLimit = (0, exports.createRateLimiter)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    keyPrefix: 'auth',
});
exports.authLimiter = exports.authRateLimit;
exports.otpRateLimit = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    max: 3,
    message: 'Too many OTP requests. Please wait 1 minute.',
    keyPrefix: 'otp',
});
exports.apiRateLimit = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    max: 200,
    message: 'Too many API requests.',
    keyPrefix: 'api',
});
exports.apiLimiter = exports.apiRateLimit;
exports.campaignRateLimit = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many campaign requests.',
    keyPrefix: 'campaign',
});
exports.campaignLimiter = exports.campaignRateLimit;
exports.webhookRateLimit = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    max: 2000,
    message: 'Webhook rate limit exceeded.',
    keyPrefix: 'webhook',
});
exports.uploadRateLimit = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many upload requests.',
    keyPrefix: 'upload',
});
// ============================================
// ✅ GENERIC rateLimit() FUNCTION
// ============================================
const rateLimit_fn = (options) => (0, exports.createRateLimiter)(options);
exports.rateLimit_fn = rateLimit_fn;
exports.rateLimit = exports.rateLimit_fn;
exports.default = {
    createRateLimiter: exports.createRateLimiter,
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