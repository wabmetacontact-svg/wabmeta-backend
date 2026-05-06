"use strict";
// src/middleware/auth.ts
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
const redis = (0, redis_1.getRedis)();
const USER_CACHE_PREFIX = 'user:auth:';
const CACHE_TTL = 120; // 120 seconds
const cookieOptions = (isRefresh = false) => {
    return {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: isRefresh ? 7 * 24 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000,
        path: '/',
    };
};
const authenticate = async (req, res, next) => {
    try {
        let token = '';
        // 1. Check Header (Authorization or authorization)
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (authHeader && /^Bearer /i.test(authHeader)) {
            token = authHeader.split(' ')[1];
        }
        // 2. Check Alternative Headers
        else if (req.headers['x-access-token']) {
            token = req.headers['x-access-token'];
        }
        // 3. Check Cookies
        else if (req.cookies?.accessToken || req.cookies?.token) {
            token = req.cookies.accessToken || req.cookies.token;
        }
        // 4. Check Query Parameter (as a last resort)
        else if (req.query.token) {
            token = req.query.token;
        }
        // 🔄 AUTO-HEALING: If no access token but refresh cookie exists
        if (!token && req.cookies?.refreshToken) {
            try {
                console.log('🛡️ Auto-healing: Missing access token but found refresh cookie. Attempting background refresh...');
                const newTokens = await auth_service_1.authService.refreshToken(req.cookies.refreshToken);
                // Success! Set new cookies and use the new access token
                res.cookie('refreshToken', newTokens.refreshToken, cookieOptions(true));
                res.cookie('accessToken', newTokens.accessToken, cookieOptions(false));
                res.setHeader('x-new-access-token', newTokens.accessToken);
                res.setHeader('x-token-refreshed', 'true');
                res.setHeader('Access-Control-Expose-Headers', 'x-new-access-token, x-token-refreshed');
                token = newTokens.accessToken;
                console.log('✅ Auto-healing: Session restored silently and synced.');
            }
            catch (refreshError) {
                console.warn('❌ Auto-healing failed:', refreshError.message);
                // Fall through to 401 handling
            }
        }
        if (!token) {
            console.warn(`🔒 Auth failed: No token found. Cookies received: ${JSON.stringify(Object.keys(req.cookies || {}))}`, {
                url: req.originalUrl,
                headers: Object.keys(req.headers),
                query: Object.keys(req.query)
            });
            throw new errorHandler_1.AppError('Access token required', 401);
        }
        // Verify token
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        // ✅ Get organizationId (from token or fetch from DB)
        let organizationId = decoded.organizationId;
        if (!organizationId) {
            console.log('⚠️ organizationId missing in token, fixing...');
            let membership = await database_1.default.organizationMember.findFirst({
                where: { userId: decoded.userId },
                include: { organization: true }
            });
            if (!membership) {
                // Auto create organization
                const userToFix = await database_1.default.user.findUnique({ where: { id: decoded.userId } });
                if (userToFix) {
                    const orgName = `${userToFix.firstName || 'User'}'s Workspace`;
                    const organization = await database_1.default.organization.create({
                        data: {
                            name: orgName,
                            slug: orgName.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Math.random().toString(36).substring(2, 7),
                            ownerId: userToFix.id,
                            planType: 'FREE_DEMO',
                            featureSimpleBulkUpload: false,
                            featureCsvUpload: false,
                            featureOverrideByAdmin: false,
                        }
                    });
                    membership = await database_1.default.organizationMember.create({
                        data: {
                            organizationId: organization.id,
                            userId: userToFix.id,
                            role: 'OWNER',
                            joinedAt: new Date()
                        },
                        include: { organization: true }
                    });
                    const freePlan = await database_1.default.plan.findUnique({ where: { type: 'FREE_DEMO' } });
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
        // ✅ Distributed Caching for Production
        let user = null;
        if (redis) {
            const cachedUser = await redis.get(`${USER_CACHE_PREFIX}${decoded.userId}`);
            if (cachedUser) {
                user = JSON.parse(cachedUser);
            }
        }
        if (!user) {
            // Check if user exists
            user = await database_1.default.user.findUnique({
                where: { id: decoded.userId },
                select: {
                    id: true,
                    email: true,
                    status: true,
                    emailVerified: true,
                },
            });
            if (user && redis) {
                // Cache user status for 2 minutes to reduce DB hits
                await redis.set(`${USER_CACHE_PREFIX}${decoded.userId}`, JSON.stringify(user), 'EX', CACHE_TTL);
            }
        }
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 401);
        }
        if (user.status === 'SUSPENDED') {
            throw new errorHandler_1.AppError('Account suspended', 403);
        }
        // Attach user to request
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
                    select: {
                        id: true,
                        email: true,
                        status: true,
                    },
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
                // Token invalid, continue without user
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