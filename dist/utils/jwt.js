"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenRemainingTime = exports.isTokenExpired = exports.getTokenExpiry = exports.parseExpiryTime = exports.decodeToken = exports.generateTokens = exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
// src/utils/jwt.ts - FIXED
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
// ─── Helper: Parse expiry ────────────────────────────────
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
// ─── Generate Access Token ──────────────────────────────
const generateAccessToken = (payload) => {
    const secret = config_1.config.jwt.secret;
    const options = {
        expiresIn: getExpirySeconds(config_1.config.jwt.accessExpiresIn),
        issuer: 'wabmeta', // ✅ Add issuer
        audience: 'wabmeta-users', // ✅ Add audience
    };
    return jsonwebtoken_1.default.sign({ ...payload, type: 'access' }, secret, options);
};
exports.generateAccessToken = generateAccessToken;
// ─── Generate Refresh Token ─────────────────────────────
const generateRefreshToken = (payload) => {
    const secret = config_1.config.jwt.refreshSecret;
    const options = {
        expiresIn: getExpirySeconds(config_1.config.jwt.refreshExpiresIn),
        issuer: 'wabmeta',
        audience: 'wabmeta-refresh',
    };
    return jsonwebtoken_1.default.sign({ ...payload, type: 'refresh' }, secret, options);
};
exports.generateRefreshToken = generateRefreshToken;
// ─── Verify Access Token (with type check) ──────────────
const verifyAccessToken = (token) => {
    const secret = config_1.config.jwt.secret;
    const payload = jsonwebtoken_1.default.verify(token, secret, {
        issuer: 'wabmeta',
        audience: 'wabmeta-users',
    });
    // ✅ CRITICAL: Verify token type
    if (payload.type !== 'access') {
        throw new Error('Invalid token type - expected access token');
    }
    return payload;
};
exports.verifyAccessToken = verifyAccessToken;
// ─── Verify Refresh Token (with type check) ─────────────
const verifyRefreshToken = (token) => {
    const secret = config_1.config.jwt.refreshSecret;
    const payload = jsonwebtoken_1.default.verify(token, secret, {
        issuer: 'wabmeta',
        audience: 'wabmeta-refresh',
    });
    // ✅ CRITICAL: Verify token type
    if (payload.type !== 'refresh') {
        throw new Error('Invalid token type - expected refresh token');
    }
    return payload;
};
exports.verifyRefreshToken = verifyRefreshToken;
// ─── Generate both tokens ───────────────────────────────
const generateTokens = (payload) => ({
    accessToken: (0, exports.generateAccessToken)(payload),
    refreshToken: (0, exports.generateRefreshToken)(payload),
});
exports.generateTokens = generateTokens;
// ─── Decode without verify (debugging only) ─────────────
const decodeToken = (token) => {
    try {
        return jsonwebtoken_1.default.decode(token);
    }
    catch {
        return null;
    }
};
exports.decodeToken = decodeToken;
// ─── Parse expiry to ms ─────────────────────────────────
const parseExpiryTime = (expiryString) => getExpirySeconds(expiryString) * 1000;
exports.parseExpiryTime = parseExpiryTime;
// ─── Get expiry Date ────────────────────────────────────
const getTokenExpiry = (expiryString) => new Date(Date.now() + (0, exports.parseExpiryTime)(expiryString));
exports.getTokenExpiry = getTokenExpiry;
// ─── Check expiry ───────────────────────────────────────
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
// ─── Get remaining time ─────────────────────────────────
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