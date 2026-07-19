// src/utils/cookies.ts - FIXED
import { config } from '../config';

const isProd = config.nodeEnv === 'production';

/**
 * Cookie options for auth tokens
 * 
 * ✅ Refresh Token: httpOnly=true (JS can't access, secure from XSS)
 * ✅ Access Token: httpOnly=false (JS needs to read for Authorization header)
 * ✅ Both: secure=true in prod, sameSite=none for cross-domain
 */
export const getCookieOptions = (isRefresh: boolean = false) => ({
  // ✅ FIX: Only refresh token should be httpOnly
  httpOnly: isRefresh,
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
export const getClearCookieOptions = (isRefresh: boolean = false) => ({
  httpOnly: isRefresh,
  secure:   isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  path:     '/',
});

export default { getCookieOptions, getClearCookieOptions };