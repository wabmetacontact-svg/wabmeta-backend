// src/modules/admin/admin.control.controller.ts
//
// HTTP handlers for the admin-control endpoints: audit log, security events,
// organization status and limits, sessions, view-as-user and admin 2FA.

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler';
import { listAuditLogs } from './admin.audit';
import {
  forceLogoutOrganization,
  forceLogoutUser,
  getOrganizationLimits,
  impersonateUser,
  listSecurityEvents,
  listUserSessions,
  revokeUserSession,
  setOrganizationStatus,
  updateOrganizationLimits,
} from './admin.control.service';
import { adminService } from './admin.service';
import { LIMIT_KEYS, UNLIMITED } from './orgControl';
import { getSystemSettings, updateSystemSettings } from './systemSettings';

type AdminReq = Request & { admin?: { id: string; email: string; role: string; name?: string } };
type Handler = (req: AdminReq, res: Response) => Promise<unknown>;

const handle =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req as AdminReq, res).catch(next);

const ok = (res: Response, data: unknown, message = 'OK') =>
  res.json({ success: true, message, data });

const param = (req: Request, name: string): string => {
  const v = req.params[name];
  if (!v) throw new AppError(`${name} is required`, 400);
  return String(v);
};

const actorOf = (req: AdminReq) => ({ id: req.admin!.id, email: req.admin!.email });

// ─── Schemas ───────────────────────────────────────────────────────────────

export const orgStatusSchema = z.object({
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'READ_ONLY']),
    reason: z.string().max(500).optional(),
  }),
});

const limitValue = z.number().int().min(1).max(UNLIMITED).nullable().optional();
export const orgLimitsSchema = z.object({
  body: z
    .object(Object.fromEntries(LIMIT_KEYS.map((k) => [k, limitValue])) as Record<
      (typeof LIMIT_KEYS)[number],
      typeof limitValue
    >)
    .strict(),
});

export const impersonateSchema = z.object({
  body: z.object({
    organizationId: z.string().optional(),
    reason: z.string().min(3, 'Give a reason').max(500),
  }),
});

export const otpCodeSchema = z.object({
  body: z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') }),
});

export const systemSettingsSchema = z.object({
  body: z
    .object({
      maintenanceMode: z.boolean().optional(),
      maintenanceMessage: z.string().max(500).optional(),
      allowRegistration: z.boolean().optional(),
      maxOrganizationsPerUser: z.number().int().min(1).max(1000).optional(),
      defaultPlanType: z.string().optional(),
      smtpEnabled: z.boolean().optional(),
    })
    .strict(),
});

// ─── Handlers ──────────────────────────────────────────────────────────────

export const adminControlController = {
  auditLogs: handle(async (req, res) => ok(res, await listAuditLogs(req.query as any))),

  securityEvents: handle(async (req, res) => ok(res, await listSecurityEvents(req.query as any))),

  setOrgStatus: handle(async (req, res) => {
    const result = await setOrganizationStatus(
      param(req, 'id'),
      req.body.status,
      req.body.reason,
      actorOf(req)
    );
    ok(res, result, `Organization is now ${result.organization.status}`);
  }),

  getOrgLimits: handle(async (req, res) => ok(res, await getOrganizationLimits(param(req, 'id')))),

  updateOrgLimits: handle(async (req, res) =>
    ok(res, await updateOrganizationLimits(param(req, 'id'), req.body), 'Limits updated')
  ),

  forceLogoutOrg: handle(async (req, res) => {
    const count = await forceLogoutOrganization(param(req, 'id'));
    ok(res, { usersLoggedOut: count }, `${count} user(s) logged out`);
  }),

  forceLogoutUser: handle(async (req, res) => {
    await forceLogoutUser(param(req, 'id'));
    ok(res, null, 'User logged out from all devices');
  }),

  listSessions: handle(async (req, res) => ok(res, await listUserSessions(param(req, 'id')))),

  revokeSession: handle(async (req, res) => {
    await revokeUserSession(param(req, 'id'), param(req, 'sessionId'));
    ok(res, null, 'Session ended');
  }),

  impersonate: handle(async (req, res) =>
    ok(
      res,
      await impersonateUser(param(req, 'id'), req.body.organizationId, req.body.reason, actorOf(req)),
      'Read-only view created'
    )
  ),

  getSettings: handle(async (_req, res) => ok(res, await getSystemSettings())),

  updateSettings: handle(async (req, res) =>
    ok(res, await updateSystemSettings(req.body, req.admin!.id), 'Settings saved')
  ),

  startTwoFactor: handle(async (req, res) =>
    ok(res, await adminService.startTwoFactorSetup(req.admin!.id), 'Scan the code, then confirm')
  ),

  confirmTwoFactor: handle(async (req, res) =>
    ok(res, await adminService.confirmTwoFactor(req.admin!.id, req.body.code), '2FA is on')
  ),

  disableOwnTwoFactor: handle(async (req, res) =>
    ok(
      res,
      await adminService.disableTwoFactor(req.admin!.id, req.admin!, req.body.code),
      '2FA is off'
    )
  ),

  resetAdminTwoFactor: handle(async (req, res) =>
    ok(res, await adminService.disableTwoFactor(param(req, 'id'), req.admin!), '2FA reset')
  ),
};
