"use strict";
// src/modules/contacts/contacts.controller.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactsController = exports.ContactsController = void 0;
const contacts_service_1 = require("./contacts.service");
const response_1 = require("../../utils/response");
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const contacts_features_1 = require("./contacts.features");
const phoneInternational_1 = require("../../utils/phoneInternational");
class ContactsController {
    // ==========================================
    // CREATE CONTACT
    // ==========================================
    async create(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const input = req.body;
            const contact = await contacts_service_1.contactsService.create(organizationId, input);
            const message = contact.whatsappProfileFetched
                ? 'Contact created with provided name'
                : 'Contact created - name will update when they send a message';
            (0, response_1.sendSuccess)(res, contact, message, 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CONTACTS LIST
    // ==========================================
    async getList(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const query = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
                search: req.query.search,
                status: req.query.status,
                tags: req.query.tags ? req.query.tags.split(',') : undefined,
                groupId: req.query.groupId,
                sortBy: req.query.sortBy || 'createdAt',
                sortOrder: req.query.sortOrder || 'desc',
                hasWhatsAppProfile: req.query.hasWhatsAppProfile === 'true' ? true :
                    req.query.hasWhatsAppProfile === 'false' ? false : undefined,
            };
            const result = await contacts_service_1.contactsService.getList(organizationId, query);
            res.json({
                success: true,
                message: 'Contacts fetched successfully',
                data: result.contacts,
                meta: result.meta,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CONTACT BY ID
    // ==========================================
    async getById(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const contact = await contacts_service_1.contactsService.getById(organizationId, id);
            (0, response_1.sendSuccess)(res, contact, 'Contact fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // UPDATE CONTACT
    // ==========================================
    async update(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const input = req.body;
            const contact = await contacts_service_1.contactsService.update(organizationId, id, input);
            (0, response_1.sendSuccess)(res, contact, 'Contact updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DELETE CONTACT
    // ==========================================
    async delete(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            const userId = req.user?.id; // ✅ NEW
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id;
            const result = await contacts_service_1.contactsService.delete(organizationId, id, userId); // ✅ Pass userId
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // IMPORT CONTACTS (FIXED)
    // ==========================================
    async import(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            let input = req.body;
            // ✅ Handle file upload (multer)
            const file = req.file;
            if (file) {
                const csvData = file.buffer.toString('utf-8');
                console.log(`📁 Received CSV file: ${file.originalname}, Size: ${file.size} bytes`);
                input.csvData = csvData;
            }
            // ✅ Handle raw CSV in body
            if (req.body.csvData && typeof req.body.csvData === 'string') {
                input.csvData = req.body.csvData;
            }
            // ✅ Handle contacts array directly
            if (req.body.contacts && Array.isArray(req.body.contacts)) {
                input.contacts = req.body.contacts;
            }
            // Get tags
            if (req.body.tags) {
                if (typeof req.body.tags === 'string') {
                    try {
                        input.tags = JSON.parse(req.body.tags);
                    }
                    catch {
                        input.tags = req.body.tags.split(',').map((t) => t.trim());
                    }
                }
                else if (Array.isArray(req.body.tags)) {
                    input.tags = req.body.tags;
                }
            }
            // Get group info
            input.groupId = req.body.groupId;
            input.groupName = req.body.groupName;
            console.log('Import input:', {
                hasCSVData: !!input.csvData,
                csvLength: input.csvData?.length,
                contactsCount: input.contacts?.length,
                tags: input.tags,
                groupId: input.groupId,
                groupName: input.groupName,
            });
            const result = await contacts_service_1.contactsService.import(organizationId, input);
            const message = result.failed > 0
                ? `Imported ${result.imported} contacts. ${result.failed} failed (only Indian +91 numbers allowed).`
                : `Successfully imported ${result.imported} contacts.`;
            (0, response_1.sendSuccess)(res, result, message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // BULK UPDATE CONTACTS
    // ==========================================
    async bulkUpdate(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const input = req.body;
            const result = await contacts_service_1.contactsService.bulkUpdate(organizationId, input);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // BULK DELETE CONTACTS
    // ==========================================
    async bulkDelete(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            const userId = req.user?.id; // ✅ NEW
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { contactIds } = req.body;
            const result = await contacts_service_1.contactsService.bulkDelete(organizationId, contactIds, userId); // ✅
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DELETE ALL CONTACTS
    // ==========================================
    async deleteAll(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            const userId = req.user?.id; // ✅ NEW
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const result = await contacts_service_1.contactsService.deleteAll(organizationId, userId); // ✅
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CONTACT STATS
    // ==========================================
    async getStats(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const stats = await contacts_service_1.contactsService.getStats(organizationId);
            (0, response_1.sendSuccess)(res, stats, 'Stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET ALL TAGS
    // ==========================================
    async getTags(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const tags = await contacts_service_1.contactsService.getAllTags(organizationId);
            (0, response_1.sendSuccess)(res, tags, 'Tags fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // EXPORT CONTACTS
    // ==========================================
    async export(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { groupId } = req.query;
            const contacts = await contacts_service_1.contactsService.export(organizationId, groupId);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
            if (contacts.length === 0) {
                res.send('No contacts found');
                return;
            }
            const headers = Object.keys(contacts[0]).join(',');
            const rows = contacts.map((contact) => Object.values(contact)
                .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                .join(','));
            const csv = [headers, ...rows].join('\n');
            res.send(csv);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // REFRESH UNKNOWN NAMES (NEW)
    // ==========================================
    async refreshUnknownNames(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const result = await contacts_service_1.contactsService.refreshUnknownNames(organizationId);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // CONTACT GROUPS
    // ==========================================
    async createGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const input = req.body;
            const group = await contacts_service_1.contactsService.createGroup(organizationId, input);
            (0, response_1.sendSuccess)(res, group, 'Group created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    async getGroups(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groups = await contacts_service_1.contactsService.getGroups(organizationId);
            (0, response_1.sendSuccess)(res, groups, 'Groups fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async getGroupById(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groupId = req.params.groupId;
            const group = await contacts_service_1.contactsService.getGroupById(organizationId, groupId);
            (0, response_1.sendSuccess)(res, group, 'Group fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groupId = req.params.groupId;
            const input = req.body;
            const group = await contacts_service_1.contactsService.updateGroup(organizationId, groupId, input);
            (0, response_1.sendSuccess)(res, group, 'Group updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deleteGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groupId = req.params.groupId;
            const result = await contacts_service_1.contactsService.deleteGroup(organizationId, groupId);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async addContactsToGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groupId = req.params.groupId;
            const { contactIds } = req.body;
            const result = await contacts_service_1.contactsService.addContactsToGroup(organizationId, groupId, contactIds);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async removeContactsFromGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groupId = req.params.groupId;
            const { contactIds } = req.body;
            const result = await contacts_service_1.contactsService.removeContactsFromGroup(organizationId, groupId, contactIds);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async getGroupContacts(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groupId = req.params.groupId;
            const query = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
                search: req.query.search,
                sortBy: req.query.sortBy || 'createdAt',
                sortOrder: req.query.sortOrder || 'desc',
            };
            const result = await contacts_service_1.contactsService.getGroupContacts(organizationId, groupId, query);
            res.json({
                success: true,
                message: 'Group contacts fetched successfully',
                data: result.contacts,
                meta: result.meta,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // FEATURE ACCESS
    // ============================================
    async getFeatureAccess(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization not found', 404);
            }
            const access = await contacts_features_1.contactFeaturesService.getFeatureAccess(organizationId);
            return res.json({
                success: true,
                data: access
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // GET COUNTRY CODES
    // ============================================
    async getCountryCodes(req, res) {
        return res.json({
            success: true,
            data: phoneInternational_1.COUNTRY_CODES
        });
    }
    // ============================================
    // SIMPLE BULK PASTE (₹2,500+ Plans)
    // ============================================
    async simpleBulkPaste(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization not found', 404);
            }
            // ✅ Check feature access (Quarterly+)
            await contacts_features_1.contactFeaturesService.validateAccess(organizationId, 'simpleBulkPaste');
            const { phoneNumbers, // Raw string with numbers
            // ❌ No countryCode parameter - auto detect
            tags = [], groupId } = req.body;
            if (!phoneNumbers || typeof phoneNumbers !== 'string') {
                throw new errorHandler_1.AppError('Phone numbers are required', 400);
            }
            // ✅ Parse with auto-detection
            const { valid, invalid } = (0, phoneInternational_1.parseMultiplePhones)(phoneNumbers);
            if (valid.length === 0) {
                throw new errorHandler_1.AppError('No valid phone numbers found. Make sure to include country code (e.g., +91, +1)', 400);
            }
            // ✅ Limit check
            const MAX_BULK = 5000;
            if (valid.length > MAX_BULK) {
                throw new errorHandler_1.AppError(`Maximum ${MAX_BULK} contacts per upload`, 400);
            }
            // 1. Identify deleted contacts
            const deletedContacts = await database_1.default.contact.findMany({
                where: {
                    organizationId,
                    phone: { in: valid.map(p => p.fullNumber) },
                    status: 'DELETED'
                },
                select: { id: true, phone: true }
            });
            // 2. Restore deleted contacts
            let restoredCount = 0;
            if (deletedContacts.length > 0) {
                const restored = await database_1.default.contact.updateMany({
                    where: {
                        id: { in: deletedContacts.map(c => c.id) }
                    },
                    data: {
                        status: 'ACTIVE',
                        deletedAt: null,
                        deletedBy: null,
                        source: 'BULK_PASTE'
                    }
                });
                restoredCount = restored.count;
            }
            // 3. Get existing contacts (check duplicates)
            const existingContacts = await database_1.default.contact.findMany({
                where: {
                    organizationId,
                    phone: { in: valid.map(p => p.fullNumber) }
                },
                select: { phone: true }
            });
            const existingPhones = new Set(existingContacts.map(c => c.phone));
            const newContacts = valid.filter(p => !existingPhones.has(p.fullNumber));
            // 4. Create contacts
            const contactsToCreate = newContacts.map((parsed, index) => ({
                organizationId,
                phone: parsed.fullNumber,
                countryCode: parsed.countryCode,
                firstName: `Contact ${index + 1}`,
                tags: Array.isArray(tags) ? tags : [],
                source: 'BULK_PASTE',
                status: 'ACTIVE'
            }));
            let createdCount = 0;
            if (contactsToCreate.length > 0) {
                const result = await database_1.default.contact.createMany({
                    data: contactsToCreate,
                    skipDuplicates: true
                });
                createdCount = result.count;
            }
            // 5. Add to group if specified
            const totalProcessedCount = createdCount + restoredCount;
            if (groupId && totalProcessedCount > 0) {
                const processedPhones = [
                    ...newContacts.map(p => p.fullNumber),
                    ...deletedContacts.map(c => c.phone)
                ];
                const contactIds = await database_1.default.contact.findMany({
                    where: {
                        organizationId,
                        phone: { in: processedPhones }
                    },
                    select: { id: true }
                });
                await database_1.default.contactGroupMember.createMany({
                    data: contactIds.map(c => ({
                        groupId,
                        contactId: c.id
                    })),
                    skipDuplicates: true
                });
            }
            let message = '';
            if (createdCount > 0 && restoredCount > 0) {
                message = `${createdCount} created, ${restoredCount} restored successfully`;
            }
            else if (createdCount > 0) {
                message = `${createdCount} contacts created successfully`;
            }
            else if (restoredCount > 0) {
                message = `${restoredCount} contacts restored successfully`;
            }
            else {
                message = 'All contacts already exist as active contacts';
            }
            return res.json({
                success: true,
                data: {
                    totalInput: valid.length + invalid.length,
                    validNumbers: valid.length,
                    invalidNumbers: invalid.length,
                    created: createdCount + restoredCount, // Sum to trigger onSuccess
                    newCreated: createdCount,
                    restored: restoredCount,
                    duplicatesSkipped: valid.length - createdCount - restoredCount,
                    invalidDetails: invalid.slice(0, 10) // Return first 10 invalid
                },
                message
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // CSV UPLOAD (₹899+ Plans)
    // ============================================
    async csvUpload(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization not found', 404);
            }
            // ✅ Check feature access (Monthly+)
            await contacts_features_1.contactFeaturesService.validateAccess(organizationId, 'csvUpload');
            const { contacts, // Array of contact objects from CSV
            groupId, tags = [] } = req.body;
            if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
                throw new errorHandler_1.AppError('No contacts provided', 400);
            }
            // ✅ Limit check
            const MAX_CSV = 10000;
            if (contacts.length > MAX_CSV) {
                throw new errorHandler_1.AppError(`Maximum ${MAX_CSV} contacts per CSV upload`, 400);
            }
            const results = {
                created: 0,
                updated: 0,
                skipped: 0,
                errors: []
            };
            // 1. Pre-process and validate phone numbers
            const phoneToContactMap = new Map();
            const validPhones = [];
            for (const contact of contacts) {
                const phoneInput = contact.phone || contact.phoneNumber || contact.mobile;
                if (!phoneInput) {
                    results.skipped++;
                    continue;
                }
                const { valid } = (0, phoneInternational_1.parseMultiplePhones)(String(phoneInput));
                if (valid.length === 0) {
                    results.skipped++;
                    results.errors.push(`Invalid: ${phoneInput}`);
                    continue;
                }
                const parsed = valid[0];
                // If multiple contacts have the same phone in the same CSV, last one wins or we can handle it
                if (!phoneToContactMap.has(parsed.fullNumber)) {
                    validPhones.push(parsed.fullNumber);
                }
                phoneToContactMap.set(parsed.fullNumber, {
                    ...contact,
                    fullNumber: parsed.fullNumber,
                    countryCode: parsed.countryCode
                });
            }
            if (validPhones.length === 0) {
                return res.json({
                    success: true,
                    data: results,
                    message: 'No valid contacts found to process'
                });
            }
            // 2. Fetch existing contacts in one query
            const existingContacts = await database_1.default.contact.findMany({
                where: {
                    organizationId,
                    phone: { in: validPhones }
                },
                select: { id: true, phone: true, firstName: true, lastName: true, email: true }
            });
            const existingPhoneMap = new Map(existingContacts.map(c => [c.phone, c]));
            const news = [];
            const updates = [];
            // 3. Categorize into news and updates
            for (const [fullPhone, contactData] of phoneToContactMap.entries()) {
                const existing = existingPhoneMap.get(fullPhone);
                if (existing) {
                    updates.push({
                        id: existing.id,
                        data: {
                            firstName: contactData.firstName || contactData.first_name || existing.firstName,
                            lastName: contactData.lastName || contactData.last_name || existing.lastName,
                            email: contactData.email || existing.email,
                            tags: Array.isArray(tags) && tags.length > 0 ? { push: tags } : undefined
                        }
                    });
                }
                else {
                    news.push({
                        organizationId,
                        phone: fullPhone,
                        countryCode: contactData.countryCode,
                        firstName: contactData.firstName || contactData.first_name || 'Unknown',
                        lastName: contactData.lastName || contactData.last_name || undefined,
                        email: contactData.email || undefined,
                        tags: tags,
                        source: 'CSV_IMPORT',
                        status: 'ACTIVE'
                    });
                }
            }
            // 4. Bulk Create
            if (news.length > 0) {
                const createResult = await database_1.default.contact.createMany({
                    data: news,
                    skipDuplicates: true
                });
                results.created = createResult.count;
            }
            // 5. Sequential or Batched Updates (Prisma doesn't have bulk unique update)
            // We'll do them in small batches or Promise.all to speed up, 
            // but for very large numbers we still need to be careful.
            // 50-100 updates at a time is usually fine.
            if (updates.length > 0) {
                const updateBatchSize = 100;
                for (let i = 0; i < updates.length; i += updateBatchSize) {
                    const batch = updates.slice(i, i + updateBatchSize);
                    await Promise.all(batch.map(u => database_1.default.contact.update({
                        where: { id: u.id },
                        data: u.data
                    }).catch(err => {
                        results.errors.push(`Update failed for ${u.id}: ${err.message}`);
                    })));
                }
                results.updated = updates.length;
            }
            // 6. Bulk Add to Group if specified
            if (groupId && (results.created > 0 || results.updated > 0)) {
                // Fetch fresh IDs for new contacts
                const allTargetContactIds = await database_1.default.contact.findMany({
                    where: {
                        organizationId,
                        phone: { in: validPhones }
                    },
                    select: { id: true }
                });
                const memberData = allTargetContactIds.map(c => ({
                    groupId,
                    contactId: c.id
                }));
                await database_1.default.contactGroupMember.createMany({
                    data: memberData,
                    skipDuplicates: true
                }).catch(() => { });
            }
            return res.json({
                success: true,
                data: {
                    totalProcessed: contacts.length,
                    created: results.created,
                    updated: results.updated,
                    skipped: results.skipped,
                    errors: results.errors.slice(0, 10)
                },
                message: `${results.created} created, ${results.updated} updated`
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET IMPORT STATS
    // ==========================================
    async getImportStats(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const stats = await contacts_service_1.contactsService.getImportStats(organizationId);
            (0, response_1.sendSuccess)(res, stats, 'Import stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ContactsController = ContactsController;
exports.contactsController = new ContactsController();
//# sourceMappingURL=contacts.controller.js.map