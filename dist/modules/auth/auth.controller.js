"use strict";
// src/modules/auth/auth.controller.ts - FIXED VERSION
// ✅ FIX: now imports shared getCookieOptions/getClearCookieOptions from utils/cookies.ts
// instead of its own conflicting local versions (was causing cross-domain cookie issues
// and clearCookie not matching original cookie attributes)
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const response_1 = require("../../utils/response");
const cookies_1 = require("../../utils/cookies"); // ✅ FIX
class AuthController {
    // ────────────────────────────────────────────
    // SEND PHONE OTP
    // ────────────────────────────────────────────
    async sendPhoneOTP(req, res, next) {
        try {
            const { phone } = req.body;
            if (!phone) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number is required',
                });
            }
            const digits = phone.replace(/\D/g, '');
            if (digits.length < 10 || digits.length > 15) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid phone number. Please enter a valid mobile number.',
                });
            }
            const result = await auth_service_1.authService.sendPhoneOTP(phone);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // VERIFY PHONE OTP + REGISTER
    // ────────────────────────────────────────────
    async verifyPhoneOTPAndRegister(req, res, next) {
        try {
            const { phone, otp, firstName, lastName, email, password, organizationName, } = req.body;
            if (!phone || !otp || !firstName || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone, OTP, first name, email and password are all required',
                });
            }
            if (!/^\d{6}$/.test(otp)) {
                return res.status(400).json({
                    success: false,
                    message: 'OTP must be a 6-digit number',
                });
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email address',
                });
            }
            const result = await auth_service_1.authService.verifyPhoneOTPAndRegister(phone, otp, {
                firstName: firstName.trim(),
                lastName: lastName?.trim(),
                email: email.trim().toLowerCase(),
                password,
                organizationName: organizationName?.trim(),
            });
            res.cookie('refreshToken', result.tokens.refreshToken, (0, cookies_1.getCookieOptions)(true));
            res.cookie('accessToken', result.tokens.accessToken, (0, cookies_1.getCookieOptions)(false));
            return (0, response_1.sendSuccess)(res, result, 'Account created successfully! Welcome to WabMeta 🎉', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // REGISTER
    // ────────────────────────────────────────────
    async register(req, res, next) {
        try {
            const input = req.body;
            const result = await auth_service_1.authService.register(input);
            // ❌ Cookies mat set karo - user verified nahi hai abhi
            return (0, response_1.sendSuccess)(res, result, result.message, 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // LOGIN
    // ────────────────────────────────────────────
    async login(req, res, next) {
        try {
            const input = req.body;
            const result = await auth_service_1.authService.login(input);
            res.cookie('refreshToken', result.tokens.refreshToken, (0, cookies_1.getCookieOptions)(true));
            res.cookie('accessToken', result.tokens.accessToken, (0, cookies_1.getCookieOptions)(false));
            return (0, response_1.sendSuccess)(res, result, 'Login successful');
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // VERIFY EMAIL
    // ────────────────────────────────────────────
    async verifyEmail(req, res, next) {
        try {
            const { token } = req.body;
            const result = await auth_service_1.authService.verifyEmail(token);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // RESEND VERIFICATION
    // ────────────────────────────────────────────
    async resendVerification(req, res, next) {
        try {
            const { email } = req.body;
            const result = await auth_service_1.authService.resendVerificationEmail(email);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // FORGOT PASSWORD
    // ────────────────────────────────────────────
    async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;
            const result = await auth_service_1.authService.forgotPassword(email);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // RESET PASSWORD
    // ────────────────────────────────────────────
    async resetPassword(req, res, next) {
        try {
            const { token, password } = req.body;
            const result = await auth_service_1.authService.resetPassword(token, password);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // SEND EMAIL OTP
    // ────────────────────────────────────────────
    async sendOTP(req, res, next) {
        try {
            const { email } = req.body;
            const result = await auth_service_1.authService.sendOTP(email);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // VERIFY EMAIL OTP
    // ────────────────────────────────────────────
    async verifyOTP(req, res, next) {
        try {
            const { email, otp } = req.body;
            const result = await auth_service_1.authService.verifyOTP(email, otp);
            res.cookie('refreshToken', result.tokens.refreshToken, (0, cookies_1.getCookieOptions)(true));
            res.cookie('accessToken', result.tokens.accessToken, (0, cookies_1.getCookieOptions)(false));
            return (0, response_1.sendSuccess)(res, result, 'OTP verified successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // GOOGLE AUTH
    // ────────────────────────────────────────────
    async googleAuth(req, res, next) {
        try {
            const { credential } = req.body;
            const result = await auth_service_1.authService.googleAuth(credential);
            res.cookie('refreshToken', result.tokens.refreshToken, (0, cookies_1.getCookieOptions)(true));
            res.cookie('accessToken', result.tokens.accessToken, (0, cookies_1.getCookieOptions)(false));
            return (0, response_1.sendSuccess)(res, result, 'Google authentication successful');
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // REFRESH TOKEN
    // ────────────────────────────────────────────
    async refreshToken(req, res, next) {
        try {
            const refreshToken = req.cookies?.refreshToken ||
                req.body?.refreshToken;
            if (!refreshToken) {
                return res.status(401).json({
                    success: false,
                    error: 'Refresh token required',
                });
            }
            const tokens = await auth_service_1.authService.refreshToken(refreshToken);
            res.cookie('refreshToken', tokens.refreshToken, (0, cookies_1.getCookieOptions)(true));
            res.cookie('accessToken', tokens.accessToken, (0, cookies_1.getCookieOptions)(false));
            return (0, response_1.sendSuccess)(res, tokens, 'Token refreshed');
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // LOGOUT
    // ────────────────────────────────────────────
    async logout(req, res, next) {
        try {
            const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
            if (refreshToken) {
                await auth_service_1.authService.logout(refreshToken);
            }
            res.clearCookie('refreshToken', (0, cookies_1.getClearCookieOptions)(true));
            res.clearCookie('accessToken', (0, cookies_1.getClearCookieOptions)(false));
            return (0, response_1.sendSuccess)(res, null, 'Logged out successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // LOGOUT ALL
    // ────────────────────────────────────────────
    async logoutAll(req, res, next) {
        try {
            const userId = req.user.id;
            const result = await auth_service_1.authService.logoutAll(userId);
            res.clearCookie('refreshToken', (0, cookies_1.getClearCookieOptions)(true));
            res.clearCookie('accessToken', (0, cookies_1.getClearCookieOptions)(false));
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // ME
    // ────────────────────────────────────────────
    async me(req, res, next) {
        try {
            const userId = req.user.id;
            const user = await auth_service_1.authService.getCurrentUser(userId);
            return (0, response_1.sendSuccess)(res, user, 'User fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // CHANGE PASSWORD
    // ────────────────────────────────────────────
    async changePassword(req, res, next) {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;
            const result = await auth_service_1.authService.changePassword(userId, currentPassword, newPassword);
            // ✅ FIX: clear BOTH cookies (access token was still valid for up to 15m/7d
            // before the tokenVersion fix — now also clear accessToken cookie for safety)
            res.clearCookie('refreshToken', (0, cookies_1.getClearCookieOptions)(true));
            res.clearCookie('accessToken', (0, cookies_1.getClearCookieOptions)(false));
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map