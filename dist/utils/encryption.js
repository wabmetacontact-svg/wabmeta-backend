"use strict";
// 📁 src/utils/encryption.ts - COMPLETE FIXED VERSION
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEncryptionKey = validateEncryptionKey;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.safeDecrypt = safeDecrypt;
exports.safeDecryptStrict = safeDecryptStrict;
exports.isMetaToken = isMetaToken;
exports.maskToken = maskToken;
exports.isEncrypted = isEncrypted;
exports.encryptIfNeeded = encryptIfNeeded;
exports.hashSHA256 = hashSHA256;
exports.hmacSHA256 = hmacSHA256;
exports.generateSecureToken = generateSecureToken;
exports.secureCompare = secureCompare;
exports.verifyWebhookSignature = verifyWebhookSignature;
exports.generateApiKeyPair = generateApiKeyPair;
exports.hashApiSecret = hashApiSecret;
exports.verifyApiSecret = verifyApiSecret;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
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
const getEncryptionKey = () => {
    const key = config_1.config.encryptionKey || config_1.config.encryption?.key;
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
    const salt = crypto_1.default.createHash('sha256').update('wabmeta-salt').digest();
    return crypto_1.default.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, 'sha512');
};
/**
 * Validate encryption key
 */
function validateEncryptionKey() {
    try {
        getEncryptionKey();
        return true;
    }
    catch {
        return false;
    }
}
// ============================================
// ENCRYPTION FUNCTIONS
// ============================================
/**
 * Encrypt a string value
 */
function encrypt(text) {
    if (!text) {
        throw new Error('Cannot encrypt empty value');
    }
    try {
        const key = getEncryptionKey();
        const iv = crypto_1.default.randomBytes(IV_LENGTH);
        const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        // Format: iv:authTag:encrypted (all hex)
        const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
        return result;
    }
    catch (error) {
        console.error('Encryption error:', error.message);
        throw new Error('Encryption failed');
    }
}
/**
 * Decrypt an encrypted string
 */
function decrypt(encryptedText) {
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
        const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (error) {
        console.error('Decryption error:', error.message);
        return null;
    }
}
/**
 * Safe decrypt - returns null instead of throwing
 */
function safeDecrypt(encryptedText) {
    try {
        return decrypt(encryptedText);
    }
    catch {
        return null;
    }
}
/**
 * Strict decrypt - only returns valid Meta tokens
 */
function safeDecryptStrict(encryptedText) {
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
function isMetaToken(value) {
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
function maskToken(token) {
    if (!token)
        return '[null]';
    if (token.length <= 20) {
        return `${token.substring(0, 4)}****`;
    }
    return `${token.substring(0, 8)}...${token.substring(token.length - 8)}`;
}
/**
 * Check if a string is encrypted (our format)
 */
function isEncrypted(value) {
    if (!value || typeof value !== 'string') {
        return false;
    }
    const parts = value.split(':');
    if (parts.length !== 3) {
        return false;
    }
    const [ivHex, authTagHex, encrypted] = parts;
    const isHex = (str) => /^[0-9a-fA-F]+$/.test(str);
    return (ivHex.length === IV_LENGTH * 2 &&
        authTagHex.length === AUTH_TAG_LENGTH * 2 &&
        isHex(ivHex) &&
        isHex(authTagHex) &&
        isHex(encrypted) &&
        encrypted.length > 0);
}
/**
 * Encrypt if not already encrypted
 */
function encryptIfNeeded(text) {
    if (isEncrypted(text)) {
        return text;
    }
    return encrypt(text);
}
// ============================================
// HASHING FUNCTIONS
// ============================================
function hashSHA256(value) {
    return crypto_1.default.createHash('sha256').update(value).digest('hex');
}
function hmacSHA256(value, secret) {
    return crypto_1.default.createHmac('sha256', secret).update(value).digest('hex');
}
function generateSecureToken(length = 32) {
    return crypto_1.default.randomBytes(length).toString('hex');
}
function secureCompare(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
// ============================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================
function verifyWebhookSignature(payload, signature, appSecret) {
    if (!payload || !signature || !appSecret) {
        return false;
    }
    try {
        const expectedSignature = `sha256=${hmacSHA256(payload, appSecret)}`;
        return secureCompare(signature, expectedSignature);
    }
    catch {
        return false;
    }
}
// ============================================
// API KEY GENERATION
// ============================================
function generateApiKeyPair() {
    const key = `wm_${generateSecureToken(16)}`;
    const secret = generateSecureToken(32);
    return { key, secret };
}
function hashApiSecret(secret) {
    return hashSHA256(secret);
}
function verifyApiSecret(secret, hash) {
    const computedHash = hashSHA256(secret);
    return secureCompare(computedHash, hash);
}
// ============================================
// EXPORTS
// ============================================
exports.default = {
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
//# sourceMappingURL=encryption.js.map