export declare const digitsOnly: (p: string) => string;
/**
 * ✅ Extract country code from digits (without +)
 */
export declare const extractCountryCodeFromDigits: (digits: string) => {
    countryCode: string;
    national: string;
} | null;
/**
 * ✅ CANONICAL FORMAT: E.164 with + prefix
 *
 * Indian formats accepted:
 *  "9876543210"       → "+919876543210"
 *  "+919876543210"    → "+919876543210"
 *  "919876543210"     → "+919876543210"
 *  "09876543210"      → "+919876543210"
 *  "+91 98765 43210"  → "+919876543210"
 *
 * International formats accepted:
 *  "+14155551234"     → "+14155551234"
 *  "+447911123456"    → "+447911123456"
 *  "+971501234567"    → "+971501234567"
 *
 * REJECTED (returns null):
 *  "73940941156"      → null (11 digits, no valid prefix)
 *  "1234567890"       → null (10 digits, not Indian mobile)
 *  "91123456789"      → null (91 prefix but invalid)
 */
export declare const toCanonicalPhone: (input?: string) => string | null;
/**
 * ✅ Extract country code from canonical E.164
 */
export declare const extractCountryCode: (canonical: string) => string;
/**
 * ✅ Build all variants for DB duplicate lookup
 */
export declare const buildPhoneVariants: (input?: string) => string[];
export declare const buildINPhoneVariants: (input?: string) => string[];
/**
 * ✅ Display format
 */
export declare const formatFullPhone: (countryCode?: string, phone?: string) => string;
/**
 * ✅ WhatsApp API recipient (digits only, no +)
 */
export declare const toWhatsAppRecipient: (phoneOrCanonical: string) => string | null;
export declare const toWhatsAppRecipientIN: (countryCode?: string, phone?: string) => string | null;
export declare const normalizeINNational10: (input?: string) => string | null;
//# sourceMappingURL=phone.d.ts.map