// src/modules/admin/admin.security.ts
//
// Admin sign-in hardening: TOTP second factor, per-account lockout, and a
// token that can only ever be used on the admin API.
//
// TOTP is RFC 6238 (SHA-1, 6 digits, 30 s) - what Google Authenticator,
// Authy and 1Password expect. It is small enough to implement here rather
// than add a dependency for it.

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

// ─── TOTP ──────────────────────────────────────────────────────────────────

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const base32Encode = (buf: Buffer): string => {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
};

export const base32Decode = (input: string): Buffer => {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

export const generateTotpSecret = (): string => base32Encode(crypto.randomBytes(20));

const STEP_SECONDS = 30;

/** The code for one 30-second step. `digits` is 6 everywhere except tests. */
export const totpCode = (key: Buffer, counter: number, digits = 6): string => {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
};

/**
 * Accept the current code and one step either side, to forgive a phone
 * clock that is a few seconds off.
 */
export const verifyTotp = (secretBase32: string, code: string, now = Date.now()): boolean => {
  const clean = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;

  const key = base32Decode(secretBase32);
  const counter = Math.floor(now / 1000 / STEP_SECONDS);

  for (const drift of [-1, 0, 1]) {
    const expected = totpCode(key, counter + drift);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return true;
  }
  return false;
};

export const otpauthUrl = (secretBase32: string, email: string): string => {
  const issuer = 'WabMeta Admin';
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
};

// ─── Lockout ───────────────────────────────────────────────────────────────

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

/** After this failure, should the account lock, and until when. */
export const lockAfterFailure = (
  failedAttemptsBefore: number,
  now = new Date()
): { attempts: number; lockedUntil: Date | null } => {
  const attempts = failedAttemptsBefore + 1;
  if (attempts < MAX_FAILED_LOGINS) return { attempts, lockedUntil: null };
  return { attempts: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) };
};

// ─── Tokens ────────────────────────────────────────────────────────────────

/**
 * Admin tokens carry their own audience, so a token signed for the admin API
 * is rejected everywhere else and a user token is rejected here - even though
 * both may share a signing secret. ADMIN_JWT_SECRET, when set, separates the
 * secrets as well.
 */
export const ADMIN_AUDIENCE = 'wabmeta-admin';
export const ADMIN_TOKEN_TTL = '12h';

const adminSecret = (): string => process.env.ADMIN_JWT_SECRET || config.jwt.secret;

export const signAdminToken = (payload: { adminId: string; email: string; role: string }): string =>
  jwt.sign(payload, adminSecret(), { expiresIn: ADMIN_TOKEN_TTL, audience: ADMIN_AUDIENCE });

export const verifyAdminToken = (token: string) =>
  jwt.verify(token, adminSecret(), { audience: ADMIN_AUDIENCE }) as {
    adminId: string;
    email: string;
    role: string;
  };
