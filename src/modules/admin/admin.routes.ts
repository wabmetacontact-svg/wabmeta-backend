// src/modules/admin/admin.routes.ts

import { Router } from 'express';
import { adminController } from './admin.controller';
import { validate } from '../../middleware/validate';
import { authenticateAdmin } from './admin.middleware';
import { requireAnyPermission as canAny, requireOrgAccess, requirePermission as can } from './admin.permissions';
import {
  addOnSchema,
  assignOnboarderSchema,
  clientBillingController as bill,
  createClientSchema,
  manualPaymentSchema,
  reviewPaymentSchema,
} from './clientBilling.controller';
import { auditAdminActions } from './admin.audit';
import {
  adminControlController as control,
  impersonateSchema,
  orgLimitsSchema,
  orgStatusSchema,
  otpCodeSchema,
  systemSettingsSchema,
} from './admin.control.controller';
import { rateLimit } from '../../middleware/rateLimit';
import {
  adminOpsController as ops,
  announcementCreateSchema,
  announcementUpdateSchema,
  bulkSchema,
  couponCreateSchema,
  couponUpdateSchema,
  notePatchSchema,
  noteSchema,
  tagsSchema,
} from './admin.ops.controller';
import {
  adminLoginSchema,
  createAdminSchema,
  updateAdminSchema,
  getUsersSchema,
  getUserByIdSchema,
  updateUserSchema,
  updateUserStatusSchema,
  updateUserPasswordSchema,
  deleteUserSchema,
  getOrganizationsSchema,
  getOrganizationByIdSchema,
  updateOrganizationSchema,
  deleteOrganizationSchema,
  updateSubscriptionSchema,
  createPlanSchema,
  updatePlanSchema,
  getActivityLogsSchema,
  organizationFeaturesSchema,
  assignPlanSchema,
  extendSubscriptionSchema,
  revokeSubscriptionSchema,
} from './admin.schema';

const router = Router();

// ============================================
// PUBLIC ROUTES (No Admin Auth)
// ============================================

/**
 * @route   POST /api/v1/admin/login
 * @desc    Admin login
 * @access  Public
 */
router.post(
  '/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Try again later.' }),
  validate(adminLoginSchema),
  adminController.login.bind(adminController)
);

// ============================================
// PROTECTED ROUTES (Admin Auth Required)
// ============================================

router.use(authenticateAdmin);

// Every change an admin makes is recorded - see admin.audit.ts.
router.use(auditAdminActions);

/**
 * @route   GET /api/v1/admin/profile
 * @desc    Get admin profile
 * @access  Admin
 */
router.get('/profile', adminController.getProfile.bind(adminController));

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get dashboard statistics
 * @access  Admin
 */
router.get('/dashboard', can('dashboard.read'), adminController.getDashboardStats.bind(adminController));

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users with pagination
 * @access  Admin
 */
router.get(
  '/users',
  can('users.read'),
  validate(getUsersSchema),
  adminController.getUsers.bind(adminController)
);

/**
 * @route   GET /api/v1/admin/users/:id
 * @desc    Get user by ID
 * @access  Admin
 */
router.get(
  '/users/:id',
  can('users.read'),
  validate(getUserByIdSchema),
  adminController.getUserById.bind(adminController)
);

/**
 * @route   PUT /api/v1/admin/users/:id
 * @desc    Update user
 * @access  Admin
 */
router.put(
  '/users/:id',
  can('users.write'),
  validate(updateUserSchema),
  adminController.updateUser.bind(adminController)
);

/**
 * @route   PATCH /api/v1/admin/users/:id/status
 * @desc    Update user status (ACTIVE, SUSPENDED, etc.)
 * @access  Admin
 */
router.patch(
  '/users/:id/status',
  can('users.write'),
  validate(updateUserStatusSchema),
  adminController.updateUserStatus.bind(adminController)
);

/**
 * @route   PATCH /api/v1/admin/users/:id/password
 * @desc    Update user password
 * @access  Admin
 */
router.patch(
  '/users/:id/password',
  can('users.password'),
  validate(updateUserPasswordSchema),
  adminController.updateUserPassword.bind(adminController)
);

/**
 * @route   POST /api/v1/admin/users/:id/suspend
 * @desc    Suspend user
 * @access  Admin
 */
router.post(
  '/users/:id/suspend',
  can('users.write'),
  validate(getUserByIdSchema),
  adminController.suspendUser.bind(adminController)
);

/**
 * @route   POST /api/v1/admin/users/:id/activate
 * @desc    Activate user
 * @access  Admin
 */
router.post(
  '/users/:id/activate',
  can('users.write'),
  validate(getUserByIdSchema),
  adminController.activateUser.bind(adminController)
);

/**
 * @route   DELETE /api/v1/admin/users/:id
 * @desc    Delete user
 * @access  Super Admin
 */
router.delete(
  '/users/:id',
  can('users.delete'),
  validate(deleteUserSchema),
  (req, res, next) => adminController.deleteUser(req, res, next)
);

/**
 * @route   POST /api/v1/admin/transfer-ownership
 * @desc    Transfer organization ownership
 * @access  Super Admin
 */
router.post(
  '/transfer-ownership',
  can('orgs.write'),
  (req, res, next) => adminController.transferOwnership(req, res, next)
);

// ============================================
// ORGANIZATION MANAGEMENT
// ============================================

/**
 * @route   GET /api/v1/admin/organizations
 * @desc    Get all organizations
 * @access  Admin
 */
router.get(
  '/organizations',
  can('orgs.read'),
  validate(getOrganizationsSchema),
  adminController.getOrganizations.bind(adminController)
);

/**
 * @route   GET /api/v1/admin/organizations/:id
 * @desc    Get organization by ID
 * @access  Admin
 */
router.get(
  '/organizations/:id',
  can('orgs.read'),
  validate(getOrganizationByIdSchema),
  adminController.getOrganizationById.bind(adminController)
);

/**
 * @route   PUT /api/v1/admin/organizations/:id
 * @desc    Update organization
 * @access  Admin
 */
router.put(
  '/organizations/:id',
  can('orgs.write'),
  validate(updateOrganizationSchema),
  adminController.updateOrganization.bind(adminController)
);

/**
 * @route   DELETE /api/v1/admin/organizations/:id
 * @desc    Delete organization
 * @access  Super Admin
 */
router.delete(
  '/organizations/:id',
  can('orgs.delete'),
  validate(deleteOrganizationSchema),
  adminController.deleteOrganization.bind(adminController)
);

/**
 * @route   PUT /api/v1/admin/organizations/:id/subscription
 * @desc    Update organization subscription
 * @access  Admin
 */
router.put(
  '/organizations/:id/subscription',
  can('billing.write'),
  validate(updateSubscriptionSchema),
  adminController.updateSubscription.bind(adminController)
);

// Feature Management
router.get(
  '/organizations/:organizationId/features',
  requireOrgAccess('orgs.read', (req) => String(req.params.organizationId || '') || undefined),
  adminController.getOrganizationFeatures.bind(adminController)
);

router.put(
  '/organizations/:organizationId/features',
  requireOrgAccess('orgs.features', (req) => String(req.params.organizationId || '') || undefined),
  validate(organizationFeaturesSchema),
  adminController.updateOrganizationFeatures.bind(adminController)
);

// ============================================
// SUBSCRIPTION MANAGEMENT ROUTES
// ============================================

// Get all subscriptions
router.get(
  '/subscriptions',
  can('billing.read'),
  adminController.getSubscriptions.bind(adminController)
);

// Get subscription stats
router.get(
  '/subscriptions/stats',
  can('billing.read'),
  adminController.getSubscriptionStats.bind(adminController)
);

// Assign plan to organization
router.post(
  '/subscriptions/assign',
  requireOrgAccess('billing.write', (req) => (typeof req.body?.organizationId === 'string' ? req.body.organizationId : undefined)),
  validate(assignPlanSchema),
  adminController.assignPlan.bind(adminController)
);

// Extend subscription
router.post(
  '/subscriptions/:organizationId/extend',
  requireOrgAccess('billing.write', (req) => String(req.params.organizationId || '') || undefined),
  validate(extendSubscriptionSchema),
  adminController.extendSubscription.bind(adminController)
);

// Revoke subscription
router.post(
  '/subscriptions/:organizationId/revoke',
  can('billing.write'),
  validate(revokeSubscriptionSchema),
  adminController.revokeSubscription.bind(adminController)
);

// ============================================
// PLAN MANAGEMENT
// ============================================

/**
 * @route   GET /api/v1/admin/plans
 * @desc    Get all plans
 * @access  Admin
 */
router.get('/plans', canAny('orgs.read', 'clients.own'), adminController.getPlans.bind(adminController));

/**
 * @route   POST /api/v1/admin/plans
 * @desc    Create plan
 * @access  Super Admin
 */
router.post(
  '/plans',
  can('plans.write'),
  validate(createPlanSchema),
  adminController.createPlan.bind(adminController)
);

/**
 * @route   PUT /api/v1/admin/plans/:id
 * @desc    Update plan
 * @access  Super Admin
 */
router.put(
  '/plans/:id',
  can('plans.write'),
  validate(updatePlanSchema),
  adminController.updatePlan.bind(adminController)
);

/**
 * @route   DELETE /api/v1/admin/plans/:id
 * @desc    Delete plan
 * @access  Super Admin
 */
router.delete(
  '/plans/:id',
  can('plans.write'),
  adminController.deletePlan.bind(adminController)
);

// ============================================
// ADMIN MANAGEMENT (Super Admin Only)
// ============================================

/**
 * @route   GET /api/v1/admin/admins
 * @desc    Get all admins
 * @access  Super Admin
 */
router.get(
  '/admins',
  can('admins.manage'),
  adminController.getAdmins.bind(adminController)
);

/**
 * @route   POST /api/v1/admin/admins
 * @desc    Create new admin
 * @access  Super Admin
 */
router.post(
  '/admins',
  can('admins.manage'),
  validate(createAdminSchema),
  adminController.createAdmin.bind(adminController)
);

/**
 * @route   PUT /api/v1/admin/admins/:id
 * @desc    Update admin
 * @access  Super Admin
 */
router.put(
  '/admins/:id',
  can('admins.manage'),
  validate(updateAdminSchema),
  adminController.updateAdmin.bind(adminController)
);

/**
 * @route   DELETE /api/v1/admin/admins/:id
 * @desc    Delete admin
 * @access  Super Admin
 */
router.delete(
  '/admins/:id',
  can('admins.manage'),
  adminController.deleteAdmin.bind(adminController)
);

// ============================================
// ACTIVITY LOGS
// ============================================

/**
 * @route   GET /api/v1/admin/activity-logs
 * @desc    Get activity logs
 * @access  Admin
 */
router.get(
  '/activity-logs',
  can('orgs.read'),
  validate(getActivityLogsSchema),
  adminController.getActivityLogs.bind(adminController)
);

// ============================================
// SYSTEM SETTINGS
// ============================================

/**
 * @route   GET /api/v1/admin/settings
 * @desc    Get system settings
 * @access  Admin
 */
router.get('/settings', can('settings.read'), control.getSettings);

/**
 * @route   PUT /api/v1/admin/settings
 * @desc    Update system settings
 * @access  Super Admin
 */
router.put(
  '/settings',
  can('settings.write'),
  validate(systemSettingsSchema),
  control.updateSettings
);

// ============================================
// WHATSAPP CONNECTION MANAGEMENT
// ============================================

router.get(
  '/whatsapp-stats',
  can('whatsapp.read'),
  adminController.getWhatsAppStats.bind(adminController)
);

router.patch(
  '/whatsapp-connections/:accountId/connection-type',
  can('whatsapp.write'),
  adminController.updateConnectionType.bind(adminController)
);

router.get(
  '/whatsapp-connections',
  can('whatsapp.read'),
  adminController.getWhatsAppConnections.bind(adminController)
);

router.post(
  '/whatsapp-connections/:accountId/disconnect',
  can('whatsapp.write'),
  adminController.disconnectWhatsAppAccount.bind(adminController)
);

// Meta se taaza quality rating / tier / health kheencho
router.post(
  '/whatsapp-connections/:accountId/refresh',
  can('whatsapp.refresh'),
  adminController.refreshWhatsAppAccount.bind(adminController)
);

// Meta's full health_status for support: code, level, and how old it is.
router.get(
  '/whatsapp-connections/:accountId/health',
  can('whatsapp.read'),
  adminController.getWhatsAppAccountHealth.bind(adminController)
);

// Display overrides - user ko kya dikhe. Meta par kuch nahi badalta,
// aur sending par bhi koi asar nahi.
router.put(
  '/whatsapp-connections/:accountId/display',
  can('whatsapp.write'),
  adminController.setAccountDisplayOverrides.bind(adminController)
);

// ============================================
// WALLET MANAGEMENT ROUTES
// ============================================

router.get(
  '/wallets',
  can('wallet.read'),
  adminController.adminGetAllWallets.bind(adminController)
);

router.get(
  '/wallets/requests',
  can('wallet.read'),
  adminController.adminGetWalletRequests.bind(adminController)
);

router.patch(
  '/wallets/requests/:requestId/review',
  can('wallet.review'),
  adminController.adminReviewWalletRequest.bind(adminController)
);

router.patch(
  '/wallets/:organizationId/adjust',
  can('wallet.money'),
  adminController.adminAdjustWalletBalance.bind(adminController)
);

router.patch(
  '/wallets/:organizationId/credit',
  can('wallet.money'),
  adminController.adminSetWalletCredit.bind(adminController)
);

router.patch(
  '/wallets/:organizationId/flag',
  can('wallet.review'),
  adminController.adminFlagWallet.bind(adminController)
);

// ============================================
// USER DETAIL VIEW ROUTES (Admin Panel)
// ============================================

// User ke saare contacts (deleted bhi)
router.get(
  '/users/:userId/contacts',
  can('users.read'),
  adminController.getUserContacts.bind(adminController)
);

// Contacts export (CSV)
router.get(
  '/users/:userId/contacts/export',
  can('users.read'),
  adminController.exportUserContacts.bind(adminController)
);

// User ke saare templates
router.get(
  '/users/:userId/templates',
  can('users.read'),
  adminController.getUserTemplates.bind(adminController)
);

// User ka dashboard analytics
router.get(
  '/users/:userId/analytics',
  can('users.read'),
  adminController.getUserAnalytics.bind(adminController)
);

// User ka wallet + transactions
router.get(
  '/users/:userId/wallet',
  can('wallet.read'),
  adminController.getUserWallet.bind(adminController)
);

// ============================================
// ADMIN CONTROL
// ============================================

// Who did what in the admin panel
router.get('/audit-logs', can('audit.read'), control.auditLogs);

// Failed logins, lockouts, org header mismatches
router.get('/security-events', can('security.read'), control.securityEvents);

// Block or reopen a whole organization (ACTIVE / READ_ONLY / SUSPENDED)
router.post(
  '/organizations/:id/status',
  can('orgs.status'),
  validate(orgStatusSchema),
  control.setOrgStatus
);

// Per-organization limits that replace the plan's
router.get('/organizations/:id/limits', can('orgs.read'), control.getOrgLimits);
router.put(
  '/organizations/:id/limits',
  can('orgs.limits'),
  validate(orgLimitsSchema),
  control.updateOrgLimits
);

// End every session of every member of an organization
router.post('/organizations/:id/force-logout', can('sessions.manage'), control.forceLogoutOrg);

// A user's sessions
router.get('/users/:id/sessions', can('users.read'), control.listSessions);
router.delete('/users/:id/sessions/:sessionId', can('sessions.manage'), control.revokeSession);
router.post('/users/:id/force-logout', can('sessions.manage'), control.forceLogoutUser);

// Read-only, 30-minute view of the app as this user
router.post(
  '/users/:id/impersonate',
  // An onboarder may view their own client's account; the organization in the
  // body must be theirs, and impersonateUser checks the user belongs to it.
  requireOrgAccess('impersonate', (req) => (typeof req.body?.organizationId === 'string' ? req.body.organizationId : undefined)),
  validate(impersonateSchema),
  control.impersonate
);

// The signed-in admin's own two-factor authentication
router.post('/2fa/setup', control.startTwoFactor);
router.post('/2fa/confirm', validate(otpCodeSchema), control.confirmTwoFactor);
router.post('/2fa/disable', validate(otpCodeSchema), control.disableOwnTwoFactor);
// Reset another admin's 2FA, for a lost phone
router.delete('/admins/:id/2fa', can('admins.manage'), control.resetAdminTwoFactor);

// ============================================
// INSIGHTS
// ============================================

// One organization end to end
router.get('/organizations/:id/overview', requireOrgAccess('orgs.read'), ops.overview);

// Accounts that need attention
router.get('/risk', can('orgs.read'), ops.risk);

// Users, organizations, WhatsApp numbers, payments
router.get('/search', can('users.read'), ops.search);

// Payments and run rate
router.get('/revenue', can('billing.read'), ops.revenue);

// ============================================
// OPERATIONS
// ============================================

// Internal notes on an organization
router.get('/organizations/:id/notes', requireOrgAccess('orgs.read'), ops.listNotes);
router.post('/organizations/:id/notes', requireOrgAccess('orgs.write'), validate(noteSchema), ops.addNote);
router.patch('/organizations/:id/notes/:noteId', requireOrgAccess('orgs.write'), validate(notePatchSchema), ops.updateNote);
router.delete('/organizations/:id/notes/:noteId', requireOrgAccess('orgs.write'), ops.deleteNote);

// Internal tags
router.get('/tags', can('orgs.read'), ops.allTags);
router.put('/organizations/:id/tags', requireOrgAccess('orgs.write'), validate(tagsSchema), ops.setTags);

// Announcements to customers
router.get('/announcements', can('orgs.read'), ops.listAnnouncements);
router.post('/announcements', can('announcements.write'), validate(announcementCreateSchema), ops.createAnnouncement);
router.put('/announcements/:id', can('announcements.write'), validate(announcementUpdateSchema), ops.updateAnnouncement);
router.delete('/announcements/:id', can('announcements.write'), ops.deleteAnnouncement);

// One action on many organizations (each action checks its own permission)
router.post('/bulk', can('orgs.read'), validate(bulkSchema), ops.bulk);

// CSV exports (audited as exports)
router.get('/export/organizations', can('data.export'), ops.exportOrganizations);
router.get('/export/users', can('data.export'), ops.exportUsers);

// Checkout coupons
router.get('/coupons', can('billing.read'), ops.listCoupons);
router.post('/coupons', can('coupons.write'), validate(couponCreateSchema), ops.createCoupon);
router.put('/coupons/:id', can('coupons.write'), validate(couponUpdateSchema), ops.updateCoupon);
router.delete('/coupons/:id', can('coupons.write'), ops.deleteCoupon);

// ============================================
// CLIENT BILLING, ADD-ONS, OFFLINE PAYMENTS
// ============================================

// What can be sold as an add-on, with default prices
router.get('/addon-catalog', canAny('orgs.read', 'clients.own'), bill.catalog);

// A client's bill (plan + add-ons) and the money actually received
router.get('/organizations/:id/billing', requireOrgAccess('billing.read'), bill.billing);

// Add-ons: raise the client's limit while active
router.get('/organizations/:id/addons', requireOrgAccess('orgs.read'), bill.listAddOns);
router.post('/organizations/:id/addons', requireOrgAccess('billing.write'), validate(addOnSchema), bill.addAddOn);
router.delete('/organizations/:id/addons/:addOnId', requireOrgAccess('billing.write'), bill.removeAddOn);

// Offline payments: recorded as pending, counted once verified
router.post(
  '/organizations/:id/manual-payments',
  requireOrgAccess('billing.write'),
  validate(manualPaymentSchema),
  bill.recordPayment
);
router.get('/manual-payments', can('billing.read'), bill.paymentQueue);
router.post('/manual-payments/:paymentId/review', can('payments.verify'), validate(reviewPaymentSchema), bill.reviewPayment);

// Onboarders
router.put('/organizations/:id/onboarder', can('orgs.write'), validate(assignOnboarderSchema), bill.assignOnboarder);
router.get('/onboarders', can('billing.read'), bill.onboarders);

// The signed-in onboarder's own clients
router.get('/my-clients', can('clients.own'), bill.myClients);
router.get('/my-clients/summary', can('clients.own'), bill.mySummary);
router.get('/my-clients/payments', can('clients.own'), bill.myPayments);
router.post('/my-clients', can('clients.own'), validate(createClientSchema), bill.createClient);

export default router;