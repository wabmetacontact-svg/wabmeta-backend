import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/express';
export declare class ContactsController {
    create(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getList(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    update(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    import(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    bulkUpdate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    bulkDelete(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    export(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    refreshUnknownNames(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    createGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getGroups(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getGroupById(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    addContactsToGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    removeContactsFromGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getGroupContacts(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getFeatureAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getCountryCodes(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    simpleBulkPaste(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    csvUpload(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getImportStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const contactsController: ContactsController;
//# sourceMappingURL=contacts.controller.d.ts.map