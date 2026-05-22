export declare const COUNTRY_CODES: {
    code: string;
    name: string;
}[];
export interface ParsedPhone {
    isValid: boolean;
    fullNumber: string;
    countryCode: string;
    nationalNumber: string;
    error?: string;
}
/**
 * ✅ FIXED - phone.ts ka toCanonicalPhone use karta hai
 * Consistent format guaranteed
 */
export declare function parsePhoneNumber(input: string): ParsedPhone;
export declare function parseMultiplePhones(input: string): {
    valid: Array<{
        fullNumber: string;
        countryCode: string;
        nationalNumber: string;
    }>;
    invalid: Array<{
        input: string;
        error: string;
    }>;
};
//# sourceMappingURL=phoneInternational.d.ts.map