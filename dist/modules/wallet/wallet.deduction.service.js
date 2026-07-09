"use strict";
// src/modules/wallet/wallet.deduction.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COUNTRY_NAMES_MAP = exports.TEMPLATE_RATES = exports.LANGUAGE_TO_PREFIX = exports.DEFAULT_RATE = exports.COUNTRY_RATES = void 0;
exports.getCountryRateFromPhone = getCountryRateFromPhone;
exports.getRateForCategory = getRateForCategory;
exports.deductWalletForTemplate = deductWalletForTemplate;
exports.deductWalletForCampaign = deductWalletForCampaign;
const database_1 = __importDefault(require("../../config/database"));
// Keyed by ITU dial prefix string (e.g. '91' for India, '49' for Germany)
// When a prefix is ambiguous (multiple countries share it), we use the most
// common country's rates or fall back to the DEFAULT_RATE.
// ─── Updated Pricing Table (+1 INR per rate, effective 2026-05) ───────────────
exports.COUNTRY_RATES = {
    // Afghanistan (+93)
    '93': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Albania (+355)
    '355': { marketing: 8.22, utility: 2.78, authentication: 2.78 },
    // Algeria (+213)
    '213': { marketing: 2.89, utility: 1.34, authentication: 1.34 },
    // Angola (+244)
    '244': { marketing: 2.89, utility: 1.34, authentication: 1.34 },
    // Argentina (+54)
    '54': { marketing: 6.19, utility: 3.18, authentication: 3.18 },
    // Armenia (+374)
    '374': { marketing: 8.22, utility: 2.78, authentication: 2.78 },
    // Australia (+61)
    '61': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Austria (+43)
    '43': { marketing: 5.97, utility: 2.44, authentication: 2.44 },
    // Azerbaijan (+994)
    '994': { marketing: 8.22, utility: 2.78, authentication: 2.78 },
    // Bahrain (+973)
    '973': { marketing: 3.86, utility: 1.76, authentication: 1.76 },
    // Bangladesh (+880)
    '880': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Belarus (+375)
    '375': { marketing: 8.22, utility: 2.78, authentication: 2.78 },
    // Belgium (+32)
    '32': { marketing: 5.97, utility: 2.44, authentication: 2.44 },
    // Benin (+229)
    '229': { marketing: 2.89, utility: 1.34, authentication: 1.34 },
    // Bolivia (+591)
    '591': { marketing: 7.22, utility: 1.95, authentication: 1.95 },
    // Botswana (+267)
    '267': { marketing: 2.89, utility: 1.34, authentication: 1.34 },
    // Brazil (+55)
    '55': { marketing: 6.25, utility: 1.57, authentication: 1.57 },
    // Bulgaria (+359)
    '359': { marketing: 8.22, utility: 2.78, authentication: 2.78 },
    // Burkina Faso (+226)
    '226': { marketing: 2.89, utility: 1.34, authentication: 1.34 },
    // Burundi (+257)
    '257': { marketing: 2.89, utility: 1.34, authentication: 1.34 },
    // Cambodia (+855)
    '855': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Cameroon (+237)
    '237': { marketing: 2.89, utility: 1.34, authentication: 1.34 },
    // Canada (+1) — same prefix as USA; both use US rate below
    // Chad (+235)
    '235': { marketing: 2.89, utility: 1.34, authentication: 1.34 },
    // Chile (+56)
    '56': { marketing: 8.47, utility: 2.68, authentication: 2.68 },
    // China (+86)
    '86': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Colombia (+57)
    '57': { marketing: 2.05, utility: 1.07, authentication: 1.07 },
    // Costa Rica (+506)
    '506': { marketing: 7.22, utility: 1.95, authentication: 1.95 },
    // Croatia (+385)
    '385': { marketing: 8.22, utility: 2.78, authentication: 2.78 },
    // Czech Republic (+420)
    '420': { marketing: 8.22, utility: 2.78, authentication: 2.78 },
    // Denmark (+45)
    '45': { marketing: 5.97, utility: 2.44, authentication: 2.44 },
    // Dominican Republic (+1809 / +1829 / +1849) — 4-digit prefix overrides +1 rate
    '1809': { marketing: 7.22, utility: 1.95, authentication: 1.95 },
    '1829': { marketing: 7.22, utility: 1.95, authentication: 1.95 },
    '1849': { marketing: 7.22, utility: 1.95, authentication: 1.95 },
    // Ecuador (+593)
    '593': { marketing: 7.22, utility: 1.95, authentication: 1.95 },
    // Egypt (+20)
    '20': { marketing: 6.41, utility: 1.30, authentication: 1.30 },
    // El Salvador (+503)
    '503': { marketing: 7.22, utility: 1.95, authentication: 1.95 },
    // Eritrea (+291)
    '291': { marketing: 2.89, utility: 1.34, authentication: 1.34 },
    // Ethiopia (+251)
    '251': { marketing: 2.89, utility: 1.34, authentication: 1.34 },
    // Finland (+358)
    '358': { marketing: 5.97, utility: 2.44, authentication: 2.44 },
    // France (+33)
    '33': { marketing: 8.22, utility: 3.52, authentication: 3.52 },
    // Germany (+49)
    '49': { marketing: 12.47, utility: 5.62, authentication: 5.62 },
    // Greece (+30)
    '30': { marketing: 8.22, utility: 2.78, authentication: 2.78 },
    // Guatemala (+502)
    '502': { marketing: 7.22, utility: 1.95, authentication: 1.95 },
    // Haiti (+509)
    '509': { marketing: 7.22, utility: 1.95, authentication: 1.95 },
    // Hong Kong (+852)
    '852': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Hungary (+36)
    '36': { marketing: 8.22, utility: 2.78, authentication: 2.78 },
    // India (+91)
    '91': { marketing: 1.00, utility: 0.19, authentication: 0.12 },
    // Indonesia (+62)
    '62': { marketing: 4.45, utility: 3.10, authentication: 3.10 },
    // Iraq (+964)
    '964': { marketing: 3.86, utility: 1.76, authentication: 1.76 },
    // Ireland (+353)
    '353': { marketing: 5.97, utility: 2.44, authentication: 2.44 },
    // Israel (+972)
    '972': { marketing: 3.97, utility: 1.45, authentication: 1.45 },
    // Italy (+39)
    '39': { marketing: 6.80, utility: 3.52, authentication: 3.52 },
    // Japan (+81)
    '81': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Jordan (+962)
    '962': { marketing: 3.86, utility: 1.76, authentication: 1.76 },
    // Kenya (+254)
    '254': { marketing: 2.89, utility: 1.34, authentication: 1.34 },
    // Kuwait (+965)
    '965': { marketing: 3.86, utility: 1.76, authentication: 1.76 },
    // Laos (+856)
    '856': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Lebanon (+961)
    '961': { marketing: 3.86, utility: 1.76, authentication: 1.76 },
    // Malaysia (+60)
    '60': { marketing: 8.22, utility: 2.18, authentication: 2.18 },
    // Mexico (+52)
    '52': { marketing: 3.56, utility: 1.71, authentication: 1.71 },
    // Nepal (+977)
    '977': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Netherlands (+31)
    '31': { marketing: 14.41, utility: 5.20, authentication: 5.20 },
    // New Zealand (+64)
    '64': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Nigeria (+234)
    '234': { marketing: 5.33, utility: 1.56, authentication: 1.56 },
    // Norway (+47)
    '47': { marketing: 5.97, utility: 2.44, authentication: 2.44 },
    // Oman (+968)
    '968': { marketing: 3.86, utility: 1.76, authentication: 1.76 },
    // Pakistan (+92)
    '92': { marketing: 4.97, utility: 1.84, authentication: 1.84 },
    // Peru (+51)
    '51': { marketing: 6.91, utility: 2.68, authentication: 2.68 },
    // Philippines (+63)
    '63': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Poland (+48)
    '48': { marketing: 8.22, utility: 2.78, authentication: 2.78 },
    // Portugal (+351)
    '351': { marketing: 5.97, utility: 2.44, authentication: 2.44 },
    // Qatar (+974)
    '974': { marketing: 3.86, utility: 1.76, authentication: 1.76 },
    // Romania (+40)
    '40': { marketing: 8.22, utility: 2.78, authentication: 2.78 },
    // Russia (+7)
    '7': { marketing: 7.74, utility: 4.36, authentication: 4.36 },
    // Saudi Arabia (+966)
    '966': { marketing: 5.21, utility: 1.90, authentication: 1.90 },
    // Singapore (+65)
    '65': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // South Africa (+27)
    '27': { marketing: 4.18, utility: 1.64, authentication: 1.64 },
    // Spain (+34)
    '34': { marketing: 6.17, utility: 2.68, authentication: 2.68 },
    // Sri Lanka (+94)
    '94': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Sweden (+46)
    '46': { marketing: 5.97, utility: 2.44, authentication: 2.44 },
    // Switzerland (+41)
    '41': { marketing: 5.97, utility: 2.44, authentication: 2.44 },
    // Taiwan (+886)
    '886': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Thailand (+66)
    '66': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Turkey (+90)
    '90': { marketing: 1.92, utility: 1.08, authentication: 1.08 },
    // UAE (+971)
    '971': { marketing: 5.19, utility: 2.32, authentication: 2.32 },
    // UK (+44)
    '44': { marketing: 5.44, utility: 2.85, authentication: 2.85 },
    // USA & Canada (+1)
    '1': { marketing: 3.10, utility: 1.29, authentication: 1.29 },
    // Vietnam (+84)
    '84': { marketing: 7.15, utility: 1.95, authentication: 1.95 },
    // Yemen (+967)
    '967': { marketing: 3.86, utility: 1.76, authentication: 1.76 },
    // Zimbabwe (+263)
    '263': { marketing: 2.89, utility: 1.34, authentication: 1.34 },
};
// ─── Default (fallback) rate when country cannot be determined ─────────────────
exports.DEFAULT_RATE = {
    marketing: 1.00, // India rate as safe default
    utility: 0.19,
    authentication: 0.12,
};
// ─── Language to Country Prefix Mapping ──────────────────────────────────────
// Maps WhatsApp language codes to their primary ITU dial prefixes
exports.LANGUAGE_TO_PREFIX = {
    'hi': '91', // Hindi -> India
    'bn': '91', // Bengali -> India (also 880, but usually 91 for this context)
    'pa': '91', // Punjabi
    'gu': '91', // Gujarati
    'mr': '91', // Marathi
    'kn': '91', // Kannada
    'ta': '91', // Tamil
    'te': '91', // Telugu
    'ml': '91', // Malayalam
    'de': '49', // German -> Germany
    'fr': '33', // French -> France
    'it': '39', // Italian -> Italy
    'es': '34', // Spanish -> Spain (Note: could be LatAm, but 34 is default)
    'pt_BR': '55', // Portuguese (Brazil) -> Brazil
    'pt_PT': '351', // Portuguese (Portugal) -> Portugal
    'en_US': '1', // English (US) -> USA
    'en_GB': '44', // English (UK) -> UK
    'en_UK': '44', // English (UK) -> UK
    'en_uk': '44', // English (UK) -> UK
    'en': '91', // Default English -> India (since primary users are Indian)
    'nl': '31', // Dutch -> Netherlands
    'tr': '90', // Turkish -> Turkey
    'ar': '966', // Arabic -> Saudi Arabia (Common default for AR)
    'ru': '7', // Russian -> Russia
    'ja': '81', // Japanese -> Japan
    'zh_CN': '86', // Chinese -> China
    'zh_HK': '852', // Chinese (HK) -> Hong Kong
    'zh_TW': '886', // Chinese (TW) -> Taiwan
    'th': '66', // Thai -> Thailand
    'vi': '84', // Vietnamese -> Vietnam
    'id': '62', // Indonesian -> Indonesia
    'ms': '60', // Malay -> Malaysia
    'ko': '82', // Korean -> South Korea
};
// ─── Dial-code lookup: longest-prefix-match from cleaned phone number ──────────
function getCountryRateFromPhone(phone) {
    if (!phone)
        return exports.DEFAULT_RATE;
    // Strip all non-digits and leading zeros
    const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
    // Try prefixes from longest (4 digits) to shortest (1 digit)
    for (const len of [4, 3, 2, 1]) {
        const prefix = digits.slice(0, len);
        if (exports.COUNTRY_RATES[prefix]) {
            return exports.COUNTRY_RATES[prefix];
        }
    }
    return exports.DEFAULT_RATE;
}
// ─── Get rate (INR) for a given category + recipient phone OR language ────────
function getRateForCategory(category, recipientPhone, language) {
    const upper = (category || '').toUpperCase().trim();
    let rates = exports.DEFAULT_RATE;
    // 1. Priority: Language (Template Country)
    if (language && exports.LANGUAGE_TO_PREFIX[language]) {
        const prefix = exports.LANGUAGE_TO_PREFIX[language];
        rates = exports.COUNTRY_RATES[prefix] || exports.DEFAULT_RATE;
    }
    // 2. Fallback: Recipient Phone prefix
    else if (recipientPhone) {
        rates = getCountryRateFromPhone(recipientPhone);
    }
    if (upper.includes('MARKETING'))
        return rates.marketing;
    if (upper.includes('AUTH'))
        return rates.authentication;
    if (upper.includes('UTILITY'))
        return rates.utility;
    return rates.marketing; // Default fallback
}
// ─── Get country name for logging/display ─────────────────────────────────────
const COUNTRY_NAMES = {
    '93': 'Afghanistan', '355': 'Albania', '213': 'Algeria', '244': 'Angola',
    '54': 'Argentina', '374': 'Armenia', '61': 'Australia', '43': 'Austria',
    '994': 'Azerbaijan', '973': 'Bahrain', '880': 'Bangladesh', '375': 'Belarus',
    '32': 'Belgium', '229': 'Benin', '591': 'Bolivia', '267': 'Botswana',
    '55': 'Brazil', '359': 'Bulgaria', '226': 'Burkina Faso', '257': 'Burundi',
    '855': 'Cambodia', '237': 'Cameroon', '235': 'Chad', '56': 'Chile',
    '86': 'China', '57': 'Colombia', '506': 'Costa Rica', '385': 'Croatia',
    '420': 'Czech Republic', '45': 'Denmark',
    '1809': 'Dominican Republic', '1829': 'Dominican Republic', '1849': 'Dominican Republic',
    '593': 'Ecuador', '20': 'Egypt',
    '503': 'El Salvador', '291': 'Eritrea', '251': 'Ethiopia', '358': 'Finland',
    '33': 'France', '49': 'Germany', '30': 'Greece', '502': 'Guatemala',
    '509': 'Haiti', '852': 'Hong Kong', '36': 'Hungary', '91': 'India',
    '62': 'Indonesia', '964': 'Iraq', '353': 'Ireland', '972': 'Israel',
    '39': 'Italy', '81': 'Japan', '962': 'Jordan', '254': 'Kenya',
    '965': 'Kuwait', '856': 'Laos', '961': 'Lebanon', '60': 'Malaysia',
    '52': 'Mexico', '977': 'Nepal', '31': 'Netherlands', '64': 'New Zealand',
    '234': 'Nigeria', '47': 'Norway', '968': 'Oman', '92': 'Pakistan',
    '51': 'Peru', '63': 'Philippines', '48': 'Poland', '351': 'Portugal',
    '974': 'Qatar', '40': 'Romania', '7': 'Russia', '966': 'Saudi Arabia',
    '65': 'Singapore', '27': 'South Africa', '34': 'Spain', '94': 'Sri Lanka',
    '46': 'Sweden', '41': 'Switzerland', '886': 'Taiwan', '66': 'Thailand',
    '90': 'Turkey', '971': 'UAE', '44': 'UK', '1': 'USA/Canada',
    '84': 'Vietnam', '967': 'Yemen', '263': 'Zimbabwe',
};
function getCountryName(phone) {
    const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
    for (const len of [4, 3, 2, 1]) {
        const prefix = digits.slice(0, len);
        if (COUNTRY_NAMES[prefix])
            return COUNTRY_NAMES[prefix];
    }
    return 'Unknown';
}
// ─── Main Function: Deduct Wallet for Template Send ───────────────────────────
async function deductWalletForTemplate(params) {
    const { organizationId, templateName, templateCategory, templateLanguage, recipientPhone, waMessageId, campaignId, campaignName, automationId, automationName, } = params;
    try {
        return await database_1.default.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({
                where: { organizationId },
            });
            // Wallet nahi hai → Skip (Meta khud charge karega)
            if (!wallet) {
                return {
                    deducted: false,
                    walletUsed: false,
                    amount: 0,
                    reason: 'No wallet found - Meta will charge directly',
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
            // ── 1. Get Template Category (from DB if not provided) ─────────────────
            let category = templateCategory;
            if (!category) {
                const template = await tx.template.findFirst({
                    where: { organizationId, name: templateName },
                    select: { category: true },
                });
                category = template?.category || 'MARKETING';
            }
            // ── 2. Calculate Country-wise Rate ─────────────────────────────────────
            const rateRupees = getRateForCategory(category, recipientPhone, templateLanguage);
            const amountPaise = Math.round(rateRupees * 100);
            const countryName = templateLanguage && exports.LANGUAGE_TO_PREFIX[templateLanguage]
                ? (COUNTRY_NAMES[exports.LANGUAGE_TO_PREFIX[templateLanguage]] || getCountryName(recipientPhone))
                : getCountryName(recipientPhone);
            // ── 3. Check Available Balance ─────────────────────────────────────────
            const availablePaise = wallet.balancePaise +
                (wallet.creditEnabled
                    ? wallet.creditLimitPaise - wallet.creditUsedPaise
                    : 0);
            const availableRupees = availablePaise / 100;
            if (availablePaise < amountPaise || availableRupees <= 20) {
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
            // ── 4. Deduct Balance ──────────────────────────────────────────────────
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
            const categoryLabel = getCategoryLabel(category, rateRupees);
            const description = automationId
                ? `Automation charge - ${categoryLabel} [${countryName}] (${templateName}) → ${recipientPhone}`
                : campaignId
                    ? `Campaign charge - ${categoryLabel} [${countryName}] (${templateName}) → ${recipientPhone}`
                    : `Template charge - ${categoryLabel} [${countryName}] (${templateName}) → ${recipientPhone}`;
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
            // ── 5. Check Low Balance After Deduction ───────────────────────────────
            if (newBalancePaise < wallet.lowThresholdPaise) {
                const updatedWallet = { ...wallet, balancePaise: newBalancePaise };
                await triggerLowBalanceAlert(updatedWallet);
            }
            console.log(`💳 Wallet deducted: ₹${rateRupees} (${categoryLabel}) [${countryName}] for ${templateName} → ${recipientPhone}`);
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
// ─── Bulk Pre-check for Campaign ──────────────────────────────────────────────
// NOTE: Campaign bulk deduction uses average of recipient countries
// For pre-check we use the flat rate estimate (safe upper bound check)
async function deductWalletForCampaign(params) {
    const { organizationId, templateName, templateCategory, templateLanguage, totalRecipients, campaignId, recipientPhones } = params;
    const wallet = await database_1.default.wallet.findUnique({
        where: { organizationId },
    });
    // Wallet record hi nahi → Proceed (Meta charges directly)
    if (!wallet) {
        console.log(`💳 [deductWalletForCampaign] No wallet found for org: ${organizationId} → skipping`);
        return {
            canProceed: true,
            estimatedCost: 0,
            availableBalance: 0,
            shortfall: 0,
            walletActive: false,
            rateUsed: 0,
        };
    }
    // Wallet flagged → Skip
    if (wallet.flagged) {
        console.log(`💳 [deductWalletForCampaign] Wallet is FLAGGED for org: ${organizationId} → skipping`);
        return {
            canProceed: true,
            estimatedCost: 0,
            availableBalance: 0,
            shortfall: 0,
            walletActive: false,
            rateUsed: 0,
        };
    }
    // NOTE: We intentionally do NOT check wallet.isActive here.
    // If a wallet record exists and is not flagged, we charge it.
    // isActive is just a UI/access flag; the deduction logic should always run
    // so that campaign costs are tracked regardless of UI state.
    // Get template category
    let category = templateCategory;
    if (!category) {
        const template = await database_1.default.template.findFirst({
            where: { organizationId, name: templateName },
            select: { category: true },
        });
        category = template?.category || 'MARKETING';
    }
    // ── Compute effective rate ─────────────────────────────────────────────────
    let rateRupees;
    // 1. If language is provided, use it for the whole campaign estimate
    if (templateLanguage && exports.LANGUAGE_TO_PREFIX[templateLanguage]) {
        rateRupees = getRateForCategory(category, undefined, templateLanguage);
    }
    // 2. Otherwise, if we have sample phones, use them
    else if (recipientPhones && recipientPhones.length > 0) {
        const totalRate = recipientPhones.reduce((sum, phone) => {
            return sum + getRateForCategory(category, phone);
        }, 0);
        rateRupees = totalRate / recipientPhones.length;
    }
    // 3. Fallback to India rate
    else {
        rateRupees = getRateForCategory(category);
    }
    const estimatedCostRupees = rateRupees * totalRecipients;
    const estimatedCostPaise = Math.round(estimatedCostRupees * 100);
    const availablePaise = wallet.balancePaise +
        (wallet.creditEnabled
            ? wallet.creditLimitPaise - wallet.creditUsedPaise
            : 0);
    const availableRupees = availablePaise / 100;
    const shortfallPaise = Math.max(0, estimatedCostPaise - availablePaise);
    const shortfallRupees = shortfallPaise / 100;
    // Hard block only when balance is ≤ ₹20
    const hasMinimumBalance = availableRupees > 20;
    console.log(`💳 [deductWalletForCampaign] org=${organizationId} ` +
        `available=₹${availableRupees.toFixed(2)} estimatedCost=₹${estimatedCostRupees.toFixed(2)} ` +
        `rate=₹${rateRupees.toFixed(4)} recipients=${totalRecipients}`);
    return {
        canProceed: availablePaise >= estimatedCostPaise && hasMinimumBalance,
        estimatedCost: estimatedCostRupees,
        availableBalance: availableRupees,
        shortfall: shortfallRupees,
        walletActive: true, // ← wallet exists → always true (we'll deduct what we can)
        rateUsed: rateRupees,
    };
}
function getCategoryLabel(category, rateRupees) {
    const upper = category.toUpperCase();
    const rStr = `₹${rateRupees.toFixed(2)}`;
    // ✅ Standardized keywords for analytics parsing
    if (upper.includes('MARKETING')) {
        return `MARKETING (${rStr})`;
    }
    if (upper.includes('AUTHENTICATION') || upper.includes('AUTH')) {
        return `AUTHENTICATION (${rStr})`;
    }
    if (upper.includes('UTILITY')) {
        return `UTILITY (${rStr})`;
    }
    if (upper.includes('SERVICE')) {
        return `SERVICE (${rStr})`;
    }
    return `${category.toUpperCase()} (${rStr})`;
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
// ─── Legacy Flat Rates (kept for backward-compat imports) ─────────────────────
/** @deprecated Use getRateForCategory(category, recipientPhone) instead */
exports.TEMPLATE_RATES = {
    MARKETING: exports.DEFAULT_RATE.marketing,
    UTILITY: exports.DEFAULT_RATE.utility,
    AUTHENTICATION: exports.DEFAULT_RATE.authentication,
    AUTHENTICATION_INTERNATIONAL: 2.50,
    marketing: exports.DEFAULT_RATE.marketing,
    utility: exports.DEFAULT_RATE.utility,
    authentication: exports.DEFAULT_RATE.authentication,
    auth_intl: 2.50,
};
// File ke end mein add karo (COUNTRY_NAMES ke baad)
// Export karo taaki campaigns.service use kar sake
exports.COUNTRY_NAMES_MAP = {
    '93': 'Afghanistan', '355': 'Albania', '213': 'Algeria', '244': 'Angola',
    '54': 'Argentina', '374': 'Armenia', '61': 'Australia', '43': 'Austria',
    '994': 'Azerbaijan', '973': 'Bahrain', '880': 'Bangladesh', '375': 'Belarus',
    '32': 'Belgium', '229': 'Benin', '591': 'Bolivia', '267': 'Botswana',
    '55': 'Brazil', '359': 'Bulgaria', '226': 'Burkina Faso', '257': 'Burundi',
    '855': 'Cambodia', '237': 'Cameroon', '235': 'Chad', '56': 'Chile',
    '86': 'China', '57': 'Colombia', '506': 'Costa Rica', '385': 'Croatia',
    '420': 'Czech Republic', '45': 'Denmark',
    '1809': 'Dominican Republic', '1829': 'Dominican Republic', '1849': 'Dominican Republic',
    '593': 'Ecuador', '20': 'Egypt', '503': 'El Salvador',
    '291': 'Eritrea', '251': 'Ethiopia', '358': 'Finland',
    '33': 'France', '49': 'Germany', '30': 'Greece', '502': 'Guatemala',
    '509': 'Haiti', '852': 'Hong Kong', '36': 'Hungary', '91': 'India',
    '62': 'Indonesia', '964': 'Iraq', '353': 'Ireland', '972': 'Israel',
    '39': 'Italy', '81': 'Japan', '962': 'Jordan', '254': 'Kenya',
    '965': 'Kuwait', '856': 'Laos', '961': 'Lebanon', '60': 'Malaysia',
    '52': 'Mexico', '977': 'Nepal', '31': 'Netherlands', '64': 'New Zealand',
    '234': 'Nigeria', '47': 'Norway', '968': 'Oman', '92': 'Pakistan',
    '51': 'Peru', '63': 'Philippines', '48': 'Poland', '351': 'Portugal',
    '974': 'Qatar', '40': 'Romania', '7': 'Russia', '966': 'Saudi Arabia',
    '65': 'Singapore', '27': 'South Africa', '34': 'Spain', '94': 'Sri Lanka',
    '46': 'Sweden', '41': 'Switzerland', '886': 'Taiwan', '66': 'Thailand',
    '90': 'Turkey', '971': 'UAE', '44': 'UK', '1': 'USA/Canada',
    '84': 'Vietnam', '967': 'Yemen', '263': 'Zimbabwe',
};
//# sourceMappingURL=wallet.deduction.service.js.map