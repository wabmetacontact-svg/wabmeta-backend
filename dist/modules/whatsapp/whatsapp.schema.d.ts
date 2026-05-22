import { z } from 'zod';
export declare const connectAccountSchema: z.ZodObject<{
    body: z.ZodObject<{
        code: z.ZodString;
        redirectUri: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        redirectUri: string;
    }, {
        code: string;
        redirectUri: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        code: string;
        redirectUri: string;
    };
}, {
    body: {
        code: string;
        redirectUri: string;
    };
}>;
export declare const disconnectAccountSchema: z.ZodObject<{
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
export declare const setDefaultAccountSchema: z.ZodObject<{
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
export declare const sendTextMessageSchema: z.ZodObject<{
    body: z.ZodObject<{
        whatsappAccountId: z.ZodString;
        to: z.ZodString;
        text: z.ZodString;
        replyToMessageId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        to: string;
        whatsappAccountId: string;
        replyToMessageId?: string | undefined;
    }, {
        text: string;
        to: string;
        whatsappAccountId: string;
        replyToMessageId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        text: string;
        to: string;
        whatsappAccountId: string;
        replyToMessageId?: string | undefined;
    };
}, {
    body: {
        text: string;
        to: string;
        whatsappAccountId: string;
        replyToMessageId?: string | undefined;
    };
}>;
export declare const sendTemplateMessageSchema: z.ZodObject<{
    body: z.ZodObject<{
        whatsappAccountId: z.ZodString;
        to: z.ZodString;
        templateName: z.ZodString;
        languageCode: z.ZodDefault<z.ZodString>;
        components: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["header", "body", "button"]>;
            sub_type: z.ZodOptional<z.ZodEnum<["quick_reply", "url"]>>;
            index: z.ZodOptional<z.ZodNumber>;
            parameters: z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<["text", "currency", "date_time", "image", "video", "document"]>;
                text: z.ZodOptional<z.ZodString>;
                image: z.ZodOptional<z.ZodObject<{
                    link: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    link: string;
                }, {
                    link: string;
                }>>;
                video: z.ZodOptional<z.ZodObject<{
                    link: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    link: string;
                }, {
                    link: string;
                }>>;
                document: z.ZodOptional<z.ZodObject<{
                    link: z.ZodString;
                    filename: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    link: string;
                    filename?: string | undefined;
                }, {
                    link: string;
                    filename?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                type: "text" | "image" | "video" | "document" | "currency" | "date_time";
                text?: string | undefined;
                image?: {
                    link: string;
                } | undefined;
                video?: {
                    link: string;
                } | undefined;
                document?: {
                    link: string;
                    filename?: string | undefined;
                } | undefined;
            }, {
                type: "text" | "image" | "video" | "document" | "currency" | "date_time";
                text?: string | undefined;
                image?: {
                    link: string;
                } | undefined;
                video?: {
                    link: string;
                } | undefined;
                document?: {
                    link: string;
                    filename?: string | undefined;
                } | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            type: "body" | "header" | "button";
            parameters: {
                type: "text" | "image" | "video" | "document" | "currency" | "date_time";
                text?: string | undefined;
                image?: {
                    link: string;
                } | undefined;
                video?: {
                    link: string;
                } | undefined;
                document?: {
                    link: string;
                    filename?: string | undefined;
                } | undefined;
            }[];
            index?: number | undefined;
            sub_type?: "url" | "quick_reply" | undefined;
        }, {
            type: "body" | "header" | "button";
            parameters: {
                type: "text" | "image" | "video" | "document" | "currency" | "date_time";
                text?: string | undefined;
                image?: {
                    link: string;
                } | undefined;
                video?: {
                    link: string;
                } | undefined;
                document?: {
                    link: string;
                    filename?: string | undefined;
                } | undefined;
            }[];
            index?: number | undefined;
            sub_type?: "url" | "quick_reply" | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        to: string;
        whatsappAccountId: string;
        templateName: string;
        languageCode: string;
        components?: {
            type: "body" | "header" | "button";
            parameters: {
                type: "text" | "image" | "video" | "document" | "currency" | "date_time";
                text?: string | undefined;
                image?: {
                    link: string;
                } | undefined;
                video?: {
                    link: string;
                } | undefined;
                document?: {
                    link: string;
                    filename?: string | undefined;
                } | undefined;
            }[];
            index?: number | undefined;
            sub_type?: "url" | "quick_reply" | undefined;
        }[] | undefined;
    }, {
        to: string;
        whatsappAccountId: string;
        templateName: string;
        components?: {
            type: "body" | "header" | "button";
            parameters: {
                type: "text" | "image" | "video" | "document" | "currency" | "date_time";
                text?: string | undefined;
                image?: {
                    link: string;
                } | undefined;
                video?: {
                    link: string;
                } | undefined;
                document?: {
                    link: string;
                    filename?: string | undefined;
                } | undefined;
            }[];
            index?: number | undefined;
            sub_type?: "url" | "quick_reply" | undefined;
        }[] | undefined;
        languageCode?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        to: string;
        whatsappAccountId: string;
        templateName: string;
        languageCode: string;
        components?: {
            type: "body" | "header" | "button";
            parameters: {
                type: "text" | "image" | "video" | "document" | "currency" | "date_time";
                text?: string | undefined;
                image?: {
                    link: string;
                } | undefined;
                video?: {
                    link: string;
                } | undefined;
                document?: {
                    link: string;
                    filename?: string | undefined;
                } | undefined;
            }[];
            index?: number | undefined;
            sub_type?: "url" | "quick_reply" | undefined;
        }[] | undefined;
    };
}, {
    body: {
        to: string;
        whatsappAccountId: string;
        templateName: string;
        components?: {
            type: "body" | "header" | "button";
            parameters: {
                type: "text" | "image" | "video" | "document" | "currency" | "date_time";
                text?: string | undefined;
                image?: {
                    link: string;
                } | undefined;
                video?: {
                    link: string;
                } | undefined;
                document?: {
                    link: string;
                    filename?: string | undefined;
                } | undefined;
            }[];
            index?: number | undefined;
            sub_type?: "url" | "quick_reply" | undefined;
        }[] | undefined;
        languageCode?: string | undefined;
    };
}>;
export declare const sendMediaMessageSchema: z.ZodObject<{
    body: z.ZodObject<{
        whatsappAccountId: z.ZodString;
        to: z.ZodString;
        type: z.ZodEnum<["image", "video", "audio", "document"]>;
        mediaUrl: z.ZodString;
        caption: z.ZodOptional<z.ZodString>;
        filename: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "image" | "video" | "document" | "audio";
        to: string;
        whatsappAccountId: string;
        mediaUrl: string;
        filename?: string | undefined;
        caption?: string | undefined;
    }, {
        type: "image" | "video" | "document" | "audio";
        to: string;
        whatsappAccountId: string;
        mediaUrl: string;
        filename?: string | undefined;
        caption?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        type: "image" | "video" | "document" | "audio";
        to: string;
        whatsappAccountId: string;
        mediaUrl: string;
        filename?: string | undefined;
        caption?: string | undefined;
    };
}, {
    body: {
        type: "image" | "video" | "document" | "audio";
        to: string;
        whatsappAccountId: string;
        mediaUrl: string;
        filename?: string | undefined;
        caption?: string | undefined;
    };
}>;
export declare const sendInteractiveMessageSchema: z.ZodObject<{
    body: z.ZodObject<{
        whatsappAccountId: z.ZodString;
        to: z.ZodString;
        interactiveType: z.ZodEnum<["button", "list"]>;
        bodyText: z.ZodString;
        headerText: z.ZodOptional<z.ZodString>;
        footerText: z.ZodOptional<z.ZodString>;
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
    }, "strip", z.ZodTypeAny, {
        to: string;
        whatsappAccountId: string;
        bodyText: string;
        interactiveType: "button" | "list";
        footerText?: string | undefined;
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
        headerText?: string | undefined;
    }, {
        to: string;
        whatsappAccountId: string;
        bodyText: string;
        interactiveType: "button" | "list";
        footerText?: string | undefined;
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
        headerText?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        to: string;
        whatsappAccountId: string;
        bodyText: string;
        interactiveType: "button" | "list";
        footerText?: string | undefined;
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
        headerText?: string | undefined;
    };
}, {
    body: {
        to: string;
        whatsappAccountId: string;
        bodyText: string;
        interactiveType: "button" | "list";
        footerText?: string | undefined;
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
        headerText?: string | undefined;
    };
}>;
export declare const webhookVerifySchema: z.ZodObject<{
    query: z.ZodObject<{
        'hub.mode': z.ZodString;
        'hub.verify_token': z.ZodString;
        'hub.challenge': z.ZodString;
    }, "strip", z.ZodTypeAny, {
        'hub.mode': string;
        'hub.verify_token': string;
        'hub.challenge': string;
    }, {
        'hub.mode': string;
        'hub.verify_token': string;
        'hub.challenge': string;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        'hub.mode': string;
        'hub.verify_token': string;
        'hub.challenge': string;
    };
}, {
    query: {
        'hub.mode': string;
        'hub.verify_token': string;
        'hub.challenge': string;
    };
}>;
export declare const getMediaUrlSchema: z.ZodObject<{
    params: z.ZodObject<{
        mediaId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        mediaId: string;
    }, {
        mediaId: string;
    }>;
    query: z.ZodObject<{
        whatsappAccountId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        whatsappAccountId: string;
    }, {
        whatsappAccountId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        whatsappAccountId: string;
    };
    params: {
        mediaId: string;
    };
}, {
    query: {
        whatsappAccountId: string;
    };
    params: {
        mediaId: string;
    };
}>;
export declare const syncTemplatesSchema: z.ZodObject<{
    body: z.ZodObject<{
        whatsappAccountId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        whatsappAccountId: string;
    }, {
        whatsappAccountId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        whatsappAccountId: string;
    };
}, {
    body: {
        whatsappAccountId: string;
    };
}>;
export type ConnectAccountSchema = z.infer<typeof connectAccountSchema>;
export type SendTextMessageSchema = z.infer<typeof sendTextMessageSchema>;
export type SendTemplateMessageSchema = z.infer<typeof sendTemplateMessageSchema>;
export type SendMediaMessageSchema = z.infer<typeof sendMediaMessageSchema>;
export type SendInteractiveMessageSchema = z.infer<typeof sendInteractiveMessageSchema>;
//# sourceMappingURL=whatsapp.schema.d.ts.map