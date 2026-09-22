// src/modules/admin/admin.permissions.ts
//
// What each admin role may do. Routes ask for a permission, never a role, so
// adding a role or moving one ability between roles is a change to this file
// only.
//
//   super_admin  everything.
//   admin        day-to-day operations. Cannot delete, move money, edit
//                plans or platform settings, manage admins, or view as a user.
//   support      reads everything, refreshes WhatsApp numbers, ends sessions.
//   finance      reads everything, runs subscriptions, wallets and coupons,
//                verifies offline payments.
//   onboarder    only their own clients (Organization.onboardedById): creates
//                them, plans, features, add-ons, notes, offline payments,
//                read-only view. See requireOrgAccess.

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import prisma from '../../config/database';

export const ADMIN_ROLES = ['super_admin', 'admin', 'support', 'finance', 'onboarder'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSIONS = [
  'dashboard.read',
  'users.read',
  'users.write',
  'users.password',
  'users.delete',
  'orgs.read',
  'orgs.write',
  'orgs.delete',
  'orgs.status',
  'orgs.limits',
  'orgs.features',
  'sessions.manage',
  'impersonate',
  'billing.read',
  'billing.write',
  'plans.write',
  'wallet.read',
  'wallet.review',
  'wallet.money',
  'whatsapp.read',
  'whatsapp.refresh',
  'whatsapp.write',
  'admins.manage',
  'settings.read',
  'settings.write',
  'audit.read',
  'security.read',
  'announcements.write',
  'coupons.write',
  'data.export',
  'payments.verify',
  'clients.own',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const READ_ALL: Permission[] = [
  'dashboard.read',
  'users.read',
  'orgs.read',
  'billing.read',
  'wallet.read',
  'whatsapp.read',
  'settings.read',
];

const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  admin: [
    ...READ_ALL,
    'users.write',
    'users.password',
    'orgs.write',
    'orgs.status',
    'orgs.limits',
    'orgs.features',
    'sessions.manage',
    'billing.write',
    'wallet.review',
    'whatsapp.refresh',
    'whatsapp.write',
    'audit.read',
    'security.read',
    'announcements.write',
    'data.export',
  ],
  support: [...READ_ALL, 'whatsapp.refresh', 'sessions.manage', 'security.read'],
  finance: [...READ_ALL, 'billing.write', 'wallet.review', 'wallet.money', 'coupons.write', 'data.export', 'payments.verify'],
  onboarder: ['clients.own'],
};

export const isAdminRole = (role: unknown): role is AdminRole =>
  typeof role === 'string' && (ADMIN_ROLES as readonly string[]).includes(role);

/** Unknown roles get nothing. */
export const permissionsFor = (role: unknown): Permission[] =>
  isAdminRole(role) ? [...ROLE_PERMISSIONS[role]] : [];

export const hasPermission = (role: unknown, permission: Permission): boolean =>
  permissionsFor(role).includes(permission);

export const requirePermission =
  (permission: Permission) => (req: Request, _res: Response, next: NextFunction) => {
    const admin = (req as any).admin;
    if (!admin) return next(new AppError('Admin authentication required', 401));

    if (!hasPermission(admin.role, permission)) {
      return next(
        new AppError('Your admin role does not allow this action.', 403, 'ADMIN_FORBIDDEN')
      );
    }
    next();
  };

/** Passes when the admin has any one of these permissions. */
export const requireAnyPermission =
  (...permissions: Permission[]) => (req: Request, _res: Response, next: NextFunction) => {
    const role = (req as any).admin?.role;
    if (permissions.some((p) => hasPermission(role, p))) return next();
    next(new AppError('Your admin role does not allow this action.', 403, 'ADMIN_FORBIDDEN'));
  };

/** true when this organization was onboarded by this admin. */
export const isOwnClient = async (adminId: string, organizationId: string | undefined): Promise<boolean> => {
  if (!organizationId) return false;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { onboardedById: true },
  });
  return !!org && org.onboardedById === adminId;
};

/**
 * Access to one organization: any admin whose role has `permission` may act
 * on every organization; an onboarder (clients.own) only on the ones they
 * onboarded. `orgIdOf` says where the request names the organization.
 */
export const requireOrgAccess =
  (permission: Permission, orgIdOf: (req: Request) => string | undefined = (req) => String(req.params.id || '') || undefined) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const admin = (req as any).admin;
      if (!admin) return next(new AppError('Admin authentication required', 401));
      if (hasPermission(admin.role, permission)) return next();

      if (hasPermission(admin.role, 'clients.own') && (await isOwnClient(admin.id, orgIdOf(req)))) {
        return next();
      }
      next(new AppError('You can only manage clients you onboarded.', 403, 'ADMIN_FORBIDDEN'));
    } catch (err) {
      next(err);
    }
  };
