// src/modules/auth/auth.schema.ts

import { z } from 'zod';

// ============================================
// COMMON VALIDATORS
// ============================================

const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address')
  .toLowerCase()
  .trim()
  .max(255, 'Email is too long');

const passwordSchema = z
  .string()
  .min(8,   'Password must be at least 8 characters')
  .max(128, 'Password too long (max 128 characters)')
  .refine(
    (pwd) => {
      // Password strength scoring
      let score = 0;
      if (/[a-z]/.test(pwd))          score++;  // lowercase
      if (/[A-Z]/.test(pwd))          score++;  // uppercase
      if (/\d/.test(pwd))             score++;  // number
      if (/[^a-zA-Z0-9]/.test(pwd))   score++;  // special char
      if (pwd.length >= 12)           score++;  // bonus for length

      // Require at least 3 of these
      return score >= 3;
    },
    {
      message:
        'Password must contain at least 3 of: uppercase letter, ' +
        'lowercase letter, number, special character. ' +
        'Longer passwords are stronger!',
    }
  )
  .refine(
    (pwd) => {
      // Reject common weak passwords
      const common = [
        'password', 'password123', '12345678', 'qwerty123',
        'admin123', 'welcome1', 'letmein123',
      ];
      return !common.includes(pwd.toLowerCase());
    },
    { message: 'This password is too common. Please choose a stronger one.' }
  );

const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name is too long')
  .regex(/^[a-zA-Z\s\-\']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .trim();

const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format (use international format: +911234567890)')
  .optional()
  .or(z.literal(''));

const organizationNameSchema = z
  .string()
  .min(2, 'Organization name must be at least 2 characters')
  .max(100, 'Organization name is too long')
  .regex(
    /^[a-zA-Z0-9\s\-\_\.]+$/,
    'Organization name can only contain letters, numbers, spaces, hyphens, underscores, and dots'
  )
  .trim()
  .optional()
  .or(z.literal(''));

// ============================================
// REQUEST SCHEMAS
// ============================================

// ✅ Updated: Added confirmPassword with refinement
export const registerSchema = z.object({
  body: z
    .object({
      email: emailSchema,
      password: passwordSchema,
      confirmPassword: z.string().min(1, 'Please confirm your password'),
      firstName: nameSchema,
      lastName: nameSchema.optional().or(z.literal('')),
      phone: phoneSchema,
      organizationName: organizationNameSchema,
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

// ✅ Updated: Added confirmPassword with refinement
export const resetPasswordSchema = z.object({
  body: z
    .object({
      token: z.string().min(1, 'Reset token is required').max(500, 'Invalid token'),
      password: passwordSchema,
      confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Verification token is required').max(500, 'Invalid token'),
  }),
});

export const verifyOTPSchema = z.object({
  body: z.object({
    email: emailSchema,
    otp: z
      .string()
      .length(6, 'OTP must be exactly 6 digits')
      .regex(/^\d{6}$/, 'OTP must contain only numbers'),
  }),
});

export const resendOTPSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const refreshTokenSchema = z.object({
  body: z
    .object({
      refreshToken: z.string().optional(),
    })
    .optional(),
});

export const googleAuthSchema = z.object({
  body: z.object({
    credential: z.string().min(1, 'Google credential is required'),
  }),
});

// ✅ Updated: Added confirmPassword with refinement
export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: passwordSchema,
      confirmPassword: z.string().min(1, 'Please confirm new password'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: 'New password must be different from current password',
      path: ['newPassword'],
    }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

// ============================================
// RATE LIMIT CONFIGS
// ============================================

export const rateLimitConfigs = {
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Too many registration attempts. Please try again later.',
  },
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many login attempts. Please try again later.',
  },
  forgotPassword: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: 'Too many password reset requests. Please try again later.',
  },
  sendOTP: {
    windowMs: 60 * 1000, // 1 minute
    max: 2,
    message: 'Please wait before requesting another OTP.',
  },
  verifyOTP: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many OTP verification attempts.',
  },
  resendVerification: {
    windowMs: 60 * 1000, // 1 minute
    max: 3,
    message: 'Please wait before requesting another verification email.',
  },
};

// ============================================
// TYPE EXPORTS
// ============================================

export type RegisterSchema = z.infer<typeof registerSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailSchema = z.infer<typeof verifyEmailSchema>;
export type VerifyOTPSchema = z.infer<typeof verifyOTPSchema>;
export type ResendOTPSchema = z.infer<typeof resendOTPSchema>;
export type RefreshTokenSchema = z.infer<typeof refreshTokenSchema>;
export type GoogleAuthSchema = z.infer<typeof googleAuthSchema>;
export type ChangePasswordSchema = z.infer<typeof changePasswordSchema>;
export type ResendVerificationSchema = z.infer<typeof resendVerificationSchema>;