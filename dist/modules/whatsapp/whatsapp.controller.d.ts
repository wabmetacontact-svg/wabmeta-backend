import { Request, Response, NextFunction } from 'express';
declare class WhatsAppController {
    getAccounts(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    setDefaultAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    disconnectAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * ✅ FIXED: Send Text Message
     */
    sendText(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * ✅ FIXED: Send Template Message
     * Accepts multiple field name formats for flexibility
     */
    sendTemplate(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * ✅ FIXED: Send Media Message
     * Accepts multiple field name formats for flexibility
     */
    sendMedia(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
    /**
     * ✅ FIXED: Mark Message as Read
     */
    markAsRead(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const whatsappController: WhatsAppController;
export default whatsappController;
//# sourceMappingURL=whatsapp.controller.d.ts.map