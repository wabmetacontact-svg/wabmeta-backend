// src/modules/auth/auth.controller.ts - FINAL VERSION

import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { sendSuccess } from '../../utils/response';
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
  VerifyOTPInput,
  GoogleAuthInput,
  RefreshTokenInput,
  ChangePasswordInput,
} from './auth.types';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

// ✅ Cookie options for setting cookies (with maxAge)
const cookieOptions = (isRefresh: boolean = false) => ({
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  maxAge: isRefresh
    ? 7 * 24 * 60 * 60 * 1000  // 7 days
    : 1 * 60 * 60 * 1000,       // 1 hour
  path: '/',
});

// ✅ FIX: Cookie options for clearing cookies (NO maxAge)
const clearCookieOptions = () => ({
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
});

export class AuthController {
  // ────────────────────────────────────────────
  // SEND PHONE OTP
  // ────────────────────────────────────────────
  async sendPhoneOTP(req: Request, res: Response, next: NextFunction) {
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
          message:
            'Invalid phone number. Please enter a valid mobile number.',
        });
      }

      const result = await authService.sendPhoneOTP(phone);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // VERIFY PHONE OTP + REGISTER
  // ────────────────────────────────────────────
  async verifyPhoneOTPAndRegister(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const {
        phone,
        otp,
        firstName,
        lastName,
        email,
        password,
        organizationName,
      } = req.body;

      if (!phone || !otp || !firstName || !email || !password) {
        return res.status(400).json({
          success: false,
          message:
            'Phone, OTP, first name, email and password are all required',
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

      const result = await authService.verifyPhoneOTPAndRegister(phone, otp, {
        firstName: firstName.trim(),
        lastName: lastName?.trim(),
        email: email.trim().toLowerCase(),
        password,
        organizationName: organizationName?.trim(),
      });

      res.cookie(
        'refreshToken',
        result.tokens.refreshToken,
        cookieOptions(true)
      );
      res.cookie(
        'accessToken',
        result.tokens.accessToken,
        cookieOptions(false)
      );

      return sendSuccess(
        res,
        result,
        'Account created successfully! Welcome to WabMeta 🎉',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // REGISTER
  // ────────────────────────────────────────────
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const input: RegisterInput = req.body;
      const result = await authService.register(input);

      res.cookie(
        'refreshToken',
        result.tokens.refreshToken,
        cookieOptions(true)
      );
      res.cookie(
        'accessToken',
        result.tokens.accessToken,
        cookieOptions(false)
      );

      return sendSuccess(res, result, 'Registration successful', 201);
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // LOGIN
  // ────────────────────────────────────────────
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input: LoginInput = req.body;
      const result = await authService.login(input);

      res.cookie(
        'refreshToken',
        result.tokens.refreshToken,
        cookieOptions(true)
      );
      res.cookie(
        'accessToken',
        result.tokens.accessToken,
        cookieOptions(false)
      );

      return sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // VERIFY EMAIL
  // ────────────────────────────────────────────
  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token }: VerifyEmailInput = req.body;
      const result = await authService.verifyEmail(token);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // RESEND VERIFICATION
  // ────────────────────────────────────────────
  async resendVerification(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { email } = req.body;
      const result = await authService.resendVerificationEmail(email);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // FORGOT PASSWORD
  // ────────────────────────────────────────────
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email }: ForgotPasswordInput = req.body;
      const result = await authService.forgotPassword(email);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // RESET PASSWORD
  // ────────────────────────────────────────────
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password }: ResetPasswordInput = req.body;
      const result = await authService.resetPassword(token, password);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // SEND EMAIL OTP
  // ────────────────────────────────────────────
  async sendOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const result = await authService.sendOTP(email);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // VERIFY EMAIL OTP
  // ────────────────────────────────────────────
  async verifyOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp }: VerifyOTPInput = req.body;
      const result = await authService.verifyOTP(email, otp);

      res.cookie(
        'refreshToken',
        result.tokens.refreshToken,
        cookieOptions(true)
      );
      res.cookie(
        'accessToken',
        result.tokens.accessToken,
        cookieOptions(false)
      );

      return sendSuccess(res, result, 'OTP verified successfully');
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // GOOGLE AUTH
  // ────────────────────────────────────────────
  async googleAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const { credential }: GoogleAuthInput = req.body;
      const result = await authService.googleAuth(credential);

      res.cookie(
        'refreshToken',
        result.tokens.refreshToken,
        cookieOptions(true)
      );
      res.cookie(
        'accessToken',
        result.tokens.accessToken,
        cookieOptions(false)
      );

      return sendSuccess(res, result, 'Google authentication successful');
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // REFRESH TOKEN
  // ────────────────────────────────────────────
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken =
        req.cookies?.refreshToken ||
        (req.body as RefreshTokenInput)?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token required',
        });
      }

      const tokens = await authService.refreshToken(refreshToken);

      res.cookie('refreshToken', tokens.refreshToken, cookieOptions(true));
      res.cookie('accessToken', tokens.accessToken, cookieOptions(false));

      return sendSuccess(res, tokens, 'Token refreshed');
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // LOGOUT - ✅ FIXED clearCookie warning
  // ────────────────────────────────────────────
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken =
        req.cookies?.refreshToken || req.body?.refreshToken;

      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      // ✅ FIX: Use clearCookieOptions (no maxAge)
      res.clearCookie('refreshToken', clearCookieOptions());
      res.clearCookie('accessToken', clearCookieOptions());

      return sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // LOGOUT ALL - ✅ FIXED clearCookie warning
  // ────────────────────────────────────────────
  async logoutAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await authService.logoutAll(userId);

      // ✅ FIX: Use clearCookieOptions (no maxAge)
      res.clearCookie('refreshToken', clearCookieOptions());
      res.clearCookie('accessToken', clearCookieOptions());

      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // ME
  // ────────────────────────────────────────────
  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const user = await authService.getCurrentUser(userId);
      return sendSuccess(res, user, 'User fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ────────────────────────────────────────────
  // CHANGE PASSWORD - ✅ FIXED clearCookie warning
  // ────────────────────────────────────────────
  async changePassword(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword }: ChangePasswordInput = req.body;
      const result = await authService.changePassword(
        userId,
        currentPassword,
        newPassword
      );

      // ✅ FIX: Use clearCookieOptions (no maxAge)
      res.clearCookie('refreshToken', clearCookieOptions());

      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();