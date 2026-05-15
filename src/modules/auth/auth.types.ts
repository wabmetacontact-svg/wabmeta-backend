// src/modules/auth/auth.types.ts

export interface RegisterInput {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  organizationName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface VerifyEmailInput {
  token: string;
}

export interface VerifyOTPInput {
  email: string;
  otp: string;
}

export interface GoogleAuthInput {
  credential: string;
}

export interface RefreshTokenInput {
  refreshToken?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  avatar?: string | null;
  emailVerified: boolean;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
  organization?: {
    id: string;
    name: string;
    slug: string;
    planType: string;
  };
}

export interface GoogleUserPayload {
  email: string;
  given_name: string;
  family_name?: string;
  picture?: string;
  sub: string;
  email_verified?: boolean;
}

export interface RegisterResponse {
  message: string;
  email: string;
  requiresVerification: boolean;
}

export interface OTPData {
  otp: string;
  expiresAt: number;
  attempts: number;
}

export interface JWTPayload {
  userId: string;
  email: string;
  organizationId?: string;
}