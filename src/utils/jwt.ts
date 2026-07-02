// src/utils/jwt.ts
// ✅ FIXED: generateAccessToken was using config.jwt.expiresIn (7d) instead of
// config.jwt.accessExpiresIn (15m) — access tokens were living 7 days instead of 15 minutes.

import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { config } from '../config';

export interface TokenPayload {
  userId: string;
  email: string;
  organizationId?: string;
  tokenVersion?: number;
  type?: 'access' | 'refresh';
}

// Helper to get expiry in seconds
const getExpirySeconds = (expiryString: string): number => {
  const match = expiryString.match(/^(\d+)([smhdw])$/);

  if (!match) {
    // Default to 7 days in seconds
    return 7 * 24 * 60 * 60;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    case 'w': return value * 7 * 24 * 60 * 60;
    default: return 7 * 24 * 60 * 60;
  }
};

// Generate Access Token
export const generateAccessToken = (payload: Omit<TokenPayload, 'type'>): string => {
  const secret: Secret = config.jwt.secret;
  const options: SignOptions = {
    // ✅ FIX: use accessExpiresIn (15m), NOT expiresIn (7d)
    expiresIn: getExpirySeconds(config.jwt.accessExpiresIn),
  };

  return jwt.sign(
    { tokenVersion: 0, ...payload, type: 'access' },
    secret,
    options
  );
};

// Generate Refresh Token
export const generateRefreshToken = (payload: Omit<TokenPayload, 'type'>): string => {
  const secret: Secret = config.jwt.refreshSecret;
  const options: SignOptions = {
    expiresIn: getExpirySeconds(config.jwt.refreshExpiresIn),
  };

  return jwt.sign(
    { tokenVersion: 0, ...payload, type: 'refresh' },
    secret,
    options
  );
};

// Verify Access Token
export const verifyAccessToken = (token: string): TokenPayload => {
  const secret: Secret = config.jwt.secret;
  return jwt.verify(token, secret) as TokenPayload;
};

// Verify Refresh Token
export const verifyRefreshToken = (token: string): TokenPayload => {
  const secret: Secret = config.jwt.refreshSecret;
  return jwt.verify(token, secret) as TokenPayload;
};

// Generate both tokens
export const generateTokens = (payload: Omit<TokenPayload, 'type'>) => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

// Decode token without verification (for debugging)
export const decodeToken = (token: string): TokenPayload | null => {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
};

// Parse expiry time string to milliseconds
export const parseExpiryTime = (expiryString: string): number => {
  return getExpirySeconds(expiryString) * 1000;
};

// Get expiry date from expiry string
export const getTokenExpiry = (expiryString: string): Date => {
  const ms = parseExpiryTime(expiryString);
  return new Date(Date.now() + ms);
};

// Check if token is expired
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded || !decoded.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
};

// Get remaining time in milliseconds
export const getTokenRemainingTime = (token: string): number => {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded || !decoded.exp) return 0;
    const remaining = decoded.exp * 1000 - Date.now();
    return remaining > 0 ? remaining : 0;
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