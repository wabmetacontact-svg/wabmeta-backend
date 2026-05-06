export interface FeatureAccess {
    simpleBulkPaste: boolean;
    csvUpload: boolean;
    currentPlan: string;
    upgradeRequired: boolean;
    upgradeMessage?: string;
}
export declare class ContactFeaturesService {
    /**
     * Get feature access for organization
     */
    getFeatureAccess(organizationId: string): Promise<FeatureAccess>;
    private getUpgradeMessage;
    /**
     * Validate access before operation
     */
    validateAccess(organizationId: string, feature: 'simpleBulkPaste' | 'csvUpload'): Promise<void>;
    /**
     * Admin: Update feature access
     */
    adminUpdateFeatures(organizationId: string, features: {
        simpleBulkUpload?: boolean;
        csvUpload?: boolean;
        overrideByAdmin?: boolean;
    }): Promise<{
        organizationId: string;
        organizationName: string;
        features: {
            simpleBulkUpload: any;
            csvUpload: any;
            overrideByAdmin: any;
        };
    }>;
}
export declare const contactFeaturesService: ContactFeaturesService;
//# sourceMappingURL=contacts.features.d.ts.map