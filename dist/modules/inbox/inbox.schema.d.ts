import { z } from 'zod';
export declare const getConversationsSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        search: z.ZodOptional<z.ZodString>;
        isArchived: z.ZodOptional<z.ZodEffects<z.ZodString, boolean, string>>;
        isRead: z.ZodOptional<z.ZodEffects<z.ZodString, boolean, string>>;
        assignedTo: z.ZodOptional<z.ZodString>;
        labels: z.ZodOptional<z.ZodString>;
        sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["lastMessageAt", "createdAt", "unreadCount"]>>>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        sortBy: "createdAt" | "lastMessageAt" | "unreadCount";
        sortOrder: "asc" | "desc";
        search?: string | undefined;
        isArchived?: boolean | undefined;
        isRead?: boolean | undefined;
        assignedTo?: string | undefined;
        labels?: string | undefined;
    }, {
        search?: string | undefined;
        limit?: string | undefined;
        page?: string | undefined;
        isArchived?: string | undefined;
        isRead?: string | undefined;
        assignedTo?: string | undefined;
        labels?: string | undefined;
        sortBy?: "createdAt" | "lastMessageAt" | "unreadCount" | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        sortBy: "createdAt" | "lastMessageAt" | "unreadCount";
        sortOrder: "asc" | "desc";
        search?: string | undefined;
        isArchived?: boolean | undefined;
        isRead?: boolean | undefined;
        assignedTo?: string | undefined;
        labels?: string | undefined;
    };
}, {
    query: {
        search?: string | undefined;
        limit?: string | undefined;
        page?: string | undefined;
        isArchived?: string | undefined;
        isRead?: string | undefined;
        assignedTo?: string | undefined;
        labels?: string | undefined;
        sortBy?: "createdAt" | "lastMessageAt" | "unreadCount" | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    };
}>;
export declare const getConversationByIdSchema: z.ZodObject<{
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
export declare const getMessagesSchema: z.ZodObject<{
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
        before: z.ZodOptional<z.ZodString>;
        after: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        before?: string | undefined;
        after?: string | undefined;
    }, {
        limit?: string | undefined;
        page?: string | undefined;
        before?: string | undefined;
        after?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        before?: string | undefined;
        after?: string | undefined;
    };
    params: {
        id: string;
    };
}, {
    query: {
        limit?: string | undefined;
        page?: string | undefined;
        before?: string | undefined;
        after?: string | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const sendMessageSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodEffects<z.ZodObject<{
        type: z.ZodEnum<["text", "image", "video", "audio", "document", "location", "interactive"]>;
        content: z.ZodOptional<z.ZodString>;
        mediaUrl: z.ZodOptional<z.ZodString>;
        mediaType: z.ZodOptional<z.ZodString>;
        filename: z.ZodOptional<z.ZodString>;
        replyToMessageId: z.ZodOptional<z.ZodString>;
        interactive: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["button", "list"]>;
            buttons: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                title: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                id: string;
                title: string;
            }, {
                id: string;
                title: string;
            }>, "many">>;
            sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                rows: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    title: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    id: string;
                    title: string;
                    description?: string | undefined;
                }, {
                    id: string;
                    title: string;
                    description?: string | undefined;
                }>, "many">;
            }, "strip", z.ZodTypeAny, {
                rows: {
                    id: string;
                    title: string;
                    description?: string | undefined;
                }[];
                title?: string | undefined;
            }, {
                rows: {
                    id: string;
                    title: string;
                    description?: string | undefined;
                }[];
                title?: string | undefined;
            }>, "many">>;
            buttonText: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "button" | "list";
            buttons?: {
                id: string;
                title: string;
            }[] | undefined;
            sections?: {
                rows: {
                    id: string;
                    title: string;
                    description?: string | undefined;
                }[];
                title?: string | undefined;
            }[] | undefined;
            buttonText?: string | undefined;
        }, {
            type: "button" | "list";
            buttons?: {
                id: string;
                title: string;
            }[] | undefined;
            sections?: {
                rows: {
                    id: string;
                    title: string;
                    description?: string | undefined;
                }[];
                title?: string | undefined;
            }[] | undefined;
            buttonText?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "text" | "image" | "video" | "document" | "audio" | "location" | "interactive";
        filename?: string | undefined;
        interactive?: {
            type: "button" | "list";
            buttons?: {
                id: string;
                title: string;
            }[] | undefined;
            sections?: {
                rows: {
                    id: string;
                    title: string;
                    description?: string | undefined;
                }[];
                title?: string | undefined;
            }[] | undefined;
            buttonText?: string | undefined;
        } | undefined;
        content?: string | undefined;
        mediaUrl?: string | undefined;
        mediaType?: string | undefined;
        replyToMessageId?: string | undefined;
    }, {
        type: "text" | "image" | "video" | "document" | "audio" | "location" | "interactive";
        filename?: string | undefined;
        interactive?: {
            type: "button" | "list";
            buttons?: {
                id: string;
                title: string;
            }[] | undefined;
            sections?: {
                rows: {
                    id: string;
                    title: string;
                    description?: string | undefined;
                }[];
                title?: string | undefined;
            }[] | undefined;
            buttonText?: string | undefined;
        } | undefined;
        content?: string | undefined;
        mediaUrl?: string | undefined;
        mediaType?: string | undefined;
        replyToMessageId?: string | undefined;
    }>, {
        type: "text" | "image" | "video" | "document" | "audio" | "location" | "interactive";
        filename?: string | undefined;
        interactive?: {
            type: "button" | "list";
            buttons?: {
                id: string;
                title: string;
            }[] | undefined;
            sections?: {
                rows: {
                    id: string;
                    title: string;
                    description?: string | undefined;
                }[];
                title?: string | undefined;
            }[] | undefined;
            buttonText?: string | undefined;
        } | undefined;
        content?: string | undefined;
        mediaUrl?: string | undefined;
        mediaType?: string | undefined;
        replyToMessageId?: string | undefined;
    }, {
        type: "text" | "image" | "video" | "document" | "audio" | "location" | "interactive";
        filename?: string | undefined;
        interactive?: {
            type: "button" | "list";
            buttons?: {
                id: string;
                title: string;
            }[] | undefined;
            sections?: {
                rows: {
                    id: string;
                    title: string;
                    description?: string | undefined;
                }[];
                title?: string | undefined;
            }[] | undefined;
            buttonText?: string | undefined;
        } | undefined;
        content?: string | undefined;
        mediaUrl?: string | undefined;
        mediaType?: string | undefined;
        replyToMessageId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        type: "text" | "image" | "video" | "document" | "audio" | "location" | "interactive";
        filename?: string | undefined;
        interactive?: {
            type: "button" | "list";
            buttons?: {
                id: string;
                title: string;
            }[] | undefined;
            sections?: {
                rows: {
                    id: string;
                    title: string;
                    description?: string | undefined;
                }[];
                title?: string | undefined;
            }[] | undefined;
            buttonText?: string | undefined;
        } | undefined;
        content?: string | undefined;
        mediaUrl?: string | undefined;
        mediaType?: string | undefined;
        replyToMessageId?: string | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        type: "text" | "image" | "video" | "document" | "audio" | "location" | "interactive";
        filename?: string | undefined;
        interactive?: {
            type: "button" | "list";
            buttons?: {
                id: string;
                title: string;
            }[] | undefined;
            sections?: {
                rows: {
                    id: string;
                    title: string;
                    description?: string | undefined;
                }[];
                title?: string | undefined;
            }[] | undefined;
            buttonText?: string | undefined;
        } | undefined;
        content?: string | undefined;
        mediaUrl?: string | undefined;
        mediaType?: string | undefined;
        replyToMessageId?: string | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const updateConversationSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        isArchived: z.ZodOptional<z.ZodBoolean>;
        isRead: z.ZodOptional<z.ZodBoolean>;
        labels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        assignedTo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        isArchived?: boolean | undefined;
        isRead?: boolean | undefined;
        assignedTo?: string | null | undefined;
        labels?: string[] | undefined;
    }, {
        isArchived?: boolean | undefined;
        isRead?: boolean | undefined;
        assignedTo?: string | null | undefined;
        labels?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        isArchived?: boolean | undefined;
        isRead?: boolean | undefined;
        assignedTo?: string | null | undefined;
        labels?: string[] | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        isArchived?: boolean | undefined;
        isRead?: boolean | undefined;
        assignedTo?: string | null | undefined;
        labels?: string[] | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const markAsReadSchema: z.ZodObject<{
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
export declare const archiveConversationSchema: z.ZodObject<{
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
export declare const assignConversationSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        userId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        userId: string | null;
    }, {
        userId: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        userId: string | null;
    };
    params: {
        id: string;
    };
}, {
    body: {
        userId: string | null;
    };
    params: {
        id: string;
    };
}>;
export declare const addLabelsSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        labels: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        labels: string[];
    }, {
        labels: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        labels: string[];
    };
    params: {
        id: string;
    };
}, {
    body: {
        labels: string[];
    };
    params: {
        id: string;
    };
}>;
export declare const deleteConversationSchema: z.ZodObject<{
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
export declare const bulkUpdateConversationsSchema: z.ZodObject<{
    body: z.ZodObject<{
        conversationIds: z.ZodArray<z.ZodString, "many">;
        isArchived: z.ZodOptional<z.ZodBoolean>;
        isRead: z.ZodOptional<z.ZodBoolean>;
        assignedTo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        conversationIds: string[];
        isArchived?: boolean | undefined;
        isRead?: boolean | undefined;
        assignedTo?: string | null | undefined;
    }, {
        conversationIds: string[];
        isArchived?: boolean | undefined;
        isRead?: boolean | undefined;
        assignedTo?: string | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        conversationIds: string[];
        isArchived?: boolean | undefined;
        isRead?: boolean | undefined;
        assignedTo?: string | null | undefined;
    };
}, {
    body: {
        conversationIds: string[];
        isArchived?: boolean | undefined;
        isRead?: boolean | undefined;
        assignedTo?: string | null | undefined;
    };
}>;
export declare const searchMessagesSchema: z.ZodObject<{
    query: z.ZodObject<{
        q: z.ZodString;
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        q: string;
    }, {
        q: string;
        limit?: string | undefined;
        page?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        q: string;
    };
}, {
    query: {
        q: string;
        limit?: string | undefined;
        page?: string | undefined;
    };
}>;
export type GetConversationsSchema = z.infer<typeof getConversationsSchema>;
export type GetMessagesSchema = z.infer<typeof getMessagesSchema>;
export type SendMessageSchema = z.infer<typeof sendMessageSchema>;
export type UpdateConversationSchema = z.infer<typeof updateConversationSchema>;
export type AssignConversationSchema = z.infer<typeof assignConversationSchema>;
export type BulkUpdateConversationsSchema = z.infer<typeof bulkUpdateConversationsSchema>;
export type SearchMessagesSchema = z.infer<typeof searchMessagesSchema>;
//# sourceMappingURL=inbox.schema.d.ts.map