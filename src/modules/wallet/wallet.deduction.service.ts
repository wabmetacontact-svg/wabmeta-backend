// src/modules/wallet/wallet.deduction.service.ts

import prisma from '../../config/database';

// ─────────────────────────────────────────────────────────────────────────────
// 🌍 WhatsApp API Country-wise Pricing (INR, 1 USD ≈ ₹84)
// Rates per conversation (Marketing / Utility / Authentication)
// Source: Meta WhatsApp Business API pricing table
// ─────────────────────────────────────────────────────────────────────────────

export interface CountryRate {
  marketing: number;
  utility: number;
  authentication: number;
}

// Keyed by ITU dial prefix string (e.g. '91' for India, '49' for Germany)
// When a prefix is ambiguous (multiple countries share it), we use the most
// common country's rates or fall back to the DEFAULT_RATE.
export const COUNTRY_RATES: Record<string, CountryRate> = {
  // Afghanistan (+93)
  '93':  { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Albania (+355)
  '355': { marketing: 7.22, utility: 1.78, authentication: 1.78 },
  // Algeria (+213)
  '213': { marketing: 1.89, utility: 0.34, authentication: 0.34 },
  // Angola (+244)
  '244': { marketing: 1.89, utility: 0.34, authentication: 0.34 },
  // Argentina (+54)
  '54':  { marketing: 5.19, utility: 2.18, authentication: 2.18 },
  // Armenia (+374)
  '374': { marketing: 7.22, utility: 1.78, authentication: 1.78 },
  // Australia (+61)
  '61':  { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Austria (+43)
  '43':  { marketing: 4.97, utility: 1.44, authentication: 1.44 },
  // Azerbaijan (+994)
  '994': { marketing: 7.22, utility: 1.78, authentication: 1.78 },
  // Bahrain (+973)
  '973': { marketing: 2.86, utility: 0.76, authentication: 0.76 },
  // Bangladesh (+880)
  '880': { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Belarus (+375)
  '375': { marketing: 7.22, utility: 1.78, authentication: 1.78 },
  // Belgium (+32)
  '32':  { marketing: 4.97, utility: 1.44, authentication: 1.44 },
  // Benin (+229)
  '229': { marketing: 1.89, utility: 0.34, authentication: 0.34 },
  // Bolivia (+591)
  '591': { marketing: 6.22, utility: 0.95, authentication: 0.95 },
  // Botswana (+267)
  '267': { marketing: 1.89, utility: 0.34, authentication: 0.34 },
  // Brazil (+55)
  '55':  { marketing: 5.25, utility: 0.57, authentication: 0.57 },
  // Bulgaria (+359)
  '359': { marketing: 7.22, utility: 1.78, authentication: 1.78 },
  // Burkina Faso (+226)
  '226': { marketing: 1.89, utility: 0.34, authentication: 0.34 },
  // Burundi (+257)
  '257': { marketing: 1.89, utility: 0.34, authentication: 0.34 },
  // Cambodia (+855)
  '855': { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Cameroon (+237)
  '237': { marketing: 1.89, utility: 0.34, authentication: 0.34 },
  // Canada (+1) – same prefix as USA, handled via US rates below
  // Chad (+235)
  '235': { marketing: 1.89, utility: 0.34, authentication: 0.34 },
  // Chile (+56)
  '56':  { marketing: 7.47, utility: 1.68, authentication: 1.68 },
  // China (+86)
  '86':  { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Colombia (+57)
  '57':  { marketing: 1.05, utility: 0.07, authentication: 0.07 },
  // Costa Rica (+506)
  '506': { marketing: 6.22, utility: 0.95, authentication: 0.95 },
  // Croatia (+385)
  '385': { marketing: 7.22, utility: 1.78, authentication: 1.78 },
  // Czech Republic (+420)
  '420': { marketing: 7.22, utility: 1.78, authentication: 1.78 },
  // Denmark (+45)
  '45':  { marketing: 4.97, utility: 1.44, authentication: 1.44 },
  // Dominican Republic (+1-809 / +1-829 / +1-849) – handled via fallback
  // Ecuador (+593)
  '593': { marketing: 6.22, utility: 0.95, authentication: 0.95 },
  // Egypt (+20)
  '20':  { marketing: 5.41, utility: 0.30, authentication: 0.30 },
  // El Salvador (+503)
  '503': { marketing: 6.22, utility: 0.95, authentication: 0.95 },
  // Eritrea (+291)
  '291': { marketing: 1.89, utility: 0.34, authentication: 0.34 },
  // Ethiopia (+251)
  '251': { marketing: 1.89, utility: 0.34, authentication: 0.34 },
  // Finland (+358)
  '358': { marketing: 4.97, utility: 1.44, authentication: 1.44 },
  // France (+33)
  '33':  { marketing: 7.22, utility: 2.52, authentication: 2.52 },
  // Germany (+49)
  '49':  { marketing: 11.47, utility: 4.62, authentication: 4.62 },
  // Greece (+30)
  '30':  { marketing: 7.22, utility: 1.78, authentication: 1.78 },
  // Guatemala (+502)
  '502': { marketing: 6.22, utility: 0.95, authentication: 0.95 },
  // Haiti (+509)
  '509': { marketing: 6.22, utility: 0.95, authentication: 0.95 },
  // Hong Kong (+852)
  '852': { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Hungary (+36)
  '36':  { marketing: 7.22, utility: 1.78, authentication: 1.78 },
  // India (+91)  ← cheapest
  '91':  { marketing: 0.99, utility: 0.12, authentication: 0.12 },
  // Indonesia (+62)
  '62':  { marketing: 3.45, utility: 2.10, authentication: 2.10 },
  // Iraq (+964)
  '964': { marketing: 2.86, utility: 0.76, authentication: 0.76 },
  // Ireland (+353)
  '353': { marketing: 4.97, utility: 1.44, authentication: 1.44 },
  // Israel (+972)
  '972': { marketing: 2.97, utility: 0.45, authentication: 0.45 },
  // Italy (+39)
  '39':  { marketing: 5.80, utility: 2.52, authentication: 2.52 },
  // Japan (+81)
  '81':  { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Jordan (+962)
  '962': { marketing: 2.86, utility: 0.76, authentication: 0.76 },
  // Kenya (+254)
  '254': { marketing: 1.89, utility: 0.34, authentication: 0.34 },
  // Kuwait (+965)
  '965': { marketing: 2.86, utility: 0.76, authentication: 0.76 },
  // Laos (+856)
  '856': { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Lebanon (+961)
  '961': { marketing: 2.86, utility: 0.76, authentication: 0.76 },
  // Malaysia (+60)
  '60':  { marketing: 7.22, utility: 1.18, authentication: 1.18 },
  // Mexico (+52)
  '52':  { marketing: 2.56, utility: 0.71, authentication: 0.71 },
  // Nepal (+977)
  '977': { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Netherlands (+31)
  '31':  { marketing: 13.41, utility: 4.20, authentication: 4.20 },
  // New Zealand (+64)
  '64':  { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Nigeria (+234)
  '234': { marketing: 4.33, utility: 0.56, authentication: 0.56 },
  // Norway (+47)
  '47':  { marketing: 4.97, utility: 1.44, authentication: 1.44 },
  // Oman (+968)
  '968': { marketing: 2.86, utility: 0.76, authentication: 0.76 },
  // Pakistan (+92)
  '92':  { marketing: 3.97, utility: 0.84, authentication: 0.84 },
  // Peru (+51)
  '51':  { marketing: 5.91, utility: 1.68, authentication: 1.68 },
  // Philippines (+63)
  '63':  { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Poland (+48)
  '48':  { marketing: 7.22, utility: 1.78, authentication: 1.78 },
  // Portugal (+351)
  '351': { marketing: 4.97, utility: 1.44, authentication: 1.44 },
  // Qatar (+974)
  '974': { marketing: 2.86, utility: 0.76, authentication: 0.76 },
  // Romania (+40)
  '40':  { marketing: 7.22, utility: 1.78, authentication: 1.78 },
  // Russia (+7)
  '7':   { marketing: 6.74, utility: 3.36, authentication: 3.36 },
  // Saudi Arabia (+966)
  '966': { marketing: 4.21, utility: 0.90, authentication: 0.90 },
  // Singapore (+65)
  '65':  { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // South Africa (+27)
  '27':  { marketing: 3.18, utility: 0.64, authentication: 0.64 },
  // Spain (+34)
  '34':  { marketing: 5.17, utility: 1.68, authentication: 1.68 },
  // Sri Lanka (+94)
  '94':  { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Sweden (+46)
  '46':  { marketing: 4.97, utility: 1.44, authentication: 1.44 },
  // Switzerland (+41)
  '41':  { marketing: 4.97, utility: 1.44, authentication: 1.44 },
  // Taiwan (+886)
  '886': { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Thailand (+66)
  '66':  { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Turkey (+90)
  '90':  { marketing: 0.92, utility: 0.08, authentication: 0.08 },
  // UAE (+971)
  '971': { marketing: 4.19, utility: 1.32, authentication: 1.32 },
  // UK (+44)
  '44':  { marketing: 4.44, utility: 1.85, authentication: 1.85 },
  // USA & Canada (+1)
  '1':   { marketing: 2.10, utility: 0.29, authentication: 0.29 },
  // Vietnam (+84)
  '84':  { marketing: 6.15, utility: 0.95, authentication: 0.95 },
  // Yemen (+967)
  '967': { marketing: 2.86, utility: 0.76, authentication: 0.76 },
  // Zimbabwe (+263)
  '263': { marketing: 1.89, utility: 0.34, authentication: 0.34 },
};

// ─── Default (fallback) rate when country cannot be determined ─────────────────
export const DEFAULT_RATE: CountryRate = {
  marketing: 0.99,      // India rate as safe default
  utility: 0.12,
  authentication: 0.12,
};

// ─── Dial-code lookup: longest-prefix-match from cleaned phone number ──────────
// We try 4-digit prefix first, then 3, then 2, then 1 (greedy match)
export function getCountryRateFromPhone(phone: string): CountryRate {
  if (!phone) return DEFAULT_RATE;

  // Strip all non-digits and leading zeros
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');

  // Try prefixes from longest (4 digits) to shortest (1 digit)
  for (const len of [4, 3, 2, 1]) {
    const prefix = digits.slice(0, len);
    if (COUNTRY_RATES[prefix]) {
      return COUNTRY_RATES[prefix];
    }
  }

  return DEFAULT_RATE;
}

// ─── Get rate (INR) for a given category + recipient phone ────────────────────
export function getRateForCategory(category: string, recipientPhone?: string): number {
  const upper = (category || '').toUpperCase().trim();
  const rates = recipientPhone ? getCountryRateFromPhone(recipientPhone) : DEFAULT_RATE;

  if (upper.includes('MARKETING')) return rates.marketing;
  if (upper.includes('AUTH'))      return rates.authentication;
  if (upper.includes('UTILITY'))   return rates.utility;

  return rates.marketing; // Default fallback
}

// ─── Get country name for logging/display ─────────────────────────────────────
const COUNTRY_NAMES: Record<string, string> = {
  '93': 'Afghanistan', '355': 'Albania', '213': 'Algeria', '244': 'Angola',
  '54': 'Argentina', '374': 'Armenia', '61': 'Australia', '43': 'Austria',
  '994': 'Azerbaijan', '973': 'Bahrain', '880': 'Bangladesh', '375': 'Belarus',
  '32': 'Belgium', '229': 'Benin', '591': 'Bolivia', '267': 'Botswana',
  '55': 'Brazil', '359': 'Bulgaria', '226': 'Burkina Faso', '257': 'Burundi',
  '855': 'Cambodia', '237': 'Cameroon', '235': 'Chad', '56': 'Chile',
  '86': 'China', '57': 'Colombia', '506': 'Costa Rica', '385': 'Croatia',
  '420': 'Czech Republic', '45': 'Denmark', '593': 'Ecuador', '20': 'Egypt',
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

function getCountryName(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  for (const len of [4, 3, 2, 1]) {
    const prefix = digits.slice(0, len);
    if (COUNTRY_NAMES[prefix]) return COUNTRY_NAMES[prefix];
  }
  return 'Unknown';
}

// ─── Main Function: Deduct Wallet for Template Send ───────────────────────────
export async function deductWalletForTemplate(params: {
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
}> {
  const {
    organizationId,
    templateName,
    templateCategory,
    recipientPhone,
    waMessageId,
    campaignId,
    campaignName,
    automationId,
    automationName,
  } = params;

  try {
    return await prisma.$transaction(async (tx) => {
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
      const countryRates  = getCountryRateFromPhone(recipientPhone);
      const rateRupees    = getRateForCategory(category, recipientPhone);
      const amountPaise   = Math.round(rateRupees * 100);
      const countryName   = getCountryName(recipientPhone);

      // ── 3. Check Available Balance ─────────────────────────────────────────
      const availablePaise =
        wallet.balancePaise +
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
      let newBalancePaise: number;
      let creditDeductedPaise = 0;

      if (wallet.balancePaise >= amountPaise) {
        newBalancePaise = wallet.balancePaise - amountPaise;
      } else {
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
        await triggerLowBalanceAlert(updatedWallet as any);
      }

      console.log(
        `💳 Wallet deducted: ₹${rateRupees} (${categoryLabel}) [${countryName}] for ${templateName} → ${recipientPhone}`
      );

      return {
        deducted: true,
        walletUsed: true,
        amount: rateRupees,
      };
    });
  } catch (error: any) {
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
export async function deductWalletForCampaign(params: {
  organizationId: string;
  templateName: string;
  templateCategory?: string;
  totalRecipients: number;
  campaignId: string;
  /** Optional: sample of recipient phones to compute weighted average rate */
  recipientPhones?: string[];
}): Promise<{
  canProceed: boolean;
  estimatedCost: number;
  availableBalance: number;
  shortfall: number;
  walletActive: boolean;
  rateUsed: number;
}> {
  const { organizationId, templateName, templateCategory, totalRecipients, campaignId, recipientPhones } = params;

  const wallet = await prisma.wallet.findUnique({
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
      rateUsed: 0,
    };
  }

  // Get template category
  let category = templateCategory;
  if (!category) {
    const template = await prisma.template.findFirst({
      where: { organizationId, name: templateName },
      select: { category: true },
    });
    category = template?.category || 'MARKETING';
  }

  // ── Compute effective rate ─────────────────────────────────────────────────
  // If we have sample phones, calculate weighted average rate across countries.
  // Otherwise fall back to India rate as conservative default.
  let rateRupees: number;

  if (recipientPhones && recipientPhones.length > 0) {
    const totalRate = recipientPhones.reduce((sum, phone) => {
      return sum + getRateForCategory(category!, phone);
    }, 0);
    rateRupees = totalRate / recipientPhones.length;
  } else {
    // Use default (India) rate as conservative fallback
    rateRupees = getRateForCategory(category);
  }

  const estimatedCostRupees = rateRupees * totalRecipients;
  const estimatedCostPaise  = Math.round(estimatedCostRupees * 100);

  const availablePaise =
    wallet.balancePaise +
    (wallet.creditEnabled
      ? wallet.creditLimitPaise - wallet.creditUsedPaise
      : 0);

  const availableRupees = availablePaise / 100;
  const shortfallPaise  = Math.max(0, estimatedCostPaise - availablePaise);
  const shortfallRupees = shortfallPaise / 100;

  // Must have at least ₹20 to run any campaign
  const hasMinimumBalance = availableRupees > 20;

  return {
    canProceed: availablePaise >= estimatedCostPaise && hasMinimumBalance,
    estimatedCost: estimatedCostRupees,
    availableBalance: availableRupees,
    shortfall: shortfallRupees,
    walletActive: true,
    rateUsed: rateRupees,
  };
}

// ─── Helper: Category Label (with actual rate) ────────────────────────────────
function getCategoryLabel(category: string, rateRupees: number): string {
  const upper = category.toUpperCase();
  const rStr  = `₹${rateRupees.toFixed(2)}`;

  if (upper.includes('MARKETING')) return `Marketing (${rStr})`;
  if (upper.includes('AUTH'))      return `Authentication (${rStr})`;
  if (upper.includes('UTILITY'))   return `Utility (${rStr})`;
  return `${category} (${rStr})`;
}

// ─── Helper: Low Balance Alert ─────────────────────────────────────────────────
async function triggerLowBalanceAlert(wallet: any) {
  if (wallet.lowAlertSent && wallet.lastAlertSentAt) {
    const hoursDiff =
      (Date.now() - new Date(wallet.lastAlertSentAt).getTime()) /
      (1000 * 60 * 60);
    if (hoursDiff < 24) return;
  }

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      lowAlertSent: true,
      lastAlertSentAt: new Date(),
    },
  });

  console.log(
    `🔔 Low balance alert: Org ${wallet.organizationId}, Balance: ₹${wallet.balancePaise / 100}`
  );
  // TODO: Email notification add karo
}

// ─── Legacy Flat Rates (kept for backward-compat imports) ─────────────────────
/** @deprecated Use getRateForCategory(category, recipientPhone) instead */
export const TEMPLATE_RATES: Record<string, number> = {
  MARKETING: DEFAULT_RATE.marketing,
  UTILITY: DEFAULT_RATE.utility,
  AUTHENTICATION: DEFAULT_RATE.authentication,
  AUTHENTICATION_INTERNATIONAL: 2.50,
  marketing: DEFAULT_RATE.marketing,
  utility: DEFAULT_RATE.utility,
  authentication: DEFAULT_RATE.authentication,
  auth_intl: 2.50,
};
