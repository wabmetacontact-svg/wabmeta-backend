import { z } from 'zod';
export declare const createCampaignSchema: z.ZodObject<{
    body: z.ZodEffects<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        templateId: z.ZodString;
        whatsappAccountId: z.ZodString;
        contactGroupId: z.ZodOptional<z.ZodString>;
        contactIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        csvContacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            phone: z.ZodString;
            customData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            phone: string;
            customData?: Record<string, any> | undefined;
        }, {
            phone: string;
            customData?: Record<string, any> | undefined;
        }>, "many">>;
        audienceFilter: z.ZodOptional<z.ZodObject<{
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            status: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            createdAfter: z.ZodOptional<z.ZodString>;
            createdBefore: z.ZodOptional<z.ZodString>;
            hasMessaged: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        }, {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        }>>;
        scheduledAt: z.ZodOptional<z.ZodString>;
        variableMapping: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodEnum<["field", "static"]>;
            value: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "field" | "static";
            value: string;
        }, {
            type: "field" | "static";
            value: string;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        whatsappAccountId: string;
        templateId: string;
        scheduledAt?: string | undefined;
        description?: string | undefined;
        contactGroupId?: string | undefined;
        audienceFilter?: {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        contactIds?: string[] | undefined;
        csvContacts?: {
            phone: string;
            customData?: Record<string, any> | undefined;
        }[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    }, {
        name: string;
        whatsappAccountId: string;
        templateId: string;
        scheduledAt?: string | undefined;
        description?: string | undefined;
        contactGroupId?: string | undefined;
        audienceFilter?: {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        contactIds?: string[] | undefined;
        csvContacts?: {
            phone: string;
            customData?: Record<string, any> | undefined;
        }[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    }>, {
        name: string;
        whatsappAccountId: string;
        templateId: string;
        scheduledAt?: string | undefined;
        description?: string | undefined;
        contactGroupId?: string | undefined;
        audienceFilter?: {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        contactIds?: string[] | undefined;
        csvContacts?: {
            phone: string;
            customData?: Record<string, any> | undefined;
        }[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    }, {
        name: string;
        whatsappAccountId: string;
        templateId: string;
        scheduledAt?: string | undefined;
        description?: string | undefined;
        contactGroupId?: string | undefined;
        audienceFilter?: {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        contactIds?: string[] | undefined;
        csvContacts?: {
            phone: string;
            customData?: Record<string, any> | undefined;
        }[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        whatsappAccountId: string;
        templateId: string;
        scheduledAt?: string | undefined;
        description?: string | undefined;
        contactGroupId?: string | undefined;
        audienceFilter?: {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        contactIds?: string[] | undefined;
        csvContacts?: {
            phone: string;
            customData?: Record<string, any> | undefined;
        }[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    };
}, {
    body: {
        name: string;
        whatsappAccountId: string;
        templateId: string;
        scheduledAt?: string | undefined;
        description?: string | undefined;
        contactGroupId?: string | undefined;
        audienceFilter?: {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        contactIds?: string[] | undefined;
        csvContacts?: {
            phone: string;
            customData?: Record<string, any> | undefined;
        }[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    };
}>;
export declare const updateCampaignSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        templateId: z.ZodOptional<z.ZodString>;
        contactGroupId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        contactIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        audienceFilter: z.ZodOptional<z.ZodObject<{
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            status: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            createdAfter: z.ZodOptional<z.ZodString>;
            createdBefore: z.ZodOptional<z.ZodString>;
            hasMessaged: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        }, {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        }>>;
        scheduledAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        variableMapping: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodEnum<["field", "static"]>;
            value: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "field" | "static";
            value: string;
        }, {
            type: "field" | "static";
            value: string;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        scheduledAt?: string | null | undefined;
        description?: string | null | undefined;
        templateId?: string | undefined;
        contactGroupId?: string | null | undefined;
        audienceFilter?: {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    }, {
        name?: string | undefined;
        scheduledAt?: string | null | undefined;
        description?: string | null | undefined;
        templateId?: string | undefined;
        contactGroupId?: string | null | undefined;
        audienceFilter?: {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name?: string | undefined;
        scheduledAt?: string | null | undefined;
        description?: string | null | undefined;
        templateId?: string | undefined;
        contactGroupId?: string | null | undefined;
        audienceFilter?: {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        name?: string | undefined;
        scheduledAt?: string | null | undefined;
        description?: string | null | undefined;
        templateId?: string | undefined;
        contactGroupId?: string | null | undefined;
        audienceFilter?: {
            tags?: string[] | undefined;
            status?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const getCampaignsSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        search: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            DRAFT: "DRAFT";
            SCHEDULED: "SCHEDULED";
            RUNNING: "RUNNING";
            PAUSED: "PAUSED";
            COMPLETED: "COMPLETED";
            FAILED: "FAILED";
            CANCELLED: "CANCELLED";
        }>>;
        sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["createdAt", "name", "scheduledAt", "sentCount"]>>>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        sortBy: "name" | "scheduledAt" | "createdAt" | "sentCount";
        sortOrder: "asc" | "desc";
        status?: "CANCELLED" | "COMPLETED" | "DRAFT" | "PAUSED" | "FAILED" | "SCHEDULED" | "RUNNING" | undefined;
        search?: string | undefined;
    }, {
        status?: "CANCELLED" | "COMPLETED" | "DRAFT" | "PAUSED" | "FAILED" | "SCHEDULED" | "RUNNING" | undefined;
        limit?: string | undefined;
        page?: string | undefined;
        search?: string | undefined;
        sortBy?: "name" | "scheduledAt" | "createdAt" | "sentCount" | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        sortBy: "name" | "scheduledAt" | "createdAt" | "sentCount";
        sortOrder: "asc" | "desc";
        status?: "CANCELLED" | "COMPLETED" | "DRAFT" | "PAUSED" | "FAILED" | "SCHEDULED" | "RUNNING" | undefined;
        search?: string | undefined;
    };
}, {
    query: {
        status?: "CANCELLED" | "COMPLETED" | "DRAFT" | "PAUSED" | "FAILED" | "SCHEDULED" | "RUNNING" | undefined;
        limit?: string | undefined;
        page?: string | undefined;
        search?: string | undefined;
        sortBy?: "name" | "scheduledAt" | "createdAt" | "sentCount" | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    };
}>;
export declare const getCampaignByIdSchema: z.ZodObject<{
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
export declare const deleteCampaignSchema: z.ZodObject<{
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
export declare const getCampaignContactsSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            PENDING: "PENDING";
            SENT: "SENT";
            DELIVERED: "DELIVERED";
            READ: "READ";
            FAILED: "FAILED";
            QUEUED: "QUEUED";
        }>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        status?: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "QUEUED" | undefined;
    }, {
        status?: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "QUEUED" | undefined;
        limit?: string | undefined;
        page?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        status?: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "QUEUED" | undefined;
    };
    params: {
        id: string;
    };
}, {
    query: {
        status?: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "QUEUED" | undefined;
        limit?: string | undefined;
        page?: string | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const startCampaignSchema: z.ZodObject<{
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
export declare const pauseCampaignSchema: z.ZodObject<{
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
export declare const resumeCampaignSchema: z.ZodObject<{
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
export declare const cancelCampaignSchema: z.ZodObject<{
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
export declare const retryCampaignSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        retryFailed: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        retryPending: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        retryFailed: boolean;
        retryPending: boolean;
    }, {
        retryFailed?: boolean | undefined;
        retryPending?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        retryFailed: boolean;
        retryPending: boolean;
    };
    params: {
        id: string;
    };
}, {
    body: {
        retryFailed?: boolean | undefined;
        retryPending?: boolean | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const duplicateCampaignSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
    }, {
        name: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
    };
    params: {
        id: string;
    };
}, {
    body: {
        name: string;
    };
    params: {
        id: string;
    };
}>;
export type CreateCampaignSchema = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignSchema = z.infer<typeof updateCampaignSchema>;
export type GetCampaignsSchema = z.infer<typeof getCampaignsSchema>;
export type GetCampaignContactsSchema = z.infer<typeof getCampaignContactsSchema>;
export type RetryCampaignSchema = z.infer<typeof retryCampaignSchema>;
export type DuplicateCampaignSchema = z.infer<typeof duplicateCampaignSchema>;
//# sourceMappingURL=campaigns.schema.d.ts.map