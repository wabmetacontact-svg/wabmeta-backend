import { z } from 'zod';
export declare const createOrganizationSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        website: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodString>>, string | null | undefined, unknown>;
        industry: z.ZodOptional<z.ZodString>;
        timezone: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        website?: string | null | undefined;
        industry?: string | undefined;
        timezone?: string | undefined;
    }, {
        name: string;
        website?: unknown;
        industry?: string | undefined;
        timezone?: unknown;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        website?: string | null | undefined;
        industry?: string | undefined;
        timezone?: string | undefined;
    };
}, {
    body: {
        name: string;
        website?: unknown;
        industry?: string | undefined;
        timezone?: unknown;
    };
}>;
export declare const updateOrganizationSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        logo: z.ZodUnion<[z.ZodNullable<z.ZodOptional<z.ZodString>>, z.ZodLiteral<"">]>;
        website: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodString>>, string | null | undefined, unknown>;
        industry: z.ZodEffects<z.ZodNullable<z.ZodOptional<z.ZodString>>, string | null | undefined, unknown>;
        timezone: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        logo?: string | null | undefined;
        website?: string | null | undefined;
        industry?: string | null | undefined;
        timezone?: string | undefined;
    }, {
        name?: string | undefined;
        logo?: string | null | undefined;
        website?: unknown;
        industry?: unknown;
        timezone?: unknown;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name?: string | undefined;
        logo?: string | null | undefined;
        website?: string | null | undefined;
        industry?: string | null | undefined;
        timezone?: string | undefined;
    };
}, {
    body: {
        name?: string | undefined;
        logo?: string | null | undefined;
        website?: unknown;
        industry?: unknown;
        timezone?: unknown;
    };
}>;
export declare const inviteMemberSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        role: z.ZodDefault<z.ZodNativeEnum<{
            OWNER: "OWNER";
            ADMIN: "ADMIN";
            MEMBER: "MEMBER";
            VIEWER: "VIEWER";
        }>>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
    }, {
        email: string;
        role?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
        role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
    };
}, {
    body: {
        email: string;
        role?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | undefined;
    };
}>;
export declare const updateMemberRoleSchema: z.ZodObject<{
    params: z.ZodObject<{
        memberId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        memberId: string;
    }, {
        memberId: string;
    }>;
    body: z.ZodObject<{
        role: z.ZodNativeEnum<{
            OWNER: "OWNER";
            ADMIN: "ADMIN";
            MEMBER: "MEMBER";
            VIEWER: "VIEWER";
        }>;
    }, "strip", z.ZodTypeAny, {
        role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
    }, {
        role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
    };
    params: {
        memberId: string;
    };
}, {
    body: {
        role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
    };
    params: {
        memberId: string;
    };
}>;
export declare const removeMemberSchema: z.ZodObject<{
    params: z.ZodObject<{
        memberId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        memberId: string;
    }, {
        memberId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        memberId: string;
    };
}, {
    params: {
        memberId: string;
    };
}>;
export declare const transferOwnershipSchema: z.ZodObject<{
    body: z.ZodObject<{
        newOwnerId: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        password: string;
        newOwnerId: string;
    }, {
        password: string;
        newOwnerId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        password: string;
        newOwnerId: string;
    };
}, {
    body: {
        password: string;
        newOwnerId: string;
    };
}>;
export declare const getOrganizationByIdSchema: z.ZodObject<{
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
export declare const switchOrganizationSchema: z.ZodObject<{
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
export type CreateOrganizationSchema = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationSchema = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberSchema = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleSchema = z.infer<typeof updateMemberRoleSchema>;
export type TransferOwnershipSchema = z.infer<typeof transferOwnershipSchema>;
//# sourceMappingURL=organizations.schema.d.ts.map