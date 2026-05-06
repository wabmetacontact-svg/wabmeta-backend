"use strict";
// ✅ CREATE/UPDATE: src/modules/chatbot/chatbot.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatbot_controller_1 = require("./chatbot.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', chatbot_controller_1.chatbotController.getAll.bind(chatbot_controller_1.chatbotController));
router.post('/', chatbot_controller_1.chatbotController.create.bind(chatbot_controller_1.chatbotController));
router.get('/:id', chatbot_controller_1.chatbotController.getById.bind(chatbot_controller_1.chatbotController));
router.put('/:id', chatbot_controller_1.chatbotController.update.bind(chatbot_controller_1.chatbotController));
router.delete('/:id', chatbot_controller_1.chatbotController.delete.bind(chatbot_controller_1.chatbotController));
router.post('/:id/activate', chatbot_controller_1.chatbotController.activate.bind(chatbot_controller_1.chatbotController));
router.post('/:id/deactivate', chatbot_controller_1.chatbotController.deactivate.bind(chatbot_controller_1.chatbotController));
router.post('/:id/duplicate', chatbot_controller_1.chatbotController.duplicate.bind(chatbot_controller_1.chatbotController));
exports.default = router;
//# sourceMappingURL=chatbot.routes.js.map