// src/middleware/requestLogger.ts - PRODUCTION READY
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import crypto from 'crypto';

// ─── Extend Request type ────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

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

const shouldSkip = (path: string): boolean => {
  if (SKIP_PATHS.includes(path)) return true;
  return SKIP_PREFIXES.some(prefix => path.startsWith(prefix));
};

// ─── Get status color ────────────────────────────────────
const getStatusEmoji = (status: number): string => {
  if (status >= 500) return '🔴';
  if (status >= 400) return '🟡';
  if (status >= 300) return '🔵';
  if (status >= 200) return '🟢';
  return '⚪';
};

const getDurationLabel = (ms: number): string => {
  if (ms > 3000)  return '🐌 slow';
  if (ms > 1000)  return '⚠️  medium';
  return 'fast';
};

// ─── Main middleware ─────────────────────────────────────
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip health checks etc.
  if (shouldSkip(req.path)) {
    return next();
  }

  // Generate request ID for tracking
  req.requestId = crypto.randomBytes(8).toString('hex');
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-Id', req.requestId);

  // Log incoming request (debug level)
  logger.http('Request', {
    requestId: req.requestId,
    method:    req.method,
    path:      req.path,
    ip:        req.ip,
    userAgent: req.headers['user-agent']?.substring(0, 50),
  });

  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || Date.now());
    const status   = res.statusCode;

    const context: any = {
      requestId: req.requestId,
      method:    req.method,
      path:      req.path,
      status,
      duration,
    };

    // Add user info if authenticated
    const user = (req as any).user;
    if (user?.id)             context.userId         = user.id;
    if (user?.organizationId) context.organizationId = user.organizationId;

    // Slow request warning
    if (duration > 3000) context.perf = getDurationLabel(duration);

    const emoji  = getStatusEmoji(status);
    const message = `${emoji} ${req.method} ${req.path} → ${status}`;

    // Log based on status
    if (status >= 500) {
      logger.category('HTTP').error(message, null, context);
    } else if (status >= 400) {
      logger.category('HTTP').warn(message, context);
    } else {
      logger.category('HTTP').http(message, context);
    }
  });

  next();
};

export default requestLogger;