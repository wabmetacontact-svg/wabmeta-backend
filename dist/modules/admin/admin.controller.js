"use strict";
// src/modules/admin/admin.controller.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = exports.AdminController = void 0;
const admin_service_1 = require("./admin.service");
const admin_billing_service_1 = require("./admin.billing.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
// ============================================
// RESPONSE HELPERS
// ============================================
const sendSuccess = (res, data, message, statusCode = 200, meta) => {
    const response = {
        success: true,
        message,
        data,
    };
    if (meta) {
        response.meta = meta;
    }
    return res.status(statusCode).json(response);
};
const sendError = (res, message, statusCode = 400) => {
    return res.status(statusCode).json({
        success: false,
        message,
    });
};
// ============================================
// HELPER FUNCTIONS
// ============================================
const parseQueryString = (value) => {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};
const parseQueryNumber = (value, defaultValue) => {
    const parsed = Number(value);
    return !isNaN(parsed) && parsed > 0 ? parsed : defaultValue;
};
const getParamId = (id) => {
    if (Array.isArray(id)) {
        return id[0];
    }
    return id || '';
};
// ============================================
// ADMIN CONTROLLER CLASS
// ============================================
class AdminController {
    // ==========================================
    // ADMIN AUTH
    // ==========================================
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                throw new errorHandler_1.AppError('Email and password are required', 400);
            }
            const result = await admin_service_1.adminService.login({ email, password });
            // Store admin user info for frontend
            return res.json({
                success: true,
                message: 'Login successful',
                data: {
                    token: result.token,
                    admin: result.admin,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getProfile(req, res, next) {
        try {
            if (!req.admin?.id) {
                throw new errorHandler_1.AppError('Admin not authenticated', 401);
            }
            const admin = await admin_service_1.adminService.getAdminById(req.admin.id);
            if (!admin) {
                throw new errorHandler_1.AppError('Admin not found', 404);
            }
            return sendSuccess(res, admin, 'Profile fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DASHBOARD
    // ==========================================
    async getDashboardStats(req, res, next) {
        try {
            const stats = await admin_service_1.adminService.getDashboardStats();
            return sendSuccess(res, stats, 'Dashboard stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // USER MANAGEMENT
    // ==========================================
    async getUsers(req, res, next) {
        try {
            const page = parseQueryNumber(req.query.page, 1);
            const limit = parseQueryNumber(req.query.limit, 20);
            const search = parseQueryString(req.query.search);
            const status = parseQueryString(req.query.status);
            const sortBy = parseQueryString(req.query.sortBy) || 'createdAt';
            const sortOrder = parseQueryString(req.query.sortOrder) || 'desc';
            const result = await admin_service_1.adminService.getUsers({
                page,
                limit,
                search,
                status,
                sortBy,
                sortOrder,
            });
            return sendSuccess(res, result.users, 'Users fetched successfully', 200, {
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getUserById(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            const user = await admin_service_1.adminService.getUserById(id);
            if (!user) {
                throw new errorHandler_1.AppError('User not found', 404);
            }
            return sendSuccess(res, user, 'User fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateUser(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            const user = await admin_service_1.adminService.updateUser(id, req.body);
            return sendSuccess(res, user, 'User updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateUserStatus(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            const { status } = req.body;
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            if (!status) {
                throw new errorHandler_1.AppError('Status is required', 400);
            }
            const validStatuses = ['ACTIVE', 'SUSPENDED', 'INACTIVE', 'PENDING_VERIFICATION'];
            if (!validStatuses.includes(status.toUpperCase())) {
                throw new errorHandler_1.AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
            }
            const user = await admin_service_1.adminService.updateUserStatus(id, status.toUpperCase());
            return sendSuccess(res, user, `User status updated to ${status}`);
        }
        catch (error) {
            next(error);
        }
    }
    async suspendUser(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            const user = await admin_service_1.adminService.suspendUser(id);
            return sendSuccess(res, user, 'User suspended successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async activateUser(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            const user = await admin_service_1.adminService.activateUser(id);
            return sendSuccess(res, user, 'User activated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateUserPassword(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            const { password } = req.body;
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            if (!password) {
                throw new errorHandler_1.AppError('Password is required', 400);
            }
            const user = await admin_service_1.adminService.updateUserPassword(id, { password });
            return sendSuccess(res, user, 'User password updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deleteUser(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('User ID is required', 400);
            }
            // ✅ Get query params for delete options
            const force = req.query.force === 'true';
            const transferOwnership = req.query.transferOwnership === 'true';
            const result = await admin_service_1.adminService.deleteUser(id, {
                force,
                transferOwnership,
            });
            return sendSuccess(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // TRANSFER OWNERSHIP
    // ============================================
    async transferOwnership(req, res, next) {
        try {
            const { organizationId, newOwnerId } = req.body;
            if (!organizationId || !newOwnerId) {
                throw new errorHandler_1.AppError('organizationId and newOwnerId are required', 400);
            }
            const result = await admin_service_1.adminService.transferOrganizationOwnership(organizationId, newOwnerId);
            return sendSuccess(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ORGANIZATION MANAGEMENT
    // ==========================================
    async getOrganizations(req, res, next) {
        try {
            const page = parseQueryNumber(req.query.page, 1);
            const limit = parseQueryNumber(req.query.limit, 20);
            const search = parseQueryString(req.query.search);
            const planType = parseQueryString(req.query.planType);
            const sortBy = parseQueryString(req.query.sortBy) || 'createdAt';
            const sortOrder = parseQueryString(req.query.sortOrder) || 'desc';
            const result = await admin_service_1.adminService.getOrganizations({
                page,
                limit,
                search,
                planType,
                sortBy,
                sortOrder,
            });
            return sendSuccess(res, result.organizations, 'Organizations fetched successfully', 200, {
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit),
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getOrganizationById(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const org = await admin_service_1.adminService.getOrganizationById(id);
            if (!org) {
                throw new errorHandler_1.AppError('Organization not found', 404);
            }
            return sendSuccess(res, org, 'Organization fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateOrganization(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const org = await admin_service_1.adminService.updateOrganization(id, req.body);
            return sendSuccess(res, org, 'Organization updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deleteOrganization(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const result = await admin_service_1.adminService.deleteOrganization(id);
            return sendSuccess(res, null, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async updateSubscription(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Organization ID is required', 400);
            }
            const result = await admin_service_1.adminService.updateSubscription(id, req.body);
            return sendSuccess(res, result, 'Subscription updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // FEATURE MANAGEMENT
    // ============================================
    async getOrganizationFeatures(req, res, next) {
        try {
            const organizationId = getParamId(req.params.organizationId);
            const org = await database_1.default.organization.findUnique({
                where: { id: organizationId },
                select: {
                    id: true,
                    name: true,
                    planType: true,
                    featureSimpleBulkUpload: true,
                    featureCsvUpload: true,
                    featureOverrideByAdmin: true
                }
            });
            if (!org) {
                throw new errorHandler_1.AppError('Organization not found', 404);
            }
            return sendSuccess(res, {
                organizationId: org.id,
                organizationName: org.name,
                currentPlan: org.planType,
                features: {
                    simpleBulkPaste: org.featureSimpleBulkUpload ?? false,
                    csvUpload: org.featureCsvUpload ?? false,
                    adminOverride: org.featureOverrideByAdmin ?? false
                }
            }, 'Features fetched');
        }
        catch (error) {
            next(error);
        }
    }
    async updateOrganizationFeatures(req, res, next) {
        try {
            const organizationId = getParamId(req.params.organizationId);
            const { simpleBulkPaste, csvUpload, enableOverride } = req.body;
            const org = await database_1.default.organization.findUnique({
                where: { id: organizationId }
            });
            if (!org) {
                throw new errorHandler_1.AppError('Organization not found', 404);
            }
            const updated = await database_1.default.organization.update({
                where: { id: organizationId },
                data: {
                    featureSimpleBulkUpload: simpleBulkPaste,
                    featureCsvUpload: csvUpload,
                    featureOverrideByAdmin: enableOverride ?? true
                }
            });
            return sendSuccess(res, {
                organizationId,
                features: {
                    simpleBulkPaste: updated.featureSimpleBulkUpload,
                    csvUpload: updated.featureCsvUpload,
                    adminOverride: updated.featureOverrideByAdmin
                }
            }, 'Features updated');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // PLAN MANAGEMENT
    // ==========================================
    async getPlans(req, res, next) {
        try {
            const plans = await admin_service_1.adminService.getPlans();
            return sendSuccess(res, plans, 'Plans fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async createPlan(req, res, next) {
        try {
            const plan = await admin_service_1.adminService.createPlan(req.body);
            return sendSuccess(res, plan, 'Plan created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    async updatePlan(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Plan ID is required', 400);
            }
            const plan = await admin_service_1.adminService.updatePlan(id, req.body);
            return sendSuccess(res, plan, 'Plan updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deletePlan(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Plan ID is required', 400);
            }
            const result = await admin_service_1.adminService.deletePlan(id);
            return sendSuccess(res, null, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ADMIN MANAGEMENT
    // ==========================================
    async getAdmins(req, res, next) {
        try {
            const admins = await admin_service_1.adminService.getAdmins();
            return sendSuccess(res, admins, 'Admins fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async createAdmin(req, res, next) {
        try {
            const admin = await admin_service_1.adminService.createAdmin(req.body);
            return sendSuccess(res, admin, 'Admin created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    async updateAdmin(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Admin ID is required', 400);
            }
            const admin = await admin_service_1.adminService.updateAdmin(id, req.body);
            return sendSuccess(res, admin, 'Admin updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async deleteAdmin(req, res, next) {
        try {
            const id = getParamId(req.params.id);
            if (!id) {
                throw new errorHandler_1.AppError('Admin ID is required', 400);
            }
            // Prevent self-deletion
            if (req.admin?.id === id) {
                throw new errorHandler_1.AppError('Cannot delete your own admin account', 400);
            }
            const result = await admin_service_1.adminService.deleteAdmin(id);
            return sendSuccess(res, null, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ACTIVITY LOGS
    // ==========================================
    async getActivityLogs(req, res, next) {
        try {
            const page = parseQueryNumber(req.query.page, 1);
            const limit = parseQueryNumber(req.query.limit, 50);
            const action = parseQueryString(req.query.action);
            const userId = parseQueryString(req.query.userId);
            const organizationId = parseQueryString(req.query.organizationId);
            const startDate = parseQueryString(req.query.startDate);
            const endDate = parseQueryString(req.query.endDate);
            const result = await admin_service_1.adminService.getActivityLogs({
                page,
                limit,
                action,
                userId,
                organizationId,
                startDate,
                endDate,
            });
            return sendSuccess(res, result.logs, 'Activity logs fetched successfully', 200, {
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit),
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // SYSTEM SETTINGS
    // ==========================================
    async getSystemSettings(req, res, next) {
        try {
            const settings = admin_service_1.adminService.getSystemSettings();
            return sendSuccess(res, settings, 'Settings fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateSystemSettings(req, res, next) {
        try {
            const settings = admin_service_1.adminService.updateSystemSettings(req.body);
            return sendSuccess(res, settings, 'Settings updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // ASSIGN PLAN TO ORGANIZATION
    // ============================================
    async assignPlan(req, res) {
        try {
            const { organizationId, planSlug, validityDays, customEndDate, reason } = req.body;
            const adminId = req.admin?.id;
            const adminName = `${req.admin?.name || ''}`.trim() || 'Admin';
            if (!organizationId || !planSlug) {
                return sendError(res, 'Organization ID and plan slug are required', 400);
            }
            const result = await admin_billing_service_1.adminBillingService.assignPlanToOrganization({
                organizationId,
                planSlug,
                validityDays: validityDays ? parseInt(validityDays) : undefined,
                customEndDate: customEndDate ? new Date(customEndDate) : undefined,
                adminId: adminId || 'system',
                adminName,
                reason,
            });
            return sendSuccess(res, result, result.message);
        }
        catch (error) {
            console.error('Assign plan error:', error);
            return sendError(res, error.message || 'Failed to assign plan', 500);
        }
    }
    // ============================================
    // EXTEND SUBSCRIPTION
    // ============================================
    async extendSubscription(req, res) {
        try {
            const organizationId = getParamId(req.params.organizationId);
            const { additionalDays, reason } = req.body;
            const adminId = req.admin?.id;
            const adminName = `${req.admin?.name || ''}`.trim() || 'Admin';
            if (!additionalDays || additionalDays <= 0) {
                return sendError(res, 'Additional days must be a positive number', 400);
            }
            const result = await admin_billing_service_1.adminBillingService.extendSubscription({
                organizationId,
                additionalDays: parseInt(additionalDays),
                adminId: adminId || 'system',
                adminName,
                reason,
            });
            return sendSuccess(res, result, result.message);
        }
        catch (error) {
            console.error('Extend subscription error:', error);
            return sendError(res, error.message || 'Failed to extend subscription', 500);
        }
    }
    // ============================================
    // REVOKE SUBSCRIPTION
    // ============================================
    async revokeSubscription(req, res) {
        try {
            const organizationId = getParamId(req.params.organizationId);
            const { reason, immediate } = req.body;
            const adminId = req.admin?.id;
            const adminName = `${req.admin?.name || ''}`.trim() || 'Admin';
            const result = await admin_billing_service_1.adminBillingService.revokeSubscription({
                organizationId,
                adminId: adminId || 'system',
                adminName,
                reason,
                immediate: immediate === true,
            });
            return sendSuccess(res, result, result.message);
        }
        catch (error) {
            console.error('Revoke subscription error:', error);
            return sendError(res, error.message || 'Failed to revoke subscription', 500);
        }
    }
    // ============================================
    // GET ALL SUBSCRIPTIONS
    // ============================================
    async getSubscriptions(req, res) {
        try {
            const { page, limit, status, planType, excludePlanType, search } = req.query;
            const result = await admin_billing_service_1.adminBillingService.getAllSubscriptions({
                page: page ? parseInt(page) : undefined,
                limit: limit ? parseInt(limit) : undefined,
                status: status,
                planType: planType,
                excludePlanType: excludePlanType,
                search: search,
            });
            return sendSuccess(res, result, 'Subscriptions retrieved successfully');
        }
        catch (error) {
            console.error('Get subscriptions error:', error);
            return sendError(res, error.message || 'Failed to get subscriptions', 500);
        }
    }
    // ============================================
    // GET SUBSCRIPTION STATS
    // ============================================
    async getSubscriptionStats(req, res) {
        try {
            const stats = await admin_billing_service_1.adminBillingService.getSubscriptionStats();
            return sendSuccess(res, stats, 'Stats retrieved successfully');
        }
        catch (error) {
            console.error('Get subscription stats error:', error);
            return sendError(res, error.message || 'Failed to get stats', 500);
        }
    }
    // ============================================
    // WHATSAPP CONNECTION MANAGEMENT
    // ============================================
    async getWhatsAppStats(req, res, next) {
        try {
            const stats = await admin_service_1.adminService.getWhatsAppConnectionStats();
            return sendSuccess(res, stats, 'WhatsApp stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async updateConnectionType(req, res, next) {
        try {
            const accountId = getParamId(req.params.accountId);
            const { connectionType } = req.body;
            if (!connectionType) {
                throw new errorHandler_1.AppError('Connection type is required', 400);
            }
            const result = await admin_service_1.adminService.updateWhatsAppConnectionType(accountId, connectionType);
            return sendSuccess(res, result, 'Connection type updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async getWhatsAppConnections(req, res, next) {
        try {
            const connections = await database_1.default.whatsAppAccount.findMany({
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            owner: {
                                select: {
                                    id: true,
                                    email: true,
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return sendSuccess(res, connections, 'WhatsApp connections fetched');
        }
        catch (error) {
            next(error);
        }
    }
    async disconnectWhatsAppAccount(req, res, next) {
        try {
            const accountId = getParamId(req.params.accountId);
            if (!accountId) {
                throw new errorHandler_1.AppError('Account ID required', 400);
            }
            // Soft disconnect (preserves data)
            await database_1.default.whatsAppAccount.update({
                where: { id: accountId },
                data: {
                    status: 'DISCONNECTED',
                    accessToken: null,
                    tokenExpiresAt: null,
                    isActive: false
                }
            });
            return sendSuccess(res, null, 'Account disconnected successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ============================================
    // WALLET MANAGEMENT
    // ============================================
    async adminGetAllWallets(req, res, next) {
        try {
            const { page, limit, flagged, isActive } = req.query;
            const { getAllWallets } = await Promise.resolve().then(() => __importStar(require('../wallet/wallet.service')));
            const result = await getAllWallets({
                page: Number(page) || 1,
                limit: Number(limit) || 20,
                flagged: flagged === 'true' ? true : flagged === 'false' ? false : undefined,
                isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            });
            return sendSuccess(res, result, 'Wallets retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async adminGetWalletRequests(req, res, next) {
        try {
            const { status, page, limit } = req.query;
            const { getAccessRequests } = await Promise.resolve().then(() => __importStar(require('../wallet/wallet.service')));
            const result = await getAccessRequests({
                status: status,
                page: Number(page) || 1,
                limit: Number(limit) || 20,
            });
            return sendSuccess(res, result, 'Wallet requests retrieved');
        }
        catch (error) {
            next(error);
        }
    }
    async adminReviewWalletRequest(req, res, next) {
        try {
            const { requestId } = req.params;
            const { action, note } = req.body;
            const adminId = req.admin?.id;
            if (!['approve', 'reject'].includes(action)) {
                throw new errorHandler_1.AppError("Action must be 'approve' or 'reject'", 400);
            }
            const { reviewWalletRequest } = await Promise.resolve().then(() => __importStar(require('../wallet/wallet.service')));
            const result = await reviewWalletRequest(requestId, adminId, action, note);
            return sendSuccess(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async adminAdjustWalletBalance(req, res, next) {
        try {
            const { organizationId } = req.params;
            const { type, amount, note } = req.body;
            const adminId = req.admin?.id;
            const { adminAdjustBalance } = await Promise.resolve().then(() => __importStar(require('../wallet/wallet.service')));
            const result = await adminAdjustBalance(organizationId, adminId, {
                type,
                amountRupees: Number(amount),
                note,
            });
            return sendSuccess(res, result, 'Balance adjusted successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async adminSetWalletCredit(req, res, next) {
        try {
            const { organizationId } = req.params;
            const { creditLimit, enable } = req.body;
            const { setCreditLimit } = await Promise.resolve().then(() => __importStar(require('../wallet/wallet.service')));
            const result = await setCreditLimit(organizationId, Number(creditLimit), Boolean(enable));
            return sendSuccess(res, result, 'Credit limit updated');
        }
        catch (error) {
            next(error);
        }
    }
    async adminFlagWallet(req, res, next) {
        try {
            const { organizationId } = req.params;
            const { reason, unflag } = req.body;
            const adminId = req.admin?.id;
            const { flagWallet } = await Promise.resolve().then(() => __importStar(require('../wallet/wallet.service')));
            const result = await flagWallet(organizationId, adminId, reason, unflag);
            return sendSuccess(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AdminController = AdminController;
exports.adminController = new AdminController();
//# sourceMappingURL=admin.controller.js.map