import { ChatbotStatus } from '@prisma/client';
export declare class ChatbotService {
    getAll(organizationId: string, options?: {
        page?: number;
        limit?: number;
        status?: ChatbotStatus;
        search?: string;
    }): Promise<{
        chatbots: {
            organizationId: string;
            id: string;
            status: import(".prisma/client").$Enums.ChatbotStatus;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            createdById: string;
            channel: import(".prisma/client").$Enums.Channel;
            telegramBotId: string | null;
            flowData: import("@prisma/client/runtime/library").JsonValue;
            triggerKeywords: string[];
            isDefault: boolean;
            welcomeMessage: string | null;
            fallbackMessage: string | null;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    getById(organizationId: string, chatbotId: string): Promise<{
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.ChatbotStatus;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        createdById: string;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        flowData: import("@prisma/client/runtime/library").JsonValue;
        triggerKeywords: string[];
        isDefault: boolean;
        welcomeMessage: string | null;
        fallbackMessage: string | null;
    }>;
    create(organizationId: string, userId: string, data: {
        name: string;
        description?: string;
        triggerKeywords?: string[];
        isDefault?: boolean;
        welcomeMessage?: string;
        fallbackMessage?: string;
        flowData?: any;
        channel?: 'WHATSAPP' | 'INSTAGRAM' | 'TELEGRAM';
        telegramBotId?: string | null;
    }): Promise<{
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.ChatbotStatus;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        createdById: string;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        flowData: import("@prisma/client/runtime/library").JsonValue;
        triggerKeywords: string[];
        isDefault: boolean;
        welcomeMessage: string | null;
        fallbackMessage: string | null;
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
        channel?: 'WHATSAPP' | 'INSTAGRAM' | 'TELEGRAM';
        telegramBotId?: string | null;
    }): Promise<{
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.ChatbotStatus;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        createdById: string;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        flowData: import("@prisma/client/runtime/library").JsonValue;
        triggerKeywords: string[];
        isDefault: boolean;
        welcomeMessage: string | null;
        fallbackMessage: string | null;
    }>;
    delete(organizationId: string, chatbotId: string): Promise<{
        message: string;
    }>;
    activate(organizationId: string, chatbotId: string): Promise<{
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.ChatbotStatus;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        createdById: string;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        flowData: import("@prisma/client/runtime/library").JsonValue;
        triggerKeywords: string[];
        isDefault: boolean;
        welcomeMessage: string | null;
        fallbackMessage: string | null;
    }>;
    deactivate(organizationId: string, chatbotId: string): Promise<{
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.ChatbotStatus;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        createdById: string;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        flowData: import("@prisma/client/runtime/library").JsonValue;
        triggerKeywords: string[];
        isDefault: boolean;
        welcomeMessage: string | null;
        fallbackMessage: string | null;
    }>;
    duplicate(organizationId: string, chatbotId: string, userId: string, newName?: string): Promise<{
        organizationId: string;
        id: string;
        status: import(".prisma/client").$Enums.ChatbotStatus;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        createdById: string;
        channel: import(".prisma/client").$Enums.Channel;
        telegramBotId: string | null;
        flowData: import("@prisma/client/runtime/library").JsonValue;
        triggerKeywords: string[];
        isDefault: boolean;
        welcomeMessage: string | null;
        fallbackMessage: string | null;
    }>;
    getStats(organizationId: string, chatbotId: string): Promise<{
        totalConversations: number;
        activeSessions: number;
        completedFlows: number;
    }>;
}
export declare const chatbotService: ChatbotService;
//# sourceMappingURL=chatbot.service.d.ts.map