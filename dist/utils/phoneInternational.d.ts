export declare const COUNTRY_CODES: {
    code: string;
    country: string;
    flag: string;
    maxLength: number;
}[];
export interface ParsedPhone {
    isValid: boolean;
    fullNumber: string;
    countryCode: string;
    nationalNumber: string;
    error?: string;
}
/**
 * Parse and validate international phone number
 */
export declare function parsePhoneNumber(input: string): {
    isValid: boolean;
    fullNumber: string;
    countryCode: string;
    nationalNumber: string;
    error?: string;
};
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