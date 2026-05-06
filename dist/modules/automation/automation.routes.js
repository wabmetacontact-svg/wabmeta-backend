"use strict";
// ✅ CREATE: src/modules/automation/automation.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const automation_controller_1 = require("./automation.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * @route   GET /api/v1/automations/stats
 * @desc    Get automation statistics
 */
router.get('/stats', automation_controller_1.automationController.getStats.bind(automation_controller_1.automationController));
/**
 * @route   GET /api/v1/automations
 * @desc    Get all automations
 */
router.get('/', automation_controller_1.automationController.getAll.bind(automation_controller_1.automationController));
/**
 * @route   POST /api/v1/automations
 * @desc    Create new automation
 */
router.post('/', automation_controller_1.automationController.create.bind(automation_controller_1.automationController));
/**
 * @route   GET /api/v1/automations/:id
 * @desc    Get automation by ID
 */
router.get('/:id', automation_controller_1.automationController.getById.bind(automation_controller_1.automationController));
/**
 * @route   PUT /api/v1/automations/:id
 * @desc    Update automation
 */
router.put('/:id', automation_controller_1.automationController.update.bind(automation_controller_1.automationController));
/**
 * @route   DELETE /api/v1/automations/:id
 * @desc    Delete automation
 */
router.delete('/:id', automation_controller_1.automationController.delete.bind(automation_controller_1.automationController));
/**
 * @route   POST /api/v1/automations/:id/toggle
 * @desc    Toggle automation active status
 */
router.post('/:id/toggle', automation_controller_1.automationController.toggle.bind(automation_controller_1.automationController));
exports.default = router;
//# sourceMappingURL=automation.routes.js.map