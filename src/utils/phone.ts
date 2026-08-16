// src/utils/phone.ts - COMPLETE FIX
// ✅ TRUE INTERNATIONAL SUPPORT

export const digitsOnly = (p: string): string =>
  String(p || '').replace(/\D/g, '');

// ============================================
// COUNTRY CODE DATABASE
// ============================================

// Sorted by length DESC (longer match first = more accurate)
const KNOWN_COUNTRY_CODES = [
  // 3-digit codes
  '355', '213', '376', '244', '374', '297', '994', '973', '880',
  '375', '501', '229', '975', '591', '387', '267', '246', '673',
  '359', '226', '257', '855', '237', '238', '236', '235', '56',
  '86', '57', '269', '243', '242', '682', '506', '385', '53',
  '357', '420', '253', '593', '503', '240', '291', '372', '251',
  '679', '358', '241', '220', '995', '233', '502', '224', '245',
  '592', '509', '504', '852', '354', '353', '972', '39', '225',
  '876', '962', '7', '254', '686', '850', '82', '965', '996',
  '856', '371', '961', '266', '231', '218', '423', '370', '352',
  '853', '389', '261', '265', '60', '960', '223', '356', '692',
  '222', '230', '52', '691', '373', '976', '212', '258', '95',
  '264', '674', '977', '31', '687', '64', '505', '227', '234',
  '683', '47', '968', '92', '680', '970', '507', '675', '595',
  '51', '63', '48', '351', '974', '40', '7', '250', '290',
  '685', '378', '239', '966', '221', '381', '248', '232', '65',
  '421', '386', '677', '252', '27', '34', '94', '249', '597',
  '268', '46', '41', '963', '886', '992', '255', '66', '670',
  '228', '690', '676', '216', '993', '688', '256', '380', '971',
  '44', '1', '598', '998', '678', '379', '58', '84', '967',
  '260', '263',
  // 2-digit codes  
  '93', '91', '90', '86', '84', '82', '81', '66', '65', '64',
  '63', '62', '61', '60', '55', '54', '52', '51', '49', '48',
  '47', '46', '45', '44', '43', '41', '40', '39', '36', '34',
  '33', '32', '31', '30', '27', '20',
  // 1-digit codes
  '1', '7',
].sort((a, b) => b.length - a.length); // Longer first!

/**
 * ✅ Extract country code from digit string (without +)
 * Returns { countryCode: "91", national: "9876543210" }
 */
export const extractCountryCodeFromDigits = (
  digits: string
): { countryCode: string; national: string } | null => {
  for (const cc of KNOWN_COUNTRY_CODES) {
    if (digits.startsWith(cc)) {
      const national = digits.slice(cc.length);
      // National number must be 4-12 digits
      if (national.length >= 4 && national.length <= 12) {
        return { countryCode: cc, national };
      }
    }
  }
  return null;
};

/**
 * ✅ CANONICAL FORMAT: E.164 with + prefix
 * e.g. "+919876543210", "+16505551234", "+447911123456"
 *
 * Accepts (Indian):
 *  "9876543210"      → "+919876543210"
 *  "+919876543210"   → "+919876543210"
 *  "919876543210"    → "+919876543210"
 *  "09876543210"     → "+919876543210"
 *  "9191XXXXXXXXXX"  → "+91XXXXXXXXXX"
 *
 * Accepts (International):
 *  "+14155551234"    → "+14155551234"
 *  "+447911123456"   → "+447911123456"
 *  "+971501234567"   → "+971501234567"
 */
export const toCanonicalPhone = (input?: string): string | null => {
  if (!input) return null;

  // Step 1: Clean - remove spaces, dashes, brackets, dots
  const cleaned = String(input)
    .replace(/[\s\-\(\)\.]/g, '')
    .trim();

  if (!cleaned) return null;

  const digits = digitsOnly(cleaned);
  if (!digits || digits.length < 7) return null;

  // ─── HAS + PREFIX ──────────────────────────────────────────
  if (cleaned.startsWith('+')) {
    // Total length: 8-16 chars (+ + 7-15 digits)
    if (digits.length < 7 || digits.length > 15) return null;

    // ✅ Indian special: double-91 fix
    if (digits.startsWith('9191') && digits.length === 14) {
      const national = digits.slice(4);
      if (/^[6-9]\d{9}$/.test(national)) {
        return `+91${national}`;
      }
    }

    // ✅ Indian validation
    if (digits.startsWith('91') && digits.length === 12) {
      const national = digits.slice(2);
      if (!/^[6-9]\d{9}$/.test(national)) return null; // Invalid Indian
      return `+${digits}`;
    }

    // ✅ All other international - trust the + prefix
    return `+${digits}`;
  }

  // ─── NO + PREFIX - DETECT ──────────────────────────────────

  // Indian 10-digit (6-9 start)
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }

  // Indian 0-prefix: 09876543210 (11 digits)
  if (digits.length === 11 && digits.startsWith('0')) {
    const national = digits.slice(1);
    if (/^[6-9]\d{9}$/.test(national)) {
      return `+91${national}`;
    }
  }

  // Indian 91 prefix: 919876543210 (12 digits)
  if (digits.length === 12 && digits.startsWith('91')) {
    const national = digits.slice(2);
    if (/^[6-9]\d{9}$/.test(national)) {
      return `+91${national}`;
    }
  }

  // Indian 091 prefix: 0919876543210 (13 digits)
  if (digits.length === 13 && digits.startsWith('091')) {
    const national = digits.slice(3);
    if (/^[6-9]\d{9}$/.test(national)) {
      return `+91${national}`;
    }
  }

  // Indian double-91: 9191XXXXXXXXXX (14 digits)
  if (digits.length === 14 && digits.startsWith('9191')) {
    const national = digits.slice(4);
    if (/^[6-9]\d{9}$/.test(national)) {
      return `+91${national}`;
    }
  }

  // ✅ International without +: try known country codes
  // Only for 10-15 digit numbers
  if (digits.length >= 10 && digits.length <= 15) {
    const extracted = extractCountryCodeFromDigits(digits);
    if (extracted) {
      return `+${digits}`;
    }
    // ❌ Unknown country code - REJECT (don't blindly add +)
    // Exception: exactly 10 digits might be US/Canada
    if (digits.length === 10 && /^[2-9]\d{9}$/.test(digits)) {
      return `+1${digits}`; // US/Canada assumption
    }
    return null;
  }

  return null;
};

/**
 * ✅ Extract country code from canonical E.164 number
 * "+919876543210" → "+91"
 * "+14155551234"  → "+1"
 * "+447911123456" → "+44"
 */
export const extractCountryCode = (canonical: string): string => {
  if (!canonical || !canonical.startsWith('+')) return '+91';

  const digits = canonical.slice(1); // Remove +
  const result = extractCountryCodeFromDigits(digits);

  return result ? `+${result.countryCode}` : '+91';
};

/**
 * ✅ Build ALL possible variants for DB duplicate lookup
 */
export const buildPhoneVariants = (input?: string): string[] => {
  if (!input) return [];

  const canonical = toCanonicalPhone(input);
  if (!canonical) return [];

  const digits = digitsOnly(canonical);
  const national = digits.slice(-10);

  const variants = new Set<string>([
    canonical,           // +919876543210
    digits,              // 919876543210
    national,            // 9876543210
    `+${digits}`,        // +919876543210
  ]);

  // Indian specific variants
  if (digits.startsWith('91') && digits.length === 12) {
    variants.add(`91${national}`);
    variants.add(`+91${national}`);
    variants.add(`9191${national}`); // Legacy double-cc
    variants.add(`0${national}`);    // 0-prefix
  }

  return Array.from(variants).filter(Boolean);
};

export const buildINPhoneVariants = buildPhoneVariants; // backward compat

/**
 * ✅ Display format
 */
export const formatFullPhone = (
  countryCode?: string,
  phone?: string
): string => {
  const phoneStr = String(phone || '').trim();
  if (!phoneStr) return '';

  if (phoneStr.startsWith('+')) return phoneStr;

  const cc = String(countryCode || '+91').trim();
  const digits = digitsOnly(phoneStr);
  const ccDigits = digitsOnly(cc);

  if (ccDigits && digits.startsWith(ccDigits) && digits.length > 10) {
    return `+${digits}`;
  }

  return `${cc.startsWith('+') ? cc : '+' + cc}${digits}`;
};

/**
 * ✅ WhatsApp API recipient (digits only, no +)
 */
export const toWhatsAppRecipient = (phoneOrCanonical: string): string | null => {
  const canonical = toCanonicalPhone(phoneOrCanonical);
  if (!canonical) return null;
  return digitsOnly(canonical);
};

// Backward compat
export const toWhatsAppRecipientIN = (
  countryCode?: string,
  phone?: string
): string | null => {
  const combined = phone
    ? phone.startsWith('+')
      ? phone
      : `${countryCode || '+91'}${phone}`
    : null;
  if (!combined) return null;
  return toWhatsAppRecipient(combined);
};

export const normalizeINNational10 = (input?: string): string | null => {
  const canonical = toCanonicalPhone(input);
  if (!canonical) return null;
  const d = digitsOnly(canonical);
  return d.length >= 10 ? d.slice(-10) : null;
};