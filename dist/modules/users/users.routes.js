"use strict";
// src/modules/users/users.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_controller_1 = require("./users.controller");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const users_schema_1 = require("./users.schema");
const rateLimit_1 = require("../../middleware/rateLimit");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', users_controller_1.usersController.getProfile.bind(users_controller_1.usersController));
/**
 * @route   GET /api/v1/users/profile/full
 * @desc    Get profile with organizations
 * @access  Private
 */
router.get('/profile/full', users_controller_1.usersController.getProfileWithOrganizations.bind(users_controller_1.usersController));
/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', (0, validate_1.validate)(users_schema_1.updateProfileSchema), users_controller_1.usersController.updateProfile.bind(users_controller_1.usersController));
/**
 * @route   PUT /api/v1/users/avatar
 * @desc    Update user avatar
 * @access  Private
 */
router.put('/avatar', (0, validate_1.validate)(users_schema_1.updateAvatarSchema), users_controller_1.usersController.updateAvatar.bind(users_controller_1.usersController));
/**
 * @route   GET /api/v1/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', users_controller_1.usersController.getStats.bind(users_controller_1.usersController));
/**
 * @route   GET /api/v1/users/sessions
 * @desc    Get active sessions
 * @access  Private
 */
router.get('/sessions', users_controller_1.usersController.getSessions.bind(users_controller_1.usersController));
/**
 * @route   DELETE /api/v1/users/sessions/:sessionId
 * @desc    Revoke specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId', users_controller_1.usersController.revokeSession.bind(users_controller_1.usersController));
/**
 * @route   DELETE /api/v1/users/sessions
 * @desc    Revoke all sessions except current
 * @access  Private
 */
router.delete('/sessions', users_controller_1.usersController.revokeAllSessions.bind(users_controller_1.usersController));
/**
 * @route   POST /api/v1/users/add-phone
 * @desc    Add phone number (for Google login users)
 * @access  Private
 */
router.post('/add-phone', (0, rateLimit_1.rateLimit)({ windowMs: 60 * 1000, max: 3 }), users_controller_1.usersController.addPhoneNumber.bind(users_controller_1.usersController));
/**
 * @route   DELETE /api/v1/users/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete('/account', (0, validate_1.validate)(users_schema_1.deleteAccountSchema), users_controller_1.usersController.deleteAccount.bind(users_controller_1.usersController));
exports.default = router;
//# sourceMappingURL=users.routes.js.map