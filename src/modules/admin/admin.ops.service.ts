// src/modules/admin/admin.ops.service.ts
//
// Day-to-day admin operations: internal notes and tags on organizations,
// announcements to customers, actions on many organizations at once, and
// CSV exports.

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { forceLogoutOrganization, setOrganizationStatus } from './admin.control.service';
import { OrgStatus } from './orgControl';

interface Actor {
  id: string;
  email?: string;
  name?: string;
}

// ─── Notes ─────────────────────────────────────────────────────────────────

export const listNotes = (organizationId: string) =>
  prisma.organizationNote.findMany({
    where: { organizationId },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });

export const addNote = async (organizationId: string, body: string, pinned: boolean, actor: Actor) => {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) throw new AppError('Organization not found', 404);

  const text = body.trim();
  if (!text) throw new AppError('Write something in the note.', 400);

  return prisma.organizationNote.create({
    data: { organizationId, body: text.slice(0, 5000), pinned, adminId: actor.id, adminEmail: actor.email },
  });
};

export const updateNote = async (organizationId: string, noteId: string, data: { pinned?: boolean }) => {
  const { count } = await prisma.organizationNote.updateMany({
    where: { id: noteId, organizationId },
    data: { ...(data.pinned !== undefined && { pinned: data.pinned }) },
  });
  if (count === 0) throw new AppError('Note not found', 404);
};

export const deleteNote = async (organizationId: string, noteId: string) => {
  const { count } = await prisma.organizationNote.deleteMany({ where: { id: noteId, organizationId } });
  if (count === 0) throw new AppError('Note not found', 404);
};

// ─── Tags ──────────────────────────────────────────────────────────────────

/** lower-case, "-" for spaces, only letters, digits and "-". */
export const normalizeTag = (raw: unknown): string =>
  String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 32);

export const cleanTags = (raw: unknown): string[] => {
  const list = Array.isArray(raw) ? raw : [];
  return [...new Set(list.map(normalizeTag).filter(Boolean))].slice(0, 20);
};

export const setOrganizationTags = async (organizationId: string, tags: unknown) => {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) throw new AppError('Organization not found', 404);

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: { adminTags: cleanTags(tags) },
    select: { id: true, adminTags: true },
  });
  return updated;
};

/** Every tag in use, with how many organizations carry it. */
export const listAllTags = async () => {
  const rows = await prisma.$queryRaw<{ tag: string; count: number }[]>`
    SELECT t AS tag, COUNT(*)::int AS count
    FROM "Organization", unnest("adminTags") AS t
    WHERE "deletedAt" IS NULL
    GROUP BY t ORDER BY count DESC, t ASC`;
  return rows;
};

// ─── Announcements ─────────────────────────────────────────────────────────

export type AnnouncementLevel = 'INFO' | 'WARNING' | 'CRITICAL';
export type AnnouncementAudience = 'ALL' | 'PLANS' | 'ORGS';

export interface AnnouncementInput {
  title?: string;
  message?: string;
  level?: AnnouncementLevel;
  audience?: AnnouncementAudience;
  planTypes?: string[];
  organizationIds?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
  notify?: boolean;
}

/** Does this announcement reach this organization? */
export const announcementTargets = (
  a: { audience: string; planTypes: string[]; organizationIds: string[] },
  org: { id: string; planType: string }
): boolean => {
  if (a.audience === 'ALL') return true;
  if (a.audience === 'PLANS') return a.planTypes.includes(org.planType);
  if (a.audience === 'ORGS') return a.organizationIds.includes(org.id);
  return false;
};

const liveWhere = (now = new Date()) => ({
  isActive: true,
  startsAt: { lte: now },
  OR: [{ endsAt: null }, { endsAt: { gt: now } }],
});

/** Announcements the customer app should show this organization right now. */
export const activeAnnouncementsFor = async (organizationId: string | undefined) => {
  const live = await prisma.announcement.findMany({
    where: liveWhere(),
    orderBy: { startsAt: 'desc' },
    take: 20,
    select: {
      id: true, title: true, message: true, level: true, audience: true,
      planTypes: true, organizationIds: true, startsAt: true, endsAt: true,
    },
  });
  if (live.length === 0) return [];

  const org = organizationId
    ? await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, planType: true } })
    : null;

  return live
    .filter((a) =>
      org ? announcementTargets(a, { id: org.id, planType: String(org.planType) }) : a.audience === 'ALL'
    )
    .map(({ id, title, message, level, startsAt, endsAt }) => ({ id, title, message, level, startsAt, endsAt }));
};

export const listAnnouncements = () =>
  prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });

const validateAnnouncement = (input: AnnouncementInput) => {
  const audience = input.audience ?? 'ALL';
  if (audience === 'PLANS' && !(input.planTypes?.length)) {
    throw new AppError('Pick at least one plan for this announcement.', 400);
  }
  if (audience === 'ORGS' && !(input.organizationIds?.length)) {
    throw new AppError('Pick at least one organization for this announcement.', 400);
  }
};

/**
 * Put an in-app notification in front of every member of every targeted
 * organization. Inserted in chunks; the in-app bell and the mobile app's
 * notification list both read these rows.
 */
const notifyMembers = async (announcement: {
  id: string; title: string; message: string; level: string;
  audience: string; planTypes: string[]; organizationIds: string[];
}): Promise<number> => {
  const orgWhere: any = { deletedAt: null };
  if (announcement.audience === 'PLANS') orgWhere.planType = { in: announcement.planTypes };
  if (announcement.audience === 'ORGS') orgWhere.id = { in: announcement.organizationIds };

  const members = await prisma.organizationMember.findMany({
    where: { organization: orgWhere },
    select: { userId: true, organizationId: true },
  });

  const rows = members.map((m) => ({
    userId: m.userId,
    organizationId: m.organizationId,
    type: announcement.level === 'INFO' ? 'system' : 'alert',
    title: announcement.title.slice(0, 200),
    description: announcement.message,
    metadata: { announcementId: announcement.id },
  }));

  for (let i = 0; i < rows.length; i += 500) {
    await prisma.notification.createMany({ data: rows.slice(i, i + 500) });
  }

  await prisma.announcement.update({ where: { id: announcement.id }, data: { notifiedAt: new Date() } });
  return rows.length;
};

export const createAnnouncement = async (input: AnnouncementInput, actor: Actor) => {
  if (!input.title?.trim() || !input.message?.trim()) {
    throw new AppError('An announcement needs a title and a message.', 400);
  }
  validateAnnouncement(input);

  const announcement = await prisma.announcement.create({
    data: {
      title: input.title.trim().slice(0, 200),
      message: input.message.trim().slice(0, 2000),
      level: input.level ?? 'INFO',
      audience: input.audience ?? 'ALL',
      planTypes: input.audience === 'PLANS' ? input.planTypes ?? [] : [],
      organizationIds: input.audience === 'ORGS' ? input.organizationIds ?? [] : [],
      startsAt: input.startsAt ? new Date(input.startsAt) : new Date(),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      isActive: input.isActive ?? true,
      createdBy: actor.email || actor.id,
    },
  });

  const notified = input.notify ? await notifyMembers(announcement) : 0;
  return { announcement, notified };
};

export const updateAnnouncement = async (id: string, input: AnnouncementInput) => {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw new AppError('Announcement not found', 404);
  validateAnnouncement({ ...existing, ...input } as AnnouncementInput);

  return prisma.announcement.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title.trim().slice(0, 200) }),
      ...(input.message !== undefined && { message: input.message.trim().slice(0, 2000) }),
      ...(input.level !== undefined && { level: input.level }),
      ...(input.audience !== undefined && { audience: input.audience }),
      ...(input.planTypes !== undefined && { planTypes: input.planTypes }),
      ...(input.organizationIds !== undefined && { organizationIds: input.organizationIds }),
      ...(input.startsAt !== undefined && { startsAt: input.startsAt ? new Date(input.startsAt) : new Date() }),
      ...(input.endsAt !== undefined && { endsAt: input.endsAt ? new Date(input.endsAt) : null }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
};

export const deleteAnnouncement = async (id: string) => {
  const { count } = await prisma.announcement.deleteMany({ where: { id } });
  if (count === 0) throw new AppError('Announcement not found', 404);
};

// ─── Bulk actions ──────────────────────────────────────────────────────────

export const BULK_MAX = 200;

export type BulkAction =
  | { action: 'extend'; days: number; reason?: string }
  | { action: 'status'; status: OrgStatus; reason?: string }
  | { action: 'tag_add'; tag: string }
  | { action: 'tag_remove'; tag: string }
  | { action: 'logout' }
  | { action: 'notify'; title: string; message: string };

/**
 * Run one action on many organizations, one at a time, and report each
 * result. A failure on one organization does not stop the rest.
 */
export const runBulkAction = async (organizationIds: string[], spec: BulkAction, actor: Actor) => {
  const ids = [...new Set(organizationIds)].slice(0, BULK_MAX);
  if (ids.length === 0) throw new AppError('Select at least one organization.', 400);

  if ((spec.action === 'tag_add' || spec.action === 'tag_remove') && !normalizeTag(spec.tag)) {
    throw new AppError('Enter a tag.', 400);
  }

  const results: { organizationId: string; ok: boolean; error?: string }[] = [];

  if (spec.action === 'notify') {
    const announcement = await createAnnouncement(
      { title: spec.title, message: spec.message, audience: 'ORGS', organizationIds: ids, notify: true },
      actor
    );
    return {
      total: ids.length,
      succeeded: ids.length,
      failed: 0,
      notified: announcement.notified,
      results: ids.map((id) => ({ organizationId: id, ok: true })),
    };
  }

  const { adminBillingService } = await import('./admin.billing.service');

  for (const organizationId of ids) {
    try {
      switch (spec.action) {
        case 'extend':
          await adminBillingService.extendSubscription({
            organizationId,
            additionalDays: spec.days,
            adminId: actor.id,
            adminName: actor.name || actor.email || 'Admin',
            reason: spec.reason || 'Bulk extension',
          });
          break;
        case 'status':
          await setOrganizationStatus(organizationId, spec.status, spec.reason, actor);
          break;
        case 'tag_add':
        case 'tag_remove': {
          const tag = normalizeTag(spec.tag);
          const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { adminTags: true },
          });
          if (!org) throw new AppError('Organization not found', 404);
          const next =
            spec.action === 'tag_add'
              ? cleanTags([...org.adminTags, tag])
              : org.adminTags.filter((t) => t !== tag);
          await prisma.organization.update({ where: { id: organizationId }, data: { adminTags: next } });
          break;
        }
        case 'logout':
          await forceLogoutOrganization(organizationId);
          break;
      }
      results.push({ organizationId, ok: true });
    } catch (err: any) {
      results.push({ organizationId, ok: false, error: err?.message || 'Failed' });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return { total: ids.length, succeeded, failed: ids.length - succeeded, results };
};

// ─── CSV export ────────────────────────────────────────────────────────────

/**
 * One CSV cell. Quoted when needed, and a leading = + - @ is neutralised so
 * a spreadsheet does not run a customer-supplied name as a formula.
 */
export const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.join(' ') : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (header: string[], rows: unknown[][]): string =>
  [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

const EXPORT_MAX = 20_000;

export const exportOrganizationsCsv = async (filter: { status?: string; tag?: string; planType?: string }) => {
  const where: any = { deletedAt: null };
  if (filter.status) where.status = filter.status;
  if (filter.planType) where.planType = filter.planType;
  if (filter.tag) where.adminTags = { has: normalizeTag(filter.tag) };

  const orgs = await prisma.organization.findMany({
    where,
    take: EXPORT_MAX,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, slug: true, planType: true, status: true, statusReason: true,
      adminTags: true, createdAt: true,
      owner: { select: { email: true, phone: true } },
      subscription: { select: { status: true, currentPeriodEnd: true, plan: { select: { name: true } } } },
      _count: { select: { members: true, contacts: true, whatsappAccounts: true } },
    },
  });

  return toCsv(
    ['id', 'name', 'slug', 'owner_email', 'owner_phone', 'plan', 'plan_type', 'subscription_status',
      'period_end', 'status', 'status_reason', 'tags', 'members', 'contacts', 'whatsapp_numbers', 'created_at'],
    orgs.map((o) => [
      o.id, o.name, o.slug, o.owner?.email, o.owner?.phone, o.subscription?.plan?.name, o.planType,
      o.subscription?.status, o.subscription?.currentPeriodEnd, o.status, o.statusReason, o.adminTags,
      o._count.members, o._count.contacts, o._count.whatsappAccounts, o.createdAt,
    ])
  );
};

export const exportUsersCsv = async (filter: { status?: string }) => {
  const users = await prisma.user.findMany({
    where: filter.status ? { status: filter.status as any } : {},
    take: EXPORT_MAX,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, firstName: true, lastName: true, phone: true, status: true,
      emailVerified: true, createdAt: true, lastLoginAt: true,
      memberships: { select: { role: true, organization: { select: { name: true } } } },
    },
  });

  return toCsv(
    ['id', 'email', 'first_name', 'last_name', 'phone', 'status', 'email_verified', 'organizations', 'created_at', 'last_login_at'],
    users.map((u) => [
      u.id, u.email, u.firstName, u.lastName, u.phone, u.status, u.emailVerified,
      u.memberships.map((m) => `${m.organization.name} (${m.role})`).join('; '),
      u.createdAt, u.lastLoginAt,
    ])
  );
};
