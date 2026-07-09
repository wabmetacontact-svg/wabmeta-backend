"use strict";
// src/middleware/auth.ts - PRODUCTION READY
// ✅ Cache TTL increased to 5 minutes (paid plan)
// ✅ Better error handling
// ✅ Pool timeout graceful degradation
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
const CACHE_TTL = 300; // ✅ 5 minutes (paid plan can afford longer cache)
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
    catch {
        // Silent
    }
};
const safeRedisDel = async (key) => {
    try {
        const redis = (0, redis_1.getRedis)();
        if (!redis)
            return;
        await redis.del(key);
    }
    catch {
        // Silent
    }
};
const fetchUser = async (userId, forceRefresh = false) => {
    const cacheKey = `${USER_CACHE_PREFIX}${userId}`;
    if (!forceRefresh) {
        const cached = await safeRedisGet(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            }
            catch {
                // Cache corrupt
            }
        }
    }
    try {
        const user = await database_1.default.user.findUnique({
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
    }
    catch (err) {
        if (err?.code === 'P2024') {
            console.warn('⚠️  Auth middleware: DB pool busy, trying cache fallback');
            const cached = await safeRedisGet(cacheKey);
            if (cached) {
                try {
                    console.log('✅ Auth: Serving from cache during pool pressure');
                    return JSON.parse(cached);
                }
                catch {
                    return null;
                }
            }
            throw new errorHandler_1.AppError('Service temporarily busy. Please retry.', 503);
        }
        throw err;
    }
};
// ============================================
// MAIN AUTH MIDDLEWARE
// ============================================
const authenticate = async (req, res, next) => {
    try {
        let token = '';
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (authHeader && /^Bearer /i.test(authHeader)) {
            token = authHeader.split(' ')[1];
        }
        else if (req.headers['x-access-token']) {
            token = req.headers['x-access-token'];
        }
        else if (req.cookies?.accessToken || req.cookies?.token) {
            token = req.cookies.accessToken || req.cookies.token;
        }
        else if (req.query.token) {
            token = req.query.token;
        }
        // Auto-heal via refresh token
        if (!token && req.cookies?.refreshToken) {
            try {
                console.log('🛡️ Auto-healing: Attempting token refresh...');
                const newTokens = await auth_service_1.authService.refreshToken(req.cookies.refreshToken);
                res.cookie('refreshToken', newTokens.refreshToken, (0, cookies_1.getCookieOptions)(true));
                res.cookie('accessToken', newTokens.accessToken, (0, cookies_1.getCookieOptions)(false));
                res.setHeader('x-new-access-token', newTokens.accessToken);
                res.setHeader('x-token-refreshed', 'true');
                res.setHeader('Access-Control-Expose-Headers', 'x-new-access-token, x-token-refreshed');
                token = newTokens.accessToken;
                console.log('✅ Auto-healing: Session restored.');
            }
            catch (refreshError) {
                console.warn('❌ Auto-healing failed:', refreshError.message);
            }
        }
        if (!token) {
            throw new errorHandler_1.AppError('Access token required', 401);
        }
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
        let user = await fetchUser(decoded.userId);
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 401);
        }
        // tokenVersion check with DB fallback
        if (decoded.tokenVersion !== undefined &&
            user.tokenVersion !== undefined &&
            decoded.tokenVersion !== user.tokenVersion) {
            console.warn(`⚠️  tokenVersion mismatch for ${decoded.userId}: ` +
                `token=${decoded.tokenVersion}, cache=${user.tokenVersion} → refreshing from DB`);
            user = await fetchUser(decoded.userId, true);
            if (!user) {
                throw new errorHandler_1.AppError('User not found', 401);
            }
            if (decoded.tokenVersion !== user.tokenVersion) {
                console.warn(`🚨 tokenVersion CONFIRMED mismatch for ${decoded.userId}: ` +
                    `token=${decoded.tokenVersion}, DB=${user.tokenVersion}`);
                await safeRedisDel(`${USER_CACHE_PREFIX}${decoded.userId}`);
                throw new errorHandler_1.AppError('Session expired. Please login again.', 401);
            }
            console.log(`✅ tokenVersion verified from DB for ${decoded.userId}`);
        }
        if (user.status === 'SUSPENDED') {
            throw new errorHandler_1.AppError('Account suspended. Please contact support.', 403);
        }
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
                console.warn('⚠️  Could not fetch organizationId: pool busy');
            }
        }
        req.user = {
            id: user.id,
            email: user.email,
            organizationId,
        };
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
        if (!req.user) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
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
            select: {
                id: true,
                name: true,
                slug: true,
                planType: true,
                ownerId: true,
            },
        });
        if (!organization) {
            throw new errorHandler_1.AppError('Organization not found', 404);
        }
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
                        id: user.id,
                        email: user.email,
                        organizationId: decoded.organizationId,
                    };
                }
            }
            catch {
                // Invalid token - continue without user
            }
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map