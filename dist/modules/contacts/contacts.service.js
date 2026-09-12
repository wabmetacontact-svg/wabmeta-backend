"use strict";
// src/modules/contacts/contacts.service.ts - FINAL FIXED
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactsService = exports.ContactsService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const sync_1 = require("csv-parse/sync");
const errorHandler_1 = require("../../middleware/errorHandler");
const automation_engine_1 = require("../automation/automation.engine");
const phone_1 = require("../../utils/phone");
// ─── Formatters ───────────────────────────────────────────────
const formatContact = (contact) => ({
    id: contact.id,
    phone: contact.phone,
    countryCode: contact.countryCode,
    fullPhone: (0, phone_1.formatFullPhone)(contact.countryCode, contact.phone),
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.phone,
    email: contact.email,
    avatar: contact.avatar,
    tags: contact.tags || [],
    customFields: contact.customFields || {},
    status: contact.status,
    source: contact.source,
    lastMessageAt: contact.lastMessageAt,
    messageCount: contact.messageCount,
    whatsappProfileFetched: contact.whatsappProfileFetched || false,
    lastProfileFetchAt: contact.lastProfileFetchAt,
    profileFetchAttempts: contact.profileFetchAttempts || 0,
    whatsappProfileName: contact.whatsappProfileName,
    whatsappAbout: contact.whatsappAbout,
    whatsappProfilePicUrl: contact.whatsappProfilePicUrl,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
});
const formatContactWithGroups = (contact) => ({
    ...formatContact(contact),
    groups: contact.groupMemberships?.map((gm) => ({
        id: gm.group.id,
        name: gm.group.name,
        color: gm.group.color,
    })) || [],
});
const formatContactGroup = (group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    color: group.color,
    contactCount: group._count?.members || 0,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
});
// ─── Service ──────────────────────────────────────────────────
class ContactsService {
    // ── Phone helpers ────────────────────────────────────────
    validateAndNormalizePhone(phone) {
        const canonical = (0, phone_1.toCanonicalPhone)(phone);
        if (!canonical) {
            throw new errorHandler_1.AppError(`Invalid phone number: "${phone}". Include country code (e.g., +919876543210)`, 400);
        }
        return canonical;
    }
    tryNormalizePhone(phone) {
        if (!phone)
            return null;
        return (0, phone_1.toCanonicalPhone)(String(phone).trim());
    }
    // ── Webhook contact update ───────────────────────────────
    async updateContactFromWebhook(phone, profileName, organizationId) {
        try {
            const normalized = this.tryNormalizePhone(phone);
            if (!normalized)
                return null;
            const variants = (0, phone_1.buildPhoneVariants)(phone);
            let contact = await database_1.default.contact.findFirst({
                where: {
                    organizationId,
                    OR: variants.map(p => ({ phone: p })),
                },
            });
            if (contact) {
                const hasGoodName = profileName && profileName !== 'Unknown';
                const isUnknown = !contact.firstName ||
                    contact.firstName === 'Unknown' ||
                    contact.firstName === '';
                if (hasGoodName && (contact.firstName !== profileName || isUnknown)) {
                    try {
                        contact = await database_1.default.contact.update({
                            where: { id: contact.id },
                            data: {
                                firstName: profileName,
                                whatsappProfileName: profileName,
                                whatsappProfileFetched: true,
                                lastProfileFetchAt: new Date(),
                                // ✅ Normalize phone if old format
                                ...(contact.phone !== normalized ? { phone: normalized } : {}),
                            },
                        });
                    }
                    catch (e) {
                        if (e.code === 'P2002') {
                            contact = await database_1.default.contact.update({
                                where: { id: contact.id },
                                data: {
                                    firstName: profileName,
                                    whatsappProfileName: profileName,
                                    whatsappProfileFetched: true,
                                    lastProfileFetchAt: new Date(),
                                },
                            });
                        }
                        else
                            throw e;
                    }
                }
                return formatContact(contact);
            }
            // New contact - upsert
            try {
                contact = await database_1.default.contact.upsert({
                    where: {
                        organizationId_phone: { organizationId, phone: normalized },
                    },
                    create: {
                        organizationId,
                        phone: normalized,
                        countryCode: (0, phone_1.extractCountryCode)(normalized),
                        firstName: profileName || 'Unknown',
                        whatsappProfileName: profileName || null,
                        source: 'whatsapp',
                        status: 'ACTIVE',
                        whatsappProfileFetched: !!(profileName && profileName !== 'Unknown'),
                        lastProfileFetchAt: new Date(),
                    },
                    update: {
                        ...(profileName && profileName !== 'Unknown'
                            ? {
                                firstName: profileName,
                                whatsappProfileName: profileName,
                                whatsappProfileFetched: true,
                                lastProfileFetchAt: new Date(),
                            }
                            : {}),
                    },
                });
                const createdMsAgo = Date.now() - new Date(contact.createdAt).getTime();
                if (createdMsAgo < 5000) {
                    database_1.default.subscription.updateMany({
                        where: { organizationId },
                        data: { contactsUsed: { increment: 1 } },
                    }).catch((e) => console.error('Subscription update error:', e.message));
                }
                return formatContact(contact);
            }
            catch (e) {
                if (e.code === 'P2002') {
                    const fallback = await database_1.default.contact.findFirst({
                        where: {
                            organizationId,
                            OR: variants.map(p => ({ phone: p })),
                        },
                    });
                    return fallback ? formatContact(fallback) : null;
                }
                throw e;
            }
        }
        catch (error) {
            console.error('Error in updateContactFromWebhook:', error);
            return null;
        }
    }
    async refreshUnknownNames(organizationId) {
        const unknownContacts = await database_1.default.contact.findMany({
            where: {
                organizationId,
                OR: [
                    { firstName: null },
                    { firstName: 'Unknown' },
                    { whatsappProfileFetched: false },
                ],
            },
            take: 100,
        });
        return {
            total: unknownContacts.length,
            updated: 0,
            message: 'Names will be updated automatically when contacts send messages',
        };
    }
    // ── CREATE ───────────────────────────────────────────────
    async create(organizationId, input) {
        const canonical = (0, phone_1.toCanonicalPhone)(input.phone);
        if (!canonical)
            throw new errorHandler_1.AppError('Invalid phone number', 400);
        const variants = (0, phone_1.buildPhoneVariants)(canonical);
        const existing = await database_1.default.contact.findFirst({
            where: {
                organizationId,
                OR: variants.map(p => ({ phone: p })),
            },
        });
        if (existing) {
            if (existing.status === 'DELETED') {
                const restored = await database_1.default.contact.update({
                    where: { id: existing.id },
                    data: {
                        status: 'ACTIVE',
                        deletedAt: null,
                        deletedBy: null,
                        firstName: input.firstName || existing.firstName || 'Unknown',
                        lastName: input.lastName ?? existing.lastName,
                        email: input.email ?? existing.email,
                        tags: input.tags || existing.tags,
                        customFields: (input.customFields || existing.customFields),
                        updatedAt: new Date(),
                    },
                });
                const subscription = await database_1.default.subscription.findFirst({
                    where: { organizationId },
                });
                if (subscription) {
                    await database_1.default.subscription.update({
                        where: { id: subscription.id },
                        data: { contactsUsed: { increment: 1 } },
                    });
                }
                return formatContact(restored);
            }
            throw new errorHandler_1.AppError('Contact with this phone number already exists', 409);
        }
        const org = await database_1.default.organization.findUnique({
            where: { id: organizationId },
            include: {
                subscription: { include: { plan: true } },
                _count: { select: { contacts: true } },
            },
        });
        if (org?.subscription?.plan) {
            if (org._count.contacts >= org.subscription.plan.maxContacts) {
                throw new errorHandler_1.AppError('Contact limit reached. Please upgrade your plan.', 400);
            }
        }
        const contact = await database_1.default.contact.create({
            data: {
                organizationId,
                phone: canonical,
                countryCode: (0, phone_1.extractCountryCode)(canonical), // ✅ FIX Bug#1
                firstName: input.firstName || 'Unknown',
                lastName: input.lastName,
                email: input.email,
                tags: input.tags || [],
                customFields: input.customFields || {},
                source: 'manual',
                whatsappProfileFetched: !!input.firstName,
                profileFetchAttempts: 0,
            },
        });
        try {
            automation_engine_1.automationEngine.triggerNewContact({
                organizationId,
                contactId: contact.id,
                phone: contact.phone,
            });
        }
        catch (e) {
            console.error('Automation trigger error:', e);
        }
        if (input.groupIds?.length) {
            await database_1.default.contactGroupMember.createMany({
                data: input.groupIds.map(groupId => ({
                    contactId: contact.id,
                    groupId,
                })),
                skipDuplicates: true,
            });
        }
        if (org?.subscription) {
            await database_1.default.subscription.update({
                where: { id: org.subscription.id },
                data: { contactsUsed: { increment: 1 } },
            });
        }
        return formatContact(contact);
    }
    // ── GET LIST ─────────────────────────────────────────────
    async getList(organizationId, query) {
        const { page = 1, limit = 20, search, status, tags, groupId, sortBy = 'createdAt', sortOrder = 'desc', hasWhatsAppProfile, } = query;
        const safeLimit = Math.min(500, Math.max(1, limit));
        const skip = (Math.max(1, page) - 1) * safeLimit;
        const where = {
            organizationId,
            status: { not: 'DELETED' },
        };
        if (search?.trim()) {
            where.OR = [
                { phone: { contains: search.trim(), mode: 'insensitive' } },
                { firstName: { contains: search.trim(), mode: 'insensitive' } },
                { lastName: { contains: search.trim(), mode: 'insensitive' } },
                { email: { contains: search.trim(), mode: 'insensitive' } },
            ];
        }
        if (status)
            where.status = status;
        if (tags?.length)
            where.tags = { hasSome: tags };
        if (groupId)
            where.groupMemberships = { some: { groupId } };
        if (hasWhatsAppProfile !== undefined) {
            where.whatsappProfileFetched = hasWhatsAppProfile;
        }
        const ALLOWED_SORT = [
            'createdAt', 'updatedAt', 'firstName',
            'lastName', 'phone', 'lastMessageAt',
        ];
        const safeSortBy = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';
        const [contacts, total] = await Promise.all([
            database_1.default.contact.findMany({
                where,
                skip,
                take: safeLimit,
                orderBy: { [safeSortBy]: sortOrder },
            }),
            database_1.default.contact.count({ where }),
        ]);
        return {
            contacts: contacts.map(formatContact),
            meta: {
                page: Math.max(1, page),
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit),
            },
        };
    }
    // ── GET BY ID ────────────────────────────────────────────
    async getById(organizationId, contactId) {
        const contact = await database_1.default.contact.findFirst({
            where: {
                id: contactId,
                organizationId,
                status: { not: 'DELETED' },
            },
            include: {
                groupMemberships: {
                    include: {
                        group: { select: { id: true, name: true, color: true } },
                    },
                },
            },
        });
        if (!contact)
            throw new errorHandler_1.AppError('Contact not found', 404);
        return formatContactWithGroups(contact);
    }
    // ── UPDATE ───────────────────────────────────────────────
    async update(organizationId, contactId, input) {
        const existing = await database_1.default.contact.findFirst({
            where: { id: contactId, organizationId },
        });
        if (!existing)
            throw new errorHandler_1.AppError('Contact not found', 404);
        let normalizedPhone;
        if (input.phone) {
            normalizedPhone = this.validateAndNormalizePhone(input.phone);
            const variants = (0, phone_1.buildPhoneVariants)(normalizedPhone);
            const duplicate = await database_1.default.contact.findFirst({
                where: {
                    organizationId,
                    id: { not: contactId },
                    OR: variants.map(p => ({ phone: p })),
                },
            });
            if (duplicate) {
                throw new errorHandler_1.AppError('Contact with this phone number already exists', 409);
            }
        }
        // ✅ FIX Bug#2: extractCountryCode use karo, hardcode nahi
        const resolvedCountryCode = normalizedPhone
            ? (0, phone_1.extractCountryCode)(normalizedPhone)
            : (input.countryCode || (0, phone_1.extractCountryCode)(existing.phone));
        const updateData = {
            ...(normalizedPhone ? { phone: normalizedPhone } : {}),
            countryCode: resolvedCountryCode,
            ...(input.firstName ? { firstName: input.firstName } : {}),
            ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
            ...(input.email !== undefined ? { email: input.email } : {}),
            ...(input.tags ? { tags: input.tags } : {}),
            ...(input.customFields ? { customFields: input.customFields } : {}),
            ...(input.status ? { status: input.status } : {}),
        };
        if (input.firstName && input.firstName !== 'Unknown') {
            updateData.whatsappProfileFetched = true;
            updateData.lastProfileFetchAt = new Date();
        }
        const updated = await database_1.default.contact.update({
            where: { id: contactId },
            data: updateData,
        });
        return formatContact(updated);
    }
    // ── DELETE ───────────────────────────────────────────────
    async delete(organizationId, contactId, userId) {
        const contact = await database_1.default.contact.findFirst({
            where: {
                id: contactId,
                organizationId,
                status: { not: 'DELETED' },
            },
        });
        if (!contact)
            throw new errorHandler_1.AppError('Contact not found', 404);
        await database_1.default.contact.update({
            where: { id: contactId },
            data: {
                status: 'DELETED',
                deletedAt: new Date(),
                deletedBy: userId || null,
            },
        });
        const subscription = await database_1.default.subscription.findFirst({
            where: { organizationId },
        });
        if (subscription && subscription.contactsUsed > 0) {
            await database_1.default.subscription.update({
                where: { id: subscription.id },
                data: { contactsUsed: { decrement: 1 } },
            });
        }
        return { message: 'Contact deleted successfully' };
    }
    // ── IMPORT ───────────────────────────────────────────────
    async import(organizationId, input) {
        let { contacts, groupId, groupName, tags = [], csvData } = input;
        // Parse CSV if provided
        if (csvData && (!contacts || contacts.length === 0)) {
            try {
                contacts = this.parseCSV(csvData);
            }
            catch (error) {
                throw new errorHandler_1.AppError(`CSV parsing failed: ${error.message}`, 400);
            }
        }
        if (!contacts || contacts.length === 0) {
            throw new errorHandler_1.AppError('No valid contacts found. Check file format.', 400);
        }
        // Bina opt-in wali list hi number ban hone ki sabse badi wajah hai: log
        // block/report karte hain, quality girti hai, Meta restrict kar deta hai.
        // Confirmation abhi clients enforce karte hain - backend ise required nahi
        // kar sakta jab tak purana mobile build chal raha hai (dekho
        // contacts.schema.ts) - par jo import bina confirmation ke aata hai wo
        // dikhna chahiye, warna pata hi nahi chalega kaun aisi list chadha raha hai.
        if (!input.optInConfirmed) {
            console.warn(`⚠️ [Import] org ${organizationId}: ${contacts.length} contacts imported ` +
                'without an opt-in confirmation');
        }
        // ── Resolve group ──────────────────────────────────────
        let targetGroupId = groupId;
        if (!targetGroupId && groupName) {
            const existingGroup = await database_1.default.contactGroup.findUnique({
                where: { organizationId_name: { organizationId, name: groupName } },
            });
            targetGroupId = existingGroup?.id || (await database_1.default.contactGroup.create({
                data: {
                    organizationId,
                    name: groupName,
                    description: 'Created via CSV Import',
                    color: '#25D366',
                },
            })).id;
        }
        else if (targetGroupId) {
            const group = await database_1.default.contactGroup.findFirst({
                where: { id: targetGroupId, organizationId },
            });
            if (!group)
                throw new errorHandler_1.AppError('Contact group not found', 404);
        }
        // ── Check limits ───────────────────────────────────────
        const org = await database_1.default.organization.findUnique({
            where: { id: organizationId },
            include: {
                subscription: { include: { plan: true } },
                _count: { select: { contacts: true } },
            },
        });
        const currentCount = org?._count.contacts || 0;
        const maxContacts = org?.subscription?.plan?.maxContacts || 999999;
        const planName = org?.subscription?.plan?.name?.toLowerCase() || 'free';
        const isFree = planName.includes('free') || planName.includes('trial');
        if (isFree) {
            if (contacts.length > 500) {
                throw new errorHandler_1.AppError('Free plan allows max 500 contacts per import. Upgrade to import more.', 403);
            }
            if (currentCount >= 1000) {
                throw new errorHandler_1.AppError('Free plan limit of 1000 contacts reached. Upgrade to add more.', 403);
            }
        }
        const availableSlots = Math.max(0, maxContacts - currentCount);
        if (availableSlots === 0) {
            throw new errorHandler_1.AppError('Contact limit reached. Please upgrade your plan.', 400);
        }
        // ── Validate contacts ──────────────────────────────────
        const validContacts = [];
        const errors = [];
        const seenPhones = new Set();
        for (let i = 0; i < contacts.length; i++) {
            const c = contacts[i];
            const rowNumber = i + 2;
            try {
                const rawPhone = String(c.phone || c.Phone || c.PHONE ||
                    c.mobile || c.Mobile ||
                    c.number || c.Number || '').trim();
                if (!rawPhone) {
                    errors.push({ row: rowNumber, phone: 'N/A', error: 'Phone number is missing' });
                    continue;
                }
                const normalized = this.tryNormalizePhone(rawPhone);
                if (!normalized) {
                    errors.push({
                        row: rowNumber, phone: rawPhone,
                        error: 'Invalid phone. Include country code (e.g., +91, +1).',
                    });
                    continue;
                }
                if (seenPhones.has(normalized)) {
                    errors.push({
                        row: rowNumber, phone: rawPhone,
                        error: 'Duplicate phone number in CSV',
                    });
                    continue;
                }
                seenPhones.add(normalized);
                const firstName = String(c.firstName || c.name || c.Name || c.first_name || 'Unknown').trim();
                const lastName = String(c.lastName || c.last_name || '').trim();
                const email = String(c.email || c.Email || '').trim();
                const contactTags = c.tags
                    ? (Array.isArray(c.tags) ? c.tags : String(c.tags).split(',').map((t) => t.trim()))
                    : [];
                const mergedTags = Array.from(new Set([...contactTags, ...tags]));
                validContacts.push({
                    organizationId,
                    phone: normalized,
                    countryCode: (0, phone_1.extractCountryCode)(normalized),
                    firstName: firstName || 'Unknown',
                    lastName: lastName || null,
                    email: email || null,
                    tags: mergedTags,
                    customFields: c.customFields || {},
                    status: 'ACTIVE',
                    source: 'import',
                    whatsappProfileFetched: false,
                });
            }
            catch (error) {
                errors.push({
                    row: rowNumber, phone: c.phone || 'N/A',
                    error: error.message || 'Unknown error',
                });
            }
        }
        if (validContacts.length === 0) {
            return {
                imported: 0, skipped: 0, failed: errors.length,
                totalErrors: errors.length,
                errors: errors.slice(0, 100),
            };
        }
        const contactsToImport = validContacts.slice(0, availableSlots);
        // ✅ FIX Bug#3: Restore deleted - ALL VARIANTS check
        const allVariants = contactsToImport.flatMap(c => (0, phone_1.buildPhoneVariants)(c.phone));
        const deletedContacts = await database_1.default.contact.findMany({
            where: {
                organizationId,
                phone: { in: allVariants },
                status: 'DELETED',
            },
            select: { id: true, phone: true },
        });
        let restoredCount = 0;
        if (deletedContacts.length > 0) {
            const r = await database_1.default.contact.updateMany({
                where: { id: { in: deletedContacts.map(c => c.id) } },
                data: {
                    status: 'ACTIVE',
                    deletedAt: null,
                    deletedBy: null,
                    source: 'import',
                },
            });
            restoredCount = r.count;
        }
        // Create new contacts
        let imported = 0;
        let skipped = 0;
        try {
            const r = await database_1.default.contact.createMany({
                data: contactsToImport,
                skipDuplicates: true,
            });
            imported = r.count;
            skipped = contactsToImport.length - imported - restoredCount;
        }
        catch (error) {
            throw new errorHandler_1.AppError(`Import failed: ${error.message}`, 500);
        }
        // Add to group
        if (targetGroupId && contactsToImport.length > 0) {
            try {
                const phones = contactsToImport.map(c => c.phone);
                const allContacts = await database_1.default.contact.findMany({
                    where: { organizationId, phone: { in: phones } },
                    select: { id: true },
                });
                if (allContacts.length > 0) {
                    await database_1.default.contactGroupMember.createMany({
                        data: allContacts.map(ct => ({
                            groupId: targetGroupId,
                            contactId: ct.id,
                        })),
                        skipDuplicates: true,
                    });
                }
            }
            catch (err) {
                console.error('Failed to add contacts to group:', err);
            }
        }
        // Update subscription
        const totalAdded = imported + restoredCount;
        if (org?.subscription && totalAdded > 0) {
            await database_1.default.subscription.update({
                where: { id: org.subscription.id },
                data: { contactsUsed: { increment: totalAdded } },
            });
        }
        // ✅ FIX Bug#5: Return restored count bhi
        return {
            imported: totalAdded, // Naye + restored
            skipped: Math.max(0, skipped),
            failed: errors.length,
            totalErrors: errors.length,
            errors: errors.slice(0, 100),
            ...(restoredCount > 0 ? { restored: restoredCount } : {}),
        };
    }
    // ── CSV Parser ───────────────────────────────────────────
    parseCSV(csvData) {
        try {
            let cleanedData = csvData;
            if (cleanedData.charCodeAt(0) === 0xFEFF) {
                cleanedData = cleanedData.slice(1);
            }
            try {
                const records = (0, sync_1.parse)(cleanedData, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                    relax_column_count: true,
                    relax_quotes: true,
                });
                if (records?.length > 0)
                    return records;
            }
            catch {
                // fallback to manual
            }
            const lines = cleanedData.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) {
                throw new Error('CSV must have header row and at least one data row');
            }
            const headers = this.parseCSVLine(lines[0]);
            const contacts = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line)
                    continue;
                const values = this.parseCSVLine(line);
                const contact = {};
                headers.forEach((header, index) => {
                    const key = header.trim().toLowerCase();
                    const value = values[index]?.trim() || '';
                    if (['phone', 'mobile', 'number', 'contact', 'whatsapp',
                        'phone_number', 'phonenumber', 'phone number', 'mob'].includes(key)) {
                        contact.phone = value;
                    }
                    else if (['name', 'firstname', 'first_name', 'first name',
                        'full name', 'fullname', 'contact name'].includes(key)) {
                        contact.firstName = value;
                    }
                    else if (['lastname', 'last_name', 'last name', 'surname'].includes(key)) {
                        contact.lastName = value;
                    }
                    else if (['email', 'email_address', 'emailaddress'].includes(key)) {
                        contact.email = value;
                    }
                    else if (['tags', 'tag', 'labels'].includes(key)) {
                        contact.tags = value;
                    }
                    else {
                        if (!contact.customFields)
                            contact.customFields = {};
                        contact.customFields[header.trim()] = value;
                    }
                });
                if (contact.phone)
                    contacts.push(contact);
            }
            return contacts;
        }
        catch (error) {
            throw new Error(`Failed to parse CSV: ${error.message}`);
        }
    }
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                }
                else
                    inQuotes = !inQuotes;
            }
            else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            }
            else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }
    // ── BULK UPDATE ──────────────────────────────────────────
    async bulkUpdate(organizationId, input) {
        const { contactIds, tags, groupIds, status } = input;
        const count = await database_1.default.contact.count({
            where: { id: { in: contactIds }, organizationId },
        });
        if (count !== contactIds.length) {
            throw new errorHandler_1.AppError('Some contacts not found or access denied', 400);
        }
        if (tags?.length) {
            const contacts = await database_1.default.contact.findMany({
                where: { id: { in: contactIds }, organizationId },
                select: { id: true, tags: true },
            });
            const BATCH = 50;
            for (let i = 0; i < contacts.length; i += BATCH) {
                const batch = contacts.slice(i, i + BATCH);
                await Promise.all(batch.map(c => database_1.default.contact.update({
                    where: { id: c.id },
                    data: { tags: [...new Set([...(c.tags || []), ...tags])] },
                })));
            }
        }
        if (status) {
            await database_1.default.contact.updateMany({
                where: { id: { in: contactIds } },
                data: { status },
            });
        }
        if (groupIds?.length) {
            await database_1.default.contactGroupMember.createMany({
                data: contactIds.flatMap(contactId => groupIds.map(groupId => ({ contactId, groupId }))),
                skipDuplicates: true,
            });
        }
        return { message: 'Contacts updated successfully', updated: count };
    }
    // ── BULK DELETE ──────────────────────────────────────────
    async bulkDelete(organizationId, contactIds, userId) {
        const result = await database_1.default.contact.updateMany({
            where: {
                id: { in: contactIds },
                organizationId,
                status: { not: 'DELETED' },
            },
            data: {
                status: 'DELETED',
                deletedAt: new Date(),
                deletedBy: userId || null,
            },
        });
        const subscription = await database_1.default.subscription.findFirst({
            where: { organizationId },
        });
        if (subscription && result.count > 0) {
            await database_1.default.subscription.update({
                where: { id: subscription.id },
                data: {
                    contactsUsed: {
                        decrement: Math.min(result.count, subscription.contactsUsed),
                    },
                },
            });
        }
        return { message: 'Contacts deleted successfully', deleted: result.count };
    }
    // ── DELETE ALL ───────────────────────────────────────────
    async deleteAll(organizationId, userId) {
        const result = await database_1.default.contact.updateMany({
            where: {
                organizationId,
                status: { not: 'DELETED' },
            },
            data: {
                status: 'DELETED',
                deletedAt: new Date(),
                deletedBy: userId || null,
            },
        });
        const subscription = await database_1.default.subscription.findFirst({
            where: { organizationId },
        });
        if (subscription && result.count > 0) {
            await database_1.default.subscription.update({
                where: { id: subscription.id },
                data: {
                    contactsUsed: {
                        decrement: Math.min(result.count, subscription.contactsUsed),
                    },
                },
            });
        }
        return { message: 'All contacts deleted successfully', deleted: result.count };
    }
    // ── STATS ────────────────────────────────────────────────
    async getStats(organizationId) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const base = { organizationId, status: { not: 'DELETED' } };
        const [total, active, blocked, unsubscribed, recentlyAdded, withMessages, whatsappVerified] = await Promise.all([
            database_1.default.contact.count({ where: base }),
            database_1.default.contact.count({ where: { organizationId, status: 'ACTIVE' } }),
            database_1.default.contact.count({ where: { organizationId, status: 'BLOCKED' } }),
            database_1.default.contact.count({ where: { organizationId, status: 'UNSUBSCRIBED' } }),
            database_1.default.contact.count({ where: { ...base, createdAt: { gte: sevenDaysAgo } } }),
            database_1.default.contact.count({ where: { ...base, messageCount: { gt: 0 } } }),
            database_1.default.contact.count({ where: { ...base, whatsappProfileFetched: true } }),
        ]);
        return { total, active, blocked, unsubscribed, recentlyAdded, withMessages, whatsappVerified };
    }
    // ── GET ALL TAGS ─────────────────────────────────────────
    async getAllTags(organizationId) {
        // Aggregate in the database. The previous version loaded every contact row
        // into memory just to count tags -- a full-table scan on large orgs, run
        // whenever the tag filter UI opens. unnest() over the tags array does the
        // counting in Postgres and returns only the distinct tags.
        const rows = await database_1.default.$queryRaw `
      SELECT tag, COUNT(*)::bigint AS count
      FROM "Contact", unnest("tags") AS tag
      WHERE "organizationId" = ${organizationId}
        AND "status" <> 'DELETED'
      GROUP BY tag
      ORDER BY count DESC
    `;
        return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
    }
    // ── EXPORT ───────────────────────────────────────────────
    async export(organizationId, groupId) {
        const where = {
            organizationId,
            status: { not: 'DELETED' },
        };
        if (groupId)
            where.groupMemberships = { some: { groupId } };
        const contacts = await database_1.default.contact.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return contacts.map(c => ({
            phone: c.phone,
            countryCode: c.countryCode,
            fullPhone: (0, phone_1.formatFullPhone)(c.countryCode, c.phone),
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            email: c.email || '',
            tags: (c.tags || []).join(', '),
            status: c.status,
            source: c.source || '',
            whatsappVerified: c.whatsappProfileFetched ? 'Yes' : 'No',
            whatsappName: c.whatsappProfileName || '',
            createdAt: c.createdAt.toISOString(),
        }));
    }
    // ── GROUPS ───────────────────────────────────────────────
    async createGroup(organizationId, input) {
        const existing = await database_1.default.contactGroup.findUnique({
            where: { organizationId_name: { organizationId, name: input.name } },
        });
        if (existing)
            throw new errorHandler_1.AppError('Group with this name already exists', 409);
        const group = await database_1.default.contactGroup.create({
            data: {
                organizationId,
                name: input.name,
                description: input.description,
                color: input.color || '#25D366',
            },
            include: { _count: { select: { members: true } } },
        });
        return formatContactGroup(group);
    }
    async getGroups(organizationId) {
        const groups = await database_1.default.contactGroup.findMany({
            where: { organizationId },
            include: { _count: { select: { members: true } } },
            orderBy: { name: 'asc' },
        });
        return groups.map(formatContactGroup);
    }
    async getGroupById(organizationId, groupId) {
        const group = await database_1.default.contactGroup.findFirst({
            where: { id: groupId, organizationId },
            include: {
                _count: { select: { members: true } },
                members: { include: { contact: true }, take: 100 },
            },
        });
        if (!group)
            throw new errorHandler_1.AppError('Group not found', 404);
        return {
            ...formatContactGroup(group),
            contacts: group.members.map(m => formatContact(m.contact)),
        };
    }
    async updateGroup(organizationId, groupId, input) {
        const group = await database_1.default.contactGroup.findFirst({
            where: { id: groupId, organizationId },
        });
        if (!group)
            throw new errorHandler_1.AppError('Group not found', 404);
        if (input.name && input.name !== group.name) {
            const dup = await database_1.default.contactGroup.findUnique({
                where: { organizationId_name: { organizationId, name: input.name } },
            });
            if (dup)
                throw new errorHandler_1.AppError('Group with this name already exists', 409);
        }
        const updated = await database_1.default.contactGroup.update({
            where: { id: groupId },
            data: { name: input.name, description: input.description, color: input.color },
            include: { _count: { select: { members: true } } },
        });
        return formatContactGroup(updated);
    }
    async deleteGroup(organizationId, groupId, deleteContacts = false) {
        const group = await database_1.default.contactGroup.findFirst({
            where: { id: groupId, organizationId },
            include: { _count: { select: { members: true } } },
        });
        if (!group)
            throw new errorHandler_1.AppError('Group not found', 404);
        const memberCount = group._count.members;
        if (deleteContacts && memberCount > 0) {
            const members = await database_1.default.contactGroupMember.findMany({
                where: { groupId },
                select: { contactId: true },
            });
            const contactIds = members.map(m => m.contactId);
            await database_1.default.$transaction([
                database_1.default.contact.updateMany({
                    where: { id: { in: contactIds }, organizationId },
                    data: { status: 'DELETED', deletedAt: new Date() },
                }),
                database_1.default.campaign.updateMany({
                    where: { contactGroupId: groupId },
                    data: { contactGroupId: null },
                }),
                database_1.default.contactGroupMember.deleteMany({ where: { groupId } }),
                database_1.default.contactGroup.delete({ where: { id: groupId } }),
            ]);
            const subscription = await database_1.default.subscription.findFirst({
                where: { organizationId },
            });
            if (subscription && contactIds.length > 0) {
                await database_1.default.subscription.update({
                    where: { id: subscription.id },
                    data: {
                        contactsUsed: {
                            decrement: Math.min(contactIds.length, subscription.contactsUsed),
                        },
                    },
                });
            }
            return {
                message: `Group "${group.name}" and ${memberCount} contacts deleted.`,
            };
        }
        await database_1.default.$transaction([
            database_1.default.campaign.updateMany({
                where: { contactGroupId: groupId },
                data: { contactGroupId: null },
            }),
            database_1.default.contactGroupMember.deleteMany({ where: { groupId } }),
            database_1.default.contactGroup.delete({ where: { id: groupId } }),
        ]);
        return {
            message: `Group "${group.name}" deleted. ${memberCount} contacts remain.`,
        };
    }
    async addContactsToGroup(organizationId, groupId, contactIds) {
        const group = await database_1.default.contactGroup.findFirst({
            where: { id: groupId, organizationId },
        });
        if (!group)
            throw new errorHandler_1.AppError('Group not found', 404);
        const contacts = await database_1.default.contact.findMany({
            where: { id: { in: contactIds }, organizationId },
        });
        if (!contacts.length)
            throw new errorHandler_1.AppError('No valid contacts found', 400);
        const result = await database_1.default.contactGroupMember.createMany({
            data: contacts.map(c => ({ groupId, contactId: c.id })),
            skipDuplicates: true,
        });
        return { message: 'Contacts added to group successfully', added: result.count };
    }
    async removeContactsFromGroup(organizationId, groupId, contactIds) {
        const group = await database_1.default.contactGroup.findFirst({
            where: { id: groupId, organizationId },
        });
        if (!group)
            throw new errorHandler_1.AppError('Group not found', 404);
        const result = await database_1.default.contactGroupMember.deleteMany({
            where: { groupId, contactId: { in: contactIds } },
        });
        return { message: 'Contacts removed from group', removed: result.count };
    }
    // ✅ FIX Bug#4: DELETED contacts filter add kiya
    async getGroupContacts(organizationId, groupId, query) {
        const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
        const skip = (page - 1) * limit;
        const group = await database_1.default.contactGroup.findFirst({
            where: { id: groupId, organizationId },
        });
        if (!group)
            throw new errorHandler_1.AppError('Group not found', 404);
        const where = {
            organizationId,
            status: { not: 'DELETED' }, // ✅ FIX Bug#4
            groupMemberships: { some: { groupId } },
        };
        if (search) {
            where.OR = [
                { phone: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [contacts, total] = await Promise.all([
            database_1.default.contact.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: sortOrder },
            }),
            database_1.default.contact.count({ where }),
        ]);
        return {
            contacts: contacts.map(formatContact),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }
    async getImportStats(organizationId) {
        const org = await database_1.default.organization.findUnique({
            where: { id: organizationId },
            include: {
                subscription: { include: { plan: true } },
                _count: { select: { contacts: true } },
            },
        });
        const totalContacts = org?._count.contacts || 0;
        const maxContacts = org?.subscription?.plan?.maxContacts || 1000;
        const planName = org?.subscription?.plan?.name || 'Free';
        const isFree = planName.toLowerCase().includes('free') ||
            planName.toLowerCase().includes('trial');
        const remainingSlots = Math.max(0, maxContacts - totalContacts);
        return {
            totalContacts,
            maxContacts,
            remainingSlots,
            planName,
            canImport: remainingSlots > 0,
            maxPerImport: isFree ? 500 : 10000,
        };
    }
}
exports.ContactsService = ContactsService;
exports.contactsService = new ContactsService();
//# sourceMappingURL=contacts.service.js.map