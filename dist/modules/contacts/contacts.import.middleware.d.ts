import { NextFunction, Request, Response } from 'express';
/**
 * ✅ FIXED Middleware - handles:
 * 1) JSON { contacts: [...] }
 * 2) JSON array [...] → wrapped
 * 3) multipart CSV file → parsed
 * 4) International phone numbers ✅
 */
export declare const contactsImportMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=contacts.import.middleware.d.ts.map