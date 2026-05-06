"use strict";
// src/modules/auth/auth.service.ts
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
// Google OAuth Client
const googleClient = new google_auth_library_1.OAuth2Client(config_1.config.google.clientId);
const redis_1 = require("../../config/redis");
const redis = (0, redis_1.getRedis)();
// WhatsApp API (for Welcome + OTP messages)
const whatsapp_api_1 = require("../whatsapp/whatsapp.api");
const OTP_PREFIX = 'otp:';
// ============================================
// HELPER FUNCTIONS
// ============================================
const normalizeEmail = (email) => email.trim().toLowerCase();
// ✅ Non-blocking email helper (never blocks request)
const sendEmailNonBlocking = (options) => {
    void (0, email_resend_1.sendEmail)(options)
        .then((ok) => {
        if (!ok)
            console.warn('📧 Email failed (sendEmail returned false):', options.subject);
    })
        .catch((err) => {
        console.error('📧 Email failed (promise rejected):', err);
    });
};
// ✅ Non-blocking WhatsApp template sender
// phoneNumberId & accessToken: aapka WabMeta platform number use karega
const sendWATemplateNonBlocking = (phone, templateName, components) => {
    // Platform ke pehle WhatsApp account se bhejo
    // NOTE: Replace these with your actual platform phoneNumberId and accessToken from DB or config
    const platformPhoneNumberId = config_1.config.meta?.platformPhoneNumberId || process.env.PLATFORM_WA_PHONE_ID;
    const platformAccessToken = config_1.config.meta?.platformAccessToken || process.env.PLATFORM_WA_ACCESS_TOKEN;
    if (!platformPhoneNumberId || !platformAccessToken || !phone) {
        console.warn('⚠️ WhatsApp not configured for platform messages. Set PLATFORM_WA_PHONE_ID and PLATFORM_WA_ACCESS_TOKEN');
        return;
    }
    // Format phone: add country code if missing
    const formattedPhone = phone.startsWith('+') ? phone.replace('+', '') : `91${phone}`;
    void whatsapp_api_1.whatsappApi.sendTemplateMessage(platformPhoneNumberId, formattedPhone, templateName, 'en', components ? { body: components.body } : undefined, platformAccessToken)
        .then(() => console.log(`✅ WhatsApp [${templateName}] sent to ${formattedPhone}`))
        .catch((err) => console.warn(`⚠️ WhatsApp [${templateName}] failed (non-critical):`, err?.message));
};
const formatUserResponse = (user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatar: user.avatar,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
});
const generateTokens = async (userId, email, organizationId) => {
    const payload = { userId, email, organizationId };
    const accessToken = (0, jwt_1.generateAccessToken)(payload);
    const refreshToken = (0, jwt_1.generateRefreshToken)(payload);
    // Store refresh token in database
    const expiresAt = new Date(Date.now() + (0, jwt_1.parseExpiryTime)(config_1.config.jwt.refreshExpiresIn));
    await database_1.default.refreshToken.create({
        data: {
            token: refreshToken,
            userId,
            expiresAt,
        },
    });
    return {
        accessToken,
        refreshToken,
        expiresIn: (0, jwt_1.parseExpiryTime)(config_1.config.jwt.expiresIn),
    };
};
const getDefaultOrganization = async (userId) => {
    // First check owned organizations
    const ownedOrg = await database_1.default.organization.findFirst({
        where: { ownerId: userId },
        select: { id: true, name: true, slug: true, planType: true },
    });
    if (ownedOrg)
        return ownedOrg;
    // Then check memberships
    const membership = await database_1.default.organizationMember.findFirst({
        where: { userId },
        include: {
            organization: {
                select: { id: true, name: true, slug: true, planType: true },
            },
        },
    });
    return membership?.organization || null;
};
// ============================================
// AUTH SERVICE CLASS
// ============================================
class AuthService {
    // ==========================================
    // REGISTER
    // ==========================================
    async register(input) {
        const { email, password, firstName, lastName, phone, organizationName } = input;
        const normalizedEmail = normalizeEmail(email);
        // Check if user already exists
        const existingUser = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        // ✅ If email exists, handle verified/unverified cases
        if (existingUser) {
            // If user exists but not verified, resend verification email
            if (!existingUser.emailVerified) {
                const emailVerifyToken = (0, otp_1.generateToken)();
                const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
                await database_1.default.user.update({
                    where: { id: existingUser.id },
                    data: { emailVerifyToken, emailVerifyExpires },
                });
                const verifyUrl = `${config_1.config.frontendUrl}/verify-email?token=${emailVerifyToken}`;
                const emailContent = email_resend_1.emailTemplates.verifyEmail(existingUser.firstName, verifyUrl);
                // ✅ Non-blocking email send (no await)
                sendEmailNonBlocking({
                    to: normalizedEmail,
                    subject: emailContent.subject,
                    html: emailContent.html,
                });
                throw new errorHandler_1.AppError('Email already registered. Verification email resent.', 409);
            }
            // If already verified, just block
            throw new errorHandler_1.AppError('Email already registered', 409);
        }
        // Hash password
        const hashedPassword = await (0, password_1.hashPassword)(password);
        // Generate email verification token
        const emailVerifyToken = (0, otp_1.generateToken)();
        const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        // Create user and organization in transaction
        const result = await database_1.default.$transaction(async (tx) => {
            // Create user
            const user = await tx.user.create({
                data: {
                    email: normalizedEmail,
                    password: hashedPassword,
                    firstName,
                    lastName,
                    phone,
                    emailVerifyToken,
                    emailVerifyExpires,
                    status: 'PENDING_VERIFICATION',
                },
            });
            // Create organization always
            const computedOrgName = organizationName && organizationName.trim().length > 0
                ? organizationName.trim()
                : `${firstName || 'User'}'s Workspace`;
            const organization = await tx.organization.create({
                data: {
                    name: computedOrgName,
                    slug: (0, otp_1.generateSlug)(computedOrgName) + '-' + Math.random().toString(36).substring(2, 7),
                    ownerId: user.id,
                    planType: 'FREE_DEMO',
                    featureSimpleBulkUpload: false,
                    featureCsvUpload: true,
                    featureOverrideByAdmin: false,
                },
            });
            // Add user as organization member
            await tx.organizationMember.create({
                data: {
                    organizationId: organization.id,
                    userId: user.id,
                    role: 'OWNER',
                    joinedAt: new Date(),
                },
            });
            // Wait, we can define the subscription for FREE_DEMO if needed, else it is handled
            const freePlan = await tx.plan.findUnique({ where: { type: 'FREE_DEMO' } });
            if (!freePlan) {
                throw new errorHandler_1.AppError('FREE_DEMO plan not found. Please run db:seed.', 500);
            }
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
            return { user, organization };
        });
        // Send verification email (✅ non-blocking)
        const verifyUrl = `${config_1.config.frontendUrl}/verify-email?token=${emailVerifyToken}`;
        const emailContent = email_resend_1.emailTemplates.verifyEmail(firstName, verifyUrl);
        sendEmailNonBlocking({
            to: normalizedEmail,
            subject: emailContent.subject,
            html: emailContent.html,
        });
        // ✅ Send WhatsApp welcome message (non-blocking, non-critical)
        if (phone) {
            sendWATemplateNonBlocking(phone, 'wabmeta_welcome', {
                body: [firstName || 'there'], // {{1}} = user ka naam
            });
        }
        // Generate tokens
        const tokens = await generateTokens(result.user.id, result.user.email, result.organization?.id);
        return {
            user: formatUserResponse(result.user),
            tokens,
            organization: result.organization
                ? {
                    id: result.organization.id,
                    name: result.organization.name,
                    slug: result.organization.slug,
                    planType: result.organization.planType,
                }
                : undefined,
        };
    }
    // ==========================================
    // LOGIN - ✅ FIXED VERSION
    // ==========================================
    async login(input) {
        const normalizedEmail = normalizeEmail(input.email);
        const { password } = input;
        console.log(`🔐 Login attempt for: ${normalizedEmail}`);
        // Find user
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            console.log('❌ User not found');
            throw new errorHandler_1.AppError('Invalid email or password', 401);
        }
        console.log(`👤 User found: ${user.id}`);
        console.log(`   Has password: ${!!user.password}`);
        console.log(`   Has Google ID: ${!!user.googleId}`);
        console.log(`   Email verified: ${user.emailVerified}`);
        console.log(`   Status: ${user.status}`);
        // ✅ FIXED: Check if user has password set
        if (!user.password) {
            // User signed up with Google only and never set a password
            if (user.googleId) {
                console.log('⚠️ User has Google login but no password');
                throw new errorHandler_1.AppError('This account was created with Google Sign-In. Please login with Google or set a password in your account settings.', 400);
            }
            // Shouldn't happen, but handle it
            console.log('❌ User has no password and no Google ID');
            throw new errorHandler_1.AppError('Account configuration error. Please contact support.', 500);
        }
        // ✅ Verify password
        const isValidPassword = await (0, password_1.comparePassword)(password, user.password);
        if (!isValidPassword) {
            console.log('❌ Invalid password');
            throw new errorHandler_1.AppError('Invalid email or password', 401);
        }
        console.log('✅ Password verified');
        // ✅ Check user status
        if (user.status === 'SUSPENDED') {
            console.log('❌ Account suspended');
            throw new errorHandler_1.AppError('Account suspended. Please contact support.', 403);
        }
        // ✅ Optional: Warn if email not verified (but still allow login)
        if (!user.emailVerified) {
            console.log('⚠️ Email not verified - allowing login anyway');
            // You can choose to block here by uncommenting:
            // throw new AppError('Please verify your email before logging in', 403);
        }
        // Get default organization
        let organization = await getDefaultOrganization(user.id);
        if (!organization) {
            console.log('⚠️ No organization found for user, auto-creating...');
            const orgName = `${user.firstName || 'User'}'s Workspace`;
            organization = await database_1.default.organization.create({
                data: {
                    name: orgName,
                    slug: (0, otp_1.generateSlug)(orgName) + '-' + Math.random().toString(36).substring(2, 7),
                    ownerId: user.id,
                    planType: 'FREE_DEMO',
                    featureSimpleBulkUpload: false,
                    featureCsvUpload: true,
                    featureOverrideByAdmin: false,
                },
            });
            await database_1.default.organizationMember.create({
                data: {
                    organizationId: organization.id,
                    userId: user.id,
                    role: 'OWNER',
                    joinedAt: new Date(),
                },
            });
            // Assign FREE_DEMO subscription
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
        // Update last login
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                lastLoginAt: new Date(),
            },
        });
        // Generate tokens
        const tokens = await generateTokens(user.id, user.email, organization?.id);
        console.log('✅ Login successful');
        return {
            user: formatUserResponse(user),
            tokens,
            organization: organization || undefined,
        };
    }
    // ==========================================
    // VERIFY EMAIL
    // ==========================================
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
        return { message: 'Email verified successfully' };
    }
    // ==========================================
    // RESEND VERIFICATION EMAIL
    // ==========================================
    async resendVerificationEmail(email) {
        const normalizedEmail = normalizeEmail(email);
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            // Don't reveal if user exists
            return { message: 'If your email is registered, you will receive a verification link' };
        }
        if (user.emailVerified) {
            throw new errorHandler_1.AppError('Email is already verified', 400);
        }
        // Generate new token
        const emailVerifyToken = (0, otp_1.generateToken)();
        const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                emailVerifyToken,
                emailVerifyExpires,
            },
        });
        // Send email (✅ non-blocking)
        const verifyUrl = `${config_1.config.frontendUrl}/verify-email?token=${emailVerifyToken}`;
        const emailContent = email_resend_1.emailTemplates.verifyEmail(user.firstName, verifyUrl);
        sendEmailNonBlocking({
            to: normalizedEmail,
            subject: emailContent.subject,
            html: emailContent.html,
        });
        return { message: 'Verification email sent' };
    }
    // ==========================================
    // FORGOT PASSWORD
    // ==========================================
    async forgotPassword(email) {
        const normalizedEmail = normalizeEmail(email);
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        // Always return success message (security)
        const successMessage = 'If your email is registered, you will receive a password reset link';
        if (!user) {
            return { message: successMessage };
        }
        // Generate reset token
        const resetToken = (0, otp_1.generateToken)();
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: resetToken,
                passwordResetExpires: resetExpires,
            },
        });
        // Send email (✅ non-blocking)
        const resetUrl = `${config_1.config.frontendUrl}/reset-password?token=${resetToken}`;
        const emailContent = email_resend_1.emailTemplates.resetPassword(user.firstName, resetUrl);
        sendEmailNonBlocking({
            to: normalizedEmail,
            subject: emailContent.subject,
            html: emailContent.html,
        });
        return { message: successMessage };
    }
    // ==========================================
    // RESET PASSWORD
    // ==========================================
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
        // Hash new password
        const hashedPassword = await (0, password_1.hashPassword)(newPassword);
        // Update password and clear reset token
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
            },
        });
        // Invalidate all refresh tokens
        await database_1.default.refreshToken.deleteMany({
            where: { userId: user.id },
        });
        return { message: 'Password reset successfully' };
    }
    // ==========================================
    // SEND OTP
    // ==========================================
    async sendOTP(email) {
        const normalizedEmail = normalizeEmail(email);
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        // Generate OTP
        const otp = (0, otp_1.generateOTP)(6);
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
        // Store OTP in Redis (10 minutes TTL)
        if (redis) {
            await redis.set(`${OTP_PREFIX}${normalizedEmail}`, JSON.stringify({ otp, attempts: 0 }), 'EX', 600 // 10 minutes
            );
        }
        else {
            console.warn('⚠️ Redis not available, OTP not stored!');
            throw new errorHandler_1.AppError('Service temporarily unavailable', 503);
        }
        // Send OTP email (✅ non-blocking)
        const emailContent = email_resend_1.emailTemplates.otp(user.firstName, otp);
        sendEmailNonBlocking({
            to: normalizedEmail,
            subject: emailContent.subject,
            html: emailContent.html,
        });
        // ✅ Send WhatsApp OTP (non-blocking, non-critical)
        if (user.phone) {
            sendWATemplateNonBlocking(user.phone, 'wabmeta_otp', {
                body: [otp], // {{1}} = OTP code
            });
        }
        return { message: 'OTP sent to your email' };
    }
    // ==========================================
    // VERIFY OTP
    // ==========================================
    async verifyOTP(email, otp) {
        const normalizedEmail = normalizeEmail(email);
        if (!redis)
            throw new errorHandler_1.AppError('Service temporarily unavailable', 503);
        const storedData = await redis.get(`${OTP_PREFIX}${normalizedEmail}`);
        if (!storedData) {
            throw new errorHandler_1.AppError('OTP expired or not found', 400);
        }
        const { otp: storedOtp, attempts } = JSON.parse(storedData);
        // Check attempts
        if (attempts >= 5) {
            await redis.del(`${OTP_PREFIX}${normalizedEmail}`);
            throw new errorHandler_1.AppError('Too many attempts. Please request a new OTP', 429);
        }
        // Verify OTP
        if (storedOtp !== otp) {
            // Increment attempts
            await redis.set(`${OTP_PREFIX}${normalizedEmail}`, JSON.stringify({ otp: storedOtp, attempts: attempts + 1 }), 'KEEPTTL');
            throw new errorHandler_1.AppError('Invalid OTP', 400);
        }
        // Clear OTP
        await redis.del(`${OTP_PREFIX}${normalizedEmail}`);
        // Get user
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        // Mark email as verified if not already
        if (!user.emailVerified) {
            await database_1.default.user.update({
                where: { id: user.id },
                data: {
                    emailVerified: true,
                    status: 'ACTIVE',
                },
            });
        }
        // Get organization
        const organization = await getDefaultOrganization(user.id);
        // Generate tokens
        const tokens = await generateTokens(user.id, user.email, organization?.id);
        return {
            user: formatUserResponse(user),
            tokens,
            organization: organization || undefined,
        };
    }
    // ==========================================
    // GOOGLE AUTH
    // ==========================================
    async googleAuth(credential) {
        // Verify Google token (credential should be ID token / JWT)
        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: config_1.config.google.clientId,
            });
            const ticketPayload = ticket.getPayload();
            if (!ticketPayload) {
                throw new Error('Invalid token payload');
            }
            payload = ticketPayload;
        }
        catch (error) {
            throw new errorHandler_1.AppError('Invalid Google token', 401);
        }
        const { email, given_name, family_name, picture, sub: googleId } = payload;
        const normalizedEmail = normalizeEmail(email);
        // Find or create user
        let user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (user) {
            // Update Google ID if not set
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
            // Create new user
            user = await database_1.default.user.create({
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
            // Create default organization
            const organization = await database_1.default.organization.create({
                data: {
                    name: `${given_name}'s Workspace`,
                    slug: (0, otp_1.generateSlug)(`${given_name}-workspace`) + '-' + Math.random().toString(36).substring(2, 7),
                    ownerId: user.id,
                    planType: 'FREE_DEMO',
                    featureSimpleBulkUpload: false,
                    featureCsvUpload: true,
                    featureOverrideByAdmin: false,
                },
            });
            await database_1.default.organizationMember.create({
                data: {
                    organizationId: organization.id,
                    userId: user.id,
                    role: 'OWNER',
                    joinedAt: new Date(),
                },
            });
            // ✅ Assign FREE_DEMO subscription
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
        // Update last login
        await database_1.default.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        // Get organization
        let organization = await getDefaultOrganization(user.id);
        // Auto heal Google Users missing organization
        if (!organization) {
            const orgName = `${user.firstName || 'User'}'s Workspace`;
            organization = await database_1.default.organization.create({
                data: {
                    name: orgName,
                    slug: (0, otp_1.generateSlug)(orgName) + '-' + Math.random().toString(36).substring(2, 7),
                    ownerId: user.id,
                    planType: 'FREE_DEMO',
                    featureSimpleBulkUpload: false,
                    featureCsvUpload: true,
                    featureOverrideByAdmin: false,
                },
            });
            await database_1.default.organizationMember.create({
                data: {
                    organizationId: organization.id,
                    userId: user.id,
                    role: 'OWNER',
                    joinedAt: new Date(),
                },
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
        // Generate tokens
        const tokens = await generateTokens(user.id, user.email, organization?.id);
        return {
            user: formatUserResponse(user),
            tokens,
            organization: organization || undefined,
        };
    }
    // ==========================================
    // REFRESH TOKEN
    // ==========================================
    async refreshToken(refreshToken) {
        // Verify refresh token
        let payload;
        try {
            payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
        }
        catch (error) {
            throw new errorHandler_1.AppError('Invalid refresh token', 401);
        }
        // Check if token exists in database
        const storedToken = await database_1.default.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });
        if (!storedToken) {
            throw new errorHandler_1.AppError('Refresh token not found', 401);
        }
        if (storedToken.expiresAt < new Date()) {
            await database_1.default.refreshToken.delete({ where: { id: storedToken.id } });
            throw new errorHandler_1.AppError('Refresh token expired', 401);
        }
        // Delete old refresh token
        await database_1.default.refreshToken.delete({ where: { id: storedToken.id } });
        // Get organization
        const organization = await getDefaultOrganization(storedToken.userId);
        // Generate new tokens
        const tokens = await generateTokens(storedToken.userId, storedToken.user.email, organization?.id);
        return tokens;
    }
    // ==========================================
    // LOGOUT
    // ==========================================
    async logout(refreshToken) {
        // Delete refresh token from database
        await database_1.default.refreshToken.deleteMany({
            where: { token: refreshToken },
        });
        return { message: 'Logged out successfully' };
    }
    // ==========================================
    // LOGOUT ALL DEVICES
    // ==========================================
    async logoutAll(userId) {
        await database_1.default.refreshToken.deleteMany({
            where: { userId },
        });
        return { message: 'Logged out from all devices' };
    }
    // ==========================================
    // GET CURRENT USER
    // ==========================================
    async getCurrentUser(userId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        return formatUserResponse(user);
    }
    // ==========================================
    // CHANGE PASSWORD
    // ==========================================
    async changePassword(userId, currentPassword, newPassword) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        if (!user.password) {
            throw new errorHandler_1.AppError('Cannot change password for OAuth-only accounts. Please set a password first.', 400);
        }
        // Verify current password
        const isValid = await (0, password_1.comparePassword)(currentPassword, user.password);
        if (!isValid) {
            throw new errorHandler_1.AppError('Current password is incorrect', 400);
        }
        // Hash and update new password
        const hashedPassword = await (0, password_1.hashPassword)(newPassword);
        await database_1.default.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
        // Invalidate all refresh tokens
        await database_1.default.refreshToken.deleteMany({
            where: { userId },
        });
        return { message: 'Password changed successfully' };
    }
}
exports.AuthService = AuthService;
// Export singleton instance
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map