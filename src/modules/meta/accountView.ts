// src/modules/meta/accountView.ts
//
// WhatsApp account ko client tak bhejne se pehle ek hi jagah se guzaro.
//
// Pehle teen alag sanitizeAccount the - meta.service, whatsapp.controller aur
// admin.controller me. Sirf ek override apply karta tha, isliye "Sync" dabate
// hi admin ki set ki hui value gayab ho jati thi aur Meta wali wapas aa jati
// thi. Ab sab yahi use karte hain.

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
    healthCanSendOverride,
    overrideSetBy,
    overrideSetAt,
    ...safe
  } = account as any;

  if (qualityRatingOverride) safe.qualityRating = qualityRatingOverride;
  if (messagingLimitOverride) safe.messagingLimit = messagingLimitOverride;
  if (healthCanSendOverride) safe.healthCanSend = healthCanSendOverride;

  return {
    ...safe,
    hasAccessToken: !!accessToken,
    hasWebhookSecret: !!webhookSecret,
  };
}
