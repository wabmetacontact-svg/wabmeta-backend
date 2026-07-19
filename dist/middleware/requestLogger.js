"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
// ─── Skip these paths ────────────────────────────────────
const SKIP_PATHS = [
    '/',
    '/health',
    '/api/health',
    '/favicon.ico',
];
const SKIP_PREFIXES = [
    '/api/webhooks',
    '/uploads',
];
const shouldSkip = (path) => {
    if (SKIP_PATHS.includes(path))
        return true;
    return SKIP_PREFIXES.some(prefix => path.startsWith(prefix));
};
// ─── Get status color ────────────────────────────────────
const getStatusEmoji = (status) => {
    if (status >= 500)
        return '🔴';
    if (status >= 400)
        return '🟡';
    if (status >= 300)
        return '🔵';
    if (status >= 200)
        return '🟢';
    return '⚪';
};
const getDurationLabel = (ms) => {
    if (ms > 3000)
        return '🐌 slow';
    if (ms > 1000)
        return '⚠️  medium';
    return 'fast';
};
// ─── Main middleware ─────────────────────────────────────
const requestLogger = (req, res, next) => {
    // Skip health checks etc.
    if (shouldSkip(req.path)) {
        return next();
    }
    // Generate request ID for tracking
    req.requestId = crypto_1.default.randomBytes(8).toString('hex');
    req.startTime = Date.now();
    // Add request ID to response headers
    res.setHeader('X-Request-Id', req.requestId);
    // Log incoming request (debug level)
    logger_1.logger.http('Request', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 50),
    });
    // Capture response
    res.on('finish', () => {
        const duration = Date.now() - (req.startTime || Date.now());
        const status = res.statusCode;
        const context = {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            status,
            duration,
        };
        // Add user info if authenticated
        const user = req.user;
        if (user?.id)
            context.userId = user.id;
        if (user?.organizationId)
            context.organizationId = user.organizationId;
        // Slow request warning
        if (duration > 3000)
            context.perf = getDurationLabel(duration);
        const emoji = getStatusEmoji(status);
        const message = `${emoji} ${req.method} ${req.path} → ${status}`;
        // Log based on status
        if (status >= 500) {
            logger_1.logger.category('HTTP').error(message, null, context);
        }
        else if (status >= 400) {
            logger_1.logger.category('HTTP').warn(message, context);
        }
        else {
            logger_1.logger.category('HTTP').http(message, context);
        }
    });
    next();
};
exports.requestLogger = requestLogger;
exports.default = exports.requestLogger;
//# sourceMappingURL=requestLogger.js.map