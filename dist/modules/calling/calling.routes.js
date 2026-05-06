"use strict";
// src/modules/calling/calling.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const calling_controller_1 = require("./calling.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// All routes protected
router.use(auth_1.authenticate);
// Calling Settings
router.get('/settings', calling_controller_1.callingController.getSettings.bind(calling_controller_1.callingController));
router.put('/settings', calling_controller_1.callingController.updateSettings.bind(calling_controller_1.callingController));
// Initiate Call
router.post('/initiate', calling_controller_1.callingController.initiateCall.bind(calling_controller_1.callingController));
// Call Logs
router.get('/logs', calling_controller_1.callingController.getCallLogs.bind(calling_controller_1.callingController));
exports.default = router;
//# sourceMappingURL=calling.routes.js.map