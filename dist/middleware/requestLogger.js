"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
const SKIP_PATHS = ['/', '/health', '/api/health', '/favicon.ico'];
const SKIP_PREFIXES = ['/api/webhooks', '/uploads'];
const shouldSkip = (path) => {
    if (SKIP_PATHS.includes(path))
        return true;
    return SKIP_PREFIXES.some(prefix => path.startsWith(prefix));
};
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
// ✅ Ye 401s expected hain - refresh flow ka part hain
// Inhe warn level pe log karne ki zaroorat nahi
const isExpectedRefreshFlow = (status, _method, path) => {
    if (status !== 401)
        return false;
    // A 401 on any authenticated route is the normal token-refresh flow: the
    // access token expired mid-session, the client refreshes and retries. It is
    // not worth a warning on every route. Auth routes are the exception — a 401
    // there is a real sign-in failure worth seeing.
    return !path.startsWith('/api/auth/');
};
const requestLogger = (req, res, next) => {
    if (shouldSkip(req.path))
        return next();
    req.requestId = crypto_1.default.randomBytes(8).toString('hex');
    req.startTime = Date.now();
    res.setHeader('X-Request-Id', req.requestId);
    logger_1.logger.http('Request', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 50),
    });
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
        const user = req.user;
        if (user?.id)
            context.userId = user.id;
        if (user?.organizationId)
            context.organizationId = user.organizationId;
        if (duration > 3000)
            context.perf = getDurationLabel(duration);
        const emoji = getStatusEmoji(status);
        const message = `${emoji} ${req.method} ${req.path} → ${status}`;
        if (status >= 500) {
            logger_1.logger.category('HTTP').error(message, null, context);
        }
        else if (status >= 400) {
            // ✅ FIX: Expected refresh flow 401s ko debug level pe log karo
            if (isExpectedRefreshFlow(status, req.method, req.path)) {
                logger_1.logger.category('HTTP').debug(message, context);
            }
            else {
                logger_1.logger.category('HTTP').warn(message, context);
            }
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