"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.timingSafeEqual = exports.generateSlug = exports.hashToken = exports.generateToken = exports.generateOTP = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * ✅ Cryptographically secure OTP generation
 */
const generateOTP = (length = 6) => {
    if (length < 4 || length > 10) {
        throw new Error('OTP length must be between 4 and 10');
    }
    const buf = crypto_1.default.randomBytes(length);
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += buf[i] % 10;
    }
    return otp;
};
exports.generateOTP = generateOTP;
/**
 * ✅ Cryptographically secure token generation
 */
const generateToken = (bytes = 32) => {
    if (bytes < 16 || bytes > 128) {
        throw new Error('Token bytes must be between 16 and 128');
    }
    return crypto_1.default.randomBytes(bytes).toString('hex');
};
exports.generateToken = generateToken;
/**
 * ✅ Hash token for DB storage (never store raw tokens)
 */
const hashToken = (token) => {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
};
exports.hashToken = hashToken;
/**
 * Generate URL-safe slug
 */
const generateSlug = (name) => {
    const base = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 40);
    const suffix = crypto_1.default.randomBytes(4).toString('hex');
    return `${base}-${suffix}`;
};
exports.generateSlug = generateSlug;
/**
 * ✅ Timing-safe string comparison
 */
const timingSafeEqual = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string')
        return false;
    if (a.length !== b.length)
        return false;
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    }
    catch {
        return false;
    }
};
exports.timingSafeEqual = timingSafeEqual;
//# sourceMappingURL=otp.js.map