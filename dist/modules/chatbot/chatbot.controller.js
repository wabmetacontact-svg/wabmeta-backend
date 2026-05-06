"use strict";
// ✅ ADD/UPDATE: src/modules/chatbot/chatbot.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatbotController = exports.ChatbotController = void 0;
const chatbot_service_1 = require("./chatbot.service");
const response_1 = require("../../utils/response");
class ChatbotController {
    async getAll(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const result = await chatbot_service_1.chatbotService.getAll(orgId, {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 50,
                search: req.query.search,
            });
            return res.json({
                success: true,
                message: 'Chatbots fetched',
                data: result.chatbots,
                meta: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit
                }
            });
        }
        catch (e) {
            next(e);
        }
    }
    async getById(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const chatbot = await chatbot_service_1.chatbotService.getById(orgId, req.params.id);
            return (0, response_1.sendSuccess)(res, chatbot, 'Chatbot fetched');
        }
        catch (e) {
            next(e);
        }
    }
    async create(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const chatbot = await chatbot_service_1.chatbotService.create(orgId, req.user.id, req.body);
            return (0, response_1.sendSuccess)(res, chatbot, 'Chatbot created', 201);
        }
        catch (e) {
            next(e);
        }
    }
    async update(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const chatbot = await chatbot_service_1.chatbotService.update(orgId, req.params.id, req.body);
            return (0, response_1.sendSuccess)(res, chatbot, 'Chatbot updated');
        }
        catch (e) {
            next(e);
        }
    }
    async delete(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const result = await chatbot_service_1.chatbotService.delete(orgId, req.params.id);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (e) {
            next(e);
        }
    }
    async activate(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const chatbot = await chatbot_service_1.chatbotService.activate(orgId, req.params.id);
            return (0, response_1.sendSuccess)(res, chatbot, 'Chatbot activated');
        }
        catch (e) {
            next(e);
        }
    }
    async deactivate(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const chatbot = await chatbot_service_1.chatbotService.deactivate(orgId, req.params.id);
            return (0, response_1.sendSuccess)(res, chatbot, 'Chatbot paused');
        }
        catch (e) {
            next(e);
        }
    }
    async duplicate(req, res, next) {
        try {
            const orgId = req.user.organizationId;
            const { name } = req.body;
            const chatbot = await chatbot_service_1.chatbotService.duplicate(orgId, req.params.id, req.user.id, name);
            return (0, response_1.sendSuccess)(res, chatbot, 'Chatbot duplicated', 201);
        }
        catch (e) {
            next(e);
        }
    }
}
exports.ChatbotController = ChatbotController;
exports.chatbotController = new ChatbotController();
//# sourceMappingURL=chatbot.controller.js.map