"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addContactsToGroupSchema = exports.updateContactGroupSchema = exports.createContactGroupSchema = exports.bulkDeleteSchema = exports.bulkUpdateSchema = exports.importContactsSchema = exports.updateContactSchema = exports.createContactSchema = void 0;
// src/modules/contacts/contacts.schema.ts - COMPLETE FIX
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const phone_1 = require("../../utils/phone");
// ✅ SINGLE PHONE VALIDATOR - toCanonicalPhone use karta hai
// Input: koi bhi format → Output: +91XXXXXXXXXX (canonical E.164)
const phoneSchema = zod_1.z.preprocess((v) => {
    if (v === null || v === undefined)
        return '';
    const raw = String(v).trim();
    if (!raw)
        return '';
    // toCanonicalPhone se canonical format milega
    const canonical = (0, phone_1.toCanonicalPhone)(raw);
    return canonical || raw; // canonical ya original (validation fail hoga)
}, zod_1.z.string()
    .min(10, 'Phone number too short')
    .regex(/^\+[1-9]\d{9,14}$/, 'Invalid phone number. Must be in E.164 format (e.g., +919876543210)'));
const emailSchema = zod_1.z.preprocess((v) => {
    if (v === null || v === undefined)
        return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
}, zod_1.z.string().email('Invalid email format').optional());
// ============================================
// CONTACT SCHEMAS
// ============================================
exports.createContactSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: phoneSchema,
        // ✅ countryCode auto-detect hoga phone se, but accept karo agar diya
        countryCode: zod_1.z.string().optional(),
        firstName: zod_1.z.string().optional(),
        lastName: zod_1.z.string().optional(),
        email: emailSchema,
        tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
        customFields: zod_1.z.record(zod_1.z.any()).optional().default({}),
        groupIds: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
exports.updateContactSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: phoneSchema.optional(),
        countryCode: zod_1.z.string().optional(),
        firstName: zod_1.z.string().optional(),
        lastName: zod_1.z.string().optional(),
        email: emailSchema,
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        customFields: zod_1.z.record(zod_1.z.any()).optional(),
        status: zod_1.z.nativeEnum(client_1.ContactStatus).optional(),
    }),
});
exports.importContactsSchema = zod_1.z.object({
    body: zod_1.z.object({
        contacts: zod_1.z.array(zod_1.z.object({
            phone: phoneSchema,
            firstName: zod_1.z.string().optional(),
            lastName: zod_1.z.string().optional(),
            email: emailSchema,
            tags: zod_1.z.array(zod_1.z.string()).optional(),
            customFields: zod_1.z.record(zod_1.z.any()).optional(),
        })).min(1, 'At least one contact is required'),
        groupId: zod_1.z.string().optional(),
        groupName: zod_1.z.string().optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        skipDuplicates: zod_1.z.boolean().optional().default(true),
    }),
});
exports.bulkUpdateSchema = zod_1.z.object({
    body: zod_1.z.object({
        contactIds: zod_1.z.array(zod_1.z.string()).min(1),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        groupIds: zod_1.z.array(zod_1.z.string()).optional(),
        status: zod_1.z.nativeEnum(client_1.ContactStatus).optional(),
    }),
});
exports.bulkDeleteSchema = zod_1.z.object({
    body: zod_1.z.object({
        contactIds: zod_1.z.array(zod_1.z.string()).min(1),
    }),
});
exports.createContactGroupSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Group name is required'),
        description: zod_1.z.string().optional(),
        color: zod_1.z.string().optional(),
    }),
});
exports.updateContactGroupSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        description: zod_1.z.string().optional(),
        color: zod_1.z.string().optional(),
    }),
});
exports.addContactsToGroupSchema = zod_1.z.object({
    body: zod_1.z.object({
        contactIds: zod_1.z.array(zod_1.z.string()).min(1),
    }),
});
//# sourceMappingURL=contacts.schema.js.map