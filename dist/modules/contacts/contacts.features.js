"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactFeaturesService = exports.ContactFeaturesService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
// ✅ UPDATED PLAN ACCESS MATRIX
const PLAN_FEATURES = {
    FREE_DEMO: {
        simpleBulkPaste: false,
        csvUpload: true // ✅ Enabled for Demo Users
    },
    MONTHLY: {
        simpleBulkPaste: false, // ❌ Not available
        csvUpload: true // ✅ Available
    },
    QUARTERLY: {
        simpleBulkPaste: true, // ✅ Available
        csvUpload: true // ✅ Available
    },
    BIANNUAL: {
        simpleBulkPaste: true,
        csvUpload: true
    },
    ANNUAL: {
        simpleBulkPaste: true,
        csvUpload: true
    }
};
class ContactFeaturesService {
    /**
     * Get feature access for organization
     */
    async getFeatureAccess(organizationId) {
        const organization = await database_1.default.organization.findUnique({
            where: { id: organizationId },
            select: {
                planType: true,
                featureSimpleBulkUpload: true,
                featureCsvUpload: true,
                featureOverrideByAdmin: true
            }
        });
        if (!organization) {
            throw new errorHandler_1.AppError('Organization not found', 404);
        }
        const planType = organization.planType;
        const planFeatures = PLAN_FEATURES[planType] || PLAN_FEATURES.FREE_DEMO;
        // ✅ Check Admin Override
        if (organization.featureOverrideByAdmin) {
            return {
                simpleBulkPaste: organization.featureSimpleBulkUpload ?? false,
                csvUpload: organization.featureCsvUpload ?? false,
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
            upgradeMessage: this.getUpgradeMessage(planType, planFeatures)
        };
    }
    getUpgradeMessage(plan, features) {
        if (plan === 'FREE_DEMO') {
            return 'Upgrade to Quarterly (₹2,500) to unlock Simple Bulk Paste and other premium features';
        }
        if (plan === 'MONTHLY' && !features.simpleBulkPaste) {
            return 'Upgrade to Quarterly (₹2,500) to unlock Simple Bulk Paste';
        }
        return undefined;
    }
    /**
     * Validate access before operation
     */
    async validateAccess(organizationId, feature) {
        const access = await this.getFeatureAccess(organizationId);
        if (feature === 'simpleBulkPaste' && !access.simpleBulkPaste) {
            throw new errorHandler_1.AppError('Simple Bulk Paste requires Quarterly plan (₹2,500) or higher. Your current plan: ' + access.currentPlan, 403);
        }
        if (feature === 'csvUpload' && !access.csvUpload) {
            throw new errorHandler_1.AppError('CSV Upload is not available for your current plan: ' + access.currentPlan, 403);
        }
    }
    /**
     * Admin: Update feature access
     */
    async adminUpdateFeatures(organizationId, features) {
        const org = await database_1.default.organization.findUnique({
            where: { id: organizationId }
        });
        if (!org) {
            throw new errorHandler_1.AppError('Organization not found', 404);
        }
        const updated = await database_1.default.organization.update({
            where: { id: organizationId },
            data: {
                featureSimpleBulkUpload: features.simpleBulkUpload,
                featureCsvUpload: features.csvUpload,
                featureOverrideByAdmin: features.overrideByAdmin ?? true
            }
        });
        return {
            organizationId,
            organizationName: org.name,
            features: {
                simpleBulkUpload: updated.featureSimpleBulkUpload,
                csvUpload: updated.featureCsvUpload,
                overrideByAdmin: updated.featureOverrideByAdmin
            }
        };
    }
}
exports.ContactFeaturesService = ContactFeaturesService;
exports.contactFeaturesService = new ContactFeaturesService();
//# sourceMappingURL=contacts.features.js.map