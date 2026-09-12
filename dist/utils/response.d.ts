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
export declare const sendSuccess: <T = any>(res: Response, data?: T, message?: string, statusCode?: number) => Response;
export declare const sendError: (res: Response, message?: string, statusCode?: number, error?: any) => Response;
export declare const successResponse: <T = any>(res: Response, options?: {
    data?: T;
    message?: string;
    meta?: any;
    statusCode?: number;
} | any) => Response;
export declare const errorResponse: (res: Response, message?: string, statusCode?: number, error?: any) => Response;
export declare const validationErrorResponse: (res: Response, errors: any[]) => Response;
export declare const paginatedResponse: <T = any>(res: Response, options: {
    data: T[];
    page: number;
    limit: number;
    total: number;
    message?: string;
}) => Response;
export declare const sendPaginated: <T = any>(res: Response, data: T[], pagination: {
    page: number;
    limit: number;
    total: number;
}, message?: string) => Response;
declare const _default: {
    successResponse: <T = any>(res: Response, options?: {
        data?: T;
        message?: string;
        meta?: any;
        statusCode?: number;
    } | any) => Response;
    errorResponse: (res: Response, message?: string, statusCode?: number, error?: any) => Response;
    sendSuccess: <T = any>(res: Response, data?: T, message?: string, statusCode?: number) => Response;
    sendError: (res: Response, message?: string, statusCode?: number, error?: any) => Response;
    validationErrorResponse: (res: Response, errors: any[]) => Response;
    paginatedResponse: <T = any>(res: Response, options: {
        data: T[];
        page: number;
        limit: number;
        total: number;
        message?: string;
    }) => Response;
    sendPaginated: <T = any>(res: Response, data: T[], pagination: {
        page: number;
        limit: number;
        total: number;
    }, message?: string) => Response;
};
export default _default;
//# sourceMappingURL=response.d.ts.map