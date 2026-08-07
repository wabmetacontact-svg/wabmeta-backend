// src/utils/jwt.ts - PRODUCTION FIX
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { config } from '../config';

export interface TokenPayload {
  userId:          string;
  email:           string;
  organizationId?: string;
  tokenVersion:    number;
  type:            'access' | 'refresh';
  iat?:            number;
  exp?:            number;
}

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

export const generateAccessToken = (
  payload: Omit<TokenPayload, 'type' | 'iat' | 'exp'>
): string => {
  // ✅ FIX: JWT_ACCESS_SECRET use karo agar available ho
  const secret: Secret = config.jwt.accessSecret || config.jwt.secret;
  const options: SignOptions = {
    expiresIn: getExpirySeconds(config.jwt.accessExpiresIn),
    // ✅ NO issuer/audience - backward compatible
  };
  return jwt.sign({ ...payload, type: 'access' }, secret, options);
};

export const generateRefreshToken = (
  payload: Omit<TokenPayload, 'type' | 'iat' | 'exp'>
): string => {
  const secret: Secret = config.jwt.refreshSecret || config.jwt.secret;
  const options: SignOptions = {
    expiresIn: getExpirySeconds(config.jwt.refreshExpiresIn),
    // ✅ NO issuer/audience - backward compatible
  };
  return jwt.sign({ ...payload, type: 'refresh' }, secret, options);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  // ✅ FIX: Try multiple secrets for backward compatibility
  const secrets = [
    config.jwt.accessSecret,
    config.jwt.secret,
  ].filter(Boolean);

  let lastError: any;
  
  for (const secret of secrets) {
    try {
      // ✅ NO issuer/audience check - purane tokens ke saath compatible
      const payload = jwt.verify(token, secret as Secret) as TokenPayload;
      
      if (payload.type && payload.type !== 'access') {
        throw new Error('Invalid token type');
      }
      
      return payload;
    } catch (err: any) {
      lastError = err;
      // TokenExpiredError pe retry mat karo - ye actual expiry hai
      if (err.name === 'TokenExpiredError') throw err;
      // Agar secret mismatch hai toh next secret try karo
      continue;
    }
  }
  
  throw lastError;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  const secrets = [
    config.jwt.refreshSecret,
    config.jwt.secret,
  ].filter(Boolean);

  let lastError: any;
  
  for (const secret of secrets) {
    try {
      const payload = jwt.verify(token, secret as Secret) as TokenPayload;
      
      if (payload.type && payload.type !== 'refresh') {
        // ✅ Purane tokens mein type field nahi tha - allow karo
        if (payload.type !== undefined) {
          throw new Error('Invalid token type');
        }
      }
      
      return payload;
    } catch (err: any) {
      lastError = err;
      if (err.name === 'TokenExpiredError') throw err;
      continue;
    }
  }
  
  throw lastError;
};

export const generateTokens = (
  payload: Omit<TokenPayload, 'type' | 'iat' | 'exp'>
) => ({
  accessToken:  generateAccessToken(payload),
  refreshToken: generateRefreshToken(payload),
});

export const decodeToken = (token: string): TokenPayload | null => {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
};

export const parseExpiryTime = (expiryString: string): number =>
  getExpirySeconds(expiryString) * 1000;

export const getTokenExpiry = (expiryString: string): Date =>
  new Date(Date.now() + parseExpiryTime(expiryString));

export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded?.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
};

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