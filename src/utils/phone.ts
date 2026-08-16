// src/utils/phone.ts - FINAL FIXED
// ✅ Strict validation - Unknown country codes REJECT

export const digitsOnly = (p: string): string =>
  String(p || '').replace(/\D/g, '');

// ============================================
// KNOWN COUNTRY CODES DATABASE
// ============================================

const KNOWN_COUNTRY_CODES = [
  // 3-digit codes
  '971', '966', '974', '973', '968', '967', '965', '962', '972',
  '880', '852', '853', '855', '856', '886', '850', '870', '960',
  '977', '992', '993', '994', '995', '996', '998',
  '212', '213', '216', '218', '220', '221', '222', '223', '224',
  '225', '226', '227', '228', '229', '230', '231', '232', '233',
  '234', '235', '236', '237', '238', '239', '240', '241', '242',
  '243', '244', '245', '246', '248', '249', '250', '251', '252',
  '253', '254', '255', '256', '257', '258', '260', '261', '262',
  '263', '264', '265', '266', '267', '268', '269', '290', '291',
  '297', '298', '299',
  '350', '351', '352', '353', '354', '355', '356', '357', '358',
  '359', '370', '371', '372', '373', '374', '375', '376', '377',
  '378', '379', '380', '381', '382', '385', '386', '387', '389',
  '420', '421', '423',
  '500', '501', '502', '503', '504', '505', '506', '507', '508',
  '509', '590', '591', '592', '593', '594', '595', '596', '597',
  '598', '599',
  '670', '672', '673', '674', '675', '676', '677', '678', '679',
  '680', '681', '682', '683', '685', '686', '687', '688', '689',
  '690', '691', '692',
  // 2-digit codes
  '20', '27', '30', '31', '32', '33', '34', '36', '39',
  '40', '41', '43', '44', '45', '46', '47', '48', '49',
  '51', '52', '53', '54', '55', '56', '57', '58',
  '60', '61', '62', '63', '64', '65', '66',
  '81', '82', '84', '86',
  '90', '91', '92', '93', '94', '95', '98',
  // 1-digit codes
  '1', '7',
].sort((a, b) => b.length - a.length); // Longest first

/**
 * ✅ Extract country code from digits (without +)
 */
export const extractCountryCodeFromDigits = (
  digits: string
): { countryCode: string; national: string } | null => {
  for (const cc of KNOWN_COUNTRY_CODES) {
    if (digits.startsWith(cc)) {
      const national = digits.slice(cc.length);
      // National number must be 6-12 digits
      if (national.length >= 6 && national.length <= 12) {
        return { countryCode: cc, national };
      }
    }
  }
  return null;
};

/**
 * ✅ Validate if digits string has known country code
 */
const hasValidCountryCode = (digits: string): boolean => {
  return extractCountryCodeFromDigits(digits) !== null;
};

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
export const toCanonicalPhone = (input?: string): string | null => {
  if (!input) return null;

  // Clean
  const cleaned = String(input)
    .replace(/[\s\-\(\)\.]/g, '')
    .trim();

  if (!cleaned) return null;

  const digits = digitsOnly(cleaned);
  if (!digits || digits.length < 10) return null; // Min 10 digits

  // ─── HAS + PREFIX ──────────────────────────────────
  if (cleaned.startsWith('+')) {
    if (digits.length < 10 || digits.length > 15) return null;

    // Indian double-91 fix (9191XXXXXXXXXX)
    if (digits.startsWith('9191') && digits.length === 14) {
      const national = digits.slice(4);
      if (/^[6-9]\d{9}$/.test(national)) {
        return `+91${national}`;
      }
    }

    // Indian +91 validation
    if (digits.startsWith('91') && digits.length === 12) {
      const national = digits.slice(2);
      if (!/^[6-9]\d{9}$/.test(national)) return null;
      return `+${digits}`;
    }

    // ✅ International with + - MUST have known country code
    if (hasValidCountryCode(digits)) {
      return `+${digits}`;
    }

    return null; // Unknown country code
  }

  // ─── NO + PREFIX ────────────────────────────────────

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
    return null; // 0-prefix but not valid Indian
  }

  // Indian 91 prefix: 919876543210 (12 digits)
  if (digits.length === 12 && digits.startsWith('91')) {
    const national = digits.slice(2);
    if (/^[6-9]\d{9}$/.test(national)) {
      return `+91${national}`;
    }
    return null; // 91 prefix but invalid Indian
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

  // ✅ 11 digits without valid prefix = REJECT
  if (digits.length === 11) {
    return null;
  }

  // ✅ 12-15 digits without + = MUST have known country code
  if (digits.length >= 12 && digits.length <= 15) {
    if (hasValidCountryCode(digits)) {
      return `+${digits}`;
    }
    return null; // Unknown country code
  }

  return null;
};

/**
 * ✅ Extract country code from canonical E.164
 */
export const extractCountryCode = (canonical: string): string => {
  if (!canonical || !canonical.startsWith('+')) return '+91';
  const digits = canonical.slice(1);
  const result = extractCountryCodeFromDigits(digits);
  return result ? `+${result.countryCode}` : '+91';
};

/**
 * ✅ Build all variants for DB duplicate lookup
 */
export const buildPhoneVariants = (input?: string): string[] => {
  if (!input) return [];

  const canonical = toCanonicalPhone(input);
  if (!canonical) return [];

  const digits = digitsOnly(canonical);
  const national = digits.slice(-10);

  const variants = new Set<string>([
    canonical,
    digits,
    national,
    `+${digits}`,
  ]);

  // Indian specific variants
  if (digits.startsWith('91') && digits.length === 12) {
    variants.add(`91${national}`);
    variants.add(`+91${national}`);
    variants.add(`9191${national}`);
    variants.add(`0${national}`);
  }

  return Array.from(variants).filter(Boolean);
};

export const buildINPhoneVariants = buildPhoneVariants;

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