// src/utils/phoneInternational.ts
// ✅ Sirf COUNTRY_CODES list rakho, parsePhoneNumber phone.ts se use karo

import { toCanonicalPhone, digitsOnly } from './phone';

// Keep the old list or a simplified one
export const COUNTRY_CODES = [
  { code: '+1', name: 'USA/Canada' },
  { code: '+44', name: 'UK' },
  { code: '+91', name: 'India' },
  { code: '+61', name: 'Australia' },
  { code: '+971', name: 'UAE' },
  // ... any other codes needed by frontend/backend if imported directly
];

export interface ParsedPhone {
  isValid: boolean;
  fullNumber: string;   // +919876543210
  countryCode: string;  // +91
  nationalNumber: string; // 9876543210
  error?: string;
}

/**
 * ✅ FIXED - phone.ts ka toCanonicalPhone use karta hai
 * Consistent format guaranteed
 */
export function parsePhoneNumber(input: string): ParsedPhone {
  if (!input || !String(input).trim()) {
    return { 
      isValid: false, fullNumber: '', 
      countryCode: '', nationalNumber: '', 
      error: 'Empty number' 
    };
  }

  const canonical = toCanonicalPhone(input);
  
  if (!canonical) {
    return {
      isValid: false,
      fullNumber: String(input).trim(),
      countryCode: '',
      nationalNumber: String(input).trim(),
      error: 'Invalid phone number. Include country code (e.g., +91XXXXXXXXXX)'
    };
  }

  const digits = digitsOnly(canonical); // "919876543210"
  
  // Detect country code from canonical
  const allCodes = [
    '+1', '+7', '+20', '+27', '+30', '+31', '+32', '+33', '+34',
    '+36', '+39', '+40', '+41', '+43', '+44', '+45', '+46', '+47',
    '+48', '+49', '+51', '+52', '+53', '+54', '+55', '+56', '+57',
    '+58', '+60', '+61', '+62', '+63', '+64', '+65', '+66', '+81',
    '+82', '+84', '+86', '+90', '+91', '+92', '+93', '+94', '+95',
    '+98', '+212', '+213', '+216', '+218', '+234', '+254', '+880',
    '+852', '+966', '+971', '+977', '+998',
  ].sort((a, b) => b.length - a.length); // Longer first

  let countryCode = '';
  let nationalNumber = '';

  for (const code of allCodes) {
    if (canonical.startsWith(code)) {
      countryCode = code;
      nationalNumber = canonical.substring(code.length);
      break;
    }
  }

  // Fallback
  if (!countryCode) {
    // Assume last 10 are national
    countryCode = '+' + digits.slice(0, digits.length - 10);
    nationalNumber = digits.slice(-10);
  }

  // ✅ Indian number extra validation
  if (countryCode === '+91') {
    if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
      return {
        isValid: false,
        fullNumber: canonical,
        countryCode,
        nationalNumber,
        error: 'Invalid Indian mobile number (must start with 6-9)'
      };
    }
  }

  return {
    isValid: true,
    fullNumber: canonical, // Always E.164: +919876543210
    countryCode,
    nationalNumber
  };
}

export function parseMultiplePhones(input: string): {
  valid: Array<{ fullNumber: string; countryCode: string; nationalNumber: string }>;
  invalid: Array<{ input: string; error: string }>;
} {
  // Clean separators
  let preprocessed = input
    .replace(/[ \t]*[\-\(\)\.@][ \t]*/g, '')
    .replace(/(\d)[ \t]+(\d)/g, '$1$2')
    .replace(/(\+)[ \t]+(\d)/g, '$1$2');

  const numbers = preprocessed
    .split(/[\n,;\s]+/)
    .map(n => n.trim())
    .filter(n => n.length >= 7);

  const valid: Array<{ fullNumber: string; countryCode: string; nationalNumber: string }> = [];
  const invalid: Array<{ input: string; error: string }> = [];
  const seen = new Set<string>();

  for (const num of numbers) {
    const parsed = parsePhoneNumber(num);
    if (parsed.isValid && !seen.has(parsed.fullNumber)) {
      seen.add(parsed.fullNumber);
      valid.push({
        fullNumber: parsed.fullNumber,
        countryCode: parsed.countryCode,
        nationalNumber: parsed.nationalNumber
      });
    } else if (!parsed.isValid) {
      invalid.push({ input: num, error: parsed.error || 'Invalid' });
    }
  }

  return { valid, invalid };
}
