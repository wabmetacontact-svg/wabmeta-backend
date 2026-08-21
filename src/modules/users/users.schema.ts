// src/modules/users/users.schema.ts

import { z } from 'zod';

// ============================================
// VALIDATORS
// ============================================

const nameSchema = z
  .string()
  .max(100, 'Name is too long')
  .trim();

const phoneSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/[\s\-\(\)]/g, '')) // spaces hatao
  .refine(
    (val) => val === '' || /^\+?[1-9]\d{9,14}$/.test(val),
    'Invalid phone number'
  )
  .optional()
  .nullable()
  .or(z.literal(''));

// Avatar: base64 mat allow karo profile update pe — URL only
const avatarSchema = z
  .string()
  .url('Avatar must be a valid URL')
  .max(500)
  .optional()
  .nullable()
  .or(z.literal(''));

// ============================================
// REQUEST SCHEMAS
// ============================================

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional().nullable().or(z.literal('')),
    phone: phoneSchema,
    avatar: avatarSchema,
  }),
});

export const updateAvatarSchema = z.object({
  body: z.object({
    avatar: z
      .string()
      .url('Avatar must be a valid URL')
      .max(500),
  }),
});

export const updateNotificationSettingsSchema = z.object({
  body: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
  }),
});

export const deleteAccountSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required'),
    reason: z.string().max(500, 'Reason is too long').optional(),
  }),
});

export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;
export type UpdateAvatarSchema = z.infer<typeof updateAvatarSchema>;
export type DeleteAccountSchema = z.infer<typeof deleteAccountSchema>;