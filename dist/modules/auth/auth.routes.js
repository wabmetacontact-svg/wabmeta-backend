"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const auth_schema_1 = require("./auth.schema");
const router = (0, express_1.Router)();
// ============================================
// PHONE OTP ROUTES (NEW)
// ============================================
/**
 * POST /api/auth/send-phone-otp
 * WhatsApp pe OTP bhejo (signup ke liye)
 */
router.post('/send-phone-otp', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 1000, max: 3 }), auth_controller_1.authController.sendPhoneOTP.bind(auth_controller_1.authController));
/**
 * POST /api/auth/verify-phone-otp
 * Phone OTP verify karo + account banao
 */
router.post('/verify-phone-otp', (0, rateLimit_1.rateLimit)({ windowMs: 15 * 60 * 1000, max: 10 }), auth_controller_1.authController.verifyPhoneOTPAndRegister.bind(auth_controller_1.authController));
// ============================================
// EXISTING PUBLIC ROUTES
// ============================================
router.post('/register', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 60 * 1000, max: 10 }), (0, validate_1.validate)(auth_schema_1.registerSchema), auth_controller_1.authController.register.bind(auth_controller_1.authController));
router.post('/login', rateLimit_1.authRateLimit, (0, validate_1.validate)(auth_schema_1.loginSchema), auth_controller_1.authController.login.bind(auth_controller_1.authController));
router.post('/google', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 60 * 1000, max: 20 }), (0, validate_1.validate)(auth_schema_1.googleAuthSchema), auth_controller_1.authController.googleAuth.bind(auth_controller_1.authController));
router.post('/verify-email', (0, validate_1.validate)(auth_schema_1.verifyEmailSchema), auth_controller_1.authController.verifyEmail.bind(auth_controller_1.authController));
router.post('/resend-verification', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 60 * 1000, max: 5 }), (0, validate_1.validate)(auth_schema_1.resendVerificationSchema), auth_controller_1.authController.resendVerification.bind(auth_controller_1.authController));
router.post('/forgot-password', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 60 * 1000, max: 5 }), (0, validate_1.validate)(auth_schema_1.forgotPasswordSchema), auth_controller_1.authController.forgotPassword.bind(auth_controller_1.authController));
router.post('/reset-password', (0, validate_1.validate)(auth_schema_1.resetPasswordSchema), auth_controller_1.authController.resetPassword.bind(auth_controller_1.authController));
router.post('/send-otp', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 1000, max: 3 }), (0, validate_1.validate)(auth_schema_1.resendOTPSchema), auth_controller_1.authController.sendOTP.bind(auth_controller_1.authController));
router.post('/verify-otp', rateLimit_1.authRateLimit, (0, validate_1.validate)(auth_schema_1.verifyOTPSchema), auth_controller_1.authController.verifyOTP.bind(auth_controller_1.authController));
router.post('/refresh', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 1000, max: 10 }), auth_controller_1.authController.refreshToken.bind(auth_controller_1.authController));
router.post('/logout', auth_controller_1.authController.logout.bind(auth_controller_1.authController));
// ============================================
// PROTECTED ROUTES
// ============================================
router.get('/me', auth_1.authenticate, auth_controller_1.authController.me.bind(auth_controller_1.authController));
router.post('/logout-all', auth_1.authenticate, auth_controller_1.authController.logoutAll.bind(auth_controller_1.authController));
router.post('/change-password', auth_1.authenticate, (0, validate_1.validate)(auth_schema_1.changePasswordSchema), auth_controller_1.authController.changePassword.bind(auth_controller_1.authController));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map