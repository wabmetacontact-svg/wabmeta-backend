"use strict";
// src/utils/password.ts - FIXED
// ✅ FIX 1: SALT_ROUNDS 12→10 (Render free tier pe 12 = too slow)
// ✅ FIX 2: comparePassword timeout protection added
// ✅ FIX 3: Hash validation before compare (corrupt hash se crash nahi hoga)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.needsRehash = exports.comparePassword = exports.hashPassword = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// ✅ 10 rounds = still secure + 4x faster than 12 on slow CPU
// 12 rounds = ~2500ms on Render free, 10 rounds = ~400ms
const SALT_ROUNDS = 10;
// ✅ Max time bcrypt ko denge
const BCRYPT_TIMEOUT_MS = 8000; // 8 seconds
const hashPassword = async (password) => {
    if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
    }
    return bcryptjs_1.default.hash(password, SALT_ROUNDS);
};
exports.hashPassword = hashPassword;
const comparePassword = async (password, hash) => {
    // ✅ Guard: Dono values honi chahiye
    if (!password || !hash) {
        console.warn('⚠️  comparePassword: empty password or hash');
        return false;
    }
    // ✅ Guard: Valid bcrypt hash format check ($2a$ or $2b$)
    if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
        console.error('❌ comparePassword: Invalid hash format detected');
        return false;
    }
    // ✅ Timeout wrapper - agar bcrypt hang ho jaye toh false return karo
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            console.error('❌ bcrypt.compare timed out after', BCRYPT_TIMEOUT_MS, 'ms');
            resolve(false);
        }, BCRYPT_TIMEOUT_MS);
        bcryptjs_1.default
            .compare(password, hash)
            .then((result) => {
            clearTimeout(timer);
            resolve(result);
        })
            .catch((err) => {
            clearTimeout(timer);
            console.error('❌ bcrypt.compare error:', err.message);
            resolve(false);
        });
    });
};
exports.comparePassword = comparePassword;
// ✅ Utility: Check if rehash needed (old 12-round hashes)
const needsRehash = (hash) => {
    try {
        const rounds = bcryptjs_1.default.getRounds(hash);
        return rounds !== SALT_ROUNDS;
    }
    catch {
        return false;
    }
};
exports.needsRehash = needsRehash;
//# sourceMappingURL=password.js.map