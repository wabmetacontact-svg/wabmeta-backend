import { Request, Response } from 'express';
export declare const getWallet: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const requestAccess: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTransactions: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createTopUp: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const verifyTopUp: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getPendingTopUps: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const retryTopUp: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getMessageAnalytics: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const adminGetRequests: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const adminReviewRequest: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const adminGetAllWallets: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const adminAdjustBalance: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const adminSetCredit: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const adminFlagWallet: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const adminToggleWallet: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=wallet.controller.d.ts.map