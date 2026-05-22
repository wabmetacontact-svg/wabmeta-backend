import { Request, Response, NextFunction } from 'express';
interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        organizationId?: string;
    };
}
export declare class AuthController {
    sendPhoneOTP(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    verifyPhoneOTPAndRegister(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    register(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    login(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    verifyEmail(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    resendVerification(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    forgotPassword(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    resetPassword(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    sendOTP(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    verifyOTP(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    googleAuth(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    refreshToken(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    logout(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    logoutAll(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    me(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const authController: AuthController;
export {};
//# sourceMappingURL=auth.controller.d.ts.map