"use strict";
// 📁 src/modules/meta/meta.controller.ts - COMPLETE FINAL VERSION
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaController = exports.MetaController = void 0;
const errorHandler_1 = require("../../middleware/errorHandler");
const response_1 = require("../../utils/response");
const database_1 = __importDefault(require("../../config/database"));
const config_1 = require("../../config");
const meta_service_1 = require("./meta.service");
const resolveOrgId_1 = require("../../utils/resolveOrgId");
// Was header-only, ignoring the verified JWT entirely.
const getOrgId = (req) => (0, resolveOrgId_1.resolveOrganizationId)(req);
class MetaController {
    // ============================================
    // GET ACCOUNTS (WHATSAPPACCOUNT ONLY - SANITIZED)
    // ============================================
    async getAccounts(req, res, next) {
        try {
            const organizationId = await getOrgId(req);
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const orgIdString = Array.isArray(organizationId) ? organizationId[0] : organizationId;
            console.log('📋 Fetching sanitized accounts for org:', orgIdString);
            const accounts = await meta_service_1.metaService.getAccounts(orgIdString);
            console.log('   Found accounts:', accounts.length);
            return (0, response_1.sendSuccess)(res, accounts, 'Accounts fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // GET SINGLE ACCOUNT (SANITIZED)
    // ============================================
    async getAccount(req, res, next) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const organizationId = await getOrgId(req);
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const account = await meta_service_1.metaService.getAccount(id, organizationId);
            if (!account) {
                throw new errorHandler_1.AppError('Account not found', 404);
            }
            return (0, response_1.sendSuccess)(res, account, 'Account fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // DISCONNECT ACCOUNT
    // ============================================
    async disconnectAccount(req, res, next) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const organizationId = await getOrgId(req);
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandler_1.AppError('Authentication required', 401);
            }
            const membership = await database_1.default.organizationMember.findFirst({
                where: {
                    organizationId,
                    userId,
                    role: { in: ['OWNER', 'ADMIN'] },
                },
            });
            if (!membership) {
                throw new errorHandler_1.AppError('You do not have permission to disconnect', 403);
            }
            const result = await meta_service_1.metaService.disconnectAccount(id, organizationId);
            return (0, response_1.sendSuccess)(res, result, 'Account disconnected successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // GET EMBEDDED SIGNUP CONFIG
    // ============================================
    async getEmbeddedSignupConfig(req, res, next) {
        try {
            // Local naam "config" rakhne se imported app config shadow ho jati thi
            const signupConfig = {
                appId: config_1.config.meta.appId,
                configId: config_1.config.meta.configId,
                version: 'v25.0',
                features: ['whatsapp_business_app_onboarding'],
                // Mobile app ye values use karti hai OAuth dialog banane ke liye.
                // Server se aate hain taaki client aur server kabhi alag na ho jayen.
                mobileSignupUrl: config_1.config.meta.mobileSignupUrl,
                mobileAppScheme: config_1.config.meta.mobileAppScheme,
                graphApiVersion: config_1.config.meta.graphApiVersion,
            };
            return (0, response_1.sendSuccess)(res, signupConfig, 'Config fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // GET INTEGRATION STATUS
    // ============================================
    async getIntegrationStatus(req, res, next) {
        try {
            const status = {
                configured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
                appId: process.env.META_APP_ID,
                version: 'v25.0',
                embeddedSignup: true,
            };
            return (0, response_1.sendSuccess)(res, status, 'Integration status fetched');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.MetaController = MetaController;
exports.metaController = new MetaController();
exports.default = exports.metaController;
//# sourceMappingURL=meta.controller.js.map