// src/utils/jwt.ts - FIXED
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { config } from '../config';

export interface TokenPayload {
  userId:          string;
  email:           string;
  organizationId?: string;
  tokenVersion:    number;   // ✅ Required now (not optional)
  type:            'access' | 'refresh';
  iat?:            number;
  exp?:            number;
}

// ─── Helper: Parse expiry ────────────────────────────────
const getExpirySeconds = (expiryString: string): number => {
  const match = expiryString.match(/^(\d+)([smhdw])$/);
  if (!match) return 7 * 24 * 60 * 60;

  const value = parseInt(match[1], 10);
  const unit  = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    case 'w': return value * 7 * 24 * 60 * 60;
    default:  return 7 * 24 * 60 * 60;
  }
};

// ─── Generate Access Token ──────────────────────────────
export const generateAccessToken = (
  payload: Omit<TokenPayload, 'type' | 'iat' | 'exp'>
): string => {
  const secret: Secret = config.jwt.secret;
  const options: SignOptions = {
    expiresIn: getExpirySeconds(config.jwt.accessExpiresIn),
    issuer:    'wabmeta',        // ✅ Add issuer
    audience:  'wabmeta-users',  // ✅ Add audience
  };

  return jwt.sign({ ...payload, type: 'access' }, secret, options);
};

// ─── Generate Refresh Token ─────────────────────────────
export const generateRefreshToken = (
  payload: Omit<TokenPayload, 'type' | 'iat' | 'exp'>
): string => {
  const secret: Secret = config.jwt.refreshSecret;
  const options: SignOptions = {
    expiresIn: getExpirySeconds(config.jwt.refreshExpiresIn),
    issuer:    'wabmeta',
    audience:  'wabmeta-refresh',
  };

  return jwt.sign({ ...payload, type: 'refresh' }, secret, options);
};

// ─── Verify Access Token (with type check) ──────────────
export const verifyAccessToken = (token: string): TokenPayload => {
  const secret: Secret = config.jwt.secret;

  const payload = jwt.verify(token, secret, {
    issuer:   'wabmeta',
    audience: 'wabmeta-users',
  }) as TokenPayload;

  // ✅ CRITICAL: Verify token type
  if (payload.type !== 'access') {
    throw new Error('Invalid token type - expected access token');
  }

  return payload;
};

// ─── Verify Refresh Token (with type check) ─────────────
export const verifyRefreshToken = (token: string): TokenPayload => {
  const secret: Secret = config.jwt.refreshSecret;

  const payload = jwt.verify(token, secret, {
    issuer:   'wabmeta',
    audience: 'wabmeta-refresh',
  }) as TokenPayload;

  // ✅ CRITICAL: Verify token type
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type - expected refresh token');
  }

  return payload;
};

// ─── Generate both tokens ───────────────────────────────
export const generateTokens = (
  payload: Omit<TokenPayload, 'type' | 'iat' | 'exp'>
) => ({
  accessToken:  generateAccessToken(payload),
  refreshToken: generateRefreshToken(payload),
});

// ─── Decode without verify (debugging only) ─────────────
export const decodeToken = (token: string): TokenPayload | null => {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
};

// ─── Parse expiry to ms ─────────────────────────────────
export const parseExpiryTime = (expiryString: string): number =>
  getExpirySeconds(expiryString) * 1000;

// ─── Get expiry Date ────────────────────────────────────
export const getTokenExpiry = (expiryString: string): Date =>
  new Date(Date.now() + parseExpiryTime(expiryString));

// ─── Check expiry ───────────────────────────────────────
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded?.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
};

// ─── Get remaining time ─────────────────────────────────
export const getTokenRemainingTime = (token: string): number => {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded?.exp) return 0;
    return Math.max(0, decoded.exp * 1000 - Date.now());
  } catch {
    return 0;
  }
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokens,
  decodeToken,
  parseExpiryTime,
  getTokenExpiry,
  isTokenExpired,
  getTokenRemainingTime,
};