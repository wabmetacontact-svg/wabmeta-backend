// src/utils/response.ts
import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;
  errors?: any[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// ✅ sendSuccess - Supports multiple call patterns
export const sendSuccess = <T = any>(
  res: Response,
  data?: T,
  message: string = 'Success',
  statusCode: number = 200
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };

  return res.status(statusCode).json(response);
};

// ✅ sendError - Supports multiple call patterns
export const sendError = (
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 400,
  error?: any
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    error: error?.message || error,
  };

  return res.status(statusCode).json(response);
};

// successResponse - Object based version
export const successResponse = <T = any>(
  res: Response,
  options: {
    data?: T;
    message?: string;
    meta?: any;
    statusCode?: number;
  } | any = {}
): Response => {
  if (options && typeof options === 'object') {
    if ('data' in options || 'meta' in options) {
      const { data, message = 'Success', meta, statusCode = 200 } = options;
      const response: ApiResponse<T> = {
        success: true,
        message,
        data,
        meta,
      };
      return res.status(statusCode).json(response);
    }

    if ('message' in options && !('items' in options) && !('count' in options)) {
      const { message = 'Success', statusCode = 200 } = options;
      const response: ApiResponse<T> = {
        success: true,
        message,
      };
      return res.status(statusCode).json(response);
    }
  }

  const response: ApiResponse<T> = {
    success: true,
    message: 'Success',
    data: options,
  };

  return res.status(200).json(response);
};

// errorResponse - Object based version
export const errorResponse = (
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 400,
  error?: any
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    error: error?.message || error,
  };

  return res.status(statusCode).json(response);
};

export const validationErrorResponse = (
  res: Response,
  errors: any[]
): Response => {
  const response: ApiResponse = {
    success: false,
    message: 'Validation failed',
    errors,
  };

  return res.status(422).json(response);
};

export const paginatedResponse = <T = any>(
  res: Response,
  options: {
    data: T[];
    page: number;
    limit: number;
    total: number;
    message?: string;
  }
): Response => {
  const { data, page, limit, total, message = 'Success' } = options;

  const response: ApiResponse<T[]> = {
    success: true,
    message,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  return res.status(200).json(response);
};

export const sendPaginated = <T = any>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  message: string = 'Success'
): Response => {
  return paginatedResponse(res, {
    data,
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    message,
  });
};

export default {
  successResponse,
  errorResponse,
  sendSuccess,
  sendError,
  validationErrorResponse,
  paginatedResponse,
  sendPaginated,
};