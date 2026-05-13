import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authRateLimit, rateLimit } from '../../middleware/rateLimit';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyOTPSchema,
  resendOTPSchema,
  googleAuthSchema,
  changePasswordSchema,
  resendVerificationSchema,
} from './auth.schema';

const router = Router();

// ============================================
// PHONE OTP ROUTES (NEW)
// ============================================

/**
 * POST /api/auth/send-phone-otp
 * WhatsApp pe OTP bhejo (signup ke liye)
 */
router.post(
  '/send-phone-otp',
  rateLimit({ windowMs: 60 * 1000, max: 3 }),
  authController.sendPhoneOTP.bind(authController)
);

/**
 * POST /api/auth/verify-phone-otp
 * Phone OTP verify karo + account banao
 */
router.post(
  '/verify-phone-otp',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
  authController.verifyPhoneOTPAndRegister.bind(authController)
);

// ============================================
// EXISTING PUBLIC ROUTES
// ============================================

router.post(
  '/register',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }),
  validate(registerSchema),
  authController.register.bind(authController)
);

router.post(
  '/login',
  authRateLimit,
  validate(loginSchema),
  authController.login.bind(authController)
);

router.post(
  '/google',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }),
  validate(googleAuthSchema),
  authController.googleAuth.bind(authController)
);

router.post(
  '/verify-email',
  validate(verifyEmailSchema),
  authController.verifyEmail.bind(authController)
);

router.post(
  '/resend-verification',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }),
  validate(resendVerificationSchema),
  authController.resendVerification.bind(authController)
);

router.post(
  '/forgot-password',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }),
  validate(forgotPasswordSchema),
  authController.forgotPassword.bind(authController)
);

router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  authController.resetPassword.bind(authController)
);

router.post(
  '/send-otp',
  rateLimit({ windowMs: 60 * 1000, max: 3 }),
  validate(resendOTPSchema),
  authController.sendOTP.bind(authController)
);

router.post(
  '/verify-otp',
  authRateLimit,
  validate(verifyOTPSchema),
  authController.verifyOTP.bind(authController)
);

router.post(
  '/refresh',
  rateLimit({ windowMs: 60 * 1000, max: 10 }),
  authController.refreshToken.bind(authController)
);

router.post('/logout', authController.logout.bind(authController));

// ============================================
// PROTECTED ROUTES
// ============================================

router.get('/me', authenticate, authController.me.bind(authController));

router.post(
  '/logout-all',
  authenticate,
  authController.logoutAll.bind(authController)
);

router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword.bind(authController)
);

export default router;