// src/utils/phone.ts - COMPLETE REWRITE
// ✅ SINGLE SOURCE OF TRUTH - Har jagah se yahi use hoga

export const digitsOnly = (p: string): string => 
  String(p || '').replace(/\D/g, '');

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
export const toCanonicalPhone = (input?: string): string | null => {
  if (!input) return null;
  
  // Remove spaces, dashes, brackets, dots
  const cleaned = String(input).replace(/[\s\-\(\)\.]/g, '').trim();
  if (!cleaned) return null;

  const digits = digitsOnly(cleaned);
  if (!digits) return null;

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

/**
 * ✅ BACKWARD COMPAT - purane code ke liye
 * @deprecated Use toCanonicalPhone instead
 */
export const normalizeINNational10 = (input?: string): string | null => {
  const canonical = toCanonicalPhone(input);
  if (!canonical) return null;
  const digits = digitsOnly(canonical);
  // Return last 10 digits
  return digits.length >= 10 ? digits.slice(-10) : null;
};

/**
 * ✅ Build ALL possible variants of a phone number for DB lookup
 * Yeh use hoga duplicate check ke liye - saare purane formats cover karta hai
 */
export const buildPhoneVariants = (input?: string): string[] => {
  if (!input) return [];
  
  const canonical = toCanonicalPhone(input);
  if (!canonical) return [];

  const digits = digitsOnly(canonical); // e.g., "919876543210"
  const national = digits.slice(-10);   // e.g., "9876543210"
  
  const variants = new Set<string>([
    canonical,              // +919876543210 ✅ NEW FORMAT
    digits,                 // 919876543210
    national,               // 9876543210
    `+${digits}`,           // +919876543210 (same as canonical for Indian)
    `91${national}`,        // 919876543210
    `+91${national}`,       // +919876543210
    `9191${national}`,      // 9191... (wrong double-cc legacy)
  ]);

  return Array.from(variants).filter(Boolean);
};

/**
 * ✅ BACKWARD COMPAT - purane code ke liye
 * @deprecated Use buildPhoneVariants instead
 */
export const buildINPhoneVariants = buildPhoneVariants;

/**
 * ✅ Display format: +91 98765 43210
 */
export const formatFullPhone = (countryCode?: string, phone?: string): string => {
  // Phone field mein canonical format hai (+919876543210)
  // Ya phir national format (9876543210) with countryCode (+91)
  
  const phoneStr = String(phone || '').trim();
  if (!phoneStr) return '';
  
  // Already canonical E.164
  if (phoneStr.startsWith('+')) return phoneStr;
  
  const cc = String(countryCode || '+91').trim();
  const digits = digitsOnly(phoneStr);
  const ccDigits = digitsOnly(cc);
  
  // Phone already has country code digits
  if (ccDigits && digits.startsWith(ccDigits) && digits.length > 10) {
    return `+${digits}`;
  }
  
  return `${cc.startsWith('+') ? cc : '+' + cc}${digits}`;
};

/**
 * ✅ WhatsApp API ke liye recipient number
 * Returns digits only without + (e.g., "919876543210")
 */
export const toWhatsAppRecipient = (phoneOrCanonical: string): string | null => {
  const canonical = toCanonicalPhone(phoneOrCanonical);
  if (!canonical) return null;
  return digitsOnly(canonical); // Remove + for WhatsApp API
};

/**
 * ✅ BACKWARD COMPAT
 * @deprecated Use toWhatsAppRecipient instead
 */
export const toWhatsAppRecipientIN = (countryCode?: string, phone?: string): string | null => {
  const combined = phone 
    ? (phone.startsWith('+') ? phone : `${countryCode || '+91'}${phone}`)
    : null;
  if (!combined) return null;
  return toWhatsAppRecipient(combined);
};