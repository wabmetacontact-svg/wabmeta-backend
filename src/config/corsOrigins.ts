// src/config/corsOrigins.ts
//
// Kaunsa browser origin API call kar sakta hai.
//
// Ye faisla is codebase ka sabse nazuk faisla hai: cookies SameSite=none par
// hain aur CORS credentials: true hai, to yahan galat "haan" ka matlab hai ki
// wo page logged-in user ke cookies ke saath API padh sakta hai. Pehle yahan
// `origin.endsWith('.vercel.app')` tha, yaani duniya ka koi bhi Vercel page.
//
// Isliye ye logic app.ts se nikal kar alag file me hai aur test hota hai.

export interface CorsPolicy {
  /** Poore origin, exact match. */
  allowed: string[];
  /** Vercel preview origins ke liye anchored regex (ya null). */
  vercelPattern: RegExp | null;
  /** Development me sab allowed. */
  isDevelopment: boolean;
}

/** Regex me literal treat karne ke liye special characters escape. */
const escapeForRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Vercel preview origin ka regex, team slug ke saath.
 *
 * Team slug zaroori hai. Sirf project name se banaya gaya pattern surakshit
 * nahi hai - Vercel par koi bhi `wabmeta-anything` naam ka project bana kar
 * us prefix se match kar sakta hai. Team slug tumhare account ka hai.
 *
 * Shape: https://<project>-<deployment hash>-<team>.vercel.app
 */
export const buildVercelPattern = (
  project: string,
  team: string
): RegExp | null => {
  const p = (project || '').trim().toLowerCase();
  const t = (team || '').trim().toLowerCase();
  if (!p || !t) return null;

  return new RegExp(
    '^https://' +
      escapeForRegex(p) +
      '-[a-z0-9-]+-' +
      escapeForRegex(t) +
      '\\.vercel\\.app$'
  );
};

/**
 * Haath se likha hua pattern - sirf tab jab dono taraf anchored ho.
 *
 * Bina anchor ka pattern kahin bhi match kar jata hai: `wabmeta-.*\.vercel\.app`
 * par `https://evil-wabmeta-x.vercel.app` bhi pass ho jata hai. Aisa pattern
 * lene se behtar hai na lena.
 */
export const parseVercelPattern = (raw: string | undefined): RegExp | null => {
  const value = (raw || '').trim();
  if (!value) return null;

  if (!value.startsWith('^') || !value.endsWith('$')) {
    console.error(
      '🚨 CORS_VERCEL_PATTERN must be anchored with ^ and $ or it matches far more than you think - ignoring it'
    );
    return null;
  }

  try {
    return new RegExp(value);
  } catch {
    console.error('🚨 CORS_VERCEL_PATTERN is not a valid regex - ignoring it');
    return null;
  }
};

/** Ek origin allowed hai ya nahi. */
export const isAllowedOrigin = (
  origin: string | undefined,
  policy: CorsPolicy
): boolean => {
  // Origin header hi nahi - mobile app, curl, server-to-server. Browser
  // hamesha origin bhejta hai, to ye cross-site attack ka rasta nahi hai.
  if (!origin) return true;

  if (policy.isDevelopment) return true;
  if (policy.allowed.includes(origin)) return true;
  if (policy.vercelPattern?.test(origin)) return true;

  return false;
};

export default { buildVercelPattern, parseVercelPattern, isAllowedOrigin };
