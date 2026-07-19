"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboxLog = exports.automationLog = exports.chatbotLog = exports.cronLog = exports.metaLog = exports.cacheLog = exports.dbLog = exports.socketLog = exports.webhookLog = exports.campaignLog = exports.whatsappLog = exports.walletLog = exports.authLog = exports.logger = void 0;
// src/utils/logger.ts - ENTERPRISE VERSION
const config_1 = require("../config");
// ─── Constants ───────────────────────────────────────────
const LOG_LEVELS = {
    error: 0, warn: 1, info: 2, http: 3, debug: 4,
};
const LEVEL_COLORS = {
    error: '\x1b[31m',
    warn: '\x1b[33m',
    info: '\x1b[36m',
    http: '\x1b[35m',
    debug: '\x1b[90m',
};
const CATEGORY_COLORS = {
    SYSTEM: '\x1b[35m', AUTH: '\x1b[34m',
    WALLET: '\x1b[32m', WHATSAPP: '\x1b[36m',
    CAMPAIGN: '\x1b[33m', WEBHOOK: '\x1b[95m',
    SOCKET: '\x1b[94m', DB: '\x1b[90m',
    CACHE: '\x1b[92m', 'META-API': '\x1b[96m',
    CHATBOT: '\x1b[93m', AUTOMATION: '\x1b[97m',
    INBOX: '\x1b[35m',
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
// ─── Sensitive Data Masking ──────────────────────────────
const SENSITIVE_KEYS = [
    'password', 'token', 'accesstoken', 'refreshtoken',
    'secret', 'apikey', 'authorization', 'cookie',
    'pin', 'otp', 'creditcard', 'cvv',
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
const maskWamid = (id) => {
    if (!id || id.length < 20)
        return id;
    const clean = id.replace('wamid.', '');
    return `wamid.${clean.slice(0, 8)}...${clean.slice(-6)}`;
};
const sanitize = (obj, depth = 0) => {
    if (depth > 5)
        return '[Nested Too Deep]';
    if (obj === null || obj === undefined)
        return obj;
    if (typeof obj === 'string') {
        // JWT tokens
        if (/^eyJ[A-Za-z0-9-_=]+\.eyJ/.test(obj))
            return maskValue(obj);
        // Meta tokens
        if (obj.startsWith('EAA') && obj.length > 30)
            return maskValue(obj);
        // wamid
        if (obj.startsWith('wamid.'))
            return maskWamid(obj);
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item, depth + 1));
    }
    if (typeof obj === 'object') {
        const clean = {};
        for (const [key, value] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();
            if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
                clean[key] = typeof value === 'string' ? maskValue(value) : '***';
                continue;
            }
            if (lowerKey === 'phone' ||
                lowerKey === 'phonenumber' ||
                lowerKey === 'senderphone' ||
                lowerKey === 'recipient' ||
                lowerKey === 'recipientphone' ||
                lowerKey.includes('mobile')) {
                clean[key] = typeof value === 'string' ? maskPhone(value) : value;
                continue;
            }
            if (lowerKey === 'email' && typeof value === 'string') {
                clean[key] = maskEmail(value);
                continue;
            }
            if ((lowerKey === 'wamid' || lowerKey === 'wamessageid' ||
                lowerKey === 'whatsappmessageid') &&
                typeof value === 'string') {
                clean[key] = maskWamid(value);
                continue;
            }
            clean[key] = sanitize(value, depth + 1);
        }
        return clean;
    }
    return obj;
};
// ─── ID Shortener ─────────────────────────────────────────
const shortId = (id) => {
    if (!id || id.length < 12)
        return id;
    return `${id.slice(0, 6)}..${id.slice(-4)}`;
};
// ─── Pretty Formatter ─────────────────────────────────────
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
    const catStr = `${catColor}[${category.padEnd(10)}]${RESET}`;
    let output = `${timestamp} ${levelStr} ${catStr} ${message}`;
    if (context && Object.keys(context).length > 0) {
        const cleanCtx = sanitize(context);
        const parts = [];
        for (const [key, value] of Object.entries(cleanCtx)) {
            if (value === undefined || value === null)
                continue;
            let displayValue;
            if (typeof value === 'object') {
                try {
                    displayValue = JSON.stringify(value).substring(0, 100);
                }
                catch {
                    displayValue = '[complex object]';
                }
            }
            else if (typeof value === 'string' && key.toLowerCase().endsWith('id') && value.length > 12) {
                displayValue = shortId(value);
            }
            else if (key === 'duration' && typeof value === 'number') {
                displayValue = `${value}ms`;
            }
            else if (key === 'error' && typeof value === 'string') {
                displayValue = value.substring(0, 80);
            }
            else {
                displayValue = String(value).substring(0, 100);
            }
            parts.push(`${DIM}${key}${RESET}=${displayValue}`);
        }
        if (parts.length > 0) {
            output += ` ${DIM}·${RESET} ${parts.join(' ')}`;
        }
    }
    return output;
};
// ─── JSON Formatter (Production) ──────────────────────────
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
        const envLevel = (process.env.LOG_LEVEL || '').toLowerCase();
        const defaultLevel = this.isProduction ? 'info' : 'debug';
        const level = LOG_LEVELS[envLevel] !== undefined ? envLevel : defaultLevel;
        this.currentLevel = LOG_LEVELS[level];
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
    error(message, error, context) {
        const ctx = { ...context };
        if (error) {
            if (error instanceof Error) {
                ctx.error = error.message;
                if (!this.isProduction)
                    ctx.stack = error.stack?.split('\n')[1];
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
    category(cat) {
        return {
            error: (msg, error, ctx) => {
                const context = { ...ctx };
                if (error) {
                    if (error instanceof Error) {
                        context.error = error.message;
                        if (!this.isProduction)
                            context.stack = error.stack?.split('\n')[1];
                    }
                    else {
                        context.error = String(error);
                    }
                }
                this.write('error', cat, msg, context);
            },
            warn: (msg, ctx) => this.write('warn', cat, msg, ctx),
            info: (msg, ctx) => this.write('info', cat, msg, ctx),
            debug: (msg, ctx) => this.write('debug', cat, msg, ctx),
            http: (msg, ctx) => this.write('http', cat, msg, ctx),
        };
    }
}
// ─── Singleton ───────────────────────────────────────────
exports.logger = new Logger();
// ─── Category loggers ────────────────────────────────────
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
exports.chatbotLog = exports.logger.category('CHATBOT');
exports.automationLog = exports.logger.category('AUTOMATION');
exports.inboxLog = exports.logger.category('INBOX');
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map