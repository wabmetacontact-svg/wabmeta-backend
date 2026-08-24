// src/modules/organizations/organizations.schema.ts

import { z } from 'zod';
import { UserRole } from '@prisma/client';

// ============================================
// VALIDATORS
// ============================================

const nameSchema = z
  .string()
  .min(2, 'Organization name must be at least 2 characters')
  .max(100, 'Organization name is too long')
  .trim();

// HTML forms khaali field ko '' bhejte hain, undefined nahi. Pehle
// website: '' par .url() fail ho jata tha aur poora settings save 400 ban
// jata tha - jabki matlab sirf itna tha ki website di hi nahi gayi.
// Nullable fields ke liye '' -> null (taaki user value clear bhi kar sake),
// baaki ke liye '' -> undefined (yaani is field ko mat chhedo).
const emptyToNull = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? null : v;

const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const urlSchema = z.preprocess(
  emptyToNull,
  z.string().url('Invalid URL').optional().nullable()
);

const timezoneSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^[A-Za-z_\/]+$/, 'Invalid timezone format')
    .optional()
);

const roleSchema = z.nativeEnum(UserRole);

// ============================================
// REQUEST SCHEMAS
// ============================================

export const createOrganizationSchema = z.object({
  body: z.object({
    name: nameSchema,
    website: urlSchema,
    industry: z.string().max(50).optional(),
    timezone: timezoneSchema,
  }),
});

export const updateOrganizationSchema = z.object({
  body: z.object({
    name: nameSchema.optional(),
    logo: z.string().optional().nullable().or(z.literal('')),
    website: urlSchema,
    industry: z.preprocess(
      emptyToNull,
      z.string().max(50).optional().nullable()
    ),
    timezone: timezoneSchema,
  }),
});

export const inviteMemberSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    role: roleSchema.default('MEMBER'),
  }),
});

export const updateMemberRoleSchema = z.object({
  params: z.object({
    memberId: z.string().min(1, 'Member ID is required'),
  }),
  body: z.object({
    role: roleSchema,
  }),
});

export const removeMemberSchema = z.object({
  params: z.object({
    memberId: z.string().min(1, 'Member ID is required'),
  }),
});

export const transferOwnershipSchema = z.object({
  body: z.object({
    newOwnerId: z.string().min(1, 'New owner ID is required'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const getOrganizationByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Organization ID is required'),
  }),
});

export const switchOrganizationSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Organization ID is required'),
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateOrganizationSchema = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationSchema = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberSchema = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleSchema = z.infer<typeof updateMemberRoleSchema>;
export type TransferOwnershipSchema = z.infer<typeof transferOwnershipSchema>;