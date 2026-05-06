"use strict";
// src/modules/users/users.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersController = exports.UsersController = void 0;
const users_service_1 = require("./users.service");
const response_1 = require("../../utils/response");
class UsersController {
    // ==========================================
    // GET PROFILE
    // ==========================================
    async getProfile(req, res, next) {
        try {
            const userId = req.user.id;
            const profile = await users_service_1.usersService.getProfile(userId);
            return (0, response_1.sendSuccess)(res, profile, 'Profile fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET PROFILE WITH ORGANIZATIONS
    // ==========================================
    async getProfileWithOrganizations(req, res, next) {
        try {
            const userId = req.user.id;
            const profile = await users_service_1.usersService.getUserWithOrganizations(userId);
            return (0, response_1.sendSuccess)(res, profile, 'Profile fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // UPDATE PROFILE
    // ==========================================
    async updateProfile(req, res, next) {
        try {
            const userId = req.user.id;
            const input = req.body;
            const profile = await users_service_1.usersService.updateProfile(userId, input);
            return (0, response_1.sendSuccess)(res, profile, 'Profile updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // UPDATE AVATAR
    // ==========================================
    async updateAvatar(req, res, next) {
        try {
            const userId = req.user.id;
            const { avatar } = req.body;
            const profile = await users_service_1.usersService.updateAvatar(userId, avatar);
            return (0, response_1.sendSuccess)(res, profile, 'Avatar updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET USER STATS
    // ==========================================
    async getStats(req, res, next) {
        try {
            const userId = req.user.id;
            const stats = await users_service_1.usersService.getUserStats(userId);
            return (0, response_1.sendSuccess)(res, stats, 'Stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET ACTIVE SESSIONS
    // ==========================================
    async getSessions(req, res, next) {
        try {
            const userId = req.user.id;
            const currentToken = req.cookies?.refreshToken;
            const sessions = await users_service_1.usersService.getActiveSessions(userId, currentToken);
            return (0, response_1.sendSuccess)(res, sessions, 'Sessions fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // REVOKE SESSION
    // ==========================================
    async revokeSession(req, res, next) {
        try {
            const userId = req.user.id;
            const sessionId = req.params.sessionId;
            const result = await users_service_1.usersService.revokeSession(userId, sessionId);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // REVOKE ALL SESSIONS
    // ==========================================
    async revokeAllSessions(req, res, next) {
        try {
            const userId = req.user.id;
            const currentToken = req.cookies?.refreshToken;
            const result = await users_service_1.usersService.revokeAllSessions(userId, currentToken);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DELETE ACCOUNT
    // ==========================================
    async deleteAccount(req, res, next) {
        try {
            const userId = req.user.id;
            const { password, reason } = req.body;
            const result = await users_service_1.usersService.deleteAccount(userId, password, reason);
            // Clear cookies
            res.clearCookie('refreshToken');
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.UsersController = UsersController;
// Export singleton instance
exports.usersController = new UsersController();
//# sourceMappingURL=users.controller.js.map