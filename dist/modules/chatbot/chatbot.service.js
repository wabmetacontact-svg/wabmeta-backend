"use strict";
// ✅ REPLACE: src/modules/chatbot/chatbot.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatbotService = exports.ChatbotService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
class ChatbotService {
    async getAll(organizationId, options = {}) {
        const { page = 1, limit = 20, status, search } = options;
        const skip = (page - 1) * limit;
        const where = { organizationId };
        if (status)
            where.status = status;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [chatbots, total] = await Promise.all([
            database_1.default.chatbot.findMany({
                where,
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
                skip,
                take: limit,
            }),
            database_1.default.chatbot.count({ where }),
        ]);
        return { chatbots, total, page, limit };
    }
    async getById(organizationId, chatbotId) {
        const chatbot = await database_1.default.chatbot.findFirst({
            where: { id: chatbotId, organizationId },
        });
        if (!chatbot)
            throw new errorHandler_1.AppError('Chatbot not found', 404);
        return chatbot;
    }
    async create(organizationId, userId, data) {
        // If setting as default, unset others
        if (data.isDefault) {
            await database_1.default.chatbot.updateMany({
                where: { organizationId, isDefault: true },
                data: { isDefault: false },
            });
        }
        return database_1.default.chatbot.create({
            data: {
                organizationId,
                createdById: userId,
                name: data.name,
                description: data.description,
                triggerKeywords: data.triggerKeywords || [],
                isDefault: data.isDefault || false,
                welcomeMessage: data.welcomeMessage,
                fallbackMessage: data.fallbackMessage,
                flowData: data.flowData || { nodes: [], edges: [] },
                status: 'DRAFT',
            },
        });
    }
    async update(organizationId, chatbotId, data) {
        const chatbot = await database_1.default.chatbot.findFirst({
            where: { id: chatbotId, organizationId },
        });
        if (!chatbot)
            throw new errorHandler_1.AppError('Chatbot not found', 404);
        // If setting as default, unset others
        if (data.isDefault) {
            await database_1.default.chatbot.updateMany({
                where: { organizationId, isDefault: true, id: { not: chatbotId } },
                data: { isDefault: false },
            });
        }
        return database_1.default.chatbot.update({
            where: { id: chatbotId },
            data,
        });
    }
    async delete(organizationId, chatbotId) {
        const chatbot = await database_1.default.chatbot.findFirst({
            where: { id: chatbotId, organizationId },
        });
        if (!chatbot)
            throw new errorHandler_1.AppError('Chatbot not found', 404);
        await database_1.default.chatbot.delete({ where: { id: chatbotId } });
        return { message: 'Chatbot deleted successfully' };
    }
    async activate(organizationId, chatbotId) {
        const chatbot = await database_1.default.chatbot.findFirst({
            where: { id: chatbotId, organizationId },
        });
        if (!chatbot)
            throw new errorHandler_1.AppError('Chatbot not found', 404);
        // ✅ Validate flow before activating
        const flowData = chatbot.flowData;
        const nodes = flowData?.nodes || [];
        const hasStart = nodes.some((n) => n.type === 'start');
        const hasOtherNode = nodes.filter((n) => n.type !== 'start').length > 0;
        if (!hasStart || !hasOtherNode) {
            throw new errorHandler_1.AppError('Chatbot flow mein Start node aur kam se kam ek aur node hona zaroori hai', 400);
        }
        return database_1.default.chatbot.update({
            where: { id: chatbotId },
            data: { status: 'ACTIVE' },
        });
    }
    async deactivate(organizationId, chatbotId) {
        const chatbot = await database_1.default.chatbot.findFirst({
            where: { id: chatbotId, organizationId },
        });
        if (!chatbot)
            throw new errorHandler_1.AppError('Chatbot not found', 404);
        return database_1.default.chatbot.update({
            where: { id: chatbotId },
            data: { status: 'PAUSED' },
        });
    }
    async duplicate(organizationId, chatbotId, userId, newName) {
        const chatbot = await database_1.default.chatbot.findFirst({
            where: { id: chatbotId, organizationId },
        });
        if (!chatbot)
            throw new errorHandler_1.AppError('Chatbot not found', 404);
        return database_1.default.chatbot.create({
            data: {
                organizationId,
                createdById: userId,
                name: newName || `${chatbot.name} (Copy)`,
                description: chatbot.description,
                triggerKeywords: chatbot.triggerKeywords,
                isDefault: false,
                welcomeMessage: chatbot.welcomeMessage,
                fallbackMessage: chatbot.fallbackMessage,
                flowData: chatbot.flowData || { nodes: [], edges: [] },
                status: 'DRAFT',
            },
        });
    }
    async getStats(organizationId, chatbotId) {
        // Basic stats for now
        return {
            totalConversations: 0,
            activeSessions: 0,
            completedFlows: 0,
        };
    }
}
exports.ChatbotService = ChatbotService;
exports.chatbotService = new ChatbotService();
//# sourceMappingURL=chatbot.service.js.map