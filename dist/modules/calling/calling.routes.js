"use strict";
// src/modules/calling/calling.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const calling_controller_1 = require("./calling.controller");
const auth_1 = require("../../middleware/auth");
const requireRole_1 = require("../../middleware/requireRole");
const router = (0, express_1.Router)();
// All routes protected
router.use(auth_1.authenticate);
// Writes are role-gated; reads stay open to every member including VIEWER.
router.use((0, requireRole_1.gateMutations)(...requireRole_1.ADMIN_ROLES));
// Calling Settings
router.get('/settings', calling_controller_1.callingController.getSettings.bind(calling_controller_1.callingController));
router.put('/settings', calling_controller_1.callingController.updateSettings.bind(calling_controller_1.callingController));
// Initiate Call
router.post('/initiate', calling_controller_1.callingController.initiateCall.bind(calling_controller_1.callingController));
// Call Logs
router.get('/logs', calling_controller_1.callingController.getCallLogs.bind(calling_controller_1.callingController));
exports.default = router;
//# sourceMappingURL=calling.routes.js.map