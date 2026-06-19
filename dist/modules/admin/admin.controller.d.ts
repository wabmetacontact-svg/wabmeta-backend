import { Request, Response, NextFunction } from 'express';
interface AdminRequest extends Request {
    admin?: {
        id: string;
        email: string;
        role: string;
        name?: string;
    };
}
export declare class AdminController {
    login(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getProfile(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getDashboardStats(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getUsers(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getUserById(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateUser(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateUserStatus(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    suspendUser(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    activateUser(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateUserPassword(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    deleteUser(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    transferOwnership(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getOrganizations(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getOrganizationById(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateOrganization(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    deleteOrganization(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateSubscription(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getOrganizationFeatures(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateOrganizationFeatures(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getPlans(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    createPlan(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updatePlan(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    deletePlan(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getAdmins(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    createAdmin(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateAdmin(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    deleteAdmin(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getActivityLogs(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getSystemSettings(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateSystemSettings(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    assignPlan(req: AdminRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    extendSubscription(req: AdminRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    revokeSubscription(req: AdminRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    getSubscriptions(req: AdminRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    getSubscriptionStats(req: AdminRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    getWhatsAppStats(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    updateConnectionType(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getWhatsAppConnections(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    disconnectWhatsAppAccount(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    adminGetAllWallets(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    adminGetWalletRequests(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    adminReviewWalletRequest(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    adminAdjustWalletBalance(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    adminSetWalletCredit(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    adminFlagWallet(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getUserContacts(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    exportUserContacts(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getUserTemplates(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getUserAnalytics(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getUserWallet(req: AdminRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const adminController: AdminController;
export {};
//# sourceMappingURL=admin.controller.d.ts.map