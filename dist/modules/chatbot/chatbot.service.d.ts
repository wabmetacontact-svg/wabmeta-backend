import { ChatbotStatus } from '@prisma/client';
export declare class ChatbotService {
    getAll(organizationId: string, options?: {
        page?: number;
        limit?: number;
        status?: ChatbotStatus;
        search?: string;
    }): Promise<{
        chatbots: {
            name: string;
            organizationId: string;
            id: string;
            status: import(".prisma/client").$Enums.ChatbotStatus;
            isDefault: boolean;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            flowData: import("@prisma/client/runtime/library").JsonValue;
            triggerKeywords: string[];
            welcomeMessage: string | null;
            fallbackMessage: string | null;
            createdById: string;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    getById(organizationId: string, chatbotId: string): Promise<{
        name: string;
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.ChatbotStatus;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        flowData: import("@prisma/client/runtime/library").JsonValue;
        triggerKeywords: string[];
        welcomeMessage: string | null;
        fallbackMessage: string | null;
        createdById: string;
    }>;
    create(organizationId: string, userId: string, data: {
        name: string;
        description?: string;
        triggerKeywords?: string[];
        isDefault?: boolean;
        welcomeMessage?: string;
        fallbackMessage?: string;
        flowData?: any;
    }): Promise<{
        name: string;
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.ChatbotStatus;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        flowData: import("@prisma/client/runtime/library").JsonValue;
        triggerKeywords: string[];
        welcomeMessage: string | null;
        fallbackMessage: string | null;
        createdById: string;
    }>;
    update(organizationId: string, chatbotId: string, data: {
        name?: string;
        description?: string;
        triggerKeywords?: string[];
        isDefault?: boolean;
        welcomeMessage?: string;
        fallbackMessage?: string;
        flowData?: any;
        status?: ChatbotStatus;
    }): Promise<{
        name: string;
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.ChatbotStatus;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        flowData: import("@prisma/client/runtime/library").JsonValue;
        triggerKeywords: string[];
        welcomeMessage: string | null;
        fallbackMessage: string | null;
        createdById: string;
    }>;
    delete(organizationId: string, chatbotId: string): Promise<{
        message: string;
    }>;
    activate(organizationId: string, chatbotId: string): Promise<{
        name: string;
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.ChatbotStatus;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        flowData: import("@prisma/client/runtime/library").JsonValue;
        triggerKeywords: string[];
        welcomeMessage: string | null;
        fallbackMessage: string | null;
        createdById: string;
    }>;
    deactivate(organizationId: string, chatbotId: string): Promise<{
        name: string;
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.ChatbotStatus;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        flowData: import("@prisma/client/runtime/library").JsonValue;
        triggerKeywords: string[];
        welcomeMessage: string | null;
        fallbackMessage: string | null;
        createdById: string;
    }>;
    duplicate(organizationId: string, chatbotId: string, userId: string, newName?: string): Promise<{
        name: string;
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.ChatbotStatus;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        flowData: import("@prisma/client/runtime/library").JsonValue;
        triggerKeywords: string[];
        welcomeMessage: string | null;
        fallbackMessage: string | null;
        createdById: string;
    }>;
    getStats(organizationId: string, chatbotId: string): Promise<{
        totalConversations: number;
        activeSessions: number;
        completedFlows: number;
    }>;
}
export declare const chatbotService: ChatbotService;
//# sourceMappingURL=chatbot.service.d.ts.map