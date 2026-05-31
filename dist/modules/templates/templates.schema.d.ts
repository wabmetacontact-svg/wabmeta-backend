import { z } from 'zod';
export declare const createTemplateSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        language: z.ZodDefault<z.ZodString>;
        category: z.ZodDefault<z.ZodEnum<["MARKETING", "UTILITY", "AUTHENTICATION"]>>;
        headerType: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        headerContent: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        bodyText: z.ZodString;
        footerText: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        buttons: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            text: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            phoneNumber: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            text: string;
            url?: string | undefined;
            phoneNumber?: string | undefined;
        }, {
            type: string;
            text: string;
            url?: string | undefined;
            phoneNumber?: string | undefined;
        }>, "many">>;
        variables: z.ZodOptional<z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            type: z.ZodString;
            example: z.ZodOptional<z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            index: number;
            example?: any;
        }, {
            type: string;
            index: number;
            example?: any;
        }>, "many">>;
        whatsappAccountId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        language: string;
        category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
        bodyText: string;
        whatsappAccountId?: string | undefined;
        headerType?: string | null | undefined;
        headerContent?: string | null | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: string;
            text: string;
            url?: string | undefined;
            phoneNumber?: string | undefined;
        }[] | undefined;
        variables?: {
            type: string;
            index: number;
            example?: any;
        }[] | undefined;
    }, {
        name: string;
        bodyText: string;
        whatsappAccountId?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        headerType?: string | null | undefined;
        headerContent?: string | null | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: string;
            text: string;
            url?: string | undefined;
            phoneNumber?: string | undefined;
        }[] | undefined;
        variables?: {
            type: string;
            index: number;
            example?: any;
        }[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        language: string;
        category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
        bodyText: string;
        whatsappAccountId?: string | undefined;
        headerType?: string | null | undefined;
        headerContent?: string | null | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: string;
            text: string;
            url?: string | undefined;
            phoneNumber?: string | undefined;
        }[] | undefined;
        variables?: {
            type: string;
            index: number;
            example?: any;
        }[] | undefined;
    };
}, {
    body: {
        name: string;
        bodyText: string;
        whatsappAccountId?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        headerType?: string | null | undefined;
        headerContent?: string | null | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: string;
            text: string;
            url?: string | undefined;
            phoneNumber?: string | undefined;
        }[] | undefined;
        variables?: {
            type: string;
            index: number;
            example?: any;
        }[] | undefined;
    };
}>;
export declare const updateTemplateSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        language: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodEnum<["MARKETING", "UTILITY", "AUTHENTICATION"]>>;
        headerType: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        headerContent: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        bodyText: z.ZodOptional<z.ZodString>;
        footerText: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        buttons: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            text: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            phoneNumber: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            text: string;
            url?: string | undefined;
            phoneNumber?: string | undefined;
        }, {
            type: string;
            text: string;
            url?: string | undefined;
            phoneNumber?: string | undefined;
        }>, "many">>;
        variables: z.ZodOptional<z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            type: z.ZodString;
            example: z.ZodOptional<z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            index: number;
            example?: any;
        }, {
            type: string;
            index: number;
            example?: any;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        headerType?: string | null | undefined;
        headerContent?: string | null | undefined;
        bodyText?: string | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: string;
            text: string;
            url?: string | undefined;
            phoneNumber?: string | undefined;
        }[] | undefined;
        variables?: {
            type: string;
            index: number;
            example?: any;
        }[] | undefined;
    }, {
        name?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        headerType?: string | null | undefined;
        headerContent?: string | null | undefined;
        bodyText?: string | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: string;
            text: string;
            url?: string | undefined;
            phoneNumber?: string | undefined;
        }[] | undefined;
        variables?: {
            type: string;
            index: number;
            example?: any;
        }[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        headerType?: string | null | undefined;
        headerContent?: string | null | undefined;
        bodyText?: string | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: string;
            text: string;
            url?: string | undefined;
            phoneNumber?: string | undefined;
        }[] | undefined;
        variables?: {
            type: string;
            index: number;
            example?: any;
        }[] | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        name?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        headerType?: string | null | undefined;
        headerContent?: string | null | undefined;
        bodyText?: string | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: string;
            text: string;
            url?: string | undefined;
            phoneNumber?: string | undefined;
        }[] | undefined;
        variables?: {
            type: string;
            index: number;
            example?: any;
        }[] | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const getTemplateByIdSchema: z.ZodObject<{
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
export declare const deleteTemplateSchema: z.ZodObject<{
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
export declare const duplicateTemplateSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodString;
        whatsappAccountId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        whatsappAccountId?: string | undefined;
    }, {
        name: string;
        whatsappAccountId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        whatsappAccountId?: string | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        name: string;
        whatsappAccountId?: string | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const submitTemplateSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodOptional<z.ZodObject<{
        whatsappAccountId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        whatsappAccountId?: string | undefined;
    }, {
        whatsappAccountId?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body?: {
        whatsappAccountId?: string | undefined;
    } | undefined;
}, {
    params: {
        id: string;
    };
    body?: {
        whatsappAccountId?: string | undefined;
    } | undefined;
}>;
export declare const previewTemplateSchema: z.ZodObject<{
    body: z.ZodObject<{
        bodyText: z.ZodString;
        variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headerType: z.ZodOptional<z.ZodString>;
        headerContent: z.ZodOptional<z.ZodString>;
        footerText: z.ZodOptional<z.ZodString>;
        buttons: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: string;
            text: string;
        }, {
            type: string;
            text: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        bodyText: string;
        headerType?: string | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: {
            type: string;
            text: string;
        }[] | undefined;
        variables?: Record<string, string> | undefined;
    }, {
        bodyText: string;
        headerType?: string | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: {
            type: string;
            text: string;
        }[] | undefined;
        variables?: Record<string, string> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        bodyText: string;
        headerType?: string | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: {
            type: string;
            text: string;
        }[] | undefined;
        variables?: Record<string, string> | undefined;
    };
}, {
    body: {
        bodyText: string;
        headerType?: string | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: {
            type: string;
            text: string;
        }[] | undefined;
        variables?: Record<string, string> | undefined;
    };
}>;
export declare const syncTemplatesSchema: z.ZodObject<{
    body: z.ZodOptional<z.ZodObject<{
        whatsappAccountId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        whatsappAccountId?: string | undefined;
    }, {
        whatsappAccountId?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    body?: {
        whatsappAccountId?: string | undefined;
    } | undefined;
}, {
    body?: {
        whatsappAccountId?: string | undefined;
    } | undefined;
}>;
export declare const getTemplatesQuerySchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodObject<{
        page: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
        limit: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
        search: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["PENDING", "APPROVED", "REJECTED"]>>;
        category: z.ZodOptional<z.ZodEnum<["MARKETING", "UTILITY", "AUTHENTICATION"]>>;
        language: z.ZodOptional<z.ZodString>;
        sortBy: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
        whatsappAccountId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        whatsappAccountId?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        search?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }, {
        limit?: string | undefined;
        whatsappAccountId?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        page?: string | undefined;
        search?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    query?: {
        limit: number;
        page: number;
        whatsappAccountId?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        search?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    } | undefined;
}, {
    query?: {
        limit?: string | undefined;
        whatsappAccountId?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        page?: string | undefined;
        search?: string | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    } | undefined;
}>;
//# sourceMappingURL=templates.schema.d.ts.map