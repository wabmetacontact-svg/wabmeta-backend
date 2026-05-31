import { CreateContactInput, UpdateContactInput, ImportContactsInput, BulkUpdateContactsInput, ContactsQueryInput, ContactResponse, ContactWithGroups, ContactsListResponse, ImportContactsResponse, ContactStats, CreateContactGroupInput, UpdateContactGroupInput, ContactGroupResponse } from './contacts.types';
export declare class ContactsService {
    /**
     * ✅ Validate and normalize phone (throws error if invalid)
     */
    private validateAndNormalizePhone;
    /**
     * ✅ Try to normalize phone - returns full number if valid, returns null if invalid.
     */
    private tryNormalizePhone;
    updateContactFromWebhook(phone: string, profileName: string, organizationId: string): Promise<ContactResponse | null>;
    refreshUnknownNames(organizationId: string): Promise<{
        total: number;
        updated: number;
        message: string;
    }>;
    create(organizationId: string, input: CreateContactInput): Promise<ContactResponse>;
    getList(organizationId: string, query: ContactsQueryInput): Promise<ContactsListResponse>;
    getById(organizationId: string, contactId: string): Promise<ContactWithGroups>;
    update(organizationId: string, contactId: string, input: UpdateContactInput): Promise<ContactResponse>;
    delete(organizationId: string, contactId: string): Promise<{
        message: string;
    }>;
    import(organizationId: string, input: ImportContactsInput & {
        groupName?: string;
        csvData?: string;
    }): Promise<ImportContactsResponse>;
    private parseCSV;
    private parseCSVLine;
    bulkUpdate(organizationId: string, input: BulkUpdateContactsInput): Promise<{
        message: string;
        updated: number;
    }>;
    bulkDelete(organizationId: string, contactIds: string[]): Promise<{
        message: string;
        deleted: number;
    }>;
    deleteAll(organizationId: string): Promise<{
        message: string;
        deleted: number;
    }>;
    getStats(organizationId: string): Promise<ContactStats>;
    getAllTags(organizationId: string): Promise<{
        tag: string;
        count: number;
    }[]>;
    export(organizationId: string, groupId?: string): Promise<any[]>;
    createGroup(organizationId: string, input: CreateContactGroupInput): Promise<ContactGroupResponse>;
    getGroups(organizationId: string): Promise<ContactGroupResponse[]>;
    getGroupById(organizationId: string, groupId: string): Promise<ContactGroupResponse & {
        contacts: ContactResponse[];
    }>;
    updateGroup(organizationId: string, groupId: string, input: UpdateContactGroupInput): Promise<ContactGroupResponse>;
    deleteGroup(organizationId: string, groupId: string): Promise<{
        message: string;
    }>;
    addContactsToGroup(organizationId: string, groupId: string, contactIds: string[]): Promise<{
        message: string;
        added: number;
    }>;
    removeContactsFromGroup(organizationId: string, groupId: string, contactIds: string[]): Promise<{
        message: string;
        removed: number;
    }>;
    getGroupContacts(organizationId: string, groupId: string, query: ContactsQueryInput): Promise<ContactsListResponse>;
    getImportStats(organizationId: string): Promise<{
        totalContacts: number;
        maxContacts: number;
        remainingSlots: number;
        planName: string;
        canImport: boolean;
        maxPerImport: number;
    }>;
}
export declare const contactsService: ContactsService;
//# sourceMappingURL=contacts.service.d.ts.map