"use strict";
// src/modules/auth/auth.controller.ts - FINAL VERSION
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const response_1 = require("../../utils/response");
// ✅ Cookie options for setting cookies (with maxAge)
const cookieOptions = (isRefresh = false) => ({
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: isRefresh
        ? 7 * 24 * 60 * 60 * 1000 // 7 days
        : 1 * 60 * 60 * 1000, // 1 hour
    path: '/',
});
// ✅ FIX: Cookie options for clearing cookies (NO maxAge)
const clearCookieOptions = () => ({
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
});
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
            res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions(true));
            res.cookie('accessToken', result.tokens.accessToken, cookieOptions(false));
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
            // ✅ Sirf success message return karo
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
            res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions(true));
            res.cookie('accessToken', result.tokens.accessToken, cookieOptions(false));
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
            res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions(true));
            res.cookie('accessToken', result.tokens.accessToken, cookieOptions(false));
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
            res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions(true));
            res.cookie('accessToken', result.tokens.accessToken, cookieOptions(false));
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
            res.cookie('refreshToken', tokens.refreshToken, cookieOptions(true));
            res.cookie('accessToken', tokens.accessToken, cookieOptions(false));
            return (0, response_1.sendSuccess)(res, tokens, 'Token refreshed');
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // LOGOUT - ✅ FIXED clearCookie warning
    // ────────────────────────────────────────────
    async logout(req, res, next) {
        try {
            const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
            if (refreshToken) {
                await auth_service_1.authService.logout(refreshToken);
            }
            // ✅ FIX: Use clearCookieOptions (no maxAge)
            res.clearCookie('refreshToken', clearCookieOptions());
            res.clearCookie('accessToken', clearCookieOptions());
            return (0, response_1.sendSuccess)(res, null, 'Logged out successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ────────────────────────────────────────────
    // LOGOUT ALL - ✅ FIXED clearCookie warning
    // ────────────────────────────────────────────
    async logoutAll(req, res, next) {
        try {
            const userId = req.user.id;
            const result = await auth_service_1.authService.logoutAll(userId);
            // ✅ FIX: Use clearCookieOptions (no maxAge)
            res.clearCookie('refreshToken', clearCookieOptions());
            res.clearCookie('accessToken', clearCookieOptions());
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
    // CHANGE PASSWORD - ✅ FIXED clearCookie warning
    // ────────────────────────────────────────────
    async changePassword(req, res, next) {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;
            const result = await auth_service_1.authService.changePassword(userId, currentPassword, newPassword);
            // ✅ FIX: Use clearCookieOptions (no maxAge)
            res.clearCookie('refreshToken', clearCookieOptions());
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