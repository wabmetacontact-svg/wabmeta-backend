import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            requestId?: string;
            startTime?: number;
        }
    }
}
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
export default requestLogger;
//# sourceMappingURL=requestLogger.d.ts.map