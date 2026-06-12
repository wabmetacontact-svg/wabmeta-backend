// 📁 src/utils/encryption.ts - COMPLETE FIXED VERSION

import crypto from 'crypto';
import { config } from '../config';

// ============================================
// CONFIGURATION
// ============================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from config
 */
const getEncryptionKey = (): Buffer => {
  const key = config.encryptionKey || config.encryption?.key;

  if (!key) {
    throw new Error('ENCRYPTION_KEY is not configured in environment');
  }

  // If key is hex string (64 chars = 32 bytes)
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }

  // If key is exactly 32 bytes
  if (key.length === 32) {
    return Buffer.from(key, 'utf8');
  }

  // Derive key from password
  const salt = crypto.createHash('sha256').update('wabmeta-salt').digest();
  return crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, 'sha512');
};

/**
 * Validate encryption key
 */
export function validateEncryptionKey(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

// ============================================
// ENCRYPTION FUNCTIONS
// ============================================

/**
 * Encrypt a string value
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('Cannot encrypt empty value');
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted (all hex)
    const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

    return result;
  } catch (error: any) {
    console.error('Encryption error:', error.message);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt an encrypted string
 */
export function decrypt(encryptedText: string): string | null {
  if (!encryptedText) {
    return null;
  }

  try {
    // Check if it's already a plain Meta token (not encrypted)
    if (isMetaToken(encryptedText)) {
      console.warn('⚠️ Token is not encrypted, returning as-is');
      return encryptedText;
    }

    const key = getEncryptionKey();

    // Parse format: iv:authTag:encrypted
    const parts = encryptedText.split(':');

    if (parts.length !== 3) {
      console.error('Invalid encrypted format: expected iv:authTag:encrypted');
      return null;
    }

    const [ivHex, authTagHex, encrypted] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== IV_LENGTH) {
      console.error('Invalid IV length');
      return null;
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      console.error('Invalid auth tag length');
      return null;
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error: any) {
    console.error('Decryption error:', error.message);
    return null;
  }
}

/**
 * Safe decrypt - returns null instead of throwing
 */
export function safeDecrypt(encryptedText: string): string | null {
  try {
    return decrypt(encryptedText);
  } catch {
    return null;
  }
}

/**
 * Strict decrypt - only returns valid Meta tokens
 */
export function safeDecryptStrict(encryptedText: string): string | null {
  const decrypted = safeDecrypt(encryptedText);

  if (!decrypted) {
    return null;
  }

  // Verify it's a valid Meta token
  if (!isMetaToken(decrypted)) {
    console.error('Decrypted value is not a valid Meta token');
    return null;
  }

  return decrypted;
}

// ============================================
// TOKEN VALIDATION HELPERS
// ============================================

/**
 * Check if a string is a Meta access token
 */
export function isMetaToken(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Meta tokens start with EAA (Extended Access Token)
  const isValidFormat = value.startsWith('EAA');
  const isValidLength = value.length >= 50 && value.length <= 500;

  // Meta tokens are alphanumeric with some special chars (like | in system/app tokens)
  const hasValidChars = /^[A-Za-z0-9_\-|]+$/.test(value);

  return isValidFormat && isValidLength && hasValidChars;
}

/**
 * Mask a token for logging
 */
export function maskToken(token: string): string {
  if (!token) return '[null]';

  if (token.length <= 20) {
    return `${token.substring(0, 4)}****`;
  }

  return `${token.substring(0, 8)}...${token.substring(token.length - 8)}`;
}

/**
 * Check if a string is encrypted (our format)
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const parts = value.split(':');

  if (parts.length !== 3) {
    return false;
  }

  const [ivHex, authTagHex, encrypted] = parts;

  const isHex = (str: string) => /^[0-9a-fA-F]+$/.test(str);

  return (
    ivHex.length === IV_LENGTH * 2 &&
    authTagHex.length === AUTH_TAG_LENGTH * 2 &&
    isHex(ivHex) &&
    isHex(authTagHex) &&
    isHex(encrypted) &&
    encrypted.length > 0
  );
}

/**
 * Encrypt if not already encrypted
 */
export function encryptIfNeeded(text: string): string {
  if (isEncrypted(text)) {
    return text;
  }
  return encrypt(text);
}

// ============================================
// HASHING FUNCTIONS
// ============================================

export function hashSHA256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hmacSHA256(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ============================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  if (!payload || !signature || !appSecret) {
    return false;
  }

  try {
    const expectedSignature = `sha256=${hmacSHA256(payload, appSecret)}`;
    return secureCompare(signature, expectedSignature);
  } catch {
    return false;
  }
}

// ============================================
// API KEY GENERATION
// ============================================

export function generateApiKeyPair(): { key: string; secret: string } {
  const key = `wm_${generateSecureToken(16)}`;
  const secret = generateSecureToken(32);

  return { key, secret };
}

export function hashApiSecret(secret: string): string {
  return hashSHA256(secret);
}

export function verifyApiSecret(secret: string, hash: string): boolean {
  const computedHash = hashSHA256(secret);
  return secureCompare(computedHash, hash);
}

// ============================================
// EXPORTS
// ============================================

export default {
  encrypt,
  decrypt,
  safeDecrypt,
  safeDecryptStrict,
  isMetaToken,
  maskToken,
  isEncrypted,
  encryptIfNeeded,
  validateEncryptionKey,
  hashSHA256,
  hmacSHA256,
  generateSecureToken,
  secureCompare,
  verifyWebhookSignature,
  generateApiKeyPair,
  hashApiSecret,
  verifyApiSecret,
};