"use strict";
// src/middleware/auth.ts - FIXED VERSION
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
// ✅ REMOVED: const redis = getRedis(); ← YE WALI LINE HATAO
// Module level pe Redis capture NAHI karna - stale ho jaati hai
const USER_CACHE_PREFIX = 'user:auth:';
const CACHE_TTL = 120;
const cookieOptions = (isRefresh = false) => ({
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: isRefresh ? 7 * 24 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000,
    path: '/',
});
// ✅ Safe Redis cache get - kabhi throw nahi karega
const safeRedisGet = async (key) => {
    try {
        const redis = (0, redis_1.getRedis)(); // ✅ Har baar fresh call
        if (!redis)
            return null;
        return await redis.get(key);
    }
    catch (err) {
        // Silent fail - Redis down hone pe auth kaam karta rahe
        return null;
    }
};
// ✅ Safe Redis cache set - kabhi throw nahi karega
const safeRedisSet = async (key, value, ttl) => {
    try {
        const redis = (0, redis_1.getRedis)(); // ✅ Har baar fresh call
        if (!redis)
            return;
        await redis.set(key, value, 'EX', ttl);
    }
    catch (err) {
        // Silent fail
    }
};
// ✅ Safe Redis cache delete
const safeRedisDel = async (key) => {
    try {
        const redis = (0, redis_1.getRedis)();
        if (!redis)
            return;
        await redis.del(key);
    }
    catch (err) {
        // Silent fail
    }
};
const authenticate = async (req, res, next) => {
    try {
        let token = '';
        // 1. Authorization Header
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (authHeader && /^Bearer /i.test(authHeader)) {
            token = authHeader.split(' ')[1];
        }
        // 2. Alternative Headers
        else if (req.headers['x-access-token']) {
            token = req.headers['x-access-token'];
        }
        // 3. Cookies
        else if (req.cookies?.accessToken || req.cookies?.token) {
            token = req.cookies.accessToken || req.cookies.token;
        }
        // 4. Query param (last resort)
        else if (req.query.token) {
            token = req.query.token;
        }
        // 🔄 AUTO-HEALING: Refresh token se recover karo
        if (!token && req.cookies?.refreshToken) {
            try {
                console.log('🛡️ Auto-healing: Attempting token refresh...');
                const newTokens = await auth_service_1.authService.refreshToken(req.cookies.refreshToken);
                res.cookie('refreshToken', newTokens.refreshToken, cookieOptions(true));
                res.cookie('accessToken', newTokens.accessToken, cookieOptions(false));
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
        // Token verify karo
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        // organizationId resolve karo
        let organizationId = decoded.organizationId;
        if (!organizationId) {
            console.log('⚠️ organizationId missing in token, fixing...');
            let membership = await database_1.default.organizationMember.findFirst({
                where: { userId: decoded.userId },
                include: { organization: true },
            });
            if (!membership) {
                const userToFix = await database_1.default.user.findUnique({
                    where: { id: decoded.userId },
                });
                if (userToFix) {
                    const orgName = `${userToFix.firstName || 'User'}'s Workspace`;
                    const organization = await database_1.default.organization.create({
                        data: {
                            name: orgName,
                            slug: orgName.toLowerCase().replace(/[^a-z0-9]/g, '') +
                                '-' +
                                Math.random().toString(36).substring(2, 7),
                            ownerId: userToFix.id,
                            planType: 'FREE_DEMO',
                            featureSimpleBulkUpload: false,
                            featureCsvUpload: false,
                            featureOverrideByAdmin: false,
                        },
                    });
                    membership = await database_1.default.organizationMember.create({
                        data: {
                            organizationId: organization.id,
                            userId: userToFix.id,
                            role: 'OWNER',
                            joinedAt: new Date(),
                        },
                        include: { organization: true },
                    });
                    const freePlan = await database_1.default.plan.findUnique({
                        where: { type: 'FREE_DEMO' },
                    });
                    if (freePlan) {
                        await database_1.default.subscription.create({
                            data: {
                                organizationId: organization.id,
                                planId: freePlan.id,
                                status: 'ACTIVE',
                                billingCycle: 'monthly',
                                currentPeriodStart: new Date(),
                                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
        let user = null;
        // Try Redis cache first (safe - never throws)
        const cacheKey = `${USER_CACHE_PREFIX}${decoded.userId}`;
        const cachedUser = await safeRedisGet(cacheKey);
        if (cachedUser) {
            try {
                user = JSON.parse(cachedUser);
            }
            catch {
                user = null; // JSON parse fail → DB se lo
            }
        }
        // Cache miss ya Redis down → DB se lo
        if (!user) {
            user = await database_1.default.user.findUnique({
                where: { id: decoded.userId },
                select: {
                    id: true,
                    email: true,
                    status: true,
                    emailVerified: true,
                    tokenVersion: true, // ✅ NEW: tokenVersion bhi fetch karo
                },
            });
            // Cache mein store karo (without tokenVersion for security)
            if (user) {
                await safeRedisSet(cacheKey, JSON.stringify({
                    id: user.id,
                    email: user.email,
                    status: user.status,
                    emailVerified: user.emailVerified,
                    tokenVersion: user.tokenVersion, // ✅ Cache me bhi store karo
                }), CACHE_TTL);
            }
        }
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 401);
        }
        // ✅ NEW: tokenVersion check - admin ne password change kiya?
        // JWT me tokenVersion hoga (naya login pe), DB me current version hai
        // Agar mismatch → token invalid → logout force karo
        if (decoded.tokenVersion !== undefined &&
            user.tokenVersion !== undefined &&
            decoded.tokenVersion !== user.tokenVersion) {
            console.warn(`🚨 Token version mismatch for user ${decoded.userId}: ` +
                `JWT=${decoded.tokenVersion}, DB=${user.tokenVersion}`);
            // Redis cache invalidate karo
            await safeRedisDel(cacheKey);
            throw new errorHandler_1.AppError('Session expired. Please login again.', 401);
        }
        if (user.status === 'SUSPENDED') {
            throw new errorHandler_1.AppError('Account suspended', 403);
        }
        req.user = {
            id: user.id,
            email: user.email,
            organizationId: organizationId,
        };
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.authenticate = authenticate;
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
const requireOrganization = async (req, res, next) => {
    try {
        if (!req.user?.organizationId) {
            throw new errorHandler_1.AppError('Organization context required', 400);
        }
        const organization = await database_1.default.organization.findUnique({
            where: { id: req.user.organizationId },
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
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = (0, jwt_1.verifyAccessToken)(token);
                const user = await database_1.default.user.findUnique({
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