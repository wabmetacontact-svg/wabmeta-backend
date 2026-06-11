"use strict";
// src/utils/jwt.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenRemainingTime = exports.isTokenExpired = exports.getTokenExpiry = exports.parseExpiryTime = exports.decodeToken = exports.generateTokens = exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
// Helper to get expiry in seconds
const getExpirySeconds = (expiryString) => {
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
const generateAccessToken = (payload) => {
    const secret = config_1.config.jwt.secret;
    const options = {
        expiresIn: getExpirySeconds(config_1.config.jwt.expiresIn),
    };
    return jsonwebtoken_1.default.sign({ tokenVersion: 0, ...payload, type: 'access' }, secret, options);
};
exports.generateAccessToken = generateAccessToken;
// Generate Refresh Token
const generateRefreshToken = (payload) => {
    const secret = config_1.config.jwt.refreshSecret;
    const options = {
        expiresIn: getExpirySeconds(config_1.config.jwt.refreshExpiresIn),
    };
    return jsonwebtoken_1.default.sign({ tokenVersion: 0, ...payload, type: 'refresh' }, secret, options);
};
exports.generateRefreshToken = generateRefreshToken;
// Verify Access Token
const verifyAccessToken = (token) => {
    const secret = config_1.config.jwt.secret;
    return jsonwebtoken_1.default.verify(token, secret);
};
exports.verifyAccessToken = verifyAccessToken;
// Verify Refresh Token
const verifyRefreshToken = (token) => {
    const secret = config_1.config.jwt.refreshSecret;
    return jsonwebtoken_1.default.verify(token, secret);
};
exports.verifyRefreshToken = verifyRefreshToken;
// Generate both tokens
const generateTokens = (payload) => {
    return {
        accessToken: (0, exports.generateAccessToken)(payload),
        refreshToken: (0, exports.generateRefreshToken)(payload),
    };
};
exports.generateTokens = generateTokens;
// Decode token without verification (for debugging)
const decodeToken = (token) => {
    try {
        return jsonwebtoken_1.default.decode(token);
    }
    catch {
        return null;
    }
};
exports.decodeToken = decodeToken;
// Parse expiry time string to milliseconds
const parseExpiryTime = (expiryString) => {
    return getExpirySeconds(expiryString) * 1000;
};
exports.parseExpiryTime = parseExpiryTime;
// Get expiry date from expiry string
const getTokenExpiry = (expiryString) => {
    const ms = (0, exports.parseExpiryTime)(expiryString);
    return new Date(Date.now() + ms);
};
exports.getTokenExpiry = getTokenExpiry;
// Check if token is expired
const isTokenExpired = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (!decoded || !decoded.exp)
            return true;
        return Date.now() >= decoded.exp * 1000;
    }
    catch {
        return true;
    }
};
exports.isTokenExpired = isTokenExpired;
// Get remaining time in milliseconds
const getTokenRemainingTime = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (!decoded || !decoded.exp)
            return 0;
        const remaining = decoded.exp * 1000 - Date.now();
        return remaining > 0 ? remaining : 0;
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