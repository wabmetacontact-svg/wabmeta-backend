"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronLog = exports.metaLog = exports.cacheLog = exports.dbLog = exports.socketLog = exports.webhookLog = exports.campaignLog = exports.whatsappLog = exports.walletLog = exports.authLog = exports.logger = void 0;
// src/utils/logger.ts - PRODUCTION READY
const config_1 = require("../config");
// ─── Constants ───────────────────────────────────────────
const LOG_LEVELS = {
    error: 0, warn: 1, info: 2, http: 3, debug: 4,
};
const LEVEL_COLORS = {
    error: '\x1b[31m', // red
    warn: '\x1b[33m', // yellow
    info: '\x1b[36m', // cyan
    http: '\x1b[35m', // magenta
    debug: '\x1b[90m', // gray
};
const CATEGORY_COLORS = {
    SYSTEM: '\x1b[35m', AUTH: '\x1b[34m',
    WALLET: '\x1b[32m', WHATSAPP: '\x1b[36m',
    CAMPAIGN: '\x1b[33m', WEBHOOK: '\x1b[95m',
    SOCKET: '\x1b[94m', DB: '\x1b[90m',
    CACHE: '\x1b[92m', 'META-API': '\x1b[96m',
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
// ─── Sensitive Data Masking ──────────────────────────────
const SENSITIVE_KEYS = [
    'password', 'token', 'accessToken', 'refreshToken',
    'secret', 'apiKey', 'authorization', 'cookie',
    'pin', 'otp', 'creditCard', 'cvv',
];
const maskValue = (value, showChars = 4) => {
    if (!value || value.length <= showChars * 2)
        return '***';
    return `${value.slice(0, showChars)}...${value.slice(-showChars)}`;
};
const maskPhone = (phone) => {
    if (!phone)
        return phone;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 6)
        return phone;
    return `${digits.slice(0, 2)}****${digits.slice(-4)}`;
};
const maskEmail = (email) => {
    if (!email || !email.includes('@'))
        return email;
    const [user, domain] = email.split('@');
    if (user.length <= 2)
        return `${user[0]}***@${domain}`;
    return `${user.slice(0, 2)}***@${domain}`;
};
const sanitize = (obj, depth = 0) => {
    if (depth > 5)
        return '[Nested Too Deep]';
    if (obj === null || obj === undefined)
        return obj;
    // String masking
    if (typeof obj === 'string') {
        // Mask JWT tokens
        if (/^eyJ[A-Za-z0-9-_=]+\.eyJ/.test(obj))
            return maskValue(obj);
        // Mask Meta tokens
        if (obj.startsWith('EAA'))
            return maskValue(obj);
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item, depth + 1));
    }
    if (typeof obj === 'object') {
        const clean = {};
        for (const [key, value] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();
            // Sensitive keys
            if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk.toLowerCase()))) {
                clean[key] = typeof value === 'string' ? maskValue(value) : '***';
                continue;
            }
            // Auto-detect and mask
            if (lowerKey === 'phone' || lowerKey === 'phonenumber' || lowerKey.includes('mobile')) {
                clean[key] = typeof value === 'string' ? maskPhone(value) : value;
                continue;
            }
            if (lowerKey === 'email' && typeof value === 'string') {
                clean[key] = maskEmail(value);
                continue;
            }
            // Recursive
            clean[key] = sanitize(value, depth + 1);
        }
        return clean;
    }
    return obj;
};
// ─── ID Shortener (for logs readability) ────────────────
const shortId = (id) => {
    if (!id || id.length < 12)
        return id;
    return `${id.slice(0, 6)}..${id.slice(-4)}`;
};
// ─── Formatters ──────────────────────────────────────────
/**
 * Pretty format for development
 * [14:32:11] INFO  [WHATSAPP] Message sent { phoneNumber: '91****96', duration: '245ms' }
 */
const formatPretty = (level, category, message, context) => {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const timestamp = `${DIM}[${time}.${ms}]${RESET}`;
    const levelStr = `${LEVEL_COLORS[level]}${BOLD}${level.toUpperCase().padEnd(5)}${RESET}`;
    const catColor = CATEGORY_COLORS[category] || '\x1b[37m';
    const catStr = `${catColor}[${category.padEnd(8)}]${RESET}`;
    let output = `${timestamp} ${levelStr} ${catStr} ${message}`;
    // Add context inline
    if (context && Object.keys(context).length > 0) {
        const cleanCtx = sanitize(context);
        const parts = [];
        for (const [key, value] of Object.entries(cleanCtx)) {
            if (value === undefined || value === null)
                continue;
            let displayValue;
            if (typeof value === 'object') {
                displayValue = JSON.stringify(value);
            }
            else if (typeof value === 'string' && key.toLowerCase().includes('id')) {
                displayValue = shortId(value);
            }
            else if (key === 'duration' && typeof value === 'number') {
                displayValue = `${value}ms`;
            }
            else {
                displayValue = String(value);
            }
            parts.push(`${DIM}${key}${RESET}=${displayValue}`);
        }
        if (parts.length > 0) {
            output += ` ${DIM}·${RESET} ${parts.join(' ')}`;
        }
    }
    return output;
};
/**
 * JSON format for production (easier to parse in log tools)
 */
const formatJSON = (level, category, message, context) => {
    const entry = {
        ts: new Date().toISOString(),
        level,
        category,
        message,
        ...(context && Object.keys(context).length > 0
            ? { context: sanitize(context) }
            : {}),
    };
    return JSON.stringify(entry);
};
// ─── Logger Class ────────────────────────────────────────
class Logger {
    currentLevel;
    isProduction;
    useJSON;
    constructor() {
        this.isProduction = config_1.config.app.isProduction;
        // Log level from env or defaults
        const envLevel = (process.env.LOG_LEVEL || '').toLowerCase();
        const defaultLevel = this.isProduction ? 'info' : 'debug';
        const level = LOG_LEVELS[envLevel] !== undefined ? envLevel : defaultLevel;
        this.currentLevel = LOG_LEVELS[level];
        // Format based on env
        this.useJSON = process.env.LOG_FORMAT === 'json' || this.isProduction;
    }
    shouldLog(level) {
        return LOG_LEVELS[level] <= this.currentLevel;
    }
    write(level, category, message, context) {
        if (!this.shouldLog(level))
            return;
        const output = this.useJSON
            ? formatJSON(level, category, message, context)
            : formatPretty(level, category, message, context);
        // Send to appropriate stream
        if (level === 'error') {
            console.error(output);
        }
        else if (level === 'warn') {
            console.warn(output);
        }
        else {
            console.log(output);
        }
    }
    // ─── Public API ─────────────────────────────────────────
    error(message, error, context) {
        const ctx = { ...context };
        if (error) {
            if (error instanceof Error) {
                ctx.error = error.message;
                if (!this.isProduction)
                    ctx.stack = error.stack;
            }
            else {
                ctx.error = String(error);
            }
        }
        this.write('error', 'SYSTEM', message, ctx);
    }
    warn(message, context) {
        this.write('warn', 'SYSTEM', message, context);
    }
    info(message, context) {
        this.write('info', 'SYSTEM', message, context);
    }
    debug(message, context) {
        this.write('debug', 'SYSTEM', message, context);
    }
    http(message, context) {
        this.write('http', 'HTTP', message, context);
    }
    // ─── Category-specific methods ──────────────────────────
    category(cat) {
        return {
            error: (msg, error, ctx) => this.write('error', cat, msg, { ...ctx, error: error?.message || error }),
            warn: (msg, ctx) => this.write('warn', cat, msg, ctx),
            info: (msg, ctx) => this.write('info', cat, msg, ctx),
            debug: (msg, ctx) => this.write('debug', cat, msg, ctx),
            http: (msg, ctx) => this.write('http', cat, msg, ctx),
        };
    }
}
// ─── Singleton export ───────────────────────────────────
exports.logger = new Logger();
// ─── Convenience category loggers ───────────────────────
exports.authLog = exports.logger.category('AUTH');
exports.walletLog = exports.logger.category('WALLET');
exports.whatsappLog = exports.logger.category('WHATSAPP');
exports.campaignLog = exports.logger.category('CAMPAIGN');
exports.webhookLog = exports.logger.category('WEBHOOK');
exports.socketLog = exports.logger.category('SOCKET');
exports.dbLog = exports.logger.category('DB');
exports.cacheLog = exports.logger.category('CACHE');
exports.metaLog = exports.logger.category('META-API');
exports.cronLog = exports.logger.category('CRON');
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map