// src/modules/contacts/contacts.schema.ts - COMPLETE FIX
import { z } from 'zod';
import { ContactStatus } from '@prisma/client';
import { toCanonicalPhone } from '../../utils/phone';

// ✅ SINGLE PHONE VALIDATOR - toCanonicalPhone use karta hai
// Input: koi bhi format → Output: +91XXXXXXXXXX (canonical E.164)
const phoneSchema = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return '';
    const raw = String(v).trim();
    if (!raw) return '';
    
    // toCanonicalPhone se canonical format milega
    const canonical = toCanonicalPhone(raw);
    return canonical || raw; // canonical ya original (validation fail hoga)
  },
  z.string()
    .min(10, 'Phone number too short')
    .regex(
      /^\+[1-9]\d{9,14}$/,
      'Invalid phone number. Must be in E.164 format (e.g., +919876543210)'
    )
);

const emailSchema = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
  },
  z.string().email('Invalid email format').optional()
);

// ============================================
// CONTACT SCHEMAS
// ============================================

export const createContactSchema = z.object({
  body: z.object({
    phone: phoneSchema,
    // ✅ countryCode auto-detect hoga phone se, but accept karo agar diya
    countryCode: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: emailSchema,
    tags: z.array(z.string()).optional().default([]),
    customFields: z.record(z.any()).optional().default({}),
    groupIds: z.array(z.string()).optional(),
  }),
});

export const updateContactSchema = z.object({
  body: z.object({
    phone: phoneSchema.optional(),
    countryCode: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: emailSchema,
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.any()).optional(),
    status: z.nativeEnum(ContactStatus).optional(),
  }),
});

export const importContactsSchema = z.object({
  body: z.object({
    contacts: z.array(
      z.object({
        phone: phoneSchema,
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: emailSchema,
        tags: z.array(z.string()).optional(),
        customFields: z.record(z.any()).optional(),
      })
    ).min(1, 'At least one contact is required'),
    groupId: z.string().optional(),
    groupName: z.string().optional(),
    tags: z.array(z.string()).optional(),
    skipDuplicates: z.boolean().optional().default(true),
  }),
});

export const bulkUpdateSchema = z.object({
  body: z.object({
    contactIds: z.array(z.string()).min(1),
    tags: z.array(z.string()).optional(),
    groupIds: z.array(z.string()).optional(),
    status: z.nativeEnum(ContactStatus).optional(),
  }),
});

export const bulkDeleteSchema = z.object({
  body: z.object({
    contactIds: z.array(z.string()).min(1),
  }),
});

export const createContactGroupSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Group name is required'),
    description: z.string().optional(),
    color: z.string().optional(),
  }),
});

export const updateContactGroupSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    color: z.string().optional(),
  }),
});

export const addContactsToGroupSchema = z.object({
  body: z.object({
    contactIds: z.array(z.string()).min(1),
  }),
});