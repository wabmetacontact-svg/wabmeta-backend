export declare const TEMPLATE_RATES: Record<string, number>;
export declare function getRateForCategory(category: string): number;
export declare function deductWalletForTemplate(params: {
    organizationId: string;
    templateName: string;
    templateCategory?: string;
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
    totalRecipients: number;
    campaignId: string;
}): Promise<{
    canProceed: boolean;
    estimatedCost: number;
    availableBalance: number;
    shortfall: number;
    walletActive: boolean;
}>;
//# sourceMappingURL=wallet.deduction.service.d.ts.map