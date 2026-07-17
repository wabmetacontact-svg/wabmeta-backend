"use strict";
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
// ─── CSV Injection Protection ─────────────────────────────────
// ✅ FIX Bug4: Escape values that could be formula injections
const escapeCsvValue = (value) => {
    const str = String(value ?? '').replace(/"/g, '""');
    // Escape formula injection characters
    if (/^[=+\-@\t\r]/.test(str)) {
        return `"'${str}"`;
    }
    return `"${str}"`;
};
class ContactsController {
    // ── CREATE ──────────────────────────────────────────────────
    async create(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const input = req.body;
            const contact = await contacts_service_1.contactsService.create(organizationId, input);
            (0, response_1.sendSuccess)(res, contact, 'Contact created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ── LIST ────────────────────────────────────────────────────
    async getList(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            // ✅ FIX Bug5: Validated bounds
            const rawPage = parseInt(req.query.page) || 1;
            const rawLimit = parseInt(req.query.limit) || 20;
            const query = {
                page: Math.max(1, rawPage),
                limit: Math.min(500, Math.max(1, rawLimit)), // ✅ Max 500
                search: req.query.search?.trim() || undefined,
                status: req.query.status,
                tags: req.query.tags
                    ? req.query.tags.split(',').filter(Boolean)
                    : undefined,
                groupId: req.query.groupId || undefined,
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
    // ── GET BY ID ───────────────────────────────────────────────
    async getById(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const contact = await contacts_service_1.contactsService.getById(organizationId, req.params.id);
            (0, response_1.sendSuccess)(res, contact, 'Contact fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ── UPDATE ──────────────────────────────────────────────────
    async update(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const input = req.body;
            const contact = await contacts_service_1.contactsService.update(organizationId, req.params.id, input);
            (0, response_1.sendSuccess)(res, contact, 'Contact updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ── DELETE ──────────────────────────────────────────────────
    async delete(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            const userId = req.user?.id;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const result = await contacts_service_1.contactsService.delete(organizationId, req.params.id, userId);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ── IMPORT ──────────────────────────────────────────────────
    // ✅ FIX Bug1: Clean separation of file/body parsing
    async import(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            // ✅ Build clean input object
            const input = {};
            // File upload (multer)
            const file = req.file;
            if (file) {
                input.csvData = file.buffer.toString('utf-8');
            }
            // Raw CSV in body
            if (!input.csvData && req.body.csvData) {
                input.csvData = String(req.body.csvData);
            }
            // Contacts array
            if (Array.isArray(req.body.contacts)) {
                input.contacts = req.body.contacts;
            }
            // Tags
            if (req.body.tags) {
                if (Array.isArray(req.body.tags)) {
                    input.tags = req.body.tags;
                }
                else if (typeof req.body.tags === 'string') {
                    try {
                        input.tags = JSON.parse(req.body.tags);
                    }
                    catch {
                        input.tags = req.body.tags.split(',').map((t) => t.trim()).filter(Boolean);
                    }
                }
            }
            else {
                input.tags = [];
            }
            // Group
            if (req.body.groupId)
                input.groupId = String(req.body.groupId);
            if (req.body.groupName)
                input.groupName = String(req.body.groupName);
            if (!input.csvData && !input.contacts?.length) {
                throw new errorHandler_1.AppError('No contact data provided', 400);
            }
            const result = await contacts_service_1.contactsService.import(organizationId, input);
            const message = result.failed > 0
                ? `Imported ${result.imported} contacts. ${result.failed} failed.`
                : `Successfully imported ${result.imported} contacts.`;
            (0, response_1.sendSuccess)(res, result, message);
        }
        catch (error) {
            next(error);
        }
    }
    // ── BULK UPDATE ─────────────────────────────────────────────
    async bulkUpdate(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const input = req.body;
            if (!Array.isArray(input.contactIds) || input.contactIds.length === 0) {
                throw new errorHandler_1.AppError('contactIds array required', 400);
            }
            const result = await contacts_service_1.contactsService.bulkUpdate(organizationId, input);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ── BULK DELETE ─────────────────────────────────────────────
    async bulkDelete(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            const userId = req.user?.id;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { contactIds } = req.body;
            if (!Array.isArray(contactIds) || contactIds.length === 0) {
                throw new errorHandler_1.AppError('contactIds array required', 400);
            }
            const result = await contacts_service_1.contactsService.bulkDelete(organizationId, contactIds, userId);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ── DELETE ALL ──────────────────────────────────────────────
    async deleteAll(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            const userId = req.user?.id;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const result = await contacts_service_1.contactsService.deleteAll(organizationId, userId);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ── STATS ───────────────────────────────────────────────────
    async getStats(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const stats = await contacts_service_1.contactsService.getStats(organizationId);
            (0, response_1.sendSuccess)(res, stats, 'Stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ── TAGS ────────────────────────────────────────────────────
    async getTags(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const tags = await contacts_service_1.contactsService.getAllTags(organizationId);
            (0, response_1.sendSuccess)(res, tags, 'Tags fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ── EXPORT ──────────────────────────────────────────────────
    async export(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { groupId } = req.query;
            const contacts = await contacts_service_1.contactsService.export(organizationId, groupId);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
            if (contacts.length === 0) {
                res.send('No contacts found');
                return;
            }
            // ✅ FIX Bug4: CSV injection protection
            const headers = Object.keys(contacts[0]).join(',');
            const rows = contacts.map(contact => Object.values(contact)
                .map(v => escapeCsvValue(String(v ?? '')))
                .join(','));
            res.send([headers, ...rows].join('\n'));
        }
        catch (error) {
            next(error);
        }
    }
    // ── REFRESH UNKNOWN NAMES ───────────────────────────────────
    async refreshUnknownNames(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const result = await contacts_service_1.contactsService.refreshUnknownNames(organizationId);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ── GROUP CRUD ──────────────────────────────────────────────
    async createGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const input = req.body;
            if (!input.name?.trim()) {
                throw new errorHandler_1.AppError('Group name is required', 400);
            }
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
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
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
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const group = await contacts_service_1.contactsService.getGroupById(organizationId, req.params.groupId);
            (0, response_1.sendSuccess)(res, group, 'Group fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const input = req.body;
            const group = await contacts_service_1.contactsService.updateGroup(organizationId, req.params.groupId, input);
            (0, response_1.sendSuccess)(res, group, 'Group updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deleteGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const result = await contacts_service_1.contactsService.deleteGroup(organizationId, req.params.groupId);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async addContactsToGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { contactIds } = req.body;
            if (!Array.isArray(contactIds) || contactIds.length === 0) {
                throw new errorHandler_1.AppError('contactIds array required', 400);
            }
            const result = await contacts_service_1.contactsService.addContactsToGroup(organizationId, req.params.groupId, contactIds);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async removeContactsFromGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { contactIds } = req.body;
            if (!Array.isArray(contactIds) || contactIds.length === 0) {
                throw new errorHandler_1.AppError('contactIds array required', 400);
            }
            const result = await contacts_service_1.contactsService.removeContactsFromGroup(organizationId, req.params.groupId, contactIds);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async getGroupContacts(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const rawPage = parseInt(req.query.page) || 1;
            const rawLimit = parseInt(req.query.limit) || 20;
            const query = {
                page: Math.max(1, rawPage),
                limit: Math.min(500, Math.max(1, rawLimit)),
                search: req.query.search?.trim() || undefined,
                sortBy: req.query.sortBy || 'createdAt',
                sortOrder: req.query.sortOrder || 'desc',
            };
            const result = await contacts_service_1.contactsService.getGroupContacts(organizationId, req.params.groupId, query);
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
    // ── FEATURE ACCESS ──────────────────────────────────────────
    async getFeatureAccess(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization not found', 404);
            const access = await contacts_features_1.contactFeaturesService.getFeatureAccess(organizationId);
            return res.json({ success: true, data: access });
        }
        catch (error) {
            next(error);
        }
    }
    // ── COUNTRY CODES ───────────────────────────────────────────
    async getCountryCodes(req, res) {
        return res.json({ success: true, data: phoneInternational_1.COUNTRY_CODES });
    }
    // ── SIMPLE BULK PASTE ───────────────────────────────────────
    async simpleBulkPaste(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization not found', 404);
            await contacts_features_1.contactFeaturesService.validateAccess(organizationId, 'simpleBulkPaste');
            const { phoneNumbers, tags = [], groupId } = req.body;
            if (!phoneNumbers || typeof phoneNumbers !== 'string') {
                throw new errorHandler_1.AppError('Phone numbers string required', 400);
            }
            const { valid, invalid } = (0, phoneInternational_1.parseMultiplePhones)(phoneNumbers);
            if (valid.length === 0) {
                throw new errorHandler_1.AppError('No valid phone numbers found. Include country code (e.g. +91, +1).', 400);
            }
            const MAX_BULK = 5000;
            if (valid.length > MAX_BULK) {
                throw new errorHandler_1.AppError(`Maximum ${MAX_BULK} contacts per upload`, 400);
            }
            const phones = valid.map(p => p.fullNumber);
            // 1. Find existing (active + deleted)
            const existing = await database_1.default.contact.findMany({
                where: { organizationId, phone: { in: phones } },
                select: { id: true, phone: true, status: true },
            });
            const existingMap = new Map(existing.map(c => [c.phone, c]));
            const toRestore = existing
                .filter(c => c.status === 'DELETED')
                .map(c => c.id);
            const existingActive = new Set(existing.filter(c => c.status !== 'DELETED').map(c => c.phone));
            const toCreate = valid.filter(p => !existingMap.has(p.fullNumber));
            // 2. Restore deleted
            let restoredCount = 0;
            if (toRestore.length > 0) {
                const r = await database_1.default.contact.updateMany({
                    where: { id: { in: toRestore } },
                    data: { status: 'ACTIVE', deletedAt: null, deletedBy: null, source: 'BULK_PASTE' },
                });
                restoredCount = r.count;
            }
            // 3. Create new
            // ✅ FIX Bug3: Use 'Unknown' instead of generic "Contact N"
            let createdCount = 0;
            if (toCreate.length > 0) {
                const createData = toCreate.map(p => ({
                    organizationId,
                    phone: p.fullNumber,
                    countryCode: p.countryCode || '+91',
                    firstName: 'Unknown', // ✅ WhatsApp name baad mein update karega
                    tags: Array.isArray(tags) ? tags : [],
                    source: 'BULK_PASTE',
                    status: 'ACTIVE',
                }));
                const r = await database_1.default.contact.createMany({
                    data: createData,
                    skipDuplicates: true,
                });
                createdCount = r.count;
            }
            // 4. Add to group if specified
            const total = createdCount + restoredCount;
            if (groupId && total > 0) {
                const processedPhones = [
                    ...toCreate.map(p => p.fullNumber),
                    ...existing.filter(c => c.status === 'DELETED').map(c => c.phone),
                ];
                const contactIds = await database_1.default.contact.findMany({
                    where: { organizationId, phone: { in: processedPhones } },
                    select: { id: true },
                });
                await database_1.default.contactGroupMember.createMany({
                    data: contactIds.map(c => ({ groupId, contactId: c.id })),
                    skipDuplicates: true,
                });
            }
            const message = createdCount > 0 && restoredCount > 0
                ? `${createdCount} created, ${restoredCount} restored`
                : createdCount > 0
                    ? `${createdCount} contacts created`
                    : restoredCount > 0
                        ? `${restoredCount} contacts restored`
                        : 'All contacts already exist';
            return res.json({
                success: true,
                data: {
                    totalInput: valid.length + invalid.length,
                    validNumbers: valid.length,
                    invalidNumbers: invalid.length,
                    created: total,
                    newCreated: createdCount,
                    restored: restoredCount,
                    duplicatesSkipped: valid.length - total,
                    invalidDetails: invalid.slice(0, 10),
                },
                message,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ── CSV UPLOAD ──────────────────────────────────────────────
    async csvUpload(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization not found', 404);
            await contacts_features_1.contactFeaturesService.validateAccess(organizationId, 'csvUpload');
            const { contacts, groupId, tags = [] } = req.body;
            if (!Array.isArray(contacts) || contacts.length === 0) {
                throw new errorHandler_1.AppError('No contacts provided', 400);
            }
            const MAX_CSV = 10_000;
            if (contacts.length > MAX_CSV) {
                throw new errorHandler_1.AppError(`Maximum ${MAX_CSV} contacts per CSV upload`, 400);
            }
            const results = { created: 0, updated: 0, skipped: 0, errors: [] };
            // 1. Parse + validate phones
            const phoneToData = new Map();
            const validPhones = [];
            for (const c of contacts) {
                const raw = String(c.phone || c.phoneNumber || c.mobile || '').trim();
                if (!raw) {
                    results.skipped++;
                    continue;
                }
                const { valid } = (0, phoneInternational_1.parseMultiplePhones)(raw);
                if (!valid.length) {
                    results.skipped++;
                    results.errors.push(`Invalid: ${raw}`);
                    continue;
                }
                const full = valid[0].fullNumber;
                if (!phoneToData.has(full))
                    validPhones.push(full);
                phoneToData.set(full, {
                    ...c,
                    fullNumber: full,
                    countryCode: valid[0].countryCode,
                });
            }
            if (!validPhones.length) {
                return res.json({
                    success: true,
                    data: results,
                    message: 'No valid contacts found',
                });
            }
            // 2. Fetch existing
            const existing = await database_1.default.contact.findMany({
                where: { organizationId, phone: { in: validPhones } },
                select: { id: true, phone: true, firstName: true, lastName: true, email: true },
            });
            const existingMap = new Map(existing.map(c => [c.phone, c]));
            const toCreate = [];
            const toUpdate = [];
            for (const [phone, data] of phoneToData) {
                const ex = existingMap.get(phone);
                if (ex) {
                    toUpdate.push({
                        id: ex.id,
                        firstName: data.firstName || data.first_name || ex.firstName,
                        lastName: data.lastName || data.last_name || ex.lastName,
                        email: data.email || ex.email,
                    });
                }
                else {
                    toCreate.push({
                        organizationId,
                        phone,
                        countryCode: data.countryCode || '+91',
                        firstName: (data.firstName || data.first_name || 'Unknown').toString().trim(),
                        lastName: (data.lastName || data.last_name || '').toString().trim() || undefined,
                        email: (data.email || '').toString().trim() || undefined,
                        tags: Array.isArray(tags) ? tags : [],
                        source: 'CSV_IMPORT',
                        status: 'ACTIVE',
                    });
                }
            }
            // 3. Bulk create
            if (toCreate.length > 0) {
                const r = await database_1.default.contact.createMany({
                    data: toCreate,
                    skipDuplicates: true,
                });
                results.created = r.count;
            }
            // ✅ FIX Bug2: Sequential updates instead of parallel
            // Batch size of 25 to prevent DB overload
            if (toUpdate.length > 0) {
                const BATCH = 25;
                for (let i = 0; i < toUpdate.length; i += BATCH) {
                    const batch = toUpdate.slice(i, i + BATCH);
                    // Sequential in each batch
                    for (const u of batch) {
                        await database_1.default.contact.update({
                            where: { id: u.id },
                            data: {
                                firstName: u.firstName,
                                lastName: u.lastName || undefined,
                                email: u.email || undefined,
                                ...(tags.length > 0 ? { tags: { push: tags } } : {}),
                            },
                        }).catch(() => { results.errors.push(`Update failed: ${u.id}`); });
                    }
                }
                results.updated = toUpdate.length;
            }
            // 4. Add to group
            if (groupId && (results.created > 0 || results.updated > 0)) {
                const allIds = await database_1.default.contact.findMany({
                    where: { organizationId, phone: { in: validPhones } },
                    select: { id: true },
                });
                await database_1.default.contactGroupMember.createMany({
                    data: allIds.map(c => ({ groupId, contactId: c.id })),
                    skipDuplicates: true,
                }).catch(() => { });
            }
            return res.json({
                success: true,
                data: {
                    totalProcessed: contacts.length,
                    created: results.created,
                    updated: results.updated,
                    skipped: results.skipped,
                    errors: results.errors.slice(0, 10),
                },
                message: `${results.created} created, ${results.updated} updated`,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ── IMPORT STATS ────────────────────────────────────────────
    async getImportStats(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const stats = await contacts_service_1.contactsService.getImportStats(organizationId);
            (0, response_1.sendSuccess)(res, stats, 'Import stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ─── GET AUDIENCE COUNT ─────────────────────────────────────
    async getAudienceCount(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const type = String(req.query.type || 'all');
            const tags = req.query.tags ? String(req.query.tags).split(',').filter(Boolean) : [];
            const groupId = req.query.groupId ? String(req.query.groupId) : undefined;
            let count = 0;
            if (type === 'all') {
                count = await database_1.default.contact.count({
                    where: {
                        organizationId,
                        status: 'ACTIVE',
                    },
                });
            }
            else if (type === 'tags' && tags.length > 0) {
                count = await database_1.default.contact.count({
                    where: {
                        organizationId,
                        status: 'ACTIVE',
                        tags: { hasSome: tags },
                    },
                });
            }
            else if (type === 'group' && groupId) {
                count = await database_1.default.contactGroupMember.count({
                    where: {
                        groupId,
                        contact: {
                            organizationId,
                            status: 'ACTIVE',
                        },
                    },
                });
            }
            (0, response_1.sendSuccess)(res, { count, type }, 'Audience count fetched');
        }
        catch (error) {
            next(error);
        }
    }
    // ─── SEARCH CONTACTS (for manual selection) ─────────────────
    async searchContacts(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const query = String(req.query.q || '').trim();
            const limit = Math.min(50, parseInt(req.query.limit) || 30);
            // Empty query returns first N contacts
            const where = {
                organizationId,
                status: 'ACTIVE',
            };
            if (query.length >= 1) {
                where.OR = [
                    { phone: { contains: query, mode: 'insensitive' } },
                    { firstName: { contains: query, mode: 'insensitive' } },
                    { lastName: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                ];
            }
            const contacts = await database_1.default.contact.findMany({
                where,
                take: limit,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    countryCode: true,
                    email: true,
                    tags: true,
                    whatsappProfileName: true,
                },
                orderBy: [
                    { firstName: 'asc' },
                    { createdAt: 'desc' },
                ],
            });
            // Format response
            const formatted = contacts.map(c => ({
                id: c.id,
                name: c.whatsappProfileName ||
                    [c.firstName, c.lastName].filter(Boolean).join(' ') ||
                    c.phone,
                phone: c.phone,
                email: c.email,
                tags: c.tags || [],
            }));
            (0, response_1.sendSuccess)(res, { contacts: formatted, total: formatted.length }, 'Contacts found');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ContactsController = ContactsController;
exports.contactsController = new ContactsController();
//# sourceMappingURL=contacts.controller.js.map