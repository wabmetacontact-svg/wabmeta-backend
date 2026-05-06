import { z } from 'zod';
export declare const createContactSchema: z.ZodObject<{
    body: z.ZodObject<{
        phone: z.ZodEffects<z.ZodString, string, unknown>;
        countryCode: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        email: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
        tags: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        customFields: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
        groupIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        tags: string[];
        phone: string;
        countryCode: string;
        customFields: Record<string, any>;
        email?: string | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        groupIds?: string[] | undefined;
    }, {
        email?: unknown;
        tags?: string[] | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: unknown;
        countryCode?: string | undefined;
        customFields?: Record<string, any> | undefined;
        groupIds?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        tags: string[];
        phone: string;
        countryCode: string;
        customFields: Record<string, any>;
        email?: string | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        groupIds?: string[] | undefined;
    };
}, {
    body: {
        email?: unknown;
        tags?: string[] | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: unknown;
        countryCode?: string | undefined;
        customFields?: Record<string, any> | undefined;
        groupIds?: string[] | undefined;
    };
}>;
export declare const updateContactSchema: z.ZodObject<{
    body: z.ZodObject<{
        phone: z.ZodOptional<z.ZodEffects<z.ZodString, string, unknown>>;
        countryCode: z.ZodOptional<z.ZodString>;
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        email: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        customFields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            ACTIVE: "ACTIVE";
            BLOCKED: "BLOCKED";
            UNSUBSCRIBED: "UNSUBSCRIBED";
        }>>;
    }, "strip", z.ZodTypeAny, {
        email?: string | undefined;
        tags?: string[] | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: string | undefined;
        countryCode?: string | undefined;
        customFields?: Record<string, any> | undefined;
    }, {
        email?: unknown;
        tags?: string[] | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: unknown;
        countryCode?: string | undefined;
        customFields?: Record<string, any> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email?: string | undefined;
        tags?: string[] | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: string | undefined;
        countryCode?: string | undefined;
        customFields?: Record<string, any> | undefined;
    };
}, {
    body: {
        email?: unknown;
        tags?: string[] | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: unknown;
        countryCode?: string | undefined;
        customFields?: Record<string, any> | undefined;
    };
}>;
export declare const importContactsSchema: z.ZodObject<{
    body: z.ZodObject<{
        contacts: z.ZodArray<z.ZodObject<{
            phone: z.ZodEffects<z.ZodString, string, unknown>;
            firstName: z.ZodOptional<z.ZodString>;
            lastName: z.ZodOptional<z.ZodString>;
            email: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            customFields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            phone: string;
            email?: string | undefined;
            tags?: string[] | undefined;
            firstName?: string | undefined;
            lastName?: string | undefined;
            customFields?: Record<string, any> | undefined;
        }, {
            email?: unknown;
            tags?: string[] | undefined;
            firstName?: string | undefined;
            lastName?: string | undefined;
            phone?: unknown;
            customFields?: Record<string, any> | undefined;
        }>, "many">;
        groupId: z.ZodOptional<z.ZodString>;
        groupName: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        skipDuplicates: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        contacts: {
            phone: string;
            email?: string | undefined;
            tags?: string[] | undefined;
            firstName?: string | undefined;
            lastName?: string | undefined;
            customFields?: Record<string, any> | undefined;
        }[];
        skipDuplicates: boolean;
        tags?: string[] | undefined;
        groupId?: string | undefined;
        groupName?: string | undefined;
    }, {
        contacts: {
            email?: unknown;
            tags?: string[] | undefined;
            firstName?: string | undefined;
            lastName?: string | undefined;
            phone?: unknown;
            customFields?: Record<string, any> | undefined;
        }[];
        tags?: string[] | undefined;
        groupId?: string | undefined;
        skipDuplicates?: boolean | undefined;
        groupName?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        contacts: {
            phone: string;
            email?: string | undefined;
            tags?: string[] | undefined;
            firstName?: string | undefined;
            lastName?: string | undefined;
            customFields?: Record<string, any> | undefined;
        }[];
        skipDuplicates: boolean;
        tags?: string[] | undefined;
        groupId?: string | undefined;
        groupName?: string | undefined;
    };
}, {
    body: {
        contacts: {
            email?: unknown;
            tags?: string[] | undefined;
            firstName?: string | undefined;
            lastName?: string | undefined;
            phone?: unknown;
            customFields?: Record<string, any> | undefined;
        }[];
        tags?: string[] | undefined;
        groupId?: string | undefined;
        skipDuplicates?: boolean | undefined;
        groupName?: string | undefined;
    };
}>;
export declare const bulkUpdateSchema: z.ZodObject<{
    body: z.ZodObject<{
        contactIds: z.ZodArray<z.ZodString, "many">;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        groupIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            ACTIVE: "ACTIVE";
            BLOCKED: "BLOCKED";
            UNSUBSCRIBED: "UNSUBSCRIBED";
        }>>;
    }, "strip", z.ZodTypeAny, {
        contactIds: string[];
        tags?: string[] | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        groupIds?: string[] | undefined;
    }, {
        contactIds: string[];
        tags?: string[] | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        groupIds?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        contactIds: string[];
        tags?: string[] | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        groupIds?: string[] | undefined;
    };
}, {
    body: {
        contactIds: string[];
        tags?: string[] | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        groupIds?: string[] | undefined;
    };
}>;
export declare const bulkDeleteSchema: z.ZodObject<{
    body: z.ZodObject<{
        contactIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        contactIds: string[];
    }, {
        contactIds: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        contactIds: string[];
    };
}, {
    body: {
        contactIds: string[];
    };
}>;
export declare const createContactGroupSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description?: string | undefined;
        color?: string | undefined;
    }, {
        name: string;
        description?: string | undefined;
        color?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        description?: string | undefined;
        color?: string | undefined;
    };
}, {
    body: {
        name: string;
        description?: string | undefined;
        color?: string | undefined;
    };
}>;
export declare const updateContactGroupSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        description?: string | undefined;
        color?: string | undefined;
    }, {
        name?: string | undefined;
        description?: string | undefined;
        color?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name?: string | undefined;
        description?: string | undefined;
        color?: string | undefined;
    };
}, {
    body: {
        name?: string | undefined;
        description?: string | undefined;
        color?: string | undefined;
    };
}>;
export declare const addContactsToGroupSchema: z.ZodObject<{
    body: z.ZodObject<{
        contactIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        contactIds: string[];
    }, {
        contactIds: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        contactIds: string[];
    };
}, {
    body: {
        contactIds: string[];
    };
}>;
//# sourceMappingURL=contacts.schema.d.ts.map