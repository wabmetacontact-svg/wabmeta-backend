"use strict";
// src/middleware/auth.ts - FINAL FIX
// ✅ FIX: Token expired pe SEEDHA refresh karo, auto-heal complex logic hatao
// ✅ FIX: Race condition prevent karo - simple aur reliable
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireOrganization = exports.requireEmailVerified = exports.authenticate = void 0;
const jwt_1 = require("../utils/jwt");
const errorHandler_1 = require("./errorHandler");
const database_1 = __importDefault(require("../config/database"));
const redis_1 = require("../config/redis");
const auth_service_1 = require("../modules/auth/auth.service");
const cookies_1 = require("../utils/cookies");
const USER_CACHE_PREFIX = 'user:auth:';
const CACHE_TTL = 300;
// ============================================
// SAFE REDIS HELPERS
// ============================================
const safeRedisGet = async (key) => {
    try {
        const redis = (0, redis_1.getRedis)();
        if (!redis)
            return null;
        return await redis.get(key);
    }
    catch {
        return null;
    }
};
const safeRedisSet = async (key, value, ttl) => {
    try {
        const redis = (0, redis_1.getRedis)();
        if (!redis)
            return;
        await redis.set(key, value, 'EX', ttl);
    }
    catch { }
};
const safeRedisDel = async (key) => {
    try {
        const redis = (0, redis_1.getRedis)();
        if (!redis)
            return;
        await redis.del(key);
    }
    catch { }
};
const fetchUser = async (userId, forceRefresh = false) => {
    const cacheKey = `${USER_CACHE_PREFIX}${userId}`;
    if (!forceRefresh) {
        const cached = await safeRedisGet(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            }
            catch { }
        }
    }
    try {
        const user = await database_1.default.user.findUnique({
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
    }
    catch (err) {
        if (err?.code === 'P2024') {
            const cached = await safeRedisGet(cacheKey);
            if (cached) {
                try {
                    return JSON.parse(cached);
                }
                catch { }
            }
            throw new errorHandler_1.AppError('Service temporarily busy. Please retry.', 503);
        }
        throw err;
    }
};
// ============================================
// ✅ SIMPLE TOKEN EXTRACTOR
// ============================================
const extractToken = (req) => {
    // 1. Authorization header
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && /^Bearer /i.test(authHeader)) {
        return authHeader.split(' ')[1];
    }
    // 2. x-access-token header
    if (req.headers['x-access-token']) {
        return req.headers['x-access-token'];
    }
    // 3. Cookie
    if (req.cookies?.accessToken)
        return req.cookies.accessToken;
    if (req.cookies?.token)
        return req.cookies.token;
    // 4. Query param
    if (req.query.token)
        return req.query.token;
    return '';
};
// ============================================
// ✅ REFRESH LOCK (prevent concurrent refresh)
// ============================================
const acquireRefreshLock = async (userId) => {
    try {
        const redis = (0, redis_1.getRedis)();
        if (!redis)
            return true;
        const result = await redis.set(`refresh:lock:${userId}`, '1', 'EX', 15, 'NX');
        return result === 'OK';
    }
    catch {
        return true;
    }
};
const releaseRefreshLock = async (userId) => {
    try {
        const redis = (0, redis_1.getRedis)();
        if (!redis)
            return;
        await redis.del(`refresh:lock:${userId}`);
    }
    catch { }
};
// ============================================
// MAIN AUTH MIDDLEWARE - CLEAN VERSION
// ============================================
const authenticate = async (req, res, next) => {
    try {
        let token = extractToken(req);
        // ✅ FIX: Sirf tab refresh karo jab token bilkul nahi hai
        // Agar token hai (chahe expired ho) toh pehle verify karo
        // Expired hone pe interceptor handle karega frontend pe
        if (!token && req.cookies?.refreshToken) {
            // ✅ No token at all - try auto-refresh
            let userId = null;
            try {
                const { verifyRefreshToken } = await Promise.resolve().then(() => __importStar(require('../utils/jwt')));
                const payload = verifyRefreshToken(req.cookies.refreshToken);
                userId = payload.userId;
            }
            catch {
                // Invalid refresh token
                throw new errorHandler_1.AppError('Access token required', 401);
            }
            if (!userId) {
                throw new errorHandler_1.AppError('Access token required', 401);
            }
            // ✅ Lock prevent karo concurrent refresh
            const lockAcquired = await acquireRefreshLock(userId);
            if (!lockAcquired) {
                // Dusri request refresh kar rahi hai - 1 second wait karo
                await new Promise(r => setTimeout(r, 1000));
                token = req.cookies?.accessToken || '';
                if (!token) {
                    throw new errorHandler_1.AppError('Access token expired', 401);
                }
            }
            else {
                try {
                    const newTokens = await auth_service_1.authService.refreshToken(req.cookies.refreshToken);
                    res.cookie('refreshToken', newTokens.refreshToken, (0, cookies_1.getCookieOptions)(true));
                    res.cookie('accessToken', newTokens.accessToken, (0, cookies_1.getCookieOptions)(false));
                    res.setHeader('x-new-access-token', newTokens.accessToken);
                    res.setHeader('x-token-refreshed', 'true');
                    res.setHeader('Access-Control-Expose-Headers', 'x-new-access-token, x-token-refreshed');
                    token = newTokens.accessToken;
                }
                catch (refreshError) {
                    console.warn('❌ Auto-refresh failed:', refreshError.message);
                    throw new errorHandler_1.AppError('Access token expired', 401);
                }
                finally {
                    await releaseRefreshLock(userId);
                }
            }
        }
        if (!token) {
            throw new errorHandler_1.AppError('Access token required', 401);
        }
        // ✅ Verify token
        let decoded;
        try {
            decoded = (0, jwt_1.verifyAccessToken)(token);
        }
        catch (jwtError) {
            if (jwtError?.name === 'TokenExpiredError') {
                throw new errorHandler_1.AppError('Access token expired', 401);
            }
            throw new errorHandler_1.AppError('Invalid access token', 401);
        }
        // ✅ Fetch user
        let user = await fetchUser(decoded.userId);
        if (!user)
            throw new errorHandler_1.AppError('User not found', 401);
        // ✅ TokenVersion check
        if (decoded.tokenVersion !== undefined &&
            user.tokenVersion !== undefined &&
            decoded.tokenVersion !== user.tokenVersion) {
            user = await fetchUser(decoded.userId, true);
            if (!user)
                throw new errorHandler_1.AppError('User not found', 401);
            if (decoded.tokenVersion !== user.tokenVersion) {
                await safeRedisDel(`${USER_CACHE_PREFIX}${decoded.userId}`);
                throw new errorHandler_1.AppError('Session expired. Please login again.', 401);
            }
        }
        if (user.status === 'SUSPENDED') {
            throw new errorHandler_1.AppError('Account suspended. Please contact support.', 403);
        }
        // ✅ Organization
        let organizationId = decoded.organizationId;
        if (!organizationId) {
            try {
                const membership = await database_1.default.organizationMember.findFirst({
                    where: { userId: decoded.userId },
                    select: { organizationId: true },
                });
                organizationId = membership?.organizationId;
            }
            catch (err) {
                if (err?.code !== 'P2024')
                    throw err;
            }
        }
        // A soft-deleted organization must behave as if it no longer exists: drop
        // the org context so every org-scoped route rejects. This is the single
        // gate that blocks access to a deleted org's data.
        if (organizationId) {
            const org = await database_1.default.organization.findFirst({
                where: { id: organizationId, deletedAt: null },
                select: { id: true },
            });
            if (!org)
                organizationId = undefined;
        }
        req.user = { id: user.id, email: user.email, organizationId };
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.authenticate = authenticate;
// ============================================
// REQUIRE EMAIL VERIFIED
// ============================================
const requireEmailVerified = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError('Authentication required', 401);
        const user = await database_1.default.user.findUnique({
            where: { id: req.user.id },
            select: { emailVerified: true },
        });
        if (!user?.emailVerified) {
            throw new errorHandler_1.AppError('Email verification required', 403);
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requireEmailVerified = requireEmailVerified;
// ============================================
// REQUIRE ORGANIZATION
// ============================================
const requireOrganization = async (req, res, next) => {
    try {
        if (!req.user?.organizationId) {
            throw new errorHandler_1.AppError('Organization context required', 400);
        }
        const organization = await database_1.default.organization.findUnique({
            where: { id: req.user.organizationId },
            select: { id: true, name: true, slug: true, planType: true, ownerId: true },
        });
        if (!organization)
            throw new errorHandler_1.AppError('Organization not found', 404);
        req.organization = organization;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requireOrganization = requireOrganization;
// ============================================
// OPTIONAL AUTH
// ============================================
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = (0, jwt_1.verifyAccessToken)(token);
                const user = await fetchUser(decoded.userId);
                if (user && user.status !== 'SUSPENDED') {
                    req.user = {
                        id: user.id, email: user.email,
                        organizationId: decoded.organizationId,
                    };
                }
            }
            catch { }
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map