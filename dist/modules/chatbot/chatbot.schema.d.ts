import { z } from 'zod';
export declare const createChatbotSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        triggerKeywords: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        isDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        welcomeMessage: z.ZodOptional<z.ZodString>;
        fallbackMessage: z.ZodOptional<z.ZodString>;
        flowData: z.ZodOptional<z.ZodObject<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        isDefault: boolean;
        triggerKeywords: string[];
        description?: string | undefined;
        flowData?: z.objectOutputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        welcomeMessage?: string | undefined;
        fallbackMessage?: string | undefined;
    }, {
        name: string;
        isDefault?: boolean | undefined;
        description?: string | undefined;
        flowData?: z.objectInputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        triggerKeywords?: string[] | undefined;
        welcomeMessage?: string | undefined;
        fallbackMessage?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        isDefault: boolean;
        triggerKeywords: string[];
        description?: string | undefined;
        flowData?: z.objectOutputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        welcomeMessage?: string | undefined;
        fallbackMessage?: string | undefined;
    };
}, {
    body: {
        name: string;
        isDefault?: boolean | undefined;
        description?: string | undefined;
        flowData?: z.objectInputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        triggerKeywords?: string[] | undefined;
        welcomeMessage?: string | undefined;
        fallbackMessage?: string | undefined;
    };
}>;
export declare const updateChatbotSchema: z.ZodObject<{
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
        triggerKeywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        isDefault: z.ZodOptional<z.ZodBoolean>;
        welcomeMessage: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        fallbackMessage: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        flowData: z.ZodOptional<z.ZodObject<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough">>>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            DRAFT: "DRAFT";
            ACTIVE: "ACTIVE";
            PAUSED: "PAUSED";
        }>>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        status?: "DRAFT" | "PAUSED" | "ACTIVE" | undefined;
        isDefault?: boolean | undefined;
        description?: string | null | undefined;
        flowData?: z.objectOutputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        triggerKeywords?: string[] | undefined;
        welcomeMessage?: string | null | undefined;
        fallbackMessage?: string | null | undefined;
    }, {
        name?: string | undefined;
        status?: "DRAFT" | "PAUSED" | "ACTIVE" | undefined;
        isDefault?: boolean | undefined;
        description?: string | null | undefined;
        flowData?: z.objectInputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        triggerKeywords?: string[] | undefined;
        welcomeMessage?: string | null | undefined;
        fallbackMessage?: string | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name?: string | undefined;
        status?: "DRAFT" | "PAUSED" | "ACTIVE" | undefined;
        isDefault?: boolean | undefined;
        description?: string | null | undefined;
        flowData?: z.objectOutputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        triggerKeywords?: string[] | undefined;
        welcomeMessage?: string | null | undefined;
        fallbackMessage?: string | null | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        name?: string | undefined;
        status?: "DRAFT" | "PAUSED" | "ACTIVE" | undefined;
        isDefault?: boolean | undefined;
        description?: string | null | undefined;
        flowData?: z.objectInputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        triggerKeywords?: string[] | undefined;
        welcomeMessage?: string | null | undefined;
        fallbackMessage?: string | null | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const getChatbotsSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        search: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            DRAFT: "DRAFT";
            ACTIVE: "ACTIVE";
            PAUSED: "PAUSED";
        }>>;
        sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["createdAt", "name", "status"]>>>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        sortBy: "name" | "status" | "createdAt";
        sortOrder: "desc" | "asc";
        search?: string | undefined;
        status?: "DRAFT" | "PAUSED" | "ACTIVE" | undefined;
    }, {
        search?: string | undefined;
        limit?: string | undefined;
        status?: "DRAFT" | "PAUSED" | "ACTIVE" | undefined;
        page?: string | undefined;
        sortBy?: "name" | "status" | "createdAt" | undefined;
        sortOrder?: "desc" | "asc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        sortBy: "name" | "status" | "createdAt";
        sortOrder: "desc" | "asc";
        search?: string | undefined;
        status?: "DRAFT" | "PAUSED" | "ACTIVE" | undefined;
    };
}, {
    query: {
        search?: string | undefined;
        limit?: string | undefined;
        status?: "DRAFT" | "PAUSED" | "ACTIVE" | undefined;
        page?: string | undefined;
        sortBy?: "name" | "status" | "createdAt" | undefined;
        sortOrder?: "desc" | "asc" | undefined;
    };
}>;
export declare const getChatbotByIdSchema: z.ZodObject<{
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
export declare const deleteChatbotSchema: z.ZodObject<{
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
export declare const duplicateChatbotSchema: z.ZodObject<{
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
export declare const activateChatbotSchema: z.ZodObject<{
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
export declare const testChatbotSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        message: z.ZodString;
        contactPhone: z.ZodOptional<z.ZodString>;
        sessionData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        contactPhone?: string | undefined;
        sessionData?: Record<string, any> | undefined;
    }, {
        message: string;
        contactPhone?: string | undefined;
        sessionData?: Record<string, any> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        message: string;
        contactPhone?: string | undefined;
        sessionData?: Record<string, any> | undefined;
    };
    params: {
        id: string;
    };
}, {
    body: {
        message: string;
        contactPhone?: string | undefined;
        sessionData?: Record<string, any> | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const saveFlowSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        flowData: z.ZodObject<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            nodes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">>, "many">;
            edges: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                source: z.ZodString;
                target: z.ZodString;
                sourceHandle: z.ZodOptional<z.ZodString>;
                targetHandle: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodObject<{
                    condition: z.ZodOptional<z.ZodString>;
                    buttonId: z.ZodOptional<z.ZodString>;
                    optionValue: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }, {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }, {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }>, "many">;
            viewport: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                zoom: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                y: number;
                x: number;
                zoom: number;
            }, {
                y: number;
                x: number;
                zoom: number;
            }>>;
        }, z.ZodTypeAny, "passthrough">>;
    }, "strip", z.ZodTypeAny, {
        flowData: {
            nodes: z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">[];
            edges: {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }[];
            viewport?: {
                y: number;
                x: number;
                zoom: number;
            } | undefined;
        } & {
            [k: string]: unknown;
        };
    }, {
        flowData: {
            nodes: z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">[];
            edges: {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }[];
            viewport?: {
                y: number;
                x: number;
                zoom: number;
            } | undefined;
        } & {
            [k: string]: unknown;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        flowData: {
            nodes: z.objectOutputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">[];
            edges: {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }[];
            viewport?: {
                y: number;
                x: number;
                zoom: number;
            } | undefined;
        } & {
            [k: string]: unknown;
        };
    };
    params: {
        id: string;
    };
}, {
    body: {
        flowData: {
            nodes: z.objectInputType<{
                id: z.ZodString;
                type: z.ZodEnum<["start", "message", "button", "list", "ai", "condition", "delay", "action", "end", "trigger", "question", "assign", "tag", "api"]>;
                position: z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    y: number;
                    x: number;
                }, {
                    y: number;
                    x: number;
                }>;
                data: z.ZodObject<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                    label: z.ZodString;
                    triggerType: z.ZodOptional<z.ZodEnum<["keyword", "first_message", "all_messages", "button_click"]>>;
                    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    messageType: z.ZodOptional<z.ZodEnum<["text", "image", "video", "document", "buttons", "list"]>>;
                    text: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
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
                    listSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
                    listButtonText: z.ZodOptional<z.ZodString>;
                    questionText: z.ZodOptional<z.ZodString>;
                    variableName: z.ZodOptional<z.ZodString>;
                    validationType: z.ZodOptional<z.ZodEnum<["text", "number", "email", "phone", "date", "options"]>>;
                    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    errorMessage: z.ZodOptional<z.ZodString>;
                    conditionType: z.ZodOptional<z.ZodEnum<["variable", "contact_field", "tag", "time"]>>;
                    conditionVariable: z.ZodOptional<z.ZodString>;
                    conditionOperator: z.ZodOptional<z.ZodEnum<["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than", "is_empty", "is_not_empty"]>>;
                    conditionValue: z.ZodOptional<z.ZodString>;
                    actionType: z.ZodOptional<z.ZodEnum<["subscribe", "unsubscribe", "add_tag", "remove_tag", "update_contact", "notify_agent"]>>;
                    actionValue: z.ZodOptional<z.ZodString>;
                    delayDuration: z.ZodOptional<z.ZodNumber>;
                    apiUrl: z.ZodOptional<z.ZodString>;
                    apiMethod: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "DELETE"]>>;
                    apiHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    apiBody: z.ZodOptional<z.ZodString>;
                    apiResponseVariable: z.ZodOptional<z.ZodString>;
                    assignTo: z.ZodOptional<z.ZodEnum<["user", "team", "round_robin"]>>;
                    assignUserId: z.ZodOptional<z.ZodString>;
                    tagAction: z.ZodOptional<z.ZodEnum<["add", "remove"]>>;
                    tagNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, z.ZodTypeAny, "passthrough">>;
            }, z.ZodTypeAny, "passthrough">[];
            edges: {
                target: string;
                id: string;
                source: string;
                data?: {
                    condition?: string | undefined;
                    buttonId?: string | undefined;
                    optionValue?: string | undefined;
                } | undefined;
                label?: string | undefined;
                sourceHandle?: string | undefined;
                targetHandle?: string | undefined;
            }[];
            viewport?: {
                y: number;
                x: number;
                zoom: number;
            } | undefined;
        } & {
            [k: string]: unknown;
        };
    };
    params: {
        id: string;
    };
}>;
export type CreateChatbotSchema = z.infer<typeof createChatbotSchema>;
export type UpdateChatbotSchema = z.infer<typeof updateChatbotSchema>;
export type GetChatbotsSchema = z.infer<typeof getChatbotsSchema>;
export type TestChatbotSchema = z.infer<typeof testChatbotSchema>;
export type SaveFlowSchema = z.infer<typeof saveFlowSchema>;
//# sourceMappingURL=chatbot.schema.d.ts.map