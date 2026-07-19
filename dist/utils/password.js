"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.needsRehash = exports.dummyComparePassword = exports.comparePassword = exports.hashPassword = void 0;
// src/utils/password.ts - FIXED
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// ✅ 12 rounds - OWASP recommended for 2024/2025
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const BCRYPT_TIMEOUT_MS = 10_000; // 10 seconds
// ✅ Dummy hash for timing-safe login (matches 12 rounds)
const DUMMY_HASH = '$2b$12$dummy.hash.for.timing.attack.prevention.only.notreal';
const hashPassword = async (password) => {
    if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
    }
    if (password.length > 128) {
        throw new Error('Password too long (max 128 chars)');
    }
    return bcryptjs_1.default.hash(password, SALT_ROUNDS);
};
exports.hashPassword = hashPassword;
const comparePassword = async (password, hash) => {
    if (!password || !hash) {
        return false;
    }
    // Validate hash format
    if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$') && !hash.startsWith('$2y$')) {
        console.error('❌ Invalid hash format');
        return false;
    }
    // Timeout wrapper
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            console.error(`❌ bcrypt timeout after ${BCRYPT_TIMEOUT_MS}ms`);
            resolve(false);
        }, BCRYPT_TIMEOUT_MS);
        bcryptjs_1.default.compare(password, hash)
            .then(result => {
            clearTimeout(timer);
            resolve(result);
        })
            .catch(err => {
            clearTimeout(timer);
            console.error('❌ bcrypt error:', err.message);
            resolve(false);
        });
    });
};
exports.comparePassword = comparePassword;
/**
 * ✅ NEW: Timing-safe dummy compare for non-existent users
 * Prevents user enumeration attacks
 */
const dummyComparePassword = async (password) => {
    await (0, exports.comparePassword)(password, DUMMY_HASH);
    return false;
};
exports.dummyComparePassword = dummyComparePassword;
const needsRehash = (hash) => {
    try {
        const rounds = bcryptjs_1.default.getRounds(hash);
        return rounds < SALT_ROUNDS;
    }
    catch {
        return false;
    }
};
exports.needsRehash = needsRehash;
//# sourceMappingURL=password.js.map