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
//   finance      reads everything, runs subscriptions, wallets and coupons.

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';

export const ADMIN_ROLES = ['super_admin', 'admin', 'support', 'finance'] as const;
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
  finance: [...READ_ALL, 'billing.write', 'wallet.review', 'wallet.money', 'coupons.write', 'data.export'],
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
