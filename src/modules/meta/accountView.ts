// src/modules/meta/accountView.ts
//
// WhatsApp account ko client tak bhejne se pehle ek hi jagah se guzaro.
//
// Pehle teen alag sanitizeAccount the - meta.service, whatsapp.controller aur
// admin.controller me. Sirf ek override apply karta tha, isliye "Sync" dabate
// hi admin ki set ki hui value gayab ho jati thi aur Meta wali wapas aa jati
// thi. Ab sab yahi use karte hain.

/**
 * Tier ka rozana ka limit. null = unlimited.
 *
 * Meta ne 1K ko 2K se badal diya tha - wo entry missing hone se limit
 * "unknown" ho jati thi.
 */
export const TIER_DAILY_LIMIT: Record<string, number | null> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_2K: 2000,
  TIER_5K: 5000,
  TIER_10K: 10000,
  TIER_20K: 20000,
  TIER_50K: 50000,
  TIER_100K: 100000,
  TIER_UNLIMITED: null,
};

export function tierDailyLimit(tier?: string | null): number | null {
  if (!tier) return null;
  if (tier in TIER_DAILY_LIMIT) return TIER_DAILY_LIMIT[tier];
  // Anjaan tier bhi samajhne ki koshish - "TIER_250K" se 250000
  const m = /^TIER_(\d+)(K|M)?$/i.exec(tier);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const mult = m[2]?.toUpperCase() === 'M' ? 1e6 : m[2]?.toUpperCase() === 'K' ? 1e3 : 1;
  return n * mult;
}

export interface SanitizedAccount {
  [key: string]: any;
  hasAccessToken: boolean;
}

/**
 * Secrets hatao, aur admin ke display overrides laga do.
 *
 * Overrides sirf DIKHNE ke liye hain - Meta par kuch nahi badalta, aur
 * campaign ki send speed hamesha Meta ke asli tier se chalti hai.
 */
export function toClientAccount(account: any): SanitizedAccount | null {
  if (!account) return null;

  const {
    accessToken,
    webhookSecret,
    healthStatus,
    qualityRatingOverride,
    messagingLimitOverride,
    codeVerificationOverride,
    healthCanSendOverride,
    overrideSetBy,
    overrideSetAt,
    ...safe
  } = account as any;

  if (qualityRatingOverride) safe.qualityRating = qualityRatingOverride;
  if (codeVerificationOverride) safe.codeVerificationStatus = codeVerificationOverride;
  if (healthCanSendOverride) safe.connectionState = healthCanSendOverride;

  if (messagingLimitOverride) {
    safe.messagingLimit = messagingLimitOverride;

    // Rozana ka limit tier se nikalta hai aur wo override se PEHLE compute
    // hota hai - isliye card upar "100,000/day" aur neeche "0 / 250 used"
    // dikhata tha. Override lagne par use dobara nikalo.
    const perDay = tierDailyLimit(messagingLimitOverride);
    safe.messagingLimitPerDay = perDay;
    safe.messagingRemaining =
      perDay === null ? null : Math.max(0, perDay - (safe.messagingUsed24h || 0));
    safe.messagingTierStatus = 'ASSIGNED';
  }

  return {
    ...safe,
    hasAccessToken: !!accessToken,
    hasWebhookSecret: !!webhookSecret,
  };
}
