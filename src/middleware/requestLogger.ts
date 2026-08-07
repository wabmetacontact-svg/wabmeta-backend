// src/middleware/requestLogger.ts - PRODUCTION READY
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

const SKIP_PATHS = ['/', '/health', '/api/health', '/favicon.ico'];
const SKIP_PREFIXES = ['/api/webhooks', '/uploads'];

const shouldSkip = (path: string): boolean => {
  if (SKIP_PATHS.includes(path)) return true;
  return SKIP_PREFIXES.some(prefix => path.startsWith(prefix));
};

const getStatusEmoji = (status: number): string => {
  if (status >= 500) return '🔴';
  if (status >= 400) return '🟡';
  if (status >= 300) return '🔵';
  if (status >= 200) return '🟢';
  return '⚪';
};

const getDurationLabel = (ms: number): string => {
  if (ms > 3000) return '🐌 slow';
  if (ms > 1000) return '⚠️  medium';
  return 'fast';
};

// ✅ Ye 401s expected hain - refresh flow ka part hain
// Inhe warn level pe log karne ki zaroorat nahi
const isExpectedRefreshFlow = (
  status: number,
  method: string,
  path: string
): boolean => {
  if (status !== 401) return false;

  const EXPECTED_401_PATHS = [
    '/api/auth/me',
    '/api/inbox/conversations',
    '/api/dashboard',
  ];

  return EXPECTED_401_PATHS.some(p => path.startsWith(p));
};

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (shouldSkip(req.path)) return next();

  req.requestId = crypto.randomBytes(8).toString('hex');
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', req.requestId);

  logger.http('Request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent']?.substring(0, 50),
  });

  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || Date.now());
    const status = res.statusCode;

    const context: any = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status,
      duration,
    };

    const user = (req as any).user;
    if (user?.id) context.userId = user.id;
    if (user?.organizationId) context.organizationId = user.organizationId;

    if (duration > 3000) context.perf = getDurationLabel(duration);

    const emoji = getStatusEmoji(status);
    const message = `${emoji} ${req.method} ${req.path} → ${status}`;

    if (status >= 500) {
      logger.category('HTTP').error(message, null, context);

    } else if (status >= 400) {
      // ✅ FIX: Expected refresh flow 401s ko debug level pe log karo
      if (isExpectedRefreshFlow(status, req.method, req.path)) {
        logger.category('HTTP').debug(message, context);
      } else {
        logger.category('HTTP').warn(message, context);
      }

    } else {
      logger.category('HTTP').http(message, context);
    }
  });

  next();
};

export default requestLogger;