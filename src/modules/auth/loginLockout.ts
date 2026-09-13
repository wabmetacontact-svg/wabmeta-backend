// src/modules/auth/loginLockout.ts
//
// Per-account login lockout.
//
// Login par sirf IP rate limit tha (auth.routes.ts). Wo ek IP se aane wale
// attempts rokta hai - alag-alag IPs se ek hi account par brute force bilkul
// nahi rokta, aur botnet ke liye IP rotate karna sasta hai. Ye counter account
// par chalta hai, isliye source address badalne se koi fayda nahi hota.
//
// Counter DB me hai (User.failedLoginAttempts / lockedUntil), memory store me
// nahi - warna deploy ya restart har attacker ko saaf slate de deta.

/** Itni galat koshishon ke baad account band. */
export const MAX_FAILED_ATTEMPTS = 8;

/** Band hone ke baad kitni der. */
export const LOCKOUT_MINUTES = 15;

/**
 * Purani failure ke baad itni der tak koshish na ho to counter khud reset.
 * Iske bina mahine bhar me 8 baar galti karne wala genuine user bhi lock ho
 * jata.
 */
export const ATTEMPT_WINDOW_MINUTES = 60;

export interface LockoutState {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  /** Aakhri failure kab hui - window reset ke liye. */
  lastFailedAt?: Date | null;
}

/** Account abhi locked hai ya nahi, aur kitni der bachi hai. */
export const lockStatus = (
  user: Pick<LockoutState, 'lockedUntil'>,
  now: Date = new Date()
): { locked: boolean; secondsRemaining: number } => {
  if (!user.lockedUntil) return { locked: false, secondsRemaining: 0 };
  const ms = new Date(user.lockedUntil).getTime() - now.getTime();
  if (ms <= 0) return { locked: false, secondsRemaining: 0 };
  return { locked: true, secondsRemaining: Math.ceil(ms / 1000) };
};

/**
 * Ek galat password ke baad naya state.
 *
 * `lastFailedAt` purana ho (window ke bahar) to ginti 1 se shuru hoti hai.
 */
export const nextStateAfterFailure = (
  user: LockoutState,
  now: Date = new Date()
): { failedLoginAttempts: number; lockedUntil: Date | null } => {
  const windowMs = ATTEMPT_WINDOW_MINUTES * 60 * 1000;
  const last = user.lastFailedAt ? new Date(user.lastFailedAt).getTime() : 0;
  const withinWindow = last > 0 && now.getTime() - last <= windowMs;

  const attempts = (withinWindow ? user.failedLoginAttempts || 0 : 0) + 1;

  if (attempts >= MAX_FAILED_ATTEMPTS) {
    return {
      failedLoginAttempts: attempts,
      lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000),
    };
  }

  return { failedLoginAttempts: attempts, lockedUntil: null };
};

/** Kamyab login ke baad counter saaf. */
export const clearedState = () => ({
  failedLoginAttempts: 0,
  lockedUntil: null,
});

/** User ko dikhane wala message - kitni der bachi hai, minute me. */
export const lockoutMessage = (secondsRemaining: number): string => {
  const minutes = Math.max(1, Math.ceil(secondsRemaining / 60));
  return `Too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`;
};
