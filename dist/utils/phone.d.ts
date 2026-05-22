export declare const digitsOnly: (p: string) => string;
/**
 * ✅ CANONICAL FORMAT: +91XXXXXXXXXX (E.164 with + prefix)
 * Yahi ek format DB mein store hoga - koi exception nahi
 *
 * Accepts:
 *  - "9876543210"       → "+919876543210"
 *  - "+919876543210"    → "+919876543210"
 *  - "919876543210"     → "+919876543210"
 *  - "+91 98765 43210"  → "+919876543210"
 *  - "09876543210"      → "+919876543210"
 *  - "+1 650 555 1234"  → "+16505551234"
 */
export declare const toCanonicalPhone: (input?: string) => string | null;
/**
 * ✅ BACKWARD COMPAT - purane code ke liye
 * @deprecated Use toCanonicalPhone instead
 */
export declare const normalizeINNational10: (input?: string) => string | null;
/**
 * ✅ Build ALL possible variants of a phone number for DB lookup
 * Yeh use hoga duplicate check ke liye - saare purane formats cover karta hai
 */
export declare const buildPhoneVariants: (input?: string) => string[];
/**
 * ✅ BACKWARD COMPAT - purane code ke liye
 * @deprecated Use buildPhoneVariants instead
 */
export declare const buildINPhoneVariants: (input?: string) => string[];
/**
 * ✅ Display format: +91 98765 43210
 */
export declare const formatFullPhone: (countryCode?: string, phone?: string) => string;
/**
 * ✅ WhatsApp API ke liye recipient number
 * Returns digits only without + (e.g., "919876543210")
 */
export declare const toWhatsAppRecipient: (phoneOrCanonical: string) => string | null;
/**
 * ✅ BACKWARD COMPAT
 * @deprecated Use toWhatsAppRecipient instead
 */
export declare const toWhatsAppRecipientIN: (countryCode?: string, phone?: string) => string | null;
//# sourceMappingURL=phone.d.ts.map