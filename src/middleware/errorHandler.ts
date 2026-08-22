// src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Best-effort guess of the HTTP status an error maps to, so logging can tell a
// normal client error (401/404/validation) apart from a real server fault.
const statusOf = (err: unknown): number => {
  if (err instanceof AppError) return err.statusCode;
  if (err instanceof ZodError) return 400;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return 409;
    if (err.code === 'P2025') return 404;
    if (err.code === 'P2024') return 503;
  }
  return 500;
};

// Log errors through the structured logger, at a level that matches severity.
//
// 4xx client errors (an expired token, a missing record, a validation failure)
// are normal traffic — the request-response is already logged by requestLogger,
// so re-logging them here as red errors just fills the console with noise. Only
// 5xx server faults get an error-level entry, with the stack in development.
const logErrorSafe = (err: unknown, req?: Request) => {
  try {
    const status = statusOf(err);
    const method = req?.method || 'UNKNOWN';
    const url = req?.url || 'UNKNOWN';
    const message = err instanceof Error ? err.message : String(err);
    const log = logger.category('HTTP');

    // Client errors: quiet. Visible only when debugging.
    if (status < 500) {
      log.debug(`${method} ${url} → ${status}`, { status, error: message });
      return;
    }

    // Server faults: this is the one that deserves attention.
    log.error(`${method} ${url} → ${status}`, err instanceof Error ? err : undefined, {
      status,
      error: message,
      ...(config.nodeEnv === 'development' && err instanceof Error && err.stack
        ? { stack: err.stack.split('\n').slice(0, 4).join(' | ') }
        : {}),
    });
  } catch {
    logger.category('HTTP').error('Failed to log an error safely');
  }
};

// ✅ Send JSON error response
const sendJsonError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  errors?: any[]
) => {
  // Prevent double response
  if (res.headersSent) {
    return;
  }

  const response: {
    success: false;
    error: string;
    message: string;
    statusCode: number;
    errors?: any[];
    stack?: string;
  } = {
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

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // Log the error
  logErrorSafe(err, req);

  // Prevent double response
  if (res.headersSent) {
    return next(err);
  }

  // ============================================
  // ZOD VALIDATION ERRORS
  // ============================================
  if (err instanceof ZodError) {
    const errors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendJsonError(res, 'Validation failed', 400, errors);
  }

  // ============================================
  // PRISMA ERRORS
  // ============================================
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        // Unique constraint violation
        const field = (err.meta?.target as string[])?.[0] || 'field';
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

  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error('⚠️ Database connection failed');
    return sendJsonError(res, 'Database connection failed', 503);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
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
    const name = (err as any).name;

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
    const code = (err as any).code;

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
    const axiosError = err as any;
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
    if (config.nodeEnv === 'development') {
      message = err.message;
    }

    // Check for status code in error object
    if ('statusCode' in err && typeof (err as any).statusCode === 'number') {
      statusCode = (err as any).statusCode;
      message = err.message;
    }
  }

  return sendJsonError(res, message, statusCode);
};

// ============================================
// NOT FOUND HANDLER
// ============================================
export const notFoundHandler = (req: Request, res: Response) => {
  sendJsonError(
    res,
    `Route ${req.method} ${req.originalUrl} not found`,
    404
  );
};

// ============================================
// ASYNC HANDLER WRAPPER
// ============================================
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};