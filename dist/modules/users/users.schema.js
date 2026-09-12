"use strict";
// src/modules/users/users.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserByIdSchema = exports.deleteAccountSchema = exports.updateNotificationSettingsSchema = exports.updateAvatarSchema = exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
// ============================================
// VALIDATORS
// ============================================
const nameSchema = zod_1.z
    .string()
    .max(100, 'Name is too long')
    .trim();
const phoneSchema = zod_1.z
    .string()
    .trim()
    .transform((val) => val.replace(/[\s\-\(\)]/g, '')) // spaces hatao
    .refine((val) => val === '' || /^\+?[1-9]\d{9,14}$/.test(val), 'Invalid phone number')
    .optional()
    .nullable()
    .or(zod_1.z.literal(''));
// Avatar: base64 mat allow karo profile update pe — URL only
const avatarSchema = zod_1.z
    .string()
    .url('Avatar must be a valid URL')
    .max(500)
    .optional()
    .nullable()
    .or(zod_1.z.literal(''));
// ============================================
// REQUEST SCHEMAS
// ============================================
exports.updateProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        firstName: nameSchema.optional(),
        lastName: nameSchema.optional().nullable().or(zod_1.z.literal('')),
        phone: phoneSchema,
        avatar: avatarSchema,
    }),
});
exports.updateAvatarSchema = zod_1.z.object({
    body: zod_1.z.object({
        avatar: zod_1.z.string().min(1, 'Avatar is required'),
    }),
});
exports.updateNotificationSettingsSchema = zod_1.z.object({
    body: zod_1.z.object({
        emailNotifications: zod_1.z.boolean().optional(),
        pushNotifications: zod_1.z.boolean().optional(),
        smsNotifications: zod_1.z.boolean().optional(),
        marketingEmails: zod_1.z.boolean().optional(),
    }),
});
exports.deleteAccountSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string().min(1, 'Password is required'),
        reason: zod_1.z.string().max(500, 'Reason is too long').optional(),
    }),
});
exports.getUserByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'User ID is required'),
    }),
});
//# sourceMappingURL=users.schema.js.map