// src/modules/admin/admin.controller.ts

import { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service';
import { adminBillingService } from './admin.billing.service';
import { AppError } from '../../middleware/errorHandler';
import prisma from '../../config/database';

// ============================================
// TYPES
// ============================================

interface AdminRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: string;
    name?: string;
  };
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// RESPONSE HELPERS
// ============================================

const sendSuccess = (
  res: Response,
  data: any,
  message: string,
  statusCode: number = 200,
  meta?: PaginationMeta
) => {
  const response: any = {
    success: true,
    message,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

const sendError = (
  res: Response,
  message: string,
  statusCode: number = 400
) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const parseQueryString = (value: any): string | undefined => {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const parseQueryNumber = (value: any, defaultValue: number): number => {
  const parsed = Number(value);
  return !isNaN(parsed) && parsed > 0 ? parsed : defaultValue;
};

const getParamId = (id: string | string[] | undefined): string => {
  if (Array.isArray(id)) {
    return id[0];
  }
  return id || '';
};

// ============================================
// ADMIN CONTROLLER CLASS
// ============================================

export class AdminController {
  // ==========================================
  // ADMIN AUTH
  // ==========================================

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError('Email and password are required', 400);
      }

      const result = await adminService.login({ email, password });

      // Store admin user info for frontend
      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          token: result.token,
          admin: result.admin,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.admin?.id) {
        throw new AppError('Admin not authenticated', 401);
      }

      const admin = await adminService.getAdminById(req.admin.id);

      if (!admin) {
        throw new AppError('Admin not found', 404);
      }

      return sendSuccess(res, admin, 'Profile fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DASHBOARD
  // ==========================================

  async getDashboardStats(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getDashboardStats();
      return sendSuccess(res, stats, 'Dashboard stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  async getUsers(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const page = parseQueryNumber(req.query.page, 1);
      const limit = parseQueryNumber(req.query.limit, 20);
      const search = parseQueryString(req.query.search);
      const status = parseQueryString(req.query.status);
      const sortBy = parseQueryString(req.query.sortBy) || 'createdAt';
      const sortOrder = parseQueryString(req.query.sortOrder) || 'desc';

      const result = await adminService.getUsers({
        page,
        limit,
        search,
        status,
        sortBy,
        sortOrder,
      });

      return sendSuccess(
        res,
        result.users,
        'Users fetched successfully',
        200,
        {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        }
      );
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      const user = await adminService.getUserById(id);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return sendSuccess(res, user, 'User fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      const user = await adminService.updateUser(id, req.body);
      return sendSuccess(res, user, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);
      const { status } = req.body;

      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      if (!status) {
        throw new AppError('Status is required', 400);
      }

      const validStatuses = ['ACTIVE', 'SUSPENDED', 'INACTIVE', 'PENDING_VERIFICATION'];
      if (!validStatuses.includes(status.toUpperCase())) {
        throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
      }

      const user = await adminService.updateUserStatus(id, status.toUpperCase());
      return sendSuccess(res, user, `User status updated to ${status}`);
    } catch (error) {
      next(error);
    }
  }

  async suspendUser(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      const user = await adminService.suspendUser(id);
      return sendSuccess(res, user, 'User suspended successfully');
    } catch (error) {
      next(error);
    }
  }

  async activateUser(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      const user = await adminService.activateUser(id);
      return sendSuccess(res, user, 'User activated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateUserPassword(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);
      const { password } = req.body;

      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      if (!password) {
        throw new AppError('Password is required', 400);
      }

      const user = await adminService.updateUserPassword(id, { password });
      return sendSuccess(res, user, 'User password updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      // ✅ Get query params for delete options
      const force = req.query.force === 'true';
      const transferOwnership = req.query.transferOwnership === 'true';

      const result = await adminService.deleteUser(id, {
        force,
        transferOwnership,
      });

      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // TRANSFER OWNERSHIP
  // ============================================

  async transferOwnership(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const { organizationId, newOwnerId } = req.body;

      if (!organizationId || !newOwnerId) {
        throw new AppError('organizationId and newOwnerId are required', 400);
      }

      const result = await adminService.transferOrganizationOwnership(
        organizationId,
        newOwnerId
      );

      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ORGANIZATION MANAGEMENT
  // ==========================================

  async getOrganizations(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const page = parseQueryNumber(req.query.page, 1);
      const limit = parseQueryNumber(req.query.limit, 20);
      const search = parseQueryString(req.query.search);
      const planType = parseQueryString(req.query.planType);
      const sortBy = parseQueryString(req.query.sortBy) || 'createdAt';
      const sortOrder = parseQueryString(req.query.sortOrder) || 'desc';

      const result = await adminService.getOrganizations({
        page,
        limit,
        search,
        planType,
        sortBy,
        sortOrder,
      });

      return sendSuccess(
        res,
        result.organizations,
        'Organizations fetched successfully',
        200,
        {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        }
      );
    } catch (error) {
      next(error);
    }
  }

  async getOrganizationById(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('Organization ID is required', 400);
      }

      const org = await adminService.getOrganizationById(id);

      if (!org) {
        throw new AppError('Organization not found', 404);
      }

      return sendSuccess(res, org, 'Organization fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateOrganization(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('Organization ID is required', 400);
      }

      const org = await adminService.updateOrganization(id, req.body);
      return sendSuccess(res, org, 'Organization updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteOrganization(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('Organization ID is required', 400);
      }

      const result = await adminService.deleteOrganization(id);
      return sendSuccess(res, null, result.message);
    } catch (error) {
      next(error);
    }
  }

  async updateSubscription(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('Organization ID is required', 400);
      }

      const result = await adminService.updateSubscription(id, req.body);
      return sendSuccess(res, result, 'Subscription updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // FEATURE MANAGEMENT
  // ============================================

  async getOrganizationFeatures(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = getParamId(req.params.organizationId);

      const org = await prisma.organization.findUnique({
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
        throw new AppError('Organization not found', 404);
      }

      return sendSuccess(res, {
        organizationId: org.id,
        organizationName: org.name,
        currentPlan: org.planType,
        features: {
          simpleBulkPaste: (org as any).featureSimpleBulkUpload ?? false,
          csvUpload: (org as any).featureCsvUpload ?? false,
          adminOverride: (org as any).featureOverrideByAdmin ?? false
        }
      }, 'Features fetched');

    } catch (error) {
      next(error);
    }
  }

  async updateOrganizationFeatures(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = getParamId(req.params.organizationId);
      const { simpleBulkPaste, csvUpload, enableOverride } = req.body;

      const org = await prisma.organization.findUnique({
        where: { id: organizationId }
      });

      if (!org) {
        throw new AppError('Organization not found', 404);
      }

      const updated = await prisma.organization.update({
        where: { id: organizationId },
        data: {
          featureSimpleBulkUpload: simpleBulkPaste,
          featureCsvUpload: csvUpload,
          featureOverrideByAdmin: enableOverride ?? true
        } as any
      });

      return sendSuccess(res, {
        organizationId,
        features: {
          simpleBulkPaste: (updated as any).featureSimpleBulkUpload,
          csvUpload: (updated as any).featureCsvUpload,
          adminOverride: (updated as any).featureOverrideByAdmin
        }
      }, 'Features updated');

    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PLAN MANAGEMENT
  // ==========================================

  async getPlans(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const plans = await adminService.getPlans();
      return sendSuccess(res, plans, 'Plans fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async createPlan(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const plan = await adminService.createPlan(req.body);
      return sendSuccess(res, plan, 'Plan created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updatePlan(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('Plan ID is required', 400);
      }

      const plan = await adminService.updatePlan(id, req.body);
      return sendSuccess(res, plan, 'Plan updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deletePlan(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('Plan ID is required', 400);
      }

      const result = await adminService.deletePlan(id);
      return sendSuccess(res, null, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ADMIN MANAGEMENT
  // ==========================================

  async getAdmins(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const admins = await adminService.getAdmins();
      return sendSuccess(res, admins, 'Admins fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async createAdmin(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const admin = await adminService.createAdmin(req.body);
      return sendSuccess(res, admin, 'Admin created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateAdmin(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('Admin ID is required', 400);
      }

      const admin = await adminService.updateAdmin(id, req.body);
      return sendSuccess(res, admin, 'Admin updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteAdmin(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const id = getParamId(req.params.id);

      if (!id) {
        throw new AppError('Admin ID is required', 400);
      }

      // Prevent self-deletion
      if (req.admin?.id === id) {
        throw new AppError('Cannot delete your own admin account', 400);
      }

      const result = await adminService.deleteAdmin(id);
      return sendSuccess(res, null, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================

  async getActivityLogs(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const page = parseQueryNumber(req.query.page, 1);
      const limit = parseQueryNumber(req.query.limit, 50);
      const action = parseQueryString(req.query.action);
      const userId = parseQueryString(req.query.userId);
      const organizationId = parseQueryString(req.query.organizationId);
      const startDate = parseQueryString(req.query.startDate);
      const endDate = parseQueryString(req.query.endDate);

      const result = await adminService.getActivityLogs({
        page,
        limit,
        action,
        userId,
        organizationId,
        startDate,
        endDate,
      });

      return sendSuccess(
        res,
        result.logs,
        'Activity logs fetched successfully',
        200,
        {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        }
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SYSTEM SETTINGS
  // ==========================================

  async getSystemSettings(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const settings = adminService.getSystemSettings();
      return sendSuccess(res, settings, 'Settings fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateSystemSettings(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const settings = adminService.updateSystemSettings(req.body);
      return sendSuccess(res, settings, 'Settings updated successfully');
    } catch (error) {
      next(error);
    }
  }
  // ============================================
  // ASSIGN PLAN TO ORGANIZATION
  // ============================================

  async assignPlan(req: AdminRequest, res: Response) {
    try {
      const { organizationId, planSlug, validityDays, customEndDate, reason } = req.body;
      const adminId = req.admin?.id;
      const adminName = `${req.admin?.name || ''}`.trim() || 'Admin';

      if (!organizationId || !planSlug) {
        return sendError(res, 'Organization ID and plan slug are required', 400);
      }

      const result = await adminBillingService.assignPlanToOrganization({
        organizationId,
        planSlug,
        validityDays: validityDays ? parseInt(validityDays) : undefined,
        customEndDate: customEndDate ? new Date(customEndDate) : undefined,
        adminId: adminId || 'system',
        adminName,
        reason,
      });

      return sendSuccess(res, result, result.message);
    } catch (error: any) {
      console.error('Assign plan error:', error);
      return sendError(res, error.message || 'Failed to assign plan', 500);
    }
  }

  // ============================================
  // EXTEND SUBSCRIPTION
  // ============================================

  async extendSubscription(req: AdminRequest, res: Response) {
    try {
      const organizationId = getParamId(req.params.organizationId);
      const { additionalDays, reason } = req.body;
      const adminId = req.admin?.id;
      const adminName = `${req.admin?.name || ''}`.trim() || 'Admin';

      if (!additionalDays || additionalDays <= 0) {
        return sendError(res, 'Additional days must be a positive number', 400);
      }

      const result = await adminBillingService.extendSubscription({
        organizationId,
        additionalDays: parseInt(additionalDays),
        adminId: adminId || 'system',
        adminName,
        reason,
      });

      return sendSuccess(res, result, result.message);
    } catch (error: any) {
      console.error('Extend subscription error:', error);
      return sendError(res, error.message || 'Failed to extend subscription', 500);
    }
  }

  // ============================================
  // REVOKE SUBSCRIPTION
  // ============================================

  async revokeSubscription(req: AdminRequest, res: Response) {
    try {
      const organizationId = getParamId(req.params.organizationId);
      const { reason, immediate } = req.body;
      const adminId = req.admin?.id;
      const adminName = `${req.admin?.name || ''}`.trim() || 'Admin';

      const result = await adminBillingService.revokeSubscription({
        organizationId,
        adminId: adminId || 'system',
        adminName,
        reason,
        immediate: immediate === true,
      });

      return sendSuccess(res, result, result.message);
    } catch (error: any) {
      console.error('Revoke subscription error:', error);
      return sendError(res, error.message || 'Failed to revoke subscription', 500);
    }
  }

  // ============================================
  // GET ALL SUBSCRIPTIONS
  // ============================================

  async getSubscriptions(req: AdminRequest, res: Response) {
    try {
      const { page, limit, status, planType, excludePlanType, search } = req.query;

      const result = await adminBillingService.getAllSubscriptions({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as any,
        planType: planType as any,
        excludePlanType: excludePlanType as any,
        search: search as string,
      });

      return sendSuccess(res, result, 'Subscriptions retrieved successfully');
    } catch (error: any) {
      console.error('Get subscriptions error:', error);
      return sendError(res, error.message || 'Failed to get subscriptions', 500);
    }
  }

  // ============================================
  // GET SUBSCRIPTION STATS
  // ============================================

  async getSubscriptionStats(req: AdminRequest, res: Response) {
    try {
      const stats = await adminBillingService.getSubscriptionStats();
      return sendSuccess(res, stats, 'Stats retrieved successfully');
    } catch (error: any) {
      console.error('Get subscription stats error:', error);
      return sendError(res, error.message || 'Failed to get stats', 500);
    }
  }

  // ============================================
  // WHATSAPP CONNECTION MANAGEMENT
  // ============================================

  async getWhatsAppStats(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getWhatsAppConnectionStats();
      return sendSuccess(res, stats, 'WhatsApp stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateConnectionType(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const accountId = getParamId(req.params.accountId);
      const { connectionType } = req.body;

      if (!connectionType) {
        throw new AppError('Connection type is required', 400);
      }

      const result = await adminService.updateWhatsAppConnectionType(
        accountId,
        connectionType
      );

      return sendSuccess(res, result, 'Connection type updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getWhatsAppConnections(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const connections = await prisma.whatsAppAccount.findMany({
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
    } catch (error) {
      next(error);
    }
  }

  async disconnectWhatsAppAccount(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const accountId = getParamId(req.params.accountId);

      if (!accountId) {
        throw new AppError('Account ID required', 400);
      }

      // Soft disconnect (preserves data)
      await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: {
          status: 'DISCONNECTED',
          accessToken: null,
          tokenExpiresAt: null,
          isActive: false
        }
      });

      return sendSuccess(res, null, 'Account disconnected successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();