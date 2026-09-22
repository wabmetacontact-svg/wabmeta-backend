// src/modules/admin/clientBilling.controller.ts
//
// HTTP handlers for client billing, add-ons, offline payments and the
// onboarder's own client list.

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler';
import { addClientAddOn, listAddOns, removeClientAddOn } from './addOns';
import {
  addOnCatalog,
  assignOnboarder,
  createClient,
  getClientBilling,
  listManualPayments,
  listMyClients,
  onboarderSummary,
  onboardersReport,
  PAYMENT_METHODS,
  recordManualPayment,
  reviewManualPayment,
} from './clientBilling';

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

const actorOf = (req: AdminReq) => ({ id: req.admin!.id, email: req.admin!.email, role: req.admin!.role });

// ─── Schemas ───────────────────────────────────────────────────────────────

export const addOnSchema = z.object({
  body: z.object({
    type: z.enum(['EXTRA_SEAT', 'EXTRA_NUMBER', 'AI_TOPUP', 'CUSTOM']),
    quantity: z.coerce.number().int().min(1).max(1000).optional(),
    unitPricePaise: z.coerce.number().int().min(0).max(100_000_000).optional(),
    label: z.string().max(120).optional(),
    note: z.string().max(500).optional(),
    startsAt: z.string().datetime().optional(),
  }),
});

export const manualPaymentSchema = z.object({
  body: z.object({
    amountPaise: z.coerce.number().int().min(100).max(1_000_000_000),
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().max(120).optional(),
    description: z.string().max(300).optional(),
    paidAt: z.string().datetime().optional(),
  }),
});

export const reviewPaymentSchema = z.object({
  body: z.object({ approve: z.boolean(), reason: z.string().max(300).optional() }),
});

export const assignOnboarderSchema = z.object({
  body: z.object({ onboarderId: z.string().min(1).nullable() }),
});

export const createClientSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(60),
    lastName: z.string().max(60).optional(),
    email: z.string().email(),
    phone: z.string().max(20).optional(),
    password: z.string().min(8).max(100),
    organizationName: z.string().min(2).max(100),
  }),
});

// ─── Handlers ──────────────────────────────────────────────────────────────

export const clientBillingController = {
  catalog: handle(async (_req, res) => ok(res, addOnCatalog())),

  billing: handle(async (req, res) => ok(res, await getClientBilling(param(req, 'id')))),

  listAddOns: handle(async (req, res) => ok(res, await listAddOns(param(req, 'id')))),

  addAddOn: handle(async (req, res) =>
    ok(res, await addClientAddOn(param(req, 'id'), req.body, actorOf(req)), 'Add-on added - the limit is raised now')
  ),

  removeAddOn: handle(async (req, res) => {
    await removeClientAddOn(param(req, 'id'), param(req, 'addOnId'), actorOf(req));
    ok(res, null, 'Add-on removed');
  }),

  recordPayment: handle(async (req, res) =>
    ok(res, await recordManualPayment(param(req, 'id'), req.body, actorOf(req)), 'Payment recorded - waiting for verification')
  ),

  paymentQueue: handle(async (req, res) =>
    ok(res, await listManualPayments({ status: req.query.status ? String(req.query.status) : undefined }))
  ),

  reviewPayment: handle(async (req, res) => {
    const r = await reviewManualPayment(param(req, 'paymentId'), req.body.approve, req.body.reason, actorOf(req));
    ok(res, r, r.status === 'VERIFIED' ? 'Payment verified' : 'Payment rejected');
  }),

  assignOnboarder: handle(async (req, res) =>
    ok(res, await assignOnboarder(param(req, 'id'), req.body.onboarderId), 'Onboarder updated')
  ),

  onboarders: handle(async (_req, res) => ok(res, await onboardersReport())),

  // ─── The onboarder's own view ───────────────────────────
  myClients: handle(async (req, res) =>
    ok(res, await listMyClients(req.admin!.id, req.query.search ? String(req.query.search) : undefined))
  ),

  mySummary: handle(async (req, res) => ok(res, await onboarderSummary(req.admin!.id))),

  myPayments: handle(async (req, res) => ok(res, await listManualPayments({ onboardedById: req.admin!.id }))),

  createClient: handle(async (req, res) =>
    ok(res, await createClient(req.body, actorOf(req)), 'Client created - share the password with them')
  ),
};
