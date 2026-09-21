// src/modules/admin/admin.audit.ts
//
// A permanent record of what every admin did.
//
// The middleware sits on the admin router after authentication and writes
// one AdminAuditLog row for every request that changes something, plus data
// exports (a GET, but it takes customer data out of the system). It records
// after the response is sent, with the status code, so a refused request is
// visible too. Writing the row can never fail the admin's request.

import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';

const SECRET_KEY = /pass(word)?|otp|secret|token|credential|authorization/i;
const MAX_BODY_CHARS = 8_000;

/** Copy of a request body with anything secret-looking replaced. */
export const redactBody = (value: unknown, depth = 0): unknown => {
  if (depth > 5 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactBody(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? '[redacted]' : redactBody(v, depth + 1);
  }
  return out;
};

const boundedBody = (body: unknown): unknown => {
  if (body === undefined || body === null) return null;
  const redacted = redactBody(body);
  const text = JSON.stringify(redacted);
  if (!text || text === '{}') return null;
  return text.length > MAX_BODY_CHARS ? { truncated: text.slice(0, MAX_BODY_CHARS) } : redacted;
};

const TARGET_TYPES: Record<string, string> = {
  users: 'user',
  organizations: 'organization',
  subscriptions: 'organization',
  wallets: 'organization',
  plans: 'plan',
  admins: 'admin',
  'whatsapp-connections': 'whatsapp',
  settings: 'settings',
  'transfer-ownership': 'organization',
  announcements: 'announcement',
  coupons: 'coupon',
  bulk: 'bulk',
  export: 'export',
};

/**
 * What a route acted on, from its pattern and params. The first path segment
 * names the kind of thing; the id is whichever param the route declares.
 */
export const describeTarget = (
  routePath: string,
  params: Record<string, string>,
  body: any
): { targetType: string | null; targetId: string | null; organizationId: string | null } => {
  // Routes served from other routers (wallet.routes.ts) carry the full
  // "/admin/..." path; skip that prefix to reach the kind of thing.
  const parts = routePath.split('/').filter(Boolean);
  const segment = (parts[0] === 'admin' ? parts[1] : parts[0]) || '';
  const targetType = TARGET_TYPES[segment] ?? (segment || null);

  const targetId =
    params.id ||
    params.userId ||
    params.organizationId ||
    params.accountId ||
    params.requestId ||
    null;

  const organizationId =
    params.organizationId ||
    (targetType === 'organization' ? params.id : undefined) ||
    (typeof body?.organizationId === 'string' ? body.organizationId : undefined) ||
    null;

  return { targetType, targetId, organizationId };
};

const isAudited = (method: string, url: string): boolean => {
  const m = method.toUpperCase();
  if (m === 'OPTIONS' || m === 'HEAD') return false;
  if (m !== 'GET') return true;
  return /\/export(\/|$|\?)/.test(url);
};

export interface AuditEntry {
  adminId?: string | null;
  adminEmail?: string | null;
  action: string;
  method: string;
  path: string;
  targetType?: string | null;
  targetId?: string | null;
  organizationId?: string | null;
  reason?: string | null;
  requestBody?: unknown;
  statusCode: number;
  ip?: string | null;
  userAgent?: string | null;
}

export const writeAudit = async (entry: AuditEntry): Promise<void> => {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: entry.adminId ?? null,
        adminEmail: entry.adminEmail ?? null,
        action: entry.action.slice(0, 200),
        method: entry.method,
        path: entry.path.slice(0, 500),
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        organizationId: entry.organizationId ?? null,
        reason: entry.reason ? String(entry.reason).slice(0, 1000) : null,
        requestBody: (entry.requestBody ?? undefined) as any,
        statusCode: entry.statusCode,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ? entry.userAgent.slice(0, 300) : null,
      },
    });
  } catch (err) {
    console.error('[adminAudit] write failed:', (err as Error)?.message);
  }
};

export const clientIp = (req: Request): string | null =>
  ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() || req.ip || null;

export const auditAdminActions = (req: Request, res: Response, next: NextFunction) => {
  if (!isAudited(req.method, req.originalUrl)) return next();

  res.on('finish', () => {
    const admin = (req as any).admin;
    const routePath: string = req.route?.path ?? req.path;
    const params = (req.params || {}) as Record<string, string>;
    const body = req.body;

    void writeAudit({
      adminId: admin?.id,
      adminEmail: admin?.email,
      action: `${req.method.toUpperCase()} ${routePath}`,
      method: req.method.toUpperCase(),
      path: req.originalUrl.split('?')[0],
      ...describeTarget(routePath, params, body),
      reason: typeof body?.reason === 'string' ? body.reason : null,
      requestBody: boundedBody(body),
      statusCode: res.statusCode,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] || null,
    });
  });

  next();
};

// ─── Reading ───────────────────────────────────────────────────────────────

export interface AuditQuery {
  page?: number;
  limit?: number;
  adminId?: string;
  targetType?: string;
  targetId?: string;
  organizationId?: string;
  action?: string;
  from?: string;
  to?: string;
}

export const listAuditLogs = async (q: AuditQuery) => {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));

  const where: any = {};
  if (q.adminId) where.adminId = q.adminId;
  if (q.targetType) where.targetType = q.targetType;
  if (q.targetId) where.targetId = q.targetId;
  if (q.organizationId) where.organizationId = q.organizationId;
  if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = new Date(q.from);
    if (q.to) where.createdAt.lte = new Date(q.to);
  }

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
};
