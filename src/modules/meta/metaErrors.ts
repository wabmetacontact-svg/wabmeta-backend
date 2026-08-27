// src/modules/meta/metaErrors.ts
//
// Meta ke saare documented error codes ek hi jagah par.
// Source: developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes
//
// Pehle har module apna chhota sa map rakhta tha aur jo code usme nahi hota
// wo seedha 500 "Request failed with status code 500" ban jata tha - user ko
// kabhi pata hi nahi chalta ki kya karna hai. Ab har code ka ek hi matlab hai,
// ek hi user-facing message hai, aur ek hi retry policy hai.

export type ErrorCategory =
  | 'AUTH'        // token / permission - reconnect chahiye
  | 'RATE_LIMIT'  // thoda ruk kar dobara
  | 'TRANSIENT'   // Meta ki taraf se temporary
  | 'TEMPLATE'    // template ki dikkat
  | 'RECIPIENT'   // is number par nahi ja sakta
  | 'ACCOUNT'     // WABA / portfolio / billing - user ko Meta me theek karna hai
  | 'MEDIA'       // media upload/download
  | 'POLICY'      // policy violation
  | 'WINDOW'      // 24-hour window
  | 'UNKNOWN';

export interface MetaErrorInfo {
  code: number;
  category: ErrorCategory;
  /** User ko dikhane wala message - hamesha English, hamesha actionable */
  message: string;
  /** Hamari API kya status lauta.e */
  status: number;
  /** Dobara koshish karne se fayda hai? */
  retryable: boolean;
  /**
   * Ye recipient ke liye hamesha fail rahega - campaign me ise skip karo,
   * baar baar mat try karo, aur paisa wapas karo.
   */
  permanent: boolean;
  /** true = poori campaign rokni chahiye, sirf ek recipient ki baat nahi */
  stopCampaign?: boolean;
}

const E = (
  code: number,
  category: ErrorCategory,
  message: string,
  opts: Partial<MetaErrorInfo> = {}
): MetaErrorInfo => ({
  code,
  category,
  message,
  status: opts.status ?? 400,
  retryable: opts.retryable ?? false,
  permanent: opts.permanent ?? false,
  stopCampaign: opts.stopCampaign ?? false,
});

export const META_ERRORS: Record<number, MetaErrorInfo> = {
  // ── Authentication / permissions ──────────────────────────
  0: E(0, 'AUTH', 'WhatsApp session has expired. Please reconnect your WhatsApp account in Settings.', { status: 401, stopCampaign: true }),
  190: E(190, 'AUTH', 'WhatsApp connection has expired. Please reconnect your WhatsApp account in Settings.', { status: 401, stopCampaign: true }),
  200: E(200, 'AUTH', 'WhatsApp authorisation is missing. Please reconnect your WhatsApp account.', { status: 401, stopCampaign: true }),
  3: E(3, 'AUTH', 'This WhatsApp connection is missing a permission it needs. Please reconnect the account and accept all permissions.', { status: 403, stopCampaign: true }),
  10: E(10, 'AUTH', 'A required WhatsApp permission was removed. Please reconnect your account and accept all permissions.', { status: 403, stopCampaign: true }),
  131005: E(131005, 'AUTH', 'This WhatsApp connection is missing a permission it needs. Please reconnect the account.', { status: 403, stopCampaign: true }),

  // ── Rate limits / throughput ──────────────────────────────
  4: E(4, 'RATE_LIMIT', 'WhatsApp is rate limiting requests right now. This will resume automatically.', { status: 429, retryable: true }),
  80007: E(80007, 'RATE_LIMIT', 'Your WhatsApp account hit its request limit. Sending will resume shortly.', { status: 429, retryable: true }),
  130429: E(130429, 'RATE_LIMIT', 'Sending too fast for this number. Slowing down and retrying.', { status: 429, retryable: true }),
  131048: E(131048, 'RATE_LIMIT', 'WhatsApp has limited this number because earlier messages were marked as spam. Check your quality rating in WhatsApp Manager.', { status: 429, retryable: true }),
  131056: E(131056, 'RATE_LIMIT', 'Too many messages to this same person in a short time. Try again later.', { status: 429, retryable: true }),
  133016: E(133016, 'RATE_LIMIT', 'Too many registration attempts for this number. Please wait before trying again.', { status: 429, retryable: true }),
  2494055: E(2494055, 'RATE_LIMIT', 'Sending limit reached for this number. Sending will resume shortly.', { status: 429, retryable: true }),

  // ── Transient / Meta side ─────────────────────────────────
  1: E(1, 'TRANSIENT', 'WhatsApp could not process this request. Retrying.', { status: 503, retryable: true }),
  2: E(2, 'TRANSIENT', 'WhatsApp is temporarily unavailable. Retrying shortly.', { status: 503, retryable: true }),
  131016: E(131016, 'TRANSIENT', 'A WhatsApp service is temporarily unavailable. Retrying shortly.', { status: 503, retryable: true }),
  131000: E(131000, 'TRANSIENT', 'WhatsApp could not send this message. Retrying.', { status: 503, retryable: true }),
  133004: E(133004, 'TRANSIENT', 'WhatsApp servers are temporarily unavailable. Retrying shortly.', { status: 503, retryable: true }),
  131057: E(131057, 'TRANSIENT', 'This WhatsApp account is in maintenance mode. Sending will resume once it finishes.', { status: 503, retryable: true }),

  // ── Account / portfolio / billing ─────────────────────────
  33: E(33, 'ACCOUNT', 'This business phone number no longer exists on WhatsApp. Reconnect a valid number.', { status: 400, stopCampaign: true }),
  368: E(368, 'ACCOUNT', 'Your WhatsApp Business Account is restricted for a policy violation. Resolve it in WhatsApp Manager before sending again.', { status: 403, stopCampaign: true }),
  131031: E(131031, 'ACCOUNT', 'Your WhatsApp Business Account is restricted, or its business details could not be verified. Check WhatsApp Manager.', { status: 403, stopCampaign: true }),
  131037: E(131037, 'ACCOUNT', 'This number cannot send yet - its display name is not approved. Approve the display name in WhatsApp Manager.', { status: 400, stopCampaign: true }),
  131042: E(131042, 'ACCOUNT', 'There is a problem with the payment method on your WhatsApp Business Account. Add a valid payment method in WhatsApp Manager.', { status: 402, stopCampaign: true }),
  131045: E(131045, 'ACCOUNT', 'This number is not fully registered with WhatsApp. Finish registration and OTP verification in WhatsApp Manager.', { status: 400, stopCampaign: true }),
  133010: E(133010, 'ACCOUNT', 'This number is not registered on the WhatsApp Business Platform. Register it before sending.', { status: 400, stopCampaign: true }),
  133006: E(133006, 'ACCOUNT', 'This number needs to be verified before it can be used. Complete verification in WhatsApp Manager.', { status: 400, stopCampaign: true }),
  134011: E(134011, 'ACCOUNT', 'WhatsApp Payments terms have not been accepted yet. Accept them in WhatsApp Manager.', { status: 402, stopCampaign: true }),
  131063: E(131063, 'ACCOUNT', 'Marketing templates are turned off for this WhatsApp configuration. Enable marketing messages in WhatsApp Manager.', { status: 403, stopCampaign: true }),

  // ── Recipient ─────────────────────────────────────────────
  131021: E(131021, 'RECIPIENT', 'You cannot send a message to your own business number.', { permanent: true }),
  131026: E(131026, 'RECIPIENT', 'This number cannot receive WhatsApp messages. It may not be on WhatsApp.', { permanent: true }),
  130403: E(130403, 'RECIPIENT', 'This person has blocked your business on WhatsApp.', { permanent: true }),
  131050: E(131050, 'RECIPIENT', 'This person opted out of marketing messages from your business.', { permanent: true }),
  131049: E(131049, 'RECIPIENT', 'WhatsApp did not deliver this to keep engagement healthy. Try again after 24 hours.', { retryable: false }),
  130472: E(130472, 'RECIPIENT', 'This message was held back because the recipient is part of a WhatsApp experiment.', { permanent: true }),

  // ── 24-hour window ────────────────────────────────────────
  131047: E(131047, 'WINDOW', 'This chat is outside the 24-hour messaging window. Send an approved template to reopen it.', { permanent: true }),

  // ── Template ──────────────────────────────────────────────
  132000: E(132000, 'TEMPLATE', 'This template expects a different number of values than were provided. Check the template variables.', { stopCampaign: true }),
  132001: E(132001, 'TEMPLATE', 'This template is not available in the selected language, or is not approved. Sync your templates and try again.', { stopCampaign: true }),
  132005: E(132005, 'TEMPLATE', 'The translated text for this template is too long. Shorten it in WhatsApp Manager.', { stopCampaign: true }),
  132007: E(132007, 'TEMPLATE', 'This template breaks WhatsApp policy and cannot be sent. Edit it and resubmit for review.', { status: 403, stopCampaign: true }),
  132012: E(132012, 'TEMPLATE', 'The values sent do not match what this template expects. Check the header and variable formats.', { stopCampaign: true }),
  132015: E(132015, 'TEMPLATE', 'This template is paused because of low quality. Improve it and resubmit for review.', { stopCampaign: true }),
  132016: E(132016, 'TEMPLATE', 'This template was permanently disabled after repeated quality issues. Create a new template.', { stopCampaign: true }),
  132018: E(132018, 'TEMPLATE', 'This template needs media that is missing. Re-upload the header file in Templates.', { stopCampaign: true }),
  132068: E(132068, 'TEMPLATE', 'The flow used by this template is blocked. Fix the flow before sending.', { stopCampaign: true }),
  132069: E(132069, 'TEMPLATE', 'This flow has been throttled after 10 messages in the past hour. Try again later.', { retryable: true, status: 429 }),
  2388019: E(2388019, 'TEMPLATE', 'You have reached the limit of 250 templates on this account. Delete unused templates first.', { stopCampaign: true }),
  2388039: E(2388039, 'TEMPLATE', 'This template is still under review and cannot be changed yet.', {}),
  2388040: E(2388040, 'TEMPLATE', 'A template field is longer than WhatsApp allows. Shorten it and try again.', {}),
  2388047: E(2388047, 'TEMPLATE', 'The template header formatting is not valid. Fix it and resubmit.', {}),
  2388072: E(2388072, 'TEMPLATE', 'The template body formatting is not valid. Fix it and resubmit.', {}),
  2388073: E(2388073, 'TEMPLATE', 'The template footer formatting is not valid. Fix it and resubmit.', {}),
  2388293: E(2388293, 'TEMPLATE', 'This template has too many variables for its length. Add more text or remove variables.', {}),
  2388299: E(2388299, 'TEMPLATE', 'Template variables cannot sit at the very start or end of the message. Move them inside the text.', {}),

  // ── Media ─────────────────────────────────────────────────
  131052: E(131052, 'MEDIA', 'WhatsApp could not download the media the customer sent. Ask them to send it again.', { permanent: true }),
  131053: E(131053, 'MEDIA', 'WhatsApp could not accept this media. Check that the file type and size are supported.', {}),

  // ── Message shape ─────────────────────────────────────────
  100: E(100, 'UNKNOWN', 'WhatsApp rejected one of the values in this request.', {}),
  131008: E(131008, 'UNKNOWN', 'A required value is missing from this request.', {}),
  131009: E(131009, 'UNKNOWN', 'One of the values in this request is not valid.', {}),
  131051: E(131051, 'UNKNOWN', 'This message type is not supported by WhatsApp.', { permanent: true }),
  135000: E(135000, 'UNKNOWN', 'WhatsApp rejected this message without giving a reason. This is usually an account or billing issue - check your WhatsApp account health in Settings.', {}),

  // ── Registration ──────────────────────────────────────────
  133000: E(133000, 'ACCOUNT', 'A previous deregistration did not finish. Deregister this number again before re-registering.', {}),
  133005: E(133005, 'ACCOUNT', 'The two-step verification PIN is incorrect.', {}),
  133008: E(133008, 'ACCOUNT', 'Too many incorrect PIN attempts. Please wait before trying again.', { status: 429, retryable: true }),
  133009: E(133009, 'ACCOUNT', 'The PIN was entered too soon. Please wait a moment and try again.', { status: 429, retryable: true }),
  133015: E(133015, 'ACCOUNT', 'This number was deleted very recently. Wait about 5 minutes and try again.', { retryable: true }),
  2388012: E(2388012, 'ACCOUNT', 'This phone number is already on the WhatsApp account. Use a different number.', {}),
};

/**
 * Kisi bhi Meta error object ka matlab nikalo.
 *
 * Ye kabhi null nahi lautata - unknown code par bhi ek dhang ka message
 * milta hai, taaki user ko "Request failed with status code 500" kabhi na
 * dikhe.
 */
export function describeMetaError(metaError: any): MetaErrorInfo & {
  raw: string | null;
  known: boolean;
} {
  const code = Number(metaError?.code);
  const subcode = Number(metaError?.error_subcode);

  const raw =
    metaError?.error_data?.details ||
    metaError?.error_user_msg ||
    metaError?.message ||
    null;

  // 100 / subcode 33 = "object does not exist" - alag matlab
  if (code === 100 && subcode === 33) {
    return {
      ...E(100, 'ACCOUNT', 'This WhatsApp number or account is no longer available. Please reconnect it in Settings.', { status: 400, stopCampaign: true }),
      raw,
      known: true,
    };
  }

  const known = META_ERRORS[code];
  if (known) {
    // Meta ne details bheja hai to wo zyada exact hota hai - use aage rakho,
    // par hamara actionable message bhi saath rakho.
    const message =
      raw && raw.toLowerCase() !== 'generic user error' && known.category === 'UNKNOWN'
        ? `${raw} ${known.message}`
        : known.message;

    return { ...known, message, raw, known: true };
  }

  // Bilkul naya code - Meta ka apna text dikhao, chupchap 500 mat do
  return {
    code: code || 0,
    category: 'UNKNOWN',
    message: raw
      ? `WhatsApp error: ${raw}`
      : 'WhatsApp rejected this request. Please try again, or contact support if it keeps happening.',
    status: 400,
    retryable: false,
    permanent: false,
    stopCampaign: false,
    raw,
    known: false,
  };
}

/** Campaign ke liye: is error par poori campaign rokni chahiye? */
export function shouldStopCampaign(metaError: any): boolean {
  return describeMetaError(metaError).stopCampaign === true;
}

/** Campaign ke liye: ye recipient hamesha fail rahega? (skip + refund) */
export function isPermanentFailure(metaError: any): boolean {
  return describeMetaError(metaError).permanent === true;
}

/** Dobara koshish karni chahiye? */
export function isRetryable(metaError: any): boolean {
  return describeMetaError(metaError).retryable === true;
}
