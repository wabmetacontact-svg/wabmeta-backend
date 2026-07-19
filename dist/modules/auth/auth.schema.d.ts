import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    body: z.ZodEffects<z.ZodObject<{
        email: z.ZodString;
        password: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        confirmPassword: z.ZodString;
        firstName: z.ZodString;
        lastName: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        phone: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        organizationName: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    }, "strip", z.ZodTypeAny, {
        password: string;
        email: string;
        firstName: string;
        confirmPassword: string;
        phone?: string | undefined;
        lastName?: string | undefined;
        organizationName?: string | undefined;
    }, {
        password: string;
        email: string;
        firstName: string;
        confirmPassword: string;
        phone?: string | undefined;
        lastName?: string | undefined;
        organizationName?: string | undefined;
    }>, {
        password: string;
        email: string;
        firstName: string;
        confirmPassword: string;
        phone?: string | undefined;
        lastName?: string | undefined;
        organizationName?: string | undefined;
    }, {
        password: string;
        email: string;
        firstName: string;
        confirmPassword: string;
        phone?: string | undefined;
        lastName?: string | undefined;
        organizationName?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        password: string;
        email: string;
        firstName: string;
        confirmPassword: string;
        phone?: string | undefined;
        lastName?: string | undefined;
        organizationName?: string | undefined;
    };
}, {
    body: {
        password: string;
        email: string;
        firstName: string;
        confirmPassword: string;
        phone?: string | undefined;
        lastName?: string | undefined;
        organizationName?: string | undefined;
    };
}>;
export declare const loginSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        password: string;
        email: string;
    }, {
        password: string;
        email: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        password: string;
        email: string;
    };
}, {
    body: {
        password: string;
        email: string;
    };
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
    }, {
        email: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
    };
}, {
    body: {
        email: string;
    };
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    body: z.ZodEffects<z.ZodObject<{
        token: z.ZodString;
        password: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        confirmPassword: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        password: string;
        token: string;
        confirmPassword: string;
    }, {
        password: string;
        token: string;
        confirmPassword: string;
    }>, {
        password: string;
        token: string;
        confirmPassword: string;
    }, {
        password: string;
        token: string;
        confirmPassword: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        password: string;
        token: string;
        confirmPassword: string;
    };
}, {
    body: {
        password: string;
        token: string;
        confirmPassword: string;
    };
}>;
export declare const verifyEmailSchema: z.ZodObject<{
    body: z.ZodObject<{
        token: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        token: string;
    }, {
        token: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        token: string;
    };
}, {
    body: {
        token: string;
    };
}>;
export declare const verifyOTPSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        otp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        otp: string;
        email: string;
    }, {
        otp: string;
        email: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        otp: string;
        email: string;
    };
}, {
    body: {
        otp: string;
        email: string;
    };
}>;
export declare const resendOTPSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
    }, {
        email: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
    };
}, {
    body: {
        email: string;
    };
}>;
export declare const refreshTokenSchema: z.ZodObject<{
    body: z.ZodOptional<z.ZodObject<{
        refreshToken: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        refreshToken?: string | undefined;
    }, {
        refreshToken?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    body?: {
        refreshToken?: string | undefined;
    } | undefined;
}, {
    body?: {
        refreshToken?: string | undefined;
    } | undefined;
}>;
export declare const googleAuthSchema: z.ZodObject<{
    body: z.ZodObject<{
        credential: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        credential: string;
    }, {
        credential: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        credential: string;
    };
}, {
    body: {
        credential: string;
    };
}>;
export declare const changePasswordSchema: z.ZodObject<{
    body: z.ZodEffects<z.ZodEffects<z.ZodObject<{
        currentPassword: z.ZodString;
        newPassword: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        confirmPassword: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    }, {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    }>, {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    }, {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    }>, {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    }, {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    };
}, {
    body: {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    };
}>;
export declare const resendVerificationSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
    }, {
        email: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
    };
}, {
    body: {
        email: string;
    };
}>;
export declare const rateLimitConfigs: {
    register: {
        windowMs: number;
        max: number;
        message: string;
    };
    login: {
        windowMs: number;
        max: number;
        message: string;
    };
    forgotPassword: {
        windowMs: number;
        max: number;
        message: string;
    };
    sendOTP: {
        windowMs: number;
        max: number;
        message: string;
    };
    verifyOTP: {
        windowMs: number;
        max: number;
        message: string;
    };
    resendVerification: {
        windowMs: number;
        max: number;
        message: string;
    };
};
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
//# sourceMappingURL=auth.schema.d.ts.map