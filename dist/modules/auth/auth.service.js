"use strict";
// src/modules/auth/auth.service.ts - FIXED VERSION
// ✅ FIX 1: generateTokenPair now returns correct accessExpiresIn (was returning 7d refresh expiry)
// ✅ FIX 2: changePassword now increments tokenVersion (invalidates old access tokens immediately)
// ✅ FIX 3: resetPassword now increments tokenVersion (invalidates old access tokens immediately)
// ✅ FIX 4: logoutAll now increments tokenVersion in a transaction (invalidates in-flight access tokens too)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const config_1 = require("../../config");
const password_1 = require("../../utils/password");
const jwt_1 = require("../../utils/jwt");
const email_resend_1 = require("../../utils/email.resend");
const otp_1 = require("../../utils/otp");
const errorHandler_1 = require("../../middleware/errorHandler");
const google_auth_library_1 = require("google-auth-library");
const redis_1 = require("../../config/redis");
const whatsapp_api_1 = require("../whatsapp/whatsapp.api");
const templateMediaResolver_1 = require("../../utils/templateMediaResolver");
// ============================================
// CONSTANTS
// ============================================
const EMAIL_OTP_PREFIX = 'otp:';
const PHONE_OTP_PREFIX = 'phone_otp:';
const OTP_TTL_SECONDS = 600; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute
// ============================================
// CLIENTS
// ============================================
const googleClient = new google_auth_library_1.OAuth2Client(config_1.config.google.clientId);
// ============================================
// HELPER: Phone Normalizers
// ============================================
const toWhatsAppPhone = (phone) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10)
        return `91${digits}`;
    if (digits.startsWith('91') && digits.length === 12)
        return digits;
    if (digits.startsWith('0') && digits.length === 11)
        return `91${digits.slice(1)}`;
    return digits;
};
const toE164 = (phone) => {
    const wa = toWhatsAppPhone(phone);
    return `+${wa}`;
};
// ============================================
// HELPER: Non-blocking email
// ============================================
const sendEmailNonBlocking = (opts) => {
    void (0, email_resend_1.sendEmail)(opts).catch((err) => console.error('📧 Email send failed (non-blocking):', err?.message));
};
// ============================================
// HELPER: Non-blocking WhatsApp template
// ============================================
const sendWhatsAppTemplate = (phone, templateName, bodyParams = []) => {
    const { phoneNumberId, accessToken } = config_1.config.platform.whatsapp;
    if (!phoneNumberId || !accessToken) {
        console.warn('⚠️  Platform WhatsApp not configured. ' +
            'Add PLATFORM_WA_PHONE_ID & PLATFORM_WA_ACCESS_TOKEN to .env');
        return;
    }
    const waPhone = toWhatsAppPhone(phone);
    database_1.default.template
        .findFirst({
        where: {
            name: templateName,
            whatsappAccount: {
                phoneNumberId: phoneNumberId,
            },
        },
        select: {
            id: true,
            organizationId: true,
            headerType: true,
            headerContent: true,
        },
    })
        .then(async (tpl) => {
        const templateComponents = {};
        if (bodyParams.length > 0) {
            templateComponents.body = bodyParams.map((param) => ({
                type: 'text',
                text: param,
            }));
        }
        if (tpl?.headerContent) {
            const resolvedUrl = await (0, templateMediaResolver_1.resolveTemplateHeaderMedia)(tpl);
            const typeLower = tpl.headerType?.toLowerCase();
            if (typeLower === 'image' || typeLower === 'video' || typeLower === 'document') {
                templateComponents.header = [
                    {
                        type: typeLower,
                        [typeLower]: {
                            link: resolvedUrl,
                            ...(typeLower === 'document' ? { filename: 'Document' } : {}),
                        },
                    },
                ];
            }
        }
        if (config_1.config.nodeEnv === 'development') {
            console.log('\n' + '='.repeat(45));
            console.log(`  📱 WhatsApp Template: ${templateName}`);
            console.log(`  📞 To: +${waPhone}`);
            if (bodyParams.length > 0) {
                console.log(`  📝 Params: ${bodyParams.join(', ')}`);
            }
            if (tpl?.headerType) {
                console.log(`  🖼️  Header: ${tpl.headerType} (${tpl.headerContent})`);
            }
            console.log('='.repeat(45) + '\n');
        }
        return whatsapp_api_1.whatsappApi.sendTemplateMessage(phoneNumberId, waPhone, templateName, 'en', templateComponents, accessToken);
    })
        .then(() => console.log(`✅ WhatsApp [${templateName}] → +${waPhone}`))
        .catch((err) => {
        console.warn(`⚠️  WhatsApp [${templateName}] → +${waPhone} failed:`, err?.message);
        if (err?.message?.toLowerCase().includes('template')) {
            console.warn('💡 Template not approved or parameter mismatch. ' +
                'Check: business.facebook.com → Message Templates');
        }
    });
};
const memoryOtpStore = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of memoryOtpStore.entries()) {
        if (now > data.expiresAt) {
            memoryOtpStore.delete(key);
        }
    }
}, 5 * 60 * 1000);
// ─── OTP Store (Redis + Memory Fallback) ─────────────────────────
const storeOTP = async (key, data) => {
    const redis = (0, redis_1.getRedis)();
    if (redis) {
        try {
            const ttl = Math.ceil((data.expiresAt - Date.now()) / 1000);
            await redis.set(key, JSON.stringify(data), 'EX', ttl);
            return;
        }
        catch (err) {
            console.warn('⚠️  Redis store failed, using memory:', err.message);
        }
    }
    memoryOtpStore.set(key, data);
};
const getOTP = async (key) => {
    const redis = (0, redis_1.getRedis)();
    if (redis) {
        try {
            const stored = await redis.get(key);
            if (stored)
                return JSON.parse(stored);
        }
        catch (err) {
            console.warn('⚠️  Redis get failed, checking memory:', err.message);
        }
    }
    const memData = memoryOtpStore.get(key);
    if (!memData)
        return null;
    if (Date.now() > memData.expiresAt) {
        memoryOtpStore.delete(key);
        return null;
    }
    return memData;
};
const deleteOTP = async (key) => {
    const redis = (0, redis_1.getRedis)();
    if (redis) {
        try {
            await redis.del(key);
        }
        catch (err) {
            console.warn('⚠️  Redis del failed:', err.message);
        }
    }
    memoryOtpStore.delete(key);
};
const updateOTPAttempts = async (key, data, newAttempts) => {
    const updated = { ...data, attempts: newAttempts };
    const redis = (0, redis_1.getRedis)();
    if (redis) {
        try {
            await redis.set(key, JSON.stringify(updated), 'KEEPTTL');
            return;
        }
        catch (err) {
            console.warn('⚠️  Redis update failed, using memory:', err.message);
        }
    }
    memoryOtpStore.set(key, updated);
};
// ============================================
// HELPER: Format user
// ============================================
const formatUser = (user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatar: user.avatar,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
});
// ============================================
// HELPER: Generate JWT tokens
// ============================================
const generateTokenPair = async (userId, email, organizationId) => {
    const user = await database_1.default.user.findUnique({
        where: { id: userId },
        select: { tokenVersion: true },
    });
    const payload = {
        userId,
        email,
        organizationId,
        tokenVersion: user?.tokenVersion ?? 0,
    };
    const accessToken = (0, jwt_1.generateAccessToken)(payload);
    const refreshToken = (0, jwt_1.generateRefreshToken)(payload);
    const expiresAt = new Date(Date.now() + (0, jwt_1.parseExpiryTime)(config_1.config.jwt.refreshExpiresIn));
    await database_1.default.refreshToken.create({
        data: { token: refreshToken, userId, expiresAt },
    });
    return {
        accessToken,
        refreshToken,
        // ✅ FIX: this was config.jwt.expiresIn (7d) which described the REFRESH token,
        // not the access token. Frontend uses this value to know when the access token
        // actually expires, so it must reflect accessExpiresIn (15m).
        expiresIn: (0, jwt_1.parseExpiryTime)(config_1.config.jwt.accessExpiresIn),
    };
};
// ============================================
// HELPER: Get default org
// ============================================
const getDefaultOrg = async (userId) => {
    const owned = await database_1.default.organization.findFirst({
        where: { ownerId: userId },
        select: { id: true, name: true, slug: true, planType: true, featureInboxLocked: true, featureCampaignsLocked: true, featureChatbotLocked: true, featureAutomationLocked: true, featureConnectionLocked: true },
    });
    if (owned)
        return owned;
    const membership = await database_1.default.organizationMember.findFirst({
        where: { userId },
        include: {
            organization: {
                select: { id: true, name: true, slug: true, planType: true, featureInboxLocked: true, featureCampaignsLocked: true, featureChatbotLocked: true, featureAutomationLocked: true, featureConnectionLocked: true },
            },
        },
    });
    return membership?.organization || null;
};
// ============================================
// HELPER: Create org with plan
// ============================================
const createOrgWithPlan = async (tx, userId, orgName) => {
    const freePlan = await tx.plan.findUnique({
        where: { type: 'FREE_DEMO' },
    });
    if (!freePlan) {
        throw new errorHandler_1.AppError('FREE_DEMO plan not found. Please run: npm run db:seed', 500);
    }
    const slug = (0, otp_1.generateSlug)(orgName) +
        '-' +
        Math.random().toString(36).substring(2, 7);
    const organization = await tx.organization.create({
        data: {
            name: orgName,
            slug,
            ownerId: userId,
            planType: 'FREE_DEMO',
            featureSimpleBulkUpload: false,
            featureCsvUpload: true,
            featureOverrideByAdmin: false,
        },
    });
    await tx.organizationMember.create({
        data: {
            organizationId: organization.id,
            userId,
            role: 'OWNER',
            joinedAt: new Date(),
        },
    });
    await tx.subscription.create({
        data: {
            organizationId: organization.id,
            planId: freePlan.id,
            status: 'ACTIVE',
            billingCycle: 'monthly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
    });
    return organization;
};
// ============================================
// AUTH SERVICE
// ============================================
class AuthService {
    // ────────────────────────────────────────────
    // SEND PHONE OTP
    // ────────────────────────────────────────────
    async sendPhoneOTP(phone) {
        const waPhone = toWhatsAppPhone(phone);
        const key = `${PHONE_OTP_PREFIX}${waPhone}`;
        const existing = await getOTP(key);
        if (existing) {
            const elapsed = Date.now() - (existing.createdAt || 0);
            if (elapsed < OTP_RESEND_COOLDOWN_MS) {
                const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
                throw new errorHandler_1.AppError(`Please wait ${wait} seconds before requesting another OTP`, 429);
            }
        }
        const otp = (0, otp_1.generateOTP)(6);
        const otpData = {
            otp,
            attempts: 0,
            createdAt: Date.now(),
            expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
        };
        await storeOTP(key, otpData);
        if (config_1.config.nodeEnv === 'development') {
            console.log('\n' + '='.repeat(45));
            console.log(`  📱 DEV OTP for +${waPhone}`);
            console.log(`  🔢 OTP: ${otp}`);
            console.log('='.repeat(45) + '\n');
        }
        sendWhatsAppTemplate(waPhone, config_1.config.platform.whatsapp.otpTemplate, [otp]);
        const isConfigured = !!config_1.config.platform.whatsapp.phoneNumberId &&
            !!config_1.config.platform.whatsapp.accessToken;
        return {
            message: isConfigured
                ? 'OTP sent to your WhatsApp number'
                : 'OTP sent (check server console in development)',
        };
    }
    // ────────────────────────────────────────────
    // VERIFY PHONE OTP + REGISTER
    // ────────────────────────────────────────────
    async verifyPhoneOTPAndRegister(phone, otp, userData) {
        const waPhone = toWhatsAppPhone(phone);
        const phoneE164 = toE164(phone);
        const key = `${PHONE_OTP_PREFIX}${waPhone}`;
        const storedData = await getOTP(key);
        if (!storedData) {
            throw new errorHandler_1.AppError('OTP expired or not found. Please request a new OTP.', 400);
        }
        if (storedData.attempts >= MAX_OTP_ATTEMPTS) {
            await deleteOTP(key);
            throw new errorHandler_1.AppError('Too many incorrect attempts. Please request a new OTP.', 429);
        }
        if (storedData.otp !== otp) {
            const newAttempts = storedData.attempts + 1;
            const remaining = MAX_OTP_ATTEMPTS - newAttempts;
            await updateOTPAttempts(key, storedData, newAttempts);
            throw new errorHandler_1.AppError(`Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`, 400);
        }
        await deleteOTP(key);
        const normalizedEmail = userData.email.trim().toLowerCase();
        const existingUser = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existingUser) {
            throw new errorHandler_1.AppError('This email is already registered. Please login instead.', 409);
        }
        const hashedPassword = await (0, password_1.hashPassword)(userData.password);
        const result = await database_1.default.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: normalizedEmail,
                    password: hashedPassword,
                    firstName: userData.firstName.trim(),
                    lastName: userData.lastName?.trim() || null,
                    phone: phoneE164,
                    emailVerified: true,
                    status: 'ACTIVE',
                },
            });
            const orgName = userData.organizationName?.trim() ||
                `${userData.firstName.trim()}'s Workspace`;
            const organization = await createOrgWithPlan(tx, user.id, orgName);
            return { user, organization };
        });
        const tokens = await generateTokenPair(result.user.id, result.user.email, result.organization.id);
        sendWhatsAppTemplate(waPhone, config_1.config.platform.whatsapp.welcomeTemplate, [result.user.firstName]);
        sendEmailNonBlocking({
            to: normalizedEmail,
            subject: '🎉 Welcome to WabMeta!',
            html: email_resend_1.emailTemplates.welcome(result.user.firstName).html,
        });
        console.log(`✅ New user registered (Phone OTP): ${normalizedEmail} | Phone: ${phoneE164}`);
        return {
            user: formatUser(result.user),
            tokens,
            organization: {
                id: result.organization.id,
                name: result.organization.name,
                slug: result.organization.slug,
                planType: result.organization.planType,
            },
        };
    }
    // ────────────────────────────────────────────
    // REGISTER (Email based)
    // ────────────────────────────────────────────
    async register(input) {
        const { email, password, firstName, lastName, phone, organizationName } = input;
        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existingUser) {
            if (!existingUser.emailVerified) {
                const otp = (0, otp_1.generateOTP)(6);
                const key = `${EMAIL_OTP_PREFIX}${normalizedEmail}`;
                const otpData = {
                    otp,
                    attempts: 0,
                    createdAt: Date.now(),
                    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
                };
                await storeOTP(key, otpData);
                const tpl = email_resend_1.emailTemplates.otp(existingUser.firstName, otp);
                sendEmailNonBlocking({
                    to: normalizedEmail,
                    subject: tpl.subject,
                    html: tpl.html,
                });
                return {
                    message: 'Account already exists but not verified. New OTP sent to your email.',
                    email: normalizedEmail,
                    requiresVerification: true,
                };
            }
            throw new errorHandler_1.AppError('Email already registered. Please login instead.', 409);
        }
        const hashedPassword = await (0, password_1.hashPassword)(password);
        const result = await database_1.default.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: normalizedEmail,
                    password: hashedPassword,
                    firstName: firstName.trim(),
                    lastName: lastName?.trim() || null,
                    phone: phone || null,
                    emailVerified: false,
                    status: 'PENDING_VERIFICATION',
                },
            });
            const orgName = organizationName?.trim() || `${firstName.trim()}'s Workspace`;
            const organization = await createOrgWithPlan(tx, user.id, orgName);
            return { user, organization };
        });
        const otp = (0, otp_1.generateOTP)(6);
        const key = `${EMAIL_OTP_PREFIX}${normalizedEmail}`;
        const otpData = {
            otp,
            attempts: 0,
            createdAt: Date.now(),
            expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
        };
        await storeOTP(key, otpData);
        const tpl = email_resend_1.emailTemplates.otp(result.user.firstName, otp);
        sendEmailNonBlocking({
            to: normalizedEmail,
            subject: tpl.subject,
            html: tpl.html,
        });
        console.log(`📧 Signup OTP sent to: ${normalizedEmail}`);
        return {
            message: 'Account created! Please check your email for verification OTP.',
            email: normalizedEmail,
            requiresVerification: true,
        };
    }
    // ────────────────────────────────────────────
    // LOGIN
    // ────────────────────────────────────────────
    async login(input) {
        const normalizedEmail = input.email.trim().toLowerCase();
        console.log(`🔐 Login attempt: ${normalizedEmail}`);
        // ── Step 1: User fetch with explicit error handling ──
        let user;
        try {
            user = await database_1.default.user.findUnique({
                where: { email: normalizedEmail },
                select: {
                    id: true,
                    email: true,
                    password: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    avatar: true,
                    emailVerified: true,
                    status: true,
                    googleId: true,
                    tokenVersion: true,
                    createdAt: true,
                },
            });
        }
        catch (err) {
            // ✅ Pool timeout pe generic error - user ko pata nahi chalega
            if (err?.code === 'P2024') {
                console.error('❌ Login DB timeout for:', normalizedEmail);
                throw new errorHandler_1.AppError('Service temporarily busy. Please try again in a moment.', 503);
            }
            throw err;
        }
        // ── Step 2: User existence check ────────────────────
        if (!user) {
            // ✅ Timing attack prevention - same delay even for missing users
            await new Promise((r) => setTimeout(r, 200));
            throw new errorHandler_1.AppError('Invalid email or password', 401);
        }
        // ── Step 3: Account type check ──────────────────────
        if (!user.password) {
            if (user.googleId) {
                throw new errorHandler_1.AppError('This account uses Google Sign-In. Please login with Google.', 400);
            }
            throw new errorHandler_1.AppError('Account configuration error. Please contact support.', 500);
        }
        // ── Step 4: Status check BEFORE bcrypt (fast fail) ──
        if (user.status === 'SUSPENDED') {
            throw new errorHandler_1.AppError('Account suspended. Please contact support.', 403);
        }
        // ── Step 5: Password compare ─────────────────────────
        let isValid = false;
        try {
            isValid = await (0, password_1.comparePassword)(input.password, user.password);
        }
        catch (bcryptError) {
            console.error('❌ bcrypt error during login:', bcryptError.message);
            throw new errorHandler_1.AppError('Login error. Please try again.', 500);
        }
        if (!isValid) {
            console.log(`❌ Wrong password for: ${normalizedEmail}`);
            throw new errorHandler_1.AppError('Invalid email or password', 401);
        }
        // ── Step 6: Get/create organization ─────────────────
        let organization = await getDefaultOrg(user.id);
        if (!organization) {
            console.log('⚠️  No org found, auto-creating...');
            const orgName = `${user.firstName || 'User'}'s Workspace`;
            organization = await database_1.default.$transaction((tx) => createOrgWithPlan(tx, user.id, orgName));
        }
        // ── Step 7: Update lastLoginAt (non-blocking) ───────
        // ✅ Await nahi karo - login slow nahi karega
        database_1.default.user
            .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        })
            .catch((err) => {
            if (err?.code !== 'P2024') {
                console.error('⚠️  lastLoginAt update failed:', err.message);
            }
        });
        // ── Step 8: Generate tokens ──────────────────────────
        const tokens = await generateTokenPair(user.id, user.email, organization?.id);
        console.log(`✅ Login successful: ${normalizedEmail}`);
        return {
            user: formatUser(user),
            tokens,
            organization: organization || undefined,
        };
    }
    // ────────────────────────────────────────────
    // VERIFY EMAIL
    // ────────────────────────────────────────────
    async verifyEmail(token) {
        const user = await database_1.default.user.findFirst({
            where: {
                emailVerifyToken: token,
                emailVerifyExpires: { gt: new Date() },
            },
        });
        if (!user) {
            throw new errorHandler_1.AppError('Invalid or expired verification token', 400);
        }
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                emailVerifyToken: null,
                emailVerifyExpires: null,
                status: 'ACTIVE',
            },
        });
        sendEmailNonBlocking({
            to: user.email,
            subject: '🎉 Welcome to WabMeta!',
            html: email_resend_1.emailTemplates.welcome(user.firstName).html,
        });
        if (user.phone) {
            sendWhatsAppTemplate(user.phone, config_1.config.platform.whatsapp.welcomeTemplate, [user.firstName]);
            console.log(`📱 Welcome WhatsApp sent → ${user.phone}`);
        }
        console.log(`✅ Email verified: ${user.email}`);
        return {
            message: 'Email verified successfully! Welcome to WabMeta 🎉',
        };
    }
    // ────────────────────────────────────────────
    // RESEND VERIFICATION EMAIL
    // ────────────────────────────────────────────
    async resendVerificationEmail(email) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        const successMsg = 'If your email is registered, you will receive a verification link';
        if (!user)
            return { message: successMsg };
        if (user.emailVerified) {
            throw new errorHandler_1.AppError('Email is already verified', 400);
        }
        const token = (0, otp_1.generateToken)();
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await database_1.default.user.update({
            where: { id: user.id },
            data: { emailVerifyToken: token, emailVerifyExpires: expires },
        });
        const verifyUrl = `${config_1.config.frontendUrl}/verify-email?token=${token}`;
        const tpl = email_resend_1.emailTemplates.verifyEmail(user.firstName, verifyUrl);
        sendEmailNonBlocking({
            to: normalizedEmail,
            subject: tpl.subject,
            html: tpl.html,
        });
        return { message: 'Verification email sent' };
    }
    // ────────────────────────────────────────────
    // FORGOT PASSWORD
    // ────────────────────────────────────────────
    async forgotPassword(email) {
        const normalizedEmail = email.trim().toLowerCase();
        const successMsg = 'If your email is registered, you will receive a password reset link';
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user)
            return { message: successMsg };
        const token = (0, otp_1.generateToken)();
        const expires = new Date(Date.now() + 60 * 60 * 1000);
        await database_1.default.user.update({
            where: { id: user.id },
            data: { passwordResetToken: token, passwordResetExpires: expires },
        });
        const resetUrl = `${config_1.config.frontendUrl}/reset-password?token=${token}`;
        const tpl = email_resend_1.emailTemplates.resetPassword(user.firstName, resetUrl);
        sendEmailNonBlocking({
            to: normalizedEmail,
            subject: tpl.subject,
            html: tpl.html,
        });
        return { message: successMsg };
    }
    // ────────────────────────────────────────────
    // RESET PASSWORD
    // ────────────────────────────────────────────
    async resetPassword(token, newPassword) {
        const user = await database_1.default.user.findFirst({
            where: {
                passwordResetToken: token,
                passwordResetExpires: { gt: new Date() },
            },
        });
        if (!user) {
            throw new errorHandler_1.AppError('Invalid or expired reset token', 400);
        }
        const hashed = await (0, password_1.hashPassword)(newPassword);
        await database_1.default.$transaction([
            database_1.default.user.update({
                where: { id: user.id },
                data: {
                    password: hashed,
                    passwordResetToken: null,
                    passwordResetExpires: null,
                    tokenVersion: { increment: 1 }, // ✅ FIX: invalidate any still-live access tokens immediately
                },
            }),
            database_1.default.refreshToken.deleteMany({ where: { userId: user.id } }),
        ]);
        return { message: 'Password reset successfully' };
    }
    // ────────────────────────────────────────────
    // SEND EMAIL OTP
    // ────────────────────────────────────────────
    async sendOTP(email) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user)
            throw new errorHandler_1.AppError('User not found', 404);
        const otp = (0, otp_1.generateOTP)(6);
        const key = `${EMAIL_OTP_PREFIX}${normalizedEmail}`;
        const otpData = {
            otp,
            attempts: 0,
            createdAt: Date.now(),
            expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
        };
        await storeOTP(key, otpData);
        const tpl = email_resend_1.emailTemplates.otp(user.firstName, otp);
        sendEmailNonBlocking({
            to: normalizedEmail,
            subject: tpl.subject,
            html: tpl.html,
        });
        console.log(`📧 OTP resent to: ${normalizedEmail}`);
        return { message: 'OTP sent to your email' };
    }
    // ────────────────────────────────────────────
    // VERIFY EMAIL OTP
    // ────────────────────────────────────────────
    async verifyOTP(email, otp) {
        const normalizedEmail = email.trim().toLowerCase();
        const key = `${EMAIL_OTP_PREFIX}${normalizedEmail}`;
        const storedData = await getOTP(key);
        if (!storedData) {
            throw new errorHandler_1.AppError('OTP expired or not found. Please request a new one.', 400);
        }
        if (storedData.attempts >= MAX_OTP_ATTEMPTS) {
            await deleteOTP(key);
            throw new errorHandler_1.AppError('Too many incorrect attempts. Please request a new OTP.', 429);
        }
        if (storedData.otp !== otp) {
            const newAttempts = storedData.attempts + 1;
            const remaining = MAX_OTP_ATTEMPTS - newAttempts;
            await updateOTPAttempts(key, storedData, newAttempts);
            throw new errorHandler_1.AppError(`Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`, 400);
        }
        await deleteOTP(key);
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user)
            throw new errorHandler_1.AppError('User not found', 404);
        const isFirstVerification = !user.emailVerified;
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                status: 'ACTIVE',
                lastLoginAt: new Date(),
            },
        });
        const organization = await getDefaultOrg(user.id);
        const tokens = await generateTokenPair(user.id, user.email, organization?.id);
        if (isFirstVerification) {
            sendEmailNonBlocking({
                to: normalizedEmail,
                subject: '🎉 Welcome to WabMeta!',
                html: email_resend_1.emailTemplates.welcome(user.firstName).html,
            });
            console.log(`📧 Welcome email sent → ${normalizedEmail}`);
            if (user.phone) {
                sendWhatsAppTemplate(user.phone, config_1.config.platform.whatsapp.welcomeTemplate, [user.firstName]);
                console.log(`📱 Welcome WhatsApp sent → ${user.phone}`);
            }
            else {
                console.log(`ℹ️ No phone on file - WhatsApp welcome skipped`);
            }
            console.log(`✅ Account activated: ${normalizedEmail}`);
        }
        const updatedUser = await database_1.default.user.findUnique({
            where: { id: user.id },
        });
        return {
            user: formatUser(updatedUser),
            tokens,
            organization: organization || undefined,
        };
    }
    // ────────────────────────────────────────────
    // GOOGLE AUTH
    // ────────────────────────────────────────────
    async googleAuth(credential) {
        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: config_1.config.google.clientId,
            });
            const p = ticket.getPayload();
            if (!p)
                throw new Error('Empty payload');
            payload = p;
        }
        catch {
            throw new errorHandler_1.AppError('Invalid Google token', 401);
        }
        const { email, given_name, family_name, picture, sub: googleId } = payload;
        const normalizedEmail = email.trim().toLowerCase();
        let user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (user) {
            if (!user.googleId) {
                user = await database_1.default.user.update({
                    where: { id: user.id },
                    data: {
                        googleId,
                        avatar: user.avatar || picture,
                        emailVerified: true,
                        status: 'ACTIVE',
                    },
                });
            }
        }
        else {
            const created = await database_1.default.$transaction(async (tx) => {
                const newUser = await tx.user.create({
                    data: {
                        email: normalizedEmail,
                        googleId,
                        firstName: given_name,
                        lastName: family_name,
                        avatar: picture,
                        emailVerified: true,
                        status: 'ACTIVE',
                    },
                });
                const org = await createOrgWithPlan(tx, newUser.id, `${given_name}'s Workspace`);
                return { user: newUser, org };
            });
            user = created.user;
        }
        await database_1.default.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        let organization = await getDefaultOrg(user.id);
        if (!organization) {
            organization = await database_1.default.$transaction((tx) => createOrgWithPlan(tx, user.id, `${user.firstName || 'User'}'s Workspace`));
        }
        const tokens = await generateTokenPair(user.id, user.email, organization?.id);
        return {
            user: formatUser(user),
            tokens,
            organization: organization || undefined,
        };
    }
    // ────────────────────────────────────────────
    // REFRESH TOKEN
    // ────────────────────────────────────────────
    async refreshToken(refreshToken) {
        let payload;
        try {
            payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
        }
        catch {
            throw new errorHandler_1.AppError('Invalid refresh token', 401);
        }
        // ✅ FIX: Race condition ke liye - agar token nahi mila but recently
        // valid tha, toh "reuse" mat samjho
        const stored = await database_1.default.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });
        if (!stored) {
            // ✅ FIX: Reuse detection - lekin aggressive nahi
            // Check karo: kya recent tokens exist hain is user ke liye?
            if (payload?.userId) {
                const recentTokens = await database_1.default.refreshToken.count({
                    where: {
                        userId: payload.userId,
                        createdAt: {
                            // Last 30 seconds mein create kiya?
                            gte: new Date(Date.now() - 30 * 1000)
                        }
                    }
                });
                // ✅ Agar recent tokens hain, ye likely race condition hai
                // Reuse nahi, sirf rotation delay
                if (recentTokens > 0) {
                    console.warn(`⚠️ Token not found but recent tokens exist - likely race condition for user: ${payload.userId}`);
                    throw new errorHandler_1.AppError('Token rotation in progress. Please retry.', 401);
                }
                // ✅ Genuinely reused token - tabhi revoke karo
                console.warn(`🚨 TOKEN REUSE DETECTED for user: ${payload.userId}`);
                await database_1.default.refreshToken.deleteMany({
                    where: { userId: payload.userId }
                });
            }
            throw new errorHandler_1.AppError('Invalid refresh token', 401);
        }
        if (stored.expiresAt < new Date()) {
            await database_1.default.refreshToken.delete({ where: { id: stored.id } });
            throw new errorHandler_1.AppError('Refresh token expired', 401);
        }
        // ✅ Token rotation - old delete, new create
        await database_1.default.refreshToken.delete({ where: { id: stored.id } });
        const org = await getDefaultOrg(stored.userId);
        return generateTokenPair(stored.userId, stored.user.email, org?.id);
    }
    // ────────────────────────────────────────────
    // LOGOUT
    // ────────────────────────────────────────────
    async logout(refreshToken) {
        await database_1.default.refreshToken.deleteMany({
            where: { token: refreshToken },
        });
        return { message: 'Logged out successfully' };
    }
    // ────────────────────────────────────────────
    // LOGOUT ALL DEVICES
    // ────────────────────────────────────────────
    async logoutAll(userId) {
        // ✅ FIX: bump tokenVersion too, otherwise any access token issued before this
        // call stays valid (up to 15m) even after "logout all devices"
        await database_1.default.$transaction([
            database_1.default.refreshToken.deleteMany({ where: { userId } }),
            database_1.default.user.update({
                where: { id: userId },
                data: { tokenVersion: { increment: 1 } },
            }),
        ]);
        return { message: 'Logged out from all devices' };
    }
    // ────────────────────────────────────────────
    // GET CURRENT USER
    // ────────────────────────────────────────────
    async getCurrentUser(userId) {
        const user = await database_1.default.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new errorHandler_1.AppError('User not found', 404);
        return formatUser(user);
    }
    // ────────────────────────────────────────────
    // CHANGE PASSWORD
    // ────────────────────────────────────────────
    async changePassword(userId, currentPassword, newPassword) {
        const user = await database_1.default.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new errorHandler_1.AppError('User not found', 404);
        if (!user.password) {
            throw new errorHandler_1.AppError('Cannot change password for OAuth-only accounts.', 400);
        }
        const isValid = await (0, password_1.comparePassword)(currentPassword, user.password);
        if (!isValid) {
            throw new errorHandler_1.AppError('Current password is incorrect', 400);
        }
        const hashed = await (0, password_1.hashPassword)(newPassword);
        await database_1.default.$transaction([
            database_1.default.user.update({
                where: { id: userId },
                data: {
                    password: hashed,
                    tokenVersion: { increment: 1 }, // ✅ FIX: invalidate all live access tokens immediately
                },
            }),
            database_1.default.refreshToken.deleteMany({ where: { userId } }),
        ]);
        return { message: 'Password changed successfully' };
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map