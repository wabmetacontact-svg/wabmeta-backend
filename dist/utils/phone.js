"use strict";
// src/utils/phone.ts - COMPLETE REWRITE
// ✅ SINGLE SOURCE OF TRUTH - Har jagah se yahi use hoga
Object.defineProperty(exports, "__esModule", { value: true });
exports.toWhatsAppRecipientIN = exports.toWhatsAppRecipient = exports.formatFullPhone = exports.buildINPhoneVariants = exports.buildPhoneVariants = exports.normalizeINNational10 = exports.toCanonicalPhone = exports.digitsOnly = void 0;
const digitsOnly = (p) => String(p || '').replace(/\D/g, '');
exports.digitsOnly = digitsOnly;
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
const toCanonicalPhone = (input) => {
    if (!input)
        return null;
    // Remove spaces, dashes, brackets, dots
    const cleaned = String(input).replace(/[\s\-\(\)\.]/g, '').trim();
    if (!cleaned)
        return null;
    const digits = (0, exports.digitsOnly)(cleaned);
    if (!digits)
        return null;
    // Already has + prefix - validate and return
    if (cleaned.startsWith('+')) {
        // Must be 10-15 digits after +
        if (digits.length >= 10 && digits.length <= 15) {
            // Indian number special handling
            if (digits.startsWith('91') && digits.length === 12) {
                const national = digits.slice(2);
                // Valid Indian mobile: starts with 6-9
                if (/^[6-9]\d{9}$/.test(national)) {
                    return `+${digits}`;
                }
            }
            return `+${digits}`;
        }
        return null;
    }
    // No + prefix - detect country code
    // Indian 10-digit mobile (6-9 start)
    if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
        return `+91${digits}`;
    }
    // Indian with 91 prefix (12 digits)
    if (digits.length === 12 && digits.startsWith('91')) {
        const national = digits.slice(2);
        if (/^[6-9]\d{9}$/.test(national)) {
            return `+${digits}`;
        }
    }
    // Indian with 091 prefix (13 digits)
    if (digits.length === 13 && digits.startsWith('091')) {
        const national = digits.slice(3);
        if (/^[6-9]\d{9}$/.test(national)) {
            return `+91${national}`;
        }
    }
    // Double 91 prefix (e.g., 9191XXXXXXXXXX - 14 digits)
    if (digits.length === 14 && digits.startsWith('9191')) {
        const national = digits.slice(4);
        if (/^[6-9]\d{9}$/.test(national)) {
            return `+91${national}`;
        }
    }
    // Indian 0-prefix (011 digits)
    if (digits.length === 11 && digits.startsWith('0')) {
        const national = digits.slice(1);
        if (/^[6-9]\d{9}$/.test(national)) {
            return `+91${national}`;
        }
    }
    // International number without + (10-15 digits)
    if (digits.length >= 10 && digits.length <= 15) {
        return `+${digits}`;
    }
    return null;
};
exports.toCanonicalPhone = toCanonicalPhone;
/**
 * ✅ BACKWARD COMPAT - purane code ke liye
 * @deprecated Use toCanonicalPhone instead
 */
const normalizeINNational10 = (input) => {
    const canonical = (0, exports.toCanonicalPhone)(input);
    if (!canonical)
        return null;
    const digits = (0, exports.digitsOnly)(canonical);
    // Return last 10 digits
    return digits.length >= 10 ? digits.slice(-10) : null;
};
exports.normalizeINNational10 = normalizeINNational10;
/**
 * ✅ Build ALL possible variants of a phone number for DB lookup
 * Yeh use hoga duplicate check ke liye - saare purane formats cover karta hai
 */
const buildPhoneVariants = (input) => {
    if (!input)
        return [];
    const canonical = (0, exports.toCanonicalPhone)(input);
    if (!canonical)
        return [];
    const digits = (0, exports.digitsOnly)(canonical); // e.g., "919876543210"
    const national = digits.slice(-10); // e.g., "9876543210"
    const variants = new Set([
        canonical, // +919876543210 ✅ NEW FORMAT
        digits, // 919876543210
        national, // 9876543210
        `+${digits}`, // +919876543210 (same as canonical for Indian)
        `91${national}`, // 919876543210
        `+91${national}`, // +919876543210
        `9191${national}`, // 9191... (wrong double-cc legacy)
    ]);
    return Array.from(variants).filter(Boolean);
};
exports.buildPhoneVariants = buildPhoneVariants;
/**
 * ✅ BACKWARD COMPAT - purane code ke liye
 * @deprecated Use buildPhoneVariants instead
 */
exports.buildINPhoneVariants = exports.buildPhoneVariants;
/**
 * ✅ Display format: +91 98765 43210
 */
const formatFullPhone = (countryCode, phone) => {
    // Phone field mein canonical format hai (+919876543210)
    // Ya phir national format (9876543210) with countryCode (+91)
    const phoneStr = String(phone || '').trim();
    if (!phoneStr)
        return '';
    // Already canonical E.164
    if (phoneStr.startsWith('+'))
        return phoneStr;
    const cc = String(countryCode || '+91').trim();
    const digits = (0, exports.digitsOnly)(phoneStr);
    const ccDigits = (0, exports.digitsOnly)(cc);
    // Phone already has country code digits
    if (ccDigits && digits.startsWith(ccDigits) && digits.length > 10) {
        return `+${digits}`;
    }
    return `${cc.startsWith('+') ? cc : '+' + cc}${digits}`;
};
exports.formatFullPhone = formatFullPhone;
/**
 * ✅ WhatsApp API ke liye recipient number
 * Returns digits only without + (e.g., "919876543210")
 */
const toWhatsAppRecipient = (phoneOrCanonical) => {
    const canonical = (0, exports.toCanonicalPhone)(phoneOrCanonical);
    if (!canonical)
        return null;
    return (0, exports.digitsOnly)(canonical); // Remove + for WhatsApp API
};
exports.toWhatsAppRecipient = toWhatsAppRecipient;
/**
 * ✅ BACKWARD COMPAT
 * @deprecated Use toWhatsAppRecipient instead
 */
const toWhatsAppRecipientIN = (countryCode, phone) => {
    const combined = phone
        ? (phone.startsWith('+') ? phone : `${countryCode || '+91'}${phone}`)
        : null;
    if (!combined)
        return null;
    return (0, exports.toWhatsAppRecipient)(combined);
};
exports.toWhatsAppRecipientIN = toWhatsAppRecipientIN;
//# sourceMappingURL=phone.js.map