import { z } from 'zod';
export declare const updateProfileSchema: z.ZodObject<{
    body: z.ZodObject<{
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        avatar: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        phone?: string | null | undefined;
        firstName?: string | undefined;
        lastName?: string | null | undefined;
        avatar?: string | null | undefined;
    }, {
        phone?: string | null | undefined;
        firstName?: string | undefined;
        lastName?: string | null | undefined;
        avatar?: string | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        phone?: string | null | undefined;
        firstName?: string | undefined;
        lastName?: string | null | undefined;
        avatar?: string | null | undefined;
    };
}, {
    body: {
        phone?: string | null | undefined;
        firstName?: string | undefined;
        lastName?: string | null | undefined;
        avatar?: string | null | undefined;
    };
}>;
export declare const updateAvatarSchema: z.ZodObject<{
    body: z.ZodObject<{
        avatar: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        avatar: string;
    }, {
        avatar: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        avatar: string;
    };
}, {
    body: {
        avatar: string;
    };
}>;
export declare const updateNotificationSettingsSchema: z.ZodObject<{
    body: z.ZodObject<{
        emailNotifications: z.ZodOptional<z.ZodBoolean>;
        pushNotifications: z.ZodOptional<z.ZodBoolean>;
        smsNotifications: z.ZodOptional<z.ZodBoolean>;
        marketingEmails: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        emailNotifications?: boolean | undefined;
        pushNotifications?: boolean | undefined;
        smsNotifications?: boolean | undefined;
        marketingEmails?: boolean | undefined;
    }, {
        emailNotifications?: boolean | undefined;
        pushNotifications?: boolean | undefined;
        smsNotifications?: boolean | undefined;
        marketingEmails?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        emailNotifications?: boolean | undefined;
        pushNotifications?: boolean | undefined;
        smsNotifications?: boolean | undefined;
        marketingEmails?: boolean | undefined;
    };
}, {
    body: {
        emailNotifications?: boolean | undefined;
        pushNotifications?: boolean | undefined;
        smsNotifications?: boolean | undefined;
        marketingEmails?: boolean | undefined;
    };
}>;
export declare const deleteAccountSchema: z.ZodObject<{
    body: z.ZodObject<{
        password: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        password: string;
        reason?: string | undefined;
    }, {
        password: string;
        reason?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        password: string;
        reason?: string | undefined;
    };
}, {
    body: {
        password: string;
        reason?: string | undefined;
    };
}>;
export declare const getUserByIdSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;
export type UpdateAvatarSchema = z.infer<typeof updateAvatarSchema>;
export type DeleteAccountSchema = z.infer<typeof deleteAccountSchema>;
//# sourceMappingURL=users.schema.d.ts.map