/**
 * ✅ Cryptographically secure OTP generation
 */
export declare const generateOTP: (length?: number) => string;
/**
 * ✅ Cryptographically secure token generation
 */
export declare const generateToken: (bytes?: number) => string;
/**
 * ✅ Hash token for DB storage (never store raw tokens)
 */
export declare const hashToken: (token: string) => string;
/**
 * Generate URL-safe slug
 */
export declare const generateSlug: (name: string) => string;
/**
 * ✅ Timing-safe string comparison
 */
export declare const timingSafeEqual: (a: string, b: string) => boolean;
//# sourceMappingURL=otp.d.ts.map