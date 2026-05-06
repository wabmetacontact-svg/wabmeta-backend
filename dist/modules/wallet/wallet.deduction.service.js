"use strict";
// src/modules/wallet/wallet.deduction.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATE_RATES = void 0;
exports.getRateForCategory = getRateForCategory;
exports.deductWalletForTemplate = deductWalletForTemplate;
exports.deductWalletForCampaign = deductWalletForCampaign;
const database_1 = __importDefault(require("../../config/database"));
// ─── WabMeta Template Rates (INR) ─────────────────────────────────────────────
exports.TEMPLATE_RATES = {
    MARKETING: 0.90,
    UTILITY: 0.15,
    AUTHENTICATION: 0.15,
    AUTHENTICATION_INTERNATIONAL: 2.50,
    // Lowercase support
    marketing: 0.90,
    utility: 0.15,
    authentication: 0.15,
    auth_intl: 2.50,
};
// ─── Helper: Get Rate for Template Category ────────────────────────────────────
function getRateForCategory(category) {
    if (!category)
        return exports.TEMPLATE_RATES.MARKETING; // Default to highest
    const upper = category.toUpperCase().trim();
    if (upper.includes('MARKETING'))
        return exports.TEMPLATE_RATES.MARKETING;
    if (upper.includes('AUTH') && upper.includes('INTL'))
        return exports.TEMPLATE_RATES.AUTHENTICATION_INTERNATIONAL;
    if (upper.includes('AUTH'))
        return exports.TEMPLATE_RATES.AUTHENTICATION;
    if (upper.includes('UTILITY'))
        return exports.TEMPLATE_RATES.UTILITY;
    return exports.TEMPLATE_RATES.MARKETING; // Default fallback
}
// ─── Main Function: Deduct Wallet for Template Send ───────────────────────────
async function deductWalletForTemplate(params) {
    const { organizationId, templateName, templateCategory, recipientPhone, waMessageId, campaignId, campaignName, automationId, automationName, } = params;
    try {
        // ── 1. Check if wallet exists & active (Inside Transaction) ────────────────
        return await database_1.default.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({
                where: { organizationId },
            });
            // Wallet nahi hai ya active nahi → Skip (Meta khud charge karega)
            if (!wallet || !wallet.isActive) {
                return {
                    deducted: false,
                    walletUsed: false,
                    amount: 0,
                    reason: 'Wallet not active - Meta will charge directly',
                };
            }
            // Flagged wallet → Skip
            if (wallet.flagged) {
                return {
                    deducted: false,
                    walletUsed: false,
                    amount: 0,
                    reason: 'Wallet is flagged',
                };
            }
            // ── 2. Get Template Category (from DB if not provided) ─────────────────────
            let category = templateCategory;
            if (!category) {
                const template = await tx.template.findFirst({
                    where: { organizationId, name: templateName },
                    select: { category: true },
                });
                category = template?.category || 'MARKETING';
            }
            // ── 3. Calculate Amount ────────────────────────────────────────────────────
            const rateRupees = getRateForCategory(category);
            const amountPaise = Math.round(rateRupees * 100);
            // ── 4. Check Available Balance ─────────────────────────────────────────────
            const availablePaise = wallet.balancePaise +
                (wallet.creditEnabled
                    ? wallet.creditLimitPaise - wallet.creditUsedPaise
                    : 0);
            const availableRupees = availablePaise / 100;
            if (availablePaise < amountPaise || availableRupees <= 20) {
                // Low balance alert
                await triggerLowBalanceAlert(wallet);
                const reason = availableRupees <= 20
                    ? `Wallet balance very low (₹${availableRupees.toFixed(2)}). Minimum ₹20.00 required.`
                    : `Insufficient wallet balance (₹${availableRupees.toFixed(2)} available, ₹${rateRupees} needed)`;
                return {
                    deducted: false,
                    walletUsed: false,
                    amount: rateRupees,
                    reason,
                };
            }
            // ── 5. Deduct Balance ──────────────────────────────────────────────────────
            const balanceBeforePaise = wallet.balancePaise;
            let newBalancePaise;
            let creditDeductedPaise = 0;
            if (wallet.balancePaise >= amountPaise) {
                newBalancePaise = wallet.balancePaise - amountPaise;
            }
            else {
                creditDeductedPaise = amountPaise - wallet.balancePaise;
                newBalancePaise = 0;
            }
            const categoryLabel = getCategoryLabel(category);
            const description = automationId
                ? `Automation template charge - ${categoryLabel} (${templateName}) → ${recipientPhone}`
                : campaignId
                    ? `Campaign template charge - ${categoryLabel} (${templateName}) → ${recipientPhone}`
                    : `Template charge - ${categoryLabel} (${templateName}) → ${recipientPhone}`;
            // Update wallet balance
            await tx.wallet.update({
                where: { id: wallet.id },
                data: {
                    balancePaise: newBalancePaise,
                    creditUsedPaise: { increment: creditDeductedPaise },
                    totalDebitedPaise: { increment: amountPaise },
                    lastTransactionAt: new Date(),
                },
            });
            // Create transaction record
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'debit',
                    amountPaise,
                    balanceBeforePaise,
                    balanceAfterPaise: newBalancePaise,
                    description,
                    status: 'completed',
                    metaChargeId: waMessageId,
                    metaService: 'template_message',
                    note: automationId
                        ? `Automation trigger: ${automationName || automationId}`
                        : campaignName
                            ? `Campaign: ${campaignName}`
                            : campaignId
                                ? `Campaign: ${campaignId}`
                                : undefined,
                },
            });
            // ── 6. Check Low Balance After Deduction ───────────────────────────────────
            if (newBalancePaise < wallet.lowThresholdPaise) {
                const updatedWallet = { ...wallet, balancePaise: newBalancePaise };
                await triggerLowBalanceAlert(updatedWallet);
            }
            console.log(`💳 Wallet deducted: ₹${rateRupees} (${categoryLabel}) for ${templateName} → ${recipientPhone}`);
            return {
                deducted: true,
                walletUsed: true,
                amount: rateRupees,
            };
        });
    }
    catch (error) {
        // Silent fail - don't block message sending if wallet deduction fails
        console.error('❌ Wallet deduction error (non-blocking):', error.message);
        return {
            deducted: false,
            walletUsed: false,
            amount: 0,
            reason: `Deduction error: ${error.message}`,
        };
    }
}
// ─── Bulk Deduction for Campaign ───────────────────────────────────────────────
async function deductWalletForCampaign(params) {
    const { organizationId, templateName, templateCategory, totalRecipients, campaignId } = params;
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    // Wallet nahi hai → Proceed normally (Meta charges directly)
    if (!wallet || !wallet.isActive) {
        return {
            canProceed: true,
            estimatedCost: 0,
            availableBalance: 0,
            shortfall: 0,
            walletActive: false,
        };
    }
    // Get template category
    let category = templateCategory;
    if (!category) {
        const template = await database_1.default.template.findFirst({
            where: { organizationId, name: templateName },
            select: { category: true },
        });
        category = template?.category || 'MARKETING';
    }
    const rateRupees = getRateForCategory(category);
    const estimatedCostRupees = rateRupees * totalRecipients;
    const estimatedCostPaise = Math.round(estimatedCostRupees * 100);
    const availablePaise = wallet.balancePaise +
        (wallet.creditEnabled
            ? wallet.creditLimitPaise - wallet.creditUsedPaise
            : 0);
    const availableRupees = availablePaise / 100;
    const shortfallPaise = Math.max(0, estimatedCostPaise - availablePaise);
    const shortfallRupees = shortfallPaise / 100;
    // ✅ New Limit: Must have at least ₹20 to run any campaign
    const hasMinimumBalance = availableRupees > 20;
    return {
        canProceed: availablePaise >= estimatedCostPaise && hasMinimumBalance,
        estimatedCost: estimatedCostRupees,
        availableBalance: availableRupees,
        shortfall: shortfallRupees,
        walletActive: true,
    };
}
// ─── Helper: Category Label ────────────────────────────────────────────────────
function getCategoryLabel(category) {
    const upper = category.toUpperCase();
    if (upper.includes('MARKETING'))
        return 'Marketing (₹0.90)';
    if (upper.includes('AUTH') && upper.includes('INTL'))
        return 'Auth Intl (₹2.50)';
    if (upper.includes('AUTH'))
        return 'Authentication (₹0.15)';
    if (upper.includes('UTILITY'))
        return 'Utility (₹0.15)';
    return `${category} (₹0.90)`;
}
// ─── Helper: Low Balance Alert ─────────────────────────────────────────────────
async function triggerLowBalanceAlert(wallet) {
    if (wallet.lowAlertSent && wallet.lastAlertSentAt) {
        const hoursDiff = (Date.now() - new Date(wallet.lastAlertSentAt).getTime()) /
            (1000 * 60 * 60);
        if (hoursDiff < 24)
            return;
    }
    await database_1.default.wallet.update({
        where: { id: wallet.id },
        data: {
            lowAlertSent: true,
            lastAlertSentAt: new Date(),
        },
    });
    console.log(`🔔 Low balance alert: Org ${wallet.organizationId}, Balance: ₹${wallet.balancePaise / 100}`);
    // TODO: Email notification add karo
}
//# sourceMappingURL=wallet.deduction.service.js.map