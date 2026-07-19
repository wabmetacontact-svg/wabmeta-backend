export declare const hashPassword: (password: string) => Promise<string>;
export declare const comparePassword: (password: string, hash: string) => Promise<boolean>;
/**
 * ✅ NEW: Timing-safe dummy compare for non-existent users
 * Prevents user enumeration attacks
 */
export declare const dummyComparePassword: (password: string) => Promise<false>;
export declare const needsRehash: (hash: string) => boolean;
//# sourceMappingURL=password.d.ts.map