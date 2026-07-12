// src/utils/cookies.ts
// ✅ NEW FILE — single source of truth for cookie options
// Fixes: SameSite/Secure mismatch between middleware/auth.ts and auth.controller.ts

import { config } from '../config';

const isProd = config.nodeEnv === 'production';

// Frontend (wabmeta.com) and backend (onrender.com) are cross-domain in prod.
// Cross-site cookies REQUIRE SameSite=None + Secure=true or the browser drops them silently.
export const getCookieOptions = (isRefresh: boolean = false) => ({
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: isRefresh ? 7 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000, // access cookie now matches 15m JWT expiry
    path: '/',
    // ✅ KEY FIX: Domain mat set karo cross-domain ke liye
    // domain set karne se browser BLOCK karta hai
});

// IMPORTANT: clear options must match the attributes used when the cookie was SET
// (no maxAge on clear, but same httpOnly/secure/sameSite/path)
export const getClearCookieOptions = () => ({
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
});

export default { getCookieOptions, getClearCookieOptions };