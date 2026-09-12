"use strict";
// src/middleware/errorHandler.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.notFoundHandler = exports.errorHandler = exports.AppError = void 0;
const config_1 = require("../config");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// Best-effort guess of the HTTP status an error maps to, so logging can tell a
// normal client error (401/404/validation) apart from a real server fault.
const statusOf = (err) => {
    if (err instanceof AppError)
        return err.statusCode;
    if (err instanceof zod_1.ZodError)
        return 400;
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002')
            return 409;
        if (err.code === 'P2025')
            return 404;
        if (err.code === 'P2024')
            return 503;
    }
    return 500;
};
// Log errors through the structured logger, at a level that matches severity.
//
// 4xx client errors (an expired token, a missing record, a validation failure)
// are normal traffic — the request-response is already logged by requestLogger,
// so re-logging them here as red errors just fills the console with noise. Only
// 5xx server faults get an error-level entry, with the stack in development.
const logErrorSafe = (err, req) => {
    try {
        const status = statusOf(err);
        const method = req?.method || 'UNKNOWN';
        const url = req?.url || 'UNKNOWN';
        const message = err instanceof Error ? err.message : String(err);
        const log = logger_1.logger.category('HTTP');
        // Client errors: quiet. Visible only when debugging.
        if (status < 500) {
            log.debug(`${method} ${url} → ${status}`, { status, error: message });
            return;
        }
        // Server faults: this is the one that deserves attention.
        log.error(`${method} ${url} → ${status}`, err instanceof Error ? err : undefined, {
            status,
            error: message,
            ...(config_1.config.nodeEnv === 'development' && err instanceof Error && err.stack
                ? { stack: err.stack.split('\n').slice(0, 4).join(' | ') }
                : {}),
        });
    }
    catch {
        logger_1.logger.category('HTTP').error('Failed to log an error safely');
    }
};
// ✅ Send JSON error response
const sendJsonError = (res, message, statusCode = 500, errors) => {
    // Prevent double response
    if (res.headersSent) {
        return;
    }
    const response = {
        success: false,
        error: message,
        message: message,
        statusCode,
    };
    if (errors && errors.length > 0) {
        response.errors = errors;
    }
    res.status(statusCode).json(response);
};
const errorHandler = (err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
next) => {
    // Log the error
    logErrorSafe(err, req);
    // Prevent double response
    if (res.headersSent) {
        return next(err);
    }
    // ============================================
    // ZOD VALIDATION ERRORS
    // ============================================
    if (err instanceof zod_1.ZodError) {
        const errors = err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
        }));
        return sendJsonError(res, 'Validation failed', 400, errors);
    }
    // ============================================
    // PRISMA ERRORS
    // ============================================
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002': {
                // Unique constraint violation
                const field = err.meta?.target?.[0] || 'field';
                return sendJsonError(res, `This ${field} already exists`, 409);
            }
            case 'P2003': {
                // Foreign key constraint
                return sendJsonError(res, 'Related record not found', 400);
            }
            case 'P2025': {
                // Record not found
                return sendJsonError(res, 'Record not found', 404);
            }
            case 'P2024': {
                // Connection pool timeout
                console.error('⚠️ Database connection pool timeout');
                return sendJsonError(res, 'Database temporarily unavailable. Please try again.', 503);
            }
            default:
                console.error('⚠️ Unhandled Prisma Error:', err.code, err.message);
                return sendJsonError(res, `Database error: ${err.code} ${err.message}`, 500, [
                    { field: 'prisma', message: `Error code: ${err.code}` }
                ]);
        }
    }
    if (err instanceof client_1.Prisma.PrismaClientInitializationError) {
        console.error('⚠️ Database connection failed');
        return sendJsonError(res, 'Database connection failed', 503);
    }
    if (err instanceof client_1.Prisma.PrismaClientValidationError) {
        return sendJsonError(res, 'Invalid data provided', 400);
    }
    // ============================================
    // CUSTOM APP ERRORS
    // ============================================
    if (err instanceof AppError) {
        return sendJsonError(res, err.message, err.statusCode);
    }
    // ============================================
    // JWT ERRORS
    // ============================================
    if (typeof err === 'object' && err !== null && 'name' in err) {
        const name = err.name;
        if (name === 'JsonWebTokenError') {
            return sendJsonError(res, 'Invalid token', 401);
        }
        if (name === 'TokenExpiredError') {
            return sendJsonError(res, 'Token expired', 401);
        }
        if (name === 'NotBeforeError') {
            return sendJsonError(res, 'Token not yet valid', 401);
        }
    }
    // ============================================
    // MULTER ERRORS (File Upload)
    // ============================================
    if (typeof err === 'object' && err !== null && 'code' in err) {
        const code = err.code;
        if (code === 'LIMIT_FILE_SIZE') {
            return sendJsonError(res, 'File too large', 400);
        }
        if (code === 'LIMIT_FILE_COUNT') {
            return sendJsonError(res, 'Too many files', 400);
        }
        if (code === 'LIMIT_UNEXPECTED_FILE') {
            return sendJsonError(res, 'Unexpected file field', 400);
        }
    }
    // ============================================
    // AXIOS/FETCH ERRORS (External API)
    // ============================================
    if (typeof err === 'object' && err !== null && 'isAxiosError' in err) {
        const axiosError = err;
        const status = axiosError.response?.status || 500;
        const message = axiosError.response?.data?.error?.message ||
            axiosError.response?.data?.message ||
            axiosError.message ||
            'External API error';
        console.error('⚠️ External API error:', {
            status,
            url: axiosError.config?.url,
            message,
        });
        return sendJsonError(res, message, status >= 500 ? 502 : status);
    }
    // ============================================
    // SYNTAX ERRORS (JSON Parse)
    // ============================================
    if (err instanceof SyntaxError && 'body' in err) {
        return sendJsonError(res, 'Invalid JSON in request body', 400);
    }
    // ============================================
    // DEFAULT ERROR
    // ============================================
    let message = 'Internal server error';
    let statusCode = 500;
    if (err instanceof Error) {
        // In development, show actual error message
        if (config_1.config.nodeEnv === 'development') {
            message = err.message;
        }
        // Check for status code in error object
        if ('statusCode' in err && typeof err.statusCode === 'number') {
            statusCode = err.statusCode;
            message = err.message;
        }
    }
    return sendJsonError(res, message, statusCode);
};
exports.errorHandler = errorHandler;
// ============================================
// NOT FOUND HANDLER
// ============================================
const notFoundHandler = (req, res) => {
    sendJsonError(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
};
exports.notFoundHandler = notFoundHandler;
// ============================================
// ASYNC HANDLER WRAPPER
// ============================================
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errorHandler.js.map