// src/modules/admin/admin.ops.controller.ts
//
// HTTP handlers for admin insights (overview, risk, search, revenue) and
// operations (notes, tags, announcements, bulk actions, exports, coupons).

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler';
import { createCoupon, deleteCoupon, listCoupons, updateCoupon } from '../billing/coupons';
import { hasPermission, Permission } from './admin.permissions';
import { getOrganizationOverview, getRevenueReport, getRiskReport, globalSearch } from './admin.insights.service';
import {
  addNote,
  BULK_MAX,
  BulkAction,
  createAnnouncement,
  deleteAnnouncement,
  deleteNote,
  exportOrganizationsCsv,
  exportUsersCsv,
  listAllTags,
  listAnnouncements,
  listNotes,
  runBulkAction,
  setOrganizationTags,
  updateAnnouncement,
  updateNote,
} from './admin.ops.service';

type AdminReq = Request & { admin?: { id: string; email: string; role: string; name?: string } };

const handle =
  (fn: (req: AdminReq, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req as AdminReq, res).catch(next);

const ok = (res: Response, data: unknown, message = 'OK') => res.json({ success: true, message, data });

const param = (req: Request, name: string): string => {
  const v = req.params[name];
  if (!v) throw new AppError(`${name} is required`, 400);
  return String(v);
};

const actorOf = (req: AdminReq) => ({ id: req.admin!.id, email: req.admin!.email, name: req.admin!.name });

const PLAN_TYPES = ['FREE_DEMO', 'STARTER', 'GROWTH', 'PRO', 'BUSINESS', 'MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL'] as const;

// ─── Schemas ───────────────────────────────────────────────────────────────

export const noteSchema = z.object({
  body: z.object({ body: z.string().min(1).max(5000), pinned: z.boolean().optional() }),
});

export const notePatchSchema = z.object({ body: z.object({ pinned: z.boolean() }) });

export const tagsSchema = z.object({ body: z.object({ tags: z.array(z.string().max(32)).max(20) }) });

const announcementBody = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  level: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
  audience: z.enum(['ALL', 'PLANS', 'ORGS']).optional(),
  planTypes: z.array(z.enum(PLAN_TYPES)).optional(),
  organizationIds: z.array(z.string().min(1)).max(1000).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  notify: z.boolean().optional(),
});

export const announcementCreateSchema = z.object({ body: announcementBody });
export const announcementUpdateSchema = z.object({ body: announcementBody.partial() });

export const bulkSchema = z.object({
  body: z.object({
    organizationIds: z.array(z.string().min(1)).min(1).max(BULK_MAX),
    action: z.enum(['extend', 'status', 'tag_add', 'tag_remove', 'logout', 'notify']),
    days: z.coerce.number().int().min(1).max(3650).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'READ_ONLY']).optional(),
    reason: z.string().max(500).optional(),
    tag: z.string().max(32).optional(),
    title: z.string().max(200).optional(),
    message: z.string().max(2000).optional(),
  }),
});

const couponBody = z.object({
  code: z.string().min(3).max(32),
  description: z.string().max(300).nullable().optional(),
  discountType: z.enum(['PERCENT', 'FLAT']),
  value: z.coerce.number().int().min(1),
  maxRedemptions: z.coerce.number().int().min(1).nullable().optional(),
  onePerOrg: z.boolean().optional(),
  planTypes: z.array(z.enum(PLAN_TYPES)).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const couponCreateSchema = z.object({ body: couponBody });
export const couponUpdateSchema = z.object({
  body: couponBody.omit({ code: true, discountType: true, value: true }).partial(),
});

// Each bulk action needs the same permission as doing it to one organization.
const BULK_PERMISSION: Record<BulkAction['action'], Permission> = {
  extend: 'billing.write',
  status: 'orgs.status',
  tag_add: 'orgs.write',
  tag_remove: 'orgs.write',
  logout: 'sessions.manage',
  notify: 'announcements.write',
};

const sendCsv = (res: Response, name: string, csv: string) => {
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${date}.csv"`);
  // BOM so Excel reads Hindi and other non-Latin names correctly.
  res.send('﻿' + csv);
};

// ─── Handlers ──────────────────────────────────────────────────────────────

export const adminOpsController = {
  overview: handle(async (req, res) => ok(res, await getOrganizationOverview(param(req, 'id')))),

  risk: handle(async (_req, res) => ok(res, await getRiskReport())),

  search: handle(async (req, res) => ok(res, await globalSearch(String(req.query.q || '')))),

  revenue: handle(async (req, res) => ok(res, await getRevenueReport(Number(req.query.months) || 6))),

  listNotes: handle(async (req, res) => ok(res, await listNotes(param(req, 'id')))),

  addNote: handle(async (req, res) =>
    ok(res, await addNote(param(req, 'id'), req.body.body, !!req.body.pinned, actorOf(req)), 'Note added')
  ),

  updateNote: handle(async (req, res) => {
    await updateNote(param(req, 'id'), param(req, 'noteId'), req.body);
    ok(res, null, 'Note updated');
  }),

  deleteNote: handle(async (req, res) => {
    await deleteNote(param(req, 'id'), param(req, 'noteId'));
    ok(res, null, 'Note deleted');
  }),

  setTags: handle(async (req, res) => ok(res, await setOrganizationTags(param(req, 'id'), req.body.tags), 'Tags saved')),

  allTags: handle(async (_req, res) => ok(res, await listAllTags())),

  listAnnouncements: handle(async (_req, res) => ok(res, await listAnnouncements())),

  createAnnouncement: handle(async (req, res) => {
    const result = await createAnnouncement(req.body, actorOf(req));
    ok(res, result, result.notified ? `Published and sent to ${result.notified} user(s)` : 'Published');
  }),

  updateAnnouncement: handle(async (req, res) =>
    ok(res, await updateAnnouncement(param(req, 'id'), req.body), 'Announcement updated')
  ),

  deleteAnnouncement: handle(async (req, res) => {
    await deleteAnnouncement(param(req, 'id'));
    ok(res, null, 'Announcement deleted');
  }),

  bulk: handle(async (req, res) => {
    const { organizationIds, action, days, status, reason, tag, title, message } = req.body;

    if (!hasPermission(req.admin?.role, BULK_PERMISSION[action as BulkAction['action']])) {
      throw new AppError('Your admin role does not allow this action.', 403, 'ADMIN_FORBIDDEN');
    }

    let spec: BulkAction;
    switch (action) {
      case 'extend':
        if (!days) throw new AppError('Enter the number of days.', 400);
        spec = { action, days, reason };
        break;
      case 'status':
        if (!status) throw new AppError('Pick a status.', 400);
        spec = { action, status, reason };
        break;
      case 'tag_add':
      case 'tag_remove':
        spec = { action, tag: tag || '' };
        break;
      case 'notify':
        if (!title || !message) throw new AppError('Write a title and a message.', 400);
        spec = { action, title, message };
        break;
      default:
        spec = { action: 'logout' };
    }

    const result = await runBulkAction(organizationIds, spec, actorOf(req));
    ok(res, result, `${result.succeeded} of ${result.total} done`);
  }),

  exportOrganizations: handle(async (req, res) => {
    const csv = await exportOrganizationsCsv({
      status: req.query.status ? String(req.query.status) : undefined,
      tag: req.query.tag ? String(req.query.tag) : undefined,
      planType: req.query.planType ? String(req.query.planType) : undefined,
    });
    sendCsv(res, 'organizations', csv);
  }),

  exportUsers: handle(async (req, res) => {
    const csv = await exportUsersCsv({ status: req.query.status ? String(req.query.status) : undefined });
    sendCsv(res, 'users', csv);
  }),

  listCoupons: handle(async (_req, res) => ok(res, await listCoupons())),

  createCoupon: handle(async (req, res) => ok(res, await createCoupon(req.body, req.admin!.id), 'Coupon created')),

  updateCoupon: handle(async (req, res) => ok(res, await updateCoupon(param(req, 'id'), req.body), 'Coupon updated')),

  deleteCoupon: handle(async (req, res) => {
    const result = await deleteCoupon(param(req, 'id'));
    ok(res, result, result.deleted ? 'Coupon deleted' : 'Coupon has been used, so it was switched off instead');
  }),
};
