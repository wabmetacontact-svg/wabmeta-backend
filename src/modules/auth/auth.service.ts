// src/modules/auth/auth.service.ts - FINAL VERSION

import prisma from '../../config/database';
import { config } from '../../config';
import { hashPassword, comparePassword } from '../../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  parseExpiryTime,
} from '../../utils/jwt';
import { sendEmail, emailTemplates } from '../../utils/email.resend';
import { generateOTP, generateToken, generateSlug } from '../../utils/otp';
import { AppError } from '../../middleware/errorHandler';
import {
  RegisterInput,
  LoginInput,
  AuthResponse,
  AuthUser,
  AuthTokens,
  GoogleUserPayload,
} from './auth.types';
import { OAuth2Client } from 'google-auth-library';
import { getRedis } from '../../config/redis';
import { whatsappApi } from '../whatsapp/whatsapp.api';
import Redis from 'ioredis';

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

const googleClient = new OAuth2Client(config.google.clientId);

// ✅ NOTE: redis variable HATAYA gaya hai top se
// Har function me getRedis() call hoga jab zaroorat ho

// ============================================
// HELPER: Phone Normalizers
// ============================================

const toWhatsAppPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 11)
    return `91${digits.slice(1)}`;
  return digits;
};

const toE164 = (phone: string): string => {
  const wa = toWhatsAppPhone(phone);
  return `+${wa}`;
};

// ============================================
// HELPER: Non-blocking email
// ============================================

const sendEmailNonBlocking = (opts: {
  to: string;
  subject: string;
  html: string;
}): void => {
  void sendEmail(opts).catch((err) =>
    console.error('📧 Email send failed (non-blocking):', err?.message)
  );
};

// ============================================
// HELPER: Non-blocking WhatsApp template
// ============================================

const sendWhatsAppTemplate = (
  phone: string,
  templateName: string,
  bodyParams: string[] = []
): void => {
  const { phoneNumberId, accessToken } = config.platform.whatsapp;

  if (!phoneNumberId || !accessToken) {
    console.warn(
      '⚠️  Platform WhatsApp not configured.',
      'Add PLATFORM_WA_PHONE_ID & PLATFORM_WA_ACCESS_TOKEN to .env'
    );
    return;
  }

  const waPhone = toWhatsAppPhone(phone);

  // Dev console log
  if (config.nodeEnv === 'development') {
    console.log('\n' + '='.repeat(45));
    console.log(`  📱 WhatsApp Template: ${templateName}`);
    console.log(`  📞 To: +${waPhone}`);
    if (templateName.includes('otp') && bodyParams[0]) {
      console.log(`  🔢 OTP: ${bodyParams[0]}`);
    }
    console.log('='.repeat(45) + '\n');
  }

  void whatsappApi
    .sendTemplateMessage(
      phoneNumberId,
      waPhone,
      templateName,
      'en',
      bodyParams.length > 0 ? { body: bodyParams } : undefined,
      accessToken
    )
    .then(() =>
      console.log(`✅ WhatsApp [${templateName}] → +${waPhone}`)
    )
    .catch((err: any) => {
      console.warn(
        `⚠️  WhatsApp [${templateName}] → +${waPhone} failed:`,
        err?.message
      );
      if (err?.message?.includes('template')) {
        console.warn(
          '💡 Template not approved yet. Check business.facebook.com → Message Templates'
        );
      }
    });
};
// ============================================
// HELPER: Safe Redis operation wrapper
// ============================================

// ✅ NEW: Redis operations ko safely execute karo
const safeRedisOp = async <T>(
  operation: (redis: Redis) => Promise<T>,
  fallback: T,
  operationName = 'Redis op'
): Promise<T> => {
  const redis = getRedis();
  if (!redis) {
    console.warn(`⚠️  ${operationName}: Redis not available, using fallback`);
    return fallback;
  }

  try {
    return await operation(redis);
  } catch (err: any) {
    console.warn(`⚠️  ${operationName} failed: ${err.message}`);
    return fallback;
  }
};

// ============================================
// IN-MEMORY OTP FALLBACK (jab Redis nahi ho)
// ============================================

interface OtpData {
  otp: string;
  attempts: number;
  createdAt: number;
  expiresAt: number;
}

// ✅ In-memory store - Redis down hone pe kaam aayega
// Note: Multi-instance pe kaam nahi karega, but single Render instance pe theek hai
const memoryOtpStore = new Map<string, OtpData>();

// Expired OTPs cleanup (memory leak prevent karo)
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of memoryOtpStore.entries()) {
    if (now > data.expiresAt) {
      memoryOtpStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Har 5 min pe cleanup

// ─── OTP Store (Redis + Memory Fallback) ─────────────────────────

const storeOTP = async (key: string, data: OtpData): Promise<void> => {
  const redis = getRedis();

  if (redis) {
    try {
      const ttl = Math.ceil((data.expiresAt - Date.now()) / 1000);
      await redis.set(key, JSON.stringify(data), 'EX', ttl);
      return;
    } catch (err: any) {
      console.warn('⚠️  Redis store failed, using memory:', err.message);
    }
  }

  // ✅ Memory fallback
  memoryOtpStore.set(key, data);
};

const getOTP = async (key: string): Promise<OtpData | null> => {
  const redis = getRedis();

  if (redis) {
    try {
      const stored = await redis.get(key);
      if (stored) return JSON.parse(stored);
    } catch (err: any) {
      console.warn('⚠️  Redis get failed, checking memory:', err.message);
    }
  }

  // ✅ Memory fallback
  const memData = memoryOtpStore.get(key);
  if (!memData) return null;

  // Expiry check
  if (Date.now() > memData.expiresAt) {
    memoryOtpStore.delete(key);
    return null;
  }

  return memData;
};

const deleteOTP = async (key: string): Promise<void> => {
  const redis = getRedis();

  if (redis) {
    try {
      await redis.del(key);
    } catch (err: any) {
      console.warn('⚠️  Redis del failed:', err.message);
    }
  }

  // Memory se bhi delete karo
  memoryOtpStore.delete(key);
};

const updateOTPAttempts = async (
  key: string,
  data: OtpData,
  newAttempts: number
): Promise<void> => {
  const updated = { ...data, attempts: newAttempts };
  const redis = getRedis();

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(updated), 'KEEPTTL');
      return;
    } catch (err: any) {
      console.warn('⚠️  Redis update failed, using memory:', err.message);
    }
  }

  memoryOtpStore.set(key, updated);
};

// ============================================
// HELPER: Format user
// ============================================

const formatUser = (user: any): AuthUser => ({
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

const generateTokenPair = async (
  userId: string,
  email: string,
  organizationId?: string
): Promise<AuthTokens> => {
  const payload = { userId, email, organizationId };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  const expiresAt = new Date(
    Date.now() + parseExpiryTime(config.jwt.refreshExpiresIn)
  );

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId, expiresAt },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: parseExpiryTime(config.jwt.expiresIn),
  };
};

// ============================================
// HELPER: Get default org
// ============================================

const getDefaultOrg = async (userId: string) => {
  const owned = await prisma.organization.findFirst({
    where: { ownerId: userId },
    select: { id: true, name: true, slug: true, planType: true },
  });
  if (owned) return owned;

  const membership = await prisma.organizationMember.findFirst({
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
// HELPER: Create org with plan
// ============================================

const createOrgWithPlan = async (
  tx: any,
  userId: string,
  orgName: string
) => {
  const freePlan = await tx.plan.findUnique({
    where: { type: 'FREE_DEMO' },
  });

  if (!freePlan) {
    throw new AppError(
      'FREE_DEMO plan not found. Please run: npm run db:seed',
      500
    );
  }

  const slug =
    generateSlug(orgName) +
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
    } as any,
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
      currentPeriodEnd: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ),
    },
  });

  return organization;
};

// ============================================
// AUTH SERVICE
// ============================================

export class AuthService {
  // ────────────────────────────────────────────
  // SEND PHONE OTP
  // ────────────────────────────────────────────
  async sendPhoneOTP(phone: string): Promise<{ message: string }> {
    const waPhone = toWhatsAppPhone(phone);
    const key = `${PHONE_OTP_PREFIX}${waPhone}`;

    // Cooldown check (Redis ya memory se)
    const existing = await getOTP(key);
    if (existing) {
      const elapsed = Date.now() - (existing.createdAt || 0);
      if (elapsed < OTP_RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new AppError(
          `Please wait ${wait} seconds before requesting another OTP`,
          429
        );
      }
    }

    const otp = generateOTP(6);
    const otpData: OtpData = {
      otp,
      attempts: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
    };

    // ✅ Redis ya memory me store karo - koi bhi down ho chalega
    await storeOTP(key, otpData);

    if (config.nodeEnv === 'development') {
      console.log('\n' + '='.repeat(45));
      console.log(`  📱 DEV OTP for +${waPhone}`);
      console.log(`  🔢 OTP: ${otp}`);
      console.log('='.repeat(45) + '\n');
    }

    sendWhatsAppTemplate(
      waPhone,
      config.platform.whatsapp.otpTemplate,
      [otp]
    );

    const isConfigured =
      !!config.platform.whatsapp.phoneNumberId &&
      !!config.platform.whatsapp.accessToken;

    return {
      message: isConfigured
        ? 'OTP sent to your WhatsApp number'
        : 'OTP sent (check server console in development)',
    };
  }

  // ────────────────────────────────────────────
  // VERIFY PHONE OTP + REGISTER
  // ────────────────────────────────────────────
  async verifyPhoneOTPAndRegister(
    phone: string,
    otp: string,
    userData: {
      firstName: string;
      lastName?: string;
      email: string;
      password: string;
      organizationName?: string;
    }
  ): Promise<AuthResponse> {
    const waPhone = toWhatsAppPhone(phone);
    const phoneE164 = toE164(phone);
    const key = `${PHONE_OTP_PREFIX}${waPhone}`;

    // ✅ Redis ya memory se OTP lo
    const storedData = await getOTP(key);

    if (!storedData) {
      throw new AppError(
        'OTP expired or not found. Please request a new OTP.',
        400
      );
    }

    if (storedData.attempts >= MAX_OTP_ATTEMPTS) {
      await deleteOTP(key);
      throw new AppError(
        'Too many incorrect attempts. Please request a new OTP.',
        429
      );
    }

    if (storedData.otp !== otp) {
      const newAttempts = storedData.attempts + 1;
      const remaining = MAX_OTP_ATTEMPTS - newAttempts;

      await updateOTPAttempts(key, storedData, newAttempts);

      throw new AppError(
        `Invalid OTP. ${remaining} attempt${
          remaining !== 1 ? 's' : ''
        } remaining.`,
        400
      );
    }

    // OTP verified - delete from Redis
    await deleteOTP(key);

    // Email duplicate check
    const normalizedEmail = userData.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new AppError(
        'This email is already registered. Please login instead.',
        409
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(userData.password);

    // Create user + org + subscription
    const result = await prisma.$transaction(async (tx) => {
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

      const orgName =
        userData.organizationName?.trim() ||
        `${userData.firstName.trim()}'s Workspace`;

      const organization = await createOrgWithPlan(tx, user.id, orgName);

      return { user, organization };
    });

    // Generate tokens
    const tokens = await generateTokenPair(
      result.user.id,
      result.user.email,
      result.organization.id
    );

    // Send welcome messages (non-blocking)
    sendWhatsAppTemplate(
      waPhone,
      config.platform.whatsapp.welcomeTemplate,
      [result.user.firstName]
    );

    sendEmailNonBlocking({
      to: normalizedEmail,
      subject: '🎉 Welcome to WabMeta!',
      html: emailTemplates.welcome(result.user.firstName).html,
    });

    console.log(
      `✅ New user registered (Phone OTP): ${normalizedEmail} | Phone: ${phoneE164}`
    );

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
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { email, password, firstName, lastName, phone, organizationName } =
      input;
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (!existingUser.emailVerified) {
        const token = generateToken();
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await prisma.user.update({
          where: { id: existingUser.id },
          data: { emailVerifyToken: token, emailVerifyExpires: expires },
        });

        const verifyUrl = `${config.frontendUrl}/verify-email?token=${token}`;
        const tpl = emailTemplates.verifyEmail(
          existingUser.firstName,
          verifyUrl
        );
        sendEmailNonBlocking({
          to: normalizedEmail,
          subject: tpl.subject,
          html: tpl.html,
        });

        throw new AppError(
          'Email already registered. Verification email resent.',
          409
        );
      }
      throw new AppError('Email already registered', 409);
    }

    const hashedPassword = await hashPassword(password);
    const emailVerifyToken = generateToken();
    const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
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

      const orgName =
        organizationName?.trim() || `${firstName}'s Workspace`;
      const organization = await createOrgWithPlan(tx, user.id, orgName);

      return { user, organization };
    });

    const verifyUrl = `${config.frontendUrl}/verify-email?token=${emailVerifyToken}`;
    const tpl = emailTemplates.verifyEmail(firstName, verifyUrl);
    sendEmailNonBlocking({
      to: normalizedEmail,
      subject: tpl.subject,
      html: tpl.html,
    });

    if (phone) {
      sendWhatsAppTemplate(
        phone,
        config.platform.whatsapp.welcomeTemplate,
        [firstName || 'there']
      );
    }

    const tokens = await generateTokenPair(
      result.user.id,
      result.user.email,
      result.organization.id
    );

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
  // LOGIN
  // ────────────────────────────────────────────
  async login(input: LoginInput): Promise<AuthResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();

    console.log(`🔐 Login attempt: ${normalizedEmail}`);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.password) {
      if (user.googleId) {
        throw new AppError(
          'This account uses Google Sign-In. Please login with Google.',
          400
        );
      }
      throw new AppError(
        'Account configuration error. Please contact support.',
        500
      );
    }

    const isValid = await comparePassword(input.password, user.password);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401);
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError(
        'Account suspended. Please contact support.',
        403
      );
    }

    let organization = await getDefaultOrg(user.id);

    if (!organization) {
      console.log('⚠️  No org found for user, auto-creating...');
      const orgName = `${user.firstName || 'User'}'s Workspace`;
      organization = await prisma.$transaction((tx) =>
        createOrgWithPlan(tx, user.id, orgName)
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await generateTokenPair(
      user.id,
      user.email,
      organization?.id
    );

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
  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    await prisma.user.update({
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

  // ────────────────────────────────────────────
  // RESEND VERIFICATION EMAIL
  // ────────────────────────────────────────────
  async resendVerificationEmail(
    email: string
  ): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const successMsg =
      'If your email is registered, you will receive a verification link';

    if (!user) return { message: successMsg };
    if (user.emailVerified) {
      throw new AppError('Email is already verified', 400);
    }

    const token = generateToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: token, emailVerifyExpires: expires },
    });

    const verifyUrl = `${config.frontendUrl}/verify-email?token=${token}`;
    const tpl = emailTemplates.verifyEmail(user.firstName, verifyUrl);
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
  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const successMsg =
      'If your email is registered, you will receive a password reset link';

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) return { message: successMsg };

    const token = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpires: expires },
    });

    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
    const tpl = emailTemplates.resetPassword(user.firstName, resetUrl);
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
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const hashed = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    return { message: 'Password reset successfully' };
  }

  // ────────────────────────────────────────────
  // SEND EMAIL OTP
  // ────────────────────────────────────────────
  async sendOTP(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) throw new AppError('User not found', 404);

    const otp = generateOTP(6);
    const key = `${EMAIL_OTP_PREFIX}${normalizedEmail}`;

    const otpData: OtpData = {
      otp,
      attempts: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
    };

    // ✅ Fallback ke saath store karo
    await storeOTP(key, otpData);

    const tpl = emailTemplates.otp(user.firstName, otp);
    sendEmailNonBlocking({
      to: normalizedEmail,
      subject: tpl.subject,
      html: tpl.html,
    });

    if (user.phone) {
      sendWhatsAppTemplate(
        user.phone,
        config.platform.whatsapp.otpTemplate,
        [otp]
      );
    }

    return { message: 'OTP sent to your email' };
  }

  // ────────────────────────────────────────────
  // VERIFY EMAIL OTP
  // ────────────────────────────────────────────
  async verifyOTP(email: string, otp: string): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const key = `${EMAIL_OTP_PREFIX}${normalizedEmail}`;

    // ✅ Fallback ke saath get karo
    const storedData = await getOTP(key);

    if (!storedData) {
      throw new AppError('OTP expired or not found', 400);
    }

    if (storedData.attempts >= MAX_OTP_ATTEMPTS) {
      await deleteOTP(key);
      throw new AppError('Too many attempts. Please request a new OTP', 429);
    }

    if (storedData.otp !== otp) {
      await updateOTPAttempts(key, storedData, storedData.attempts + 1);
      throw new AppError('Invalid OTP', 400);
    }

    await deleteOTP(key);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) throw new AppError('User not found', 404);

    if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, status: 'ACTIVE' },
      });
    }

    const organization = await getDefaultOrg(user.id);
    const tokens = await generateTokenPair(
      user.id,
      user.email,
      organization?.id
    );

    return {
      user: formatUser(user),
      tokens,
      organization: organization || undefined,
    };
  }

  // ────────────────────────────────────────────
  // GOOGLE AUTH
  // ────────────────────────────────────────────
  async googleAuth(credential: string): Promise<AuthResponse> {
    let payload: GoogleUserPayload;

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.google.clientId,
      });
      const p = ticket.getPayload();
      if (!p) throw new Error('Empty payload');
      payload = p as GoogleUserPayload;
    } catch {
      throw new AppError('Invalid Google token', 401);
    }

    const { email, given_name, family_name, picture, sub: googleId } =
      payload;
    const normalizedEmail = email.trim().toLowerCase();

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            avatar: user.avatar || picture,
            emailVerified: true,
            status: 'ACTIVE',
          },
        });
      }
    } else {
      const created = await prisma.$transaction(async (tx) => {
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

        const org = await createOrgWithPlan(
          tx,
          newUser.id,
          `${given_name}'s Workspace`
        );

        return { user: newUser, org };
      });

      user = created.user;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    let organization = await getDefaultOrg(user.id);

    if (!organization) {
      organization = await prisma.$transaction((tx) =>
        createOrgWithPlan(
          tx,
          user!.id,
          `${user!.firstName || 'User'}'s Workspace`
        )
      );
    }

    const tokens = await generateTokenPair(
      user.id,
      user.email,
      organization?.id
    );

    return {
      user: formatUser(user),
      tokens,
      organization: organization || undefined,
    };
  }

  // ────────────────────────────────────────────
  // REFRESH TOKEN
  // ────────────────────────────────────────────
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored) throw new AppError('Refresh token not found', 401);

    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new AppError('Refresh token expired', 401);
    }

    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const org = await getDefaultOrg(stored.userId);

    return generateTokenPair(stored.userId, stored.user.email, org?.id);
  }

  // ────────────────────────────────────────────
  // LOGOUT
  // ────────────────────────────────────────────
  async logout(refreshToken: string): Promise<{ message: string }> {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
    return { message: 'Logged out successfully' };
  }

  // ────────────────────────────────────────────
  // LOGOUT ALL DEVICES
  // ────────────────────────────────────────────
  async logoutAll(userId: string): Promise<{ message: string }> {
    await prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: 'Logged out from all devices' };
  }

  // ────────────────────────────────────────────
  // GET CURRENT USER
  // ────────────────────────────────────────────
  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    return formatUser(user);
  }

  // ────────────────────────────────────────────
  // CHANGE PASSWORD
  // ────────────────────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    if (!user.password) {
      throw new AppError(
        'Cannot change password for OAuth-only accounts.',
        400
      );
    }

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    const hashed = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    await prisma.refreshToken.deleteMany({ where: { userId } });

    return { message: 'Password changed successfully' };
  }
}

export const authService = new AuthService();