export interface CountryRate {
    marketing: number;
    utility: number;
    authentication: number;
}
export declare const COUNTRY_RATES: Record<string, CountryRate>;
export declare const DEFAULT_RATE: CountryRate;
export declare const LANGUAGE_TO_PREFIX: Record<string, string>;
export declare function getCountryRateFromPhone(phone: string): CountryRate;
export declare function getRateForCategory(category: string, recipientPhone?: string, language?: string): number;
export declare function deductWalletForTemplate(params: {
    organizationId: string;
    templateName: string;
    templateCategory?: string;
    templateLanguage?: string;
    recipientPhone: string;
    waMessageId?: string;
    campaignId?: string;
    campaignName?: string;
    automationId?: string;
    automationName?: string;
}): Promise<{
    deducted: boolean;
    walletUsed: boolean;
    amount: number;
    reason?: string;
}>;
export declare function deductWalletForCampaign(params: {
    organizationId: string;
    templateName: string;
    templateCategory?: string;
    templateLanguage?: string;
    totalRecipients: number;
    campaignId: string;
    recipientPhones?: string[];
}): Promise<{
    canProceed: boolean;
    estimatedCost: number;
    availableBalance: number;
    shortfall: number;
    walletActive: boolean;
    rateUsed: number;
}>;
/** @deprecated Use getRateForCategory(category, recipientPhone) instead */
export declare const TEMPLATE_RATES: Record<string, number>;
export declare const COUNTRY_NAMES_MAP: Record<string, string>;
//# sourceMappingURL=wallet.deduction.service.d.ts.map