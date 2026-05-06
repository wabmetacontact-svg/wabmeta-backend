// ✅ INTERNATIONAL COUNTRY CODES
export const COUNTRY_CODES = [
    { code: '+91', country: 'India', flag: '🇮🇳', maxLength: 10 },
    { code: '+1', country: 'USA/Canada', flag: '🇺🇸', maxLength: 10 },
    { code: '+44', country: 'United Kingdom', flag: '🇬🇧', maxLength: 10 },
    { code: '+971', country: 'UAE', flag: '🇦🇪', maxLength: 9 },
    { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', maxLength: 9 },
    { code: '+65', country: 'Singapore', flag: '🇸🇬', maxLength: 8 },
    { code: '+60', country: 'Malaysia', flag: '🇲🇾', maxLength: 10 },
    { code: '+61', country: 'Australia', flag: '🇦🇺', maxLength: 9 },
    { code: '+49', country: 'Germany', flag: '🇩🇪', maxLength: 11 },
    { code: '+33', country: 'France', flag: '🇫🇷', maxLength: 9 },
    { code: '+39', country: 'Italy', flag: '🇮🇹', maxLength: 10 },
    { code: '+34', country: 'Spain', flag: '🇪🇸', maxLength: 9 },
    { code: '+81', country: 'Japan', flag: '🇯🇵', maxLength: 10 },
    { code: '+82', country: 'South Korea', flag: '🇰🇷', maxLength: 10 },
    { code: '+86', country: 'China', flag: '🇨🇳', maxLength: 11 },
    { code: '+852', country: 'Hong Kong', flag: '🇭🇰', maxLength: 8 },
    { code: '+63', country: 'Philippines', flag: '🇵🇭', maxLength: 10 },
    { code: '+62', country: 'Indonesia', flag: '🇮🇩', maxLength: 11 },
    { code: '+66', country: 'Thailand', flag: '🇹🇭', maxLength: 9 },
    { code: '+84', country: 'Vietnam', flag: '🇻🇳', maxLength: 10 },
    { code: '+27', country: 'South Africa', flag: '🇿🇦', maxLength: 9 },
    { code: '+234', country: 'Nigeria', flag: '🇳🇬', maxLength: 10 },
    { code: '+254', country: 'Kenya', flag: '🇰🇪', maxLength: 9 },
    { code: '+55', country: 'Brazil', flag: '🇧🇷', maxLength: 11 },
    { code: '+52', country: 'Mexico', flag: '🇲🇽', maxLength: 10 },
    { code: '+7', country: 'Russia', flag: '🇷🇺', maxLength: 10 },
    { code: '+90', country: 'Turkey', flag: '🇹🇷', maxLength: 10 },
    { code: '+20', country: 'Egypt', flag: '🇪🇬', maxLength: 10 },
    { code: '+92', country: 'Pakistan', flag: '🇵🇰', maxLength: 10 },
    { code: '+880', country: 'Bangladesh', flag: '🇧🇩', maxLength: 10 },
    { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', maxLength: 9 },
    { code: '+977', country: 'Nepal', flag: '🇳🇵', maxLength: 10 },
];

export interface ParsedPhone {
    isValid: boolean;
    fullNumber: string;      // +919876543210
    countryCode: string;     // +91
    nationalNumber: string;  // 9876543210
    error?: string;
}

/**
 * Parse and validate international phone number
 */
// ✅ Auto-detect country code from phone number
export function parsePhoneNumber(input: string): {
    isValid: boolean;
    fullNumber: string;
    countryCode: string;
    nationalNumber: string;
    error?: string;
} {
    // Clean input
    let cleaned = String(input || '').replace(/[\s\-\(\)\.]/g, '').trim();

    if (!cleaned) {
        return { isValid: false, fullNumber: '', countryCode: '', nationalNumber: '', error: 'Empty number' };
    }

    // ✅ Must start with + for international
    if (!cleaned.startsWith('+')) {
        // Try adding + if it looks like international
        if (cleaned.length >= 10 && /^\d+$/.test(cleaned)) {
            cleaned = '+' + cleaned;
        } else {
            return {
                isValid: false,
                fullNumber: cleaned,
                countryCode: '',
                nationalNumber: cleaned,
                error: 'Missing country code (e.g., +91, +1)'
            };
        }
    }

    // ✅ Validate format: + followed by 10-15 digits
    const digitsOnly = cleaned.replace('+', '');

    if (!/^\d{10,15}$/.test(digitsOnly)) {
        return {
            isValid: false,
            fullNumber: cleaned,
            countryCode: '',
            nationalNumber: digitsOnly,
            error: 'Invalid phone number length (10-15 digits required)'
        };
    }

    // ✅ Extract country code (assume first 1-4 digits)
    // Common patterns: +1 (US), +91 (India), +44 (UK), +971 (UAE)
    let countryCode = '';
    let nationalNumber = '';

    // Check common country codes
    const commonCodes = ['+1', '+7', '+20', '+27', '+30', '+31', '+32', '+33', '+34', '+36', '+39', '+40', '+41', '+43', '+44', '+45', '+46', '+47', '+48', '+49', '+51', '+52', '+53', '+54', '+55', '+56', '+57', '+58', '+60', '+61', '+62', '+63', '+64', '+65', '+66', '+81', '+82', '+84', '+86', '+90', '+91', '+92', '+93', '+94', '+95', '+98', '+212', '+213', '+216', '+218', '+220', '+221', '+222', '+223', '+224', '+225', '+226', '+227', '+228', '+229', '+230', '+231', '+232', '+233', '+234', '+235', '+236', '+237', '+238', '+239', '+240', '+241', '+242', '+243', '+244', '+245', '+246', '+247', '+248', '+249', '+250', '+251', '+252', '+253', '+254', '+255', '+256', '+257', '+258', '+260', '+261', '+262', '+263', '+264', '+265', '+266', '+267', '+268', '+269', '+290', '+291', '+297', '+298', '+299', '+350', '+351', '+352', '+353', '+354', '+355', '+356', '+357', '+358', '+359', '+370', '+371', '+372', '+373', '+374', '+375', '+376', '+377', '+378', '+380', '+381', '+382', '+383', '+385', '+386', '+387', '+389', '+420', '+421', '+423', '+500', '+501', '+502', '+503', '+504', '+505', '+506', '+507', '+508', '+509', '+590', '+591', '+592', '+593', '+594', '+595', '+596', '+597', '+598', '+599', '+670', '+672', '+673', '+674', '+675', '+676', '+677', '+678', '+679', '+680', '+681', '+682', '+683', '+685', '+686', '+687', '+688', '+689', '+690', '+691', '+692', '+850', '+852', '+853', '+855', '+856', '+880', '+886', '+960', '+961', '+962', '+963', '+964', '+965', '+966', '+967', '+968', '+970', '+971', '+972', '+973', '+974', '+975', '+976', '+977', '+992', '+993', '+994', '+995', '+996', '+998'];

    // Sort by length (longer first) to match +971 before +97
    const sortedCodes = commonCodes.sort((a, b) => b.length - a.length);

    for (const code of sortedCodes) {
        if (cleaned.startsWith(code)) {
            countryCode = code;
            nationalNumber = cleaned.substring(code.length);
            break;
        }
    }

    // Fallback: assume first 2-3 digits are country code
    if (!countryCode) {
        if (digitsOnly.length >= 11) {
            countryCode = '+' + digitsOnly.substring(0, digitsOnly.length - 10);
            nationalNumber = digitsOnly.substring(digitsOnly.length - 10);
        } else {
            countryCode = '+' + digitsOnly.substring(0, 2);
            nationalNumber = digitsOnly.substring(2);
        }
    }

    return {
        isValid: true,
        fullNumber: cleaned,
        countryCode,
        nationalNumber
    };
}

// ✅ Parse multiple phone numbers
export function parseMultiplePhones(input: string): {
    valid: Array<{ fullNumber: string; countryCode: string; nationalNumber: string }>;
    invalid: Array<{ input: string; error: string }>;
} {
    // Replace common separators with newlines to standardize parsing
    // But be careful not to split inside a valid phone number.
    
    // 1. Remove all spaces, dashes, parens, dots that are part of a phone number
    // We can do this by finding all phone-like sequences and cleaning them.
    // A phone like sequence starts with + (optional), followed by digits and separators.
    
    // Instead of complex splitting, let's just split by newlines, commas, and semicolons.
    // If users separate numbers by spaces on the same line, that's ambiguous.
    // But we can try to handle it. First, remove spaces immediately following a '+' and digits.
    let preprocessed = input.replace(/\s*[\-\(\)\.]\s*/g, ''); // Remove -, (, ), . and surrounding spaces
    
    // Remove spaces between digits
    preprocessed = preprocessed.replace(/(\d)\s+(\d)/g, '$1$2');
    preprocessed = preprocessed.replace(/(\+)\s+(\d)/g, '$1$2');

    const numbers = preprocessed
        .split(/[\n,;\s]+/) // Now it's safe to split by any remaining whitespace
        .map(n => n.trim())
        .filter(n => n.length > 0);

    const valid: Array<{ fullNumber: string; countryCode: string; nationalNumber: string }> = [];
    const invalid: Array<{ input: string; error: string }> = [];

    for (const num of numbers) {
        const parsed = parsePhoneNumber(num);

        if (parsed.isValid) {
            valid.push({
                fullNumber: parsed.fullNumber,
                countryCode: parsed.countryCode,
                nationalNumber: parsed.nationalNumber
            });
        } else {
            invalid.push({ input: num, error: parsed.error || 'Invalid' });
        }
    }

    return { valid, invalid };
}
