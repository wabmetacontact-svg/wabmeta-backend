import { Request, Response, NextFunction } from 'express';
declare class CallingController {
    getSettings(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateSettings(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    initiateCall(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getCallLogs(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const callingController: CallingController;
export {};
//# sourceMappingURL=calling.controller.d.ts.map