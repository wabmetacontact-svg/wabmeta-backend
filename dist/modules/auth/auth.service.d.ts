import { RegisterInput, LoginInput, AuthResponse, AuthUser, AuthTokens } from './auth.types';
export declare class AuthService {
    sendPhoneOTP(phone: string): Promise<{
        message: string;
    }>;
    verifyPhoneOTPAndRegister(phone: string, otp: string, userData: {
        firstName: string;
        lastName?: string;
        email: string;
        password: string;
        organizationName?: string;
    }): Promise<AuthResponse>;
    register(input: RegisterInput): Promise<{
        message: string;
        email: string;
        requiresVerification: boolean;
    }>;
    login(input: LoginInput): Promise<AuthResponse>;
    verifyEmail(token: string): Promise<{
        message: string;
    }>;
    resendVerificationEmail(email: string): Promise<{
        message: string;
    }>;
    forgotPassword(email: string): Promise<{
        message: string;
    }>;
    resetPassword(token: string, newPassword: string): Promise<{
        message: string;
    }>;
    sendOTP(email: string): Promise<{
        message: string;
    }>;
    verifyOTP(email: string, otp: string): Promise<AuthResponse>;
    googleAuth(credential: string): Promise<AuthResponse>;
    refreshToken(refreshToken: string): Promise<AuthTokens>;
    logout(refreshToken: string): Promise<{
        message: string;
    }>;
    logoutAll(userId: string): Promise<{
        message: string;
    }>;
    getCurrentUser(userId: string): Promise<AuthUser>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        message: string;
    }>;
}
export declare const authService: AuthService;
//# sourceMappingURL=auth.service.d.ts.map