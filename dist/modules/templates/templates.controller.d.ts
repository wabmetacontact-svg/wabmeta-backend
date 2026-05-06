import { Request, Response, NextFunction } from 'express';
declare class TemplatesController {
    private getDefaultAccountId;
    private getWabaIdForAccount;
    create(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getList(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getById(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    update(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    delete(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    duplicate(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getStats(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    preview(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getApproved(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getLanguages(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    submit(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    sync(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    checkConnection(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    uploadToMeta(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    reuploadMedia(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    fixMedia(req: any, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const templatesController: TemplatesController;
export default templatesController;
//# sourceMappingURL=templates.controller.d.ts.map