import { Request, Response } from 'express';
declare class AnalyticsController {
    getOverview(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getUnifiedDashboard(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getMessageAnalytics(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getCampaignAnalytics(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getContactAnalytics(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getConversationAnalytics(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getTemplateAnalytics(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    exportAnalytics(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const analyticsController: AnalyticsController;
export {};
//# sourceMappingURL=analytics.controller.d.ts.map