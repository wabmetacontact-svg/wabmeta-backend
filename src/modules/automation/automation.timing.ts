// src/modules/automation/automation.timing.ts
//
// Follow-up timing ke pure helpers - koi DB nahi, isliye seedhe test hote hain.

/** Isse chhota delay process ke andar hi wait ho jata hai; lamba delay job banta hai. */
export const INLINE_DELAY_MAX_MS = 30 * 1000;

const UNIT_MS: Record<string, number> = {
  seconds: 1000,
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
};

/**
 * `delay` action ka config ms me. Frontend `value` bhejta hai, purane
 * automations `duration` - dono chalte hain.
 */
export function delayToMs(config: any): number {
  const duration = Number(config?.duration ?? config?.value ?? 1);
  const unit = String(config?.unit || 'seconds').toLowerCase();
  const perUnit = UNIT_MS[unit] ?? UNIT_MS.seconds;
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return duration * perUnit;
}

/**
 * wait_for_response ka timeout ms me. `timeout` purana field hai (ms me);
 * `timeoutValue` + `timeoutUnit` builder ke liye.
 */
export function waitTimeoutMs(config: any): number | null {
  if (config?.timeoutValue !== undefined) {
    const ms = delayToMs({ value: config.timeoutValue, unit: config.timeoutUnit || 'hours' });
    return ms > 0 ? ms : null;
  }
  const raw = Number(config?.timeout);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** "21:30" -> 1290. Galat format par null. */
export function parseHHMM(value: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** `date` us timezone me din ka kaunsa minute hai (0-1439). */
export function minuteOfDayIn(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
}

/**
 * Agar `now` quiet hours ke andar hai to wo waqt lautata hai jab quiet hours
 * khatam honge; bahar hai (ya band hai / config galat hai) to null.
 * Raat paar karne wali window (21:00 -> 09:00) bhi sambhalta hai.
 */
export function quietHoursEndsAt(now: Date, qh: QuietHours | null | undefined): Date | null {
  if (!qh?.enabled) return null;
  const start = parseHHMM(qh.start);
  const end = parseHHMM(qh.end);
  if (start === null || end === null || start === end) return null;

  let current: number;
  try {
    current = minuteOfDayIn(now, qh.timezone || 'Asia/Kolkata');
  } catch {
    return null; // galat timezone string - rok mat do
  }

  const inside = start < end
    ? current >= start && current < end
    : current >= start || current < end;
  if (!inside) return null;

  const minutesLeft = (end - current + 1440) % 1440;
  const at = new Date(now.getTime() + minutesLeft * 60 * 1000);
  at.setUTCSeconds(0, 0);
  return at;
}

export interface WindowSource {
  windowExpiresAt?: Date | string | null;
  isWindowOpen?: boolean | null;
  lastCustomerMessageAt?: Date | string | null;
}

/**
 * WhatsApp ki 24 ghante wali window khuli hai ya nahi. whatsappService.sendMessage
 * wala hi niyam - band window par wo text/media ko 400 se rok deta hai, isliye
 * automation pehle hi pooch leti hai aur template par chali jati hai.
 */
export function isWindowOpen(conv: WindowSource | null | undefined, now: Date = new Date()): boolean {
  if (!conv) return false;
  if (conv.windowExpiresAt) return new Date(conv.windowExpiresAt).getTime() > now.getTime();
  if (conv.isWindowOpen === false) return false;
  if (conv.lastCustomerMessageAt) {
    return now.getTime() - new Date(conv.lastCustomerMessageAt).getTime() <= 24 * 60 * 60 * 1000;
  }
  return false;
}

/** Ye actions sirf khuli window me ja sakte hain - template nahi hain. */
export const FREE_FORM_ACTIONS = new Set([
  'send_text',
  'send_message',
  'send_buttons',
  'send_audio',
  'send_video',
  'send_image',
  'send_document',
]);

/** Retry ke beech ka intezar: 2, 4, 8 minute. */
export function retryBackoffMs(attempts: number): number {
  return Math.pow(2, Math.max(1, attempts)) * 60 * 1000;
}
