// src/utils/cookies.ts - FIXED
import { config } from '../config';

const isProd = config.nodeEnv === 'production';

/**
 * Cookie options for auth tokens
 *
 * Both tokens are httpOnly. The access-token cookie used to be readable by JS
 * "so the client could build the Authorization header" - but the web app never
 * reads it: it keeps its own copy in localStorage (services/api.ts) and these
 * cookies are only ever consumed server-side by middleware/auth.ts. Leaving it
 * readable just handed any XSS a live token.
 *
 * sameSite=none is required because the API and the app are on different
 * domains. That makes the CORS allowlist in app.ts the only thing standing
 * between a hostile page and an authenticated request - keep it exact.
 */
export const getCookieOptions = (isRefresh: boolean = false) => ({
  httpOnly: true,
  secure:   isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  maxAge:   isRefresh
    ? 7 * 24 * 60 * 60 * 1000   // 7 days for refresh
    : 15 * 60 * 1000,            // 15 min for access
  path:     '/',
  // Don't set domain in production - lets browser handle cross-domain properly
});

/**
 * Options for clearing cookies (must match set options except maxAge)
 */
export const getClearCookieOptions = (_isRefresh: boolean = false) => ({
  httpOnly: true,
  secure:   isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  path:     '/',
});

export default { getCookieOptions, getClearCookieOptions };