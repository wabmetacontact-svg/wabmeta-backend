import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

// Bulk paste access per plan.
//
// The source of truth is the plan row's `includedFeatures.bulkPaste`, which
// set-billing-plans.ts writes. This table is only the fallback for rows that
// predate that column - and for the retired term plans, which never had it.
//
// Without the new tiers listed here, an unseeded PRO organisation would fall
// through to FREE_DEMO and be denied a feature it paid for.
const PLAN_FEATURES: Record<string, { simpleBulkPaste: boolean; csvUpload: boolean }> = {
    FREE_DEMO: { simpleBulkPaste: true, csvUpload: true },
    STARTER: { simpleBulkPaste: false, csvUpload: true },
    GROWTH: { simpleBulkPaste: true, csvUpload: true },
    PRO: { simpleBulkPaste: true, csvUpload: true },
    BUSINESS: { simpleBulkPaste: true, csvUpload: true },

    // Retired duration plans - still live for existing subscriptions.
    MONTHLY: { simpleBulkPaste: false, csvUpload: true },
    QUARTERLY: { simpleBulkPaste: true, csvUpload: true },
    BIANNUAL: { simpleBulkPaste: true, csvUpload: true },
    ANNUAL: { simpleBulkPaste: true, csvUpload: true },
};

/** The plan the customer should move to for bulk paste. */
const BULK_PASTE_PLAN = 'Growth';

export interface FeatureAccess {
    simpleBulkPaste: boolean;
    csvUpload: boolean;
    currentPlan: string;
    upgradeRequired: boolean;
    upgradeMessage?: string;
}

/**
 * What this organisation's plan allows.
 *
 * An explicit `includedFeatures.bulkPaste` on the plan row wins; anything the
 * plan does not state falls back to the table above, and an unknown plan type
 * falls back to the trial's access rather than to nothing.
 */
const resolvePlanFeatures = (org: any): { simpleBulkPaste: boolean; csvUpload: boolean } => {
    const fallback = PLAN_FEATURES[String(org.planType)] || PLAN_FEATURES.FREE_DEMO;
    const flags = org?.subscription?.plan?.includedFeatures;

    if (!flags || typeof flags !== 'object') return fallback;

    return {
        simpleBulkPaste:
            typeof flags.bulkPaste === 'boolean' ? flags.bulkPaste : fallback.simpleBulkPaste,
        csvUpload:
            typeof flags.csvUpload === 'boolean' ? flags.csvUpload : fallback.csvUpload,
    };
};

export class ContactFeaturesService {

    /**
     * Get feature access for organization
     */
    async getFeatureAccess(organizationId: string): Promise<FeatureAccess> {
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                planType: true,
                featureSimpleBulkUpload: true,
                featureCsvUpload: true,
                featureOverrideByAdmin: true,
                subscription: {
                    select: { plan: { select: { includedFeatures: true } } }
                }
            }
        });

        if (!organization) {
            throw new AppError('Organization not found', 404);
        }

        const planType = String(organization.planType);
        const planFeatures = resolvePlanFeatures(organization);

        // ✅ Check Admin Override
        if ((organization as any).featureOverrideByAdmin) {
            return {
                simpleBulkPaste: (organization as any).featureSimpleBulkUpload ?? false,
                csvUpload: (organization as any).featureCsvUpload ?? false,
                currentPlan: planType,
                upgradeRequired: false
            };
        }

        // ✅ Return plan-based access
        const needsUpgrade = !planFeatures.simpleBulkPaste && !planFeatures.csvUpload;

        return {
            simpleBulkPaste: planFeatures.simpleBulkPaste,
            csvUpload: planFeatures.csvUpload,
            currentPlan: planType,
            upgradeRequired: needsUpgrade,
            upgradeMessage: planFeatures.simpleBulkPaste
                ? undefined
                : `Bulk paste is included from the ${BULK_PASTE_PLAN} plan onwards.`
        };
    }

    /**
     * Validate access before operation
     */
    async validateAccess(
        organizationId: string,
        feature: 'simpleBulkPaste' | 'csvUpload'
    ): Promise<void> {
        const access = await this.getFeatureAccess(organizationId);

        if (feature === 'simpleBulkPaste' && !access.simpleBulkPaste) {
            throw new AppError(
                `Bulk paste is included from the ${BULK_PASTE_PLAN} plan onwards. Your current plan: ${access.currentPlan}`,
                403
            );
        }

        if (feature === 'csvUpload' && !access.csvUpload) {
            throw new AppError(
                'CSV Upload is not available for your current plan: ' + access.currentPlan,
                403
            );
        }
    }

    /**
     * Admin: Update feature access
     */
    async adminUpdateFeatures(
        organizationId: string,
        features: {
            simpleBulkUpload?: boolean;
            csvUpload?: boolean;
            overrideByAdmin?: boolean;
        }
    ) {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId }
        });

        if (!org) {
            throw new AppError('Organization not found', 404);
        }

        const updated = await prisma.organization.update({
            where: { id: organizationId },
            data: {
                featureSimpleBulkUpload: features.simpleBulkUpload,
                featureCsvUpload: features.csvUpload,
                featureOverrideByAdmin: features.overrideByAdmin ?? true
            } as any
        });

        return {
            organizationId,
            organizationName: org.name,
            features: {
                simpleBulkUpload: (updated as any).featureSimpleBulkUpload,
                csvUpload: (updated as any).featureCsvUpload,
                overrideByAdmin: (updated as any).featureOverrideByAdmin
            }
        };
    }
}

export const contactFeaturesService = new ContactFeaturesService();
