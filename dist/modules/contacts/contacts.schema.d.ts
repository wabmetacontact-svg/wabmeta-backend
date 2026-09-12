import { z } from 'zod';
export declare const createContactSchema: z.ZodObject<{
    body: z.ZodObject<{
        phone: z.ZodEffects<z.ZodString, string, unknown>;
        countryCode: z.ZodOptional<z.ZodString>;
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        email: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
        tags: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        customFields: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
        groupIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        phone: string;
        customFields: Record<string, any>;
        tags: string[];
        email?: string | undefined;
        countryCode?: string | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        groupIds?: string[] | undefined;
    }, {
        phone?: unknown;
        email?: unknown;
        countryCode?: string | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        customFields?: Record<string, any> | undefined;
        tags?: string[] | undefined;
        groupIds?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        phone: string;
        customFields: Record<string, any>;
        tags: string[];
        email?: string | undefined;
        countryCode?: string | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        groupIds?: string[] | undefined;
    };
}, {
    body: {
        phone?: unknown;
        email?: unknown;
        countryCode?: string | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        customFields?: Record<string, any> | undefined;
        tags?: string[] | undefined;
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
            DELETED: "DELETED";
        }>>;
    }, "strip", z.ZodTypeAny, {
        phone?: string | undefined;
        email?: string | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | "DELETED" | undefined;
        countryCode?: string | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        customFields?: Record<string, any> | undefined;
        tags?: string[] | undefined;
    }, {
        phone?: unknown;
        email?: unknown;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | "DELETED" | undefined;
        countryCode?: string | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        customFields?: Record<string, any> | undefined;
        tags?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        phone?: string | undefined;
        email?: string | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | "DELETED" | undefined;
        countryCode?: string | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        customFields?: Record<string, any> | undefined;
        tags?: string[] | undefined;
    };
}, {
    body: {
        phone?: unknown;
        email?: unknown;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | "DELETED" | undefined;
        countryCode?: string | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        customFields?: Record<string, any> | undefined;
        tags?: string[] | undefined;
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
            firstName?: string | undefined;
            lastName?: string | undefined;
            customFields?: Record<string, any> | undefined;
            tags?: string[] | undefined;
        }, {
            phone?: unknown;
            email?: unknown;
            firstName?: string | undefined;
            lastName?: string | undefined;
            customFields?: Record<string, any> | undefined;
            tags?: string[] | undefined;
        }>, "many">;
        groupId: z.ZodOptional<z.ZodString>;
        groupName: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        skipDuplicates: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        optInConfirmed: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        contacts: {
            phone: string;
            email?: string | undefined;
            firstName?: string | undefined;
            lastName?: string | undefined;
            customFields?: Record<string, any> | undefined;
            tags?: string[] | undefined;
        }[];
        skipDuplicates: boolean;
        tags?: string[] | undefined;
        groupId?: string | undefined;
        groupName?: string | undefined;
        optInConfirmed?: boolean | undefined;
    }, {
        contacts: {
            phone?: unknown;
            email?: unknown;
            firstName?: string | undefined;
            lastName?: string | undefined;
            customFields?: Record<string, any> | undefined;
            tags?: string[] | undefined;
        }[];
        tags?: string[] | undefined;
        groupId?: string | undefined;
        skipDuplicates?: boolean | undefined;
        groupName?: string | undefined;
        optInConfirmed?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        contacts: {
            phone: string;
            email?: string | undefined;
            firstName?: string | undefined;
            lastName?: string | undefined;
            customFields?: Record<string, any> | undefined;
            tags?: string[] | undefined;
        }[];
        skipDuplicates: boolean;
        tags?: string[] | undefined;
        groupId?: string | undefined;
        groupName?: string | undefined;
        optInConfirmed?: boolean | undefined;
    };
}, {
    body: {
        contacts: {
            phone?: unknown;
            email?: unknown;
            firstName?: string | undefined;
            lastName?: string | undefined;
            customFields?: Record<string, any> | undefined;
            tags?: string[] | undefined;
        }[];
        tags?: string[] | undefined;
        groupId?: string | undefined;
        skipDuplicates?: boolean | undefined;
        groupName?: string | undefined;
        optInConfirmed?: boolean | undefined;
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
            DELETED: "DELETED";
        }>>;
    }, "strip", z.ZodTypeAny, {
        contactIds: string[];
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | "DELETED" | undefined;
        tags?: string[] | undefined;
        groupIds?: string[] | undefined;
    }, {
        contactIds: string[];
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | "DELETED" | undefined;
        tags?: string[] | undefined;
        groupIds?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        contactIds: string[];
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | "DELETED" | undefined;
        tags?: string[] | undefined;
        groupIds?: string[] | undefined;
    };
}, {
    body: {
        contactIds: string[];
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | "DELETED" | undefined;
        tags?: string[] | undefined;
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