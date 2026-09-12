"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenRemainingTime = exports.isTokenExpired = exports.getTokenExpiry = exports.parseExpiryTime = exports.decodeToken = exports.generateTokens = exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
// src/utils/jwt.ts - PRODUCTION FIX
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const config_1 = require("../config");
const getExpirySeconds = (expiryString) => {
    const match = expiryString.match(/^(\d+)([smhdw])$/);
    if (!match)
        return 7 * 24 * 60 * 60;
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
const generateAccessToken = (payload) => {
    // ✅ FIX: JWT_ACCESS_SECRET use karo agar available ho
    const secret = config_1.config.jwt.accessSecret || config_1.config.jwt.secret;
    const options = {
        expiresIn: getExpirySeconds(config_1.config.jwt.accessExpiresIn),
        // ✅ NO issuer/audience - backward compatible
    };
    return jsonwebtoken_1.default.sign({ ...payload, type: 'access' }, secret, options);
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (payload) => {
    const secret = config_1.config.jwt.refreshSecret || config_1.config.jwt.secret;
    const options = {
        expiresIn: getExpirySeconds(config_1.config.jwt.refreshExpiresIn),
        // ✅ NO issuer/audience - backward compatible
    };
    // jti har token ko alag banata hai.
    //
    // Iske bina payload sirf { userId, email, organizationId, tokenVersion }
    // tha, aur JWT me iat/exp seconds me hote hain - to ek hi user ke do
    // refresh same second me hone par bilkul same string banti thi. Phir
    // refreshToken.create() unique constraint (token @unique) par P2002
    // deta tha, jo errorHandler me 409 "This token already exists" ban kar
    // client tak jaata tha aur us request ko fail kar deta tha.
    //
    // Ye aasani se hota hai: dashboard ek saath 4 call karta hai, aur user
    // ke kai devices/tabs ek saath logged in ho sakte hain.
    return jsonwebtoken_1.default.sign({ ...payload, type: 'refresh', jti: (0, crypto_1.randomUUID)() }, secret, options);
};
exports.generateRefreshToken = generateRefreshToken;
const verifyAccessToken = (token) => {
    // ✅ FIX: Try multiple secrets for backward compatibility
    const secrets = [
        config_1.config.jwt.accessSecret,
        config_1.config.jwt.secret,
    ].filter(Boolean);
    let lastError;
    for (const secret of secrets) {
        try {
            // ✅ NO issuer/audience check - purane tokens ke saath compatible
            const payload = jsonwebtoken_1.default.verify(token, secret);
            if (payload.type && payload.type !== 'access') {
                throw new Error('Invalid token type');
            }
            return payload;
        }
        catch (err) {
            lastError = err;
            // TokenExpiredError pe retry mat karo - ye actual expiry hai
            if (err.name === 'TokenExpiredError')
                throw err;
            // Agar secret mismatch hai toh next secret try karo
            continue;
        }
    }
    throw lastError;
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => {
    const secrets = [
        config_1.config.jwt.refreshSecret,
        config_1.config.jwt.secret,
    ].filter(Boolean);
    let lastError;
    for (const secret of secrets) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, secret);
            if (payload.type && payload.type !== 'refresh') {
                // ✅ Purane tokens mein type field nahi tha - allow karo
                if (payload.type !== undefined) {
                    throw new Error('Invalid token type');
                }
            }
            return payload;
        }
        catch (err) {
            lastError = err;
            if (err.name === 'TokenExpiredError')
                throw err;
            continue;
        }
    }
    throw lastError;
};
exports.verifyRefreshToken = verifyRefreshToken;
const generateTokens = (payload) => ({
    accessToken: (0, exports.generateAccessToken)(payload),
    refreshToken: (0, exports.generateRefreshToken)(payload),
});
exports.generateTokens = generateTokens;
const decodeToken = (token) => {
    try {
        return jsonwebtoken_1.default.decode(token);
    }
    catch {
        return null;
    }
};
exports.decodeToken = decodeToken;
const parseExpiryTime = (expiryString) => getExpirySeconds(expiryString) * 1000;
exports.parseExpiryTime = parseExpiryTime;
const getTokenExpiry = (expiryString) => new Date(Date.now() + (0, exports.parseExpiryTime)(expiryString));
exports.getTokenExpiry = getTokenExpiry;
const isTokenExpired = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (!decoded?.exp)
            return true;
        return Date.now() >= decoded.exp * 1000;
    }
    catch {
        return true;
    }
};
exports.isTokenExpired = isTokenExpired;
const getTokenRemainingTime = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (!decoded?.exp)
            return 0;
        return Math.max(0, decoded.exp * 1000 - Date.now());
    }
    catch {
        return 0;
    }
};
exports.getTokenRemainingTime = getTokenRemainingTime;
exports.default = {
    generateAccessToken: exports.generateAccessToken,
    generateRefreshToken: exports.generateRefreshToken,
    verifyAccessToken: exports.verifyAccessToken,
    verifyRefreshToken: exports.verifyRefreshToken,
    generateTokens: exports.generateTokens,
    decodeToken: exports.decodeToken,
    parseExpiryTime: exports.parseExpiryTime,
    getTokenExpiry: exports.getTokenExpiry,
    isTokenExpired: exports.isTokenExpired,
    getTokenRemainingTime: exports.getTokenRemainingTime,
};
//# sourceMappingURL=jwt.js.map