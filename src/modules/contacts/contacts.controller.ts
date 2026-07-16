// src/modules/contacts/contacts.controller.ts - FIXED
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/express';
import { contactsService } from './contacts.service';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { contactFeaturesService } from './contacts.features';
import { parseMultiplePhones, COUNTRY_CODES } from '../../utils/phoneInternational';
import {
  CreateContactInput, UpdateContactInput, ImportContactsInput,
  BulkUpdateContactsInput, ContactsQueryInput,
  CreateContactGroupInput, UpdateContactGroupInput,
} from './contacts.types';

// ─── CSV Injection Protection ─────────────────────────────────
// ✅ FIX Bug4: Escape values that could be formula injections
const escapeCsvValue = (value: string): string => {
  const str = String(value ?? '').replace(/"/g, '""');
  // Escape formula injection characters
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str}"`;
  }
  return `"${str}"`;
};

export class ContactsController {

  // ── CREATE ──────────────────────────────────────────────────
  async create(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const input: CreateContactInput = req.body;
      const contact = await contactsService.create(organizationId, input);

      sendSuccess(res, contact, 'Contact created successfully', 201);
    } catch (error) { next(error); }
  }

  // ── LIST ────────────────────────────────────────────────────
  async getList(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      // ✅ FIX Bug5: Validated bounds
      const rawPage = parseInt(req.query.page as string) || 1;
      const rawLimit = parseInt(req.query.limit as string) || 20;

      const query: ContactsQueryInput = {
        page: Math.max(1, rawPage),
        limit: Math.min(500, Math.max(1, rawLimit)), // ✅ Max 500
        search: (req.query.search as string)?.trim() || undefined,
        status: req.query.status as any,
        tags: req.query.tags
          ? (req.query.tags as string).split(',').filter(Boolean)
          : undefined,
        groupId: req.query.groupId as string || undefined,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
        hasWhatsAppProfile:
          req.query.hasWhatsAppProfile === 'true' ? true :
            req.query.hasWhatsAppProfile === 'false' ? false : undefined,
      };

      const result = await contactsService.getList(organizationId, query);
      res.json({
        success: true,
        message: 'Contacts fetched successfully',
        data: result.contacts,
        meta: result.meta,
      });
    } catch (error) { next(error); }
  }

  // ── GET BY ID ───────────────────────────────────────────────
  async getById(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const contact = await contactsService.getById(
        organizationId, req.params.id as string
      );
      sendSuccess(res, contact, 'Contact fetched successfully');
    } catch (error) { next(error); }
  }

  // ── UPDATE ──────────────────────────────────────────────────
  async update(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const input: UpdateContactInput = req.body;
      const contact = await contactsService.update(
        organizationId, req.params.id as string, input
      );
      sendSuccess(res, contact, 'Contact updated successfully');
    } catch (error) { next(error); }
  }

  // ── DELETE ──────────────────────────────────────────────────
  async delete(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const result = await contactsService.delete(
        organizationId, req.params.id as string, userId
      );
      sendSuccess(res, result, result.message);
    } catch (error) { next(error); }
  }

  // ── IMPORT ──────────────────────────────────────────────────
  // ✅ FIX Bug1: Clean separation of file/body parsing
  async import(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      // ✅ Build clean input object
      const input: any = {};

      // File upload (multer)
      const file = (req as any).file;
      if (file) {
        input.csvData = file.buffer.toString('utf-8');
      }

      // Raw CSV in body
      if (!input.csvData && req.body.csvData) {
        input.csvData = String(req.body.csvData);
      }

      // Contacts array
      if (Array.isArray(req.body.contacts)) {
        input.contacts = req.body.contacts;
      }

      // Tags
      if (req.body.tags) {
        if (Array.isArray(req.body.tags)) {
          input.tags = req.body.tags;
        } else if (typeof req.body.tags === 'string') {
          try {
            input.tags = JSON.parse(req.body.tags);
          } catch {
            input.tags = req.body.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
          }
        }
      } else {
        input.tags = [];
      }

      // Group
      if (req.body.groupId) input.groupId = String(req.body.groupId);
      if (req.body.groupName) input.groupName = String(req.body.groupName);

      if (!input.csvData && !input.contacts?.length) {
        throw new AppError('No contact data provided', 400);
      }

      const result = await contactsService.import(organizationId, input);

      const message = result.failed > 0
        ? `Imported ${result.imported} contacts. ${result.failed} failed.`
        : `Successfully imported ${result.imported} contacts.`;

      sendSuccess(res, result, message);
    } catch (error) { next(error); }
  }

  // ── BULK UPDATE ─────────────────────────────────────────────
  async bulkUpdate(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const input: BulkUpdateContactsInput = req.body;

      if (!Array.isArray(input.contactIds) || input.contactIds.length === 0) {
        throw new AppError('contactIds array required', 400);
      }

      const result = await contactsService.bulkUpdate(organizationId, input);
      sendSuccess(res, result, result.message);
    } catch (error) { next(error); }
  }

  // ── BULK DELETE ─────────────────────────────────────────────
  async bulkDelete(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { contactIds } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        throw new AppError('contactIds array required', 400);
      }

      const result = await contactsService.bulkDelete(
        organizationId, contactIds, userId
      );
      sendSuccess(res, result, result.message);
    } catch (error) { next(error); }
  }

  // ── DELETE ALL ──────────────────────────────────────────────
  async deleteAll(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const result = await contactsService.deleteAll(organizationId, userId);
      sendSuccess(res, result, result.message);
    } catch (error) { next(error); }
  }

  // ── STATS ───────────────────────────────────────────────────
  async getStats(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const stats = await contactsService.getStats(organizationId);
      sendSuccess(res, stats, 'Stats fetched successfully');
    } catch (error) { next(error); }
  }

  // ── TAGS ────────────────────────────────────────────────────
  async getTags(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const tags = await contactsService.getAllTags(organizationId);
      sendSuccess(res, tags, 'Tags fetched successfully');
    } catch (error) { next(error); }
  }

  // ── EXPORT ──────────────────────────────────────────────────
  async export(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { groupId } = req.query;
      const contacts = await contactsService.export(
        organizationId, groupId as string
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=contacts.csv'
      );

      if (contacts.length === 0) {
        res.send('No contacts found');
        return;
      }

      // ✅ FIX Bug4: CSV injection protection
      const headers = Object.keys(contacts[0]).join(',');
      const rows = contacts.map(contact =>
        Object.values(contact)
          .map(v => escapeCsvValue(String(v ?? '')))
          .join(',')
      );

      res.send([headers, ...rows].join('\n'));
    } catch (error) { next(error); }
  }

  // ── REFRESH UNKNOWN NAMES ───────────────────────────────────
  async refreshUnknownNames(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const result = await contactsService.refreshUnknownNames(organizationId);
      sendSuccess(res, result, result.message);
    } catch (error) { next(error); }
  }

  // ── GROUP CRUD ──────────────────────────────────────────────
  async createGroup(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const input: CreateContactGroupInput = req.body;
      if (!input.name?.trim()) {
        throw new AppError('Group name is required', 400);
      }

      const group = await contactsService.createGroup(organizationId, input);
      sendSuccess(res, group, 'Group created successfully', 201);
    } catch (error) { next(error); }
  }

  async getGroups(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const groups = await contactsService.getGroups(organizationId);
      sendSuccess(res, groups, 'Groups fetched successfully');
    } catch (error) { next(error); }
  }

  async getGroupById(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const group = await contactsService.getGroupById(
        organizationId, req.params.groupId as string
      );
      sendSuccess(res, group, 'Group fetched successfully');
    } catch (error) { next(error); }
  }

  async updateGroup(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const input: UpdateContactGroupInput = req.body;
      const group = await contactsService.updateGroup(
        organizationId, req.params.groupId as string, input
      );
      sendSuccess(res, group, 'Group updated successfully');
    } catch (error) { next(error); }
  }

  async deleteGroup(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const result = await contactsService.deleteGroup(
        organizationId, req.params.groupId as string
      );
      sendSuccess(res, result, result.message);
    } catch (error) { next(error); }
  }

  async addContactsToGroup(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { contactIds } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        throw new AppError('contactIds array required', 400);
      }

      const result = await contactsService.addContactsToGroup(
        organizationId, req.params.groupId as string, contactIds
      );
      sendSuccess(res, result, result.message);
    } catch (error) { next(error); }
  }

  async removeContactsFromGroup(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { contactIds } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        throw new AppError('contactIds array required', 400);
      }

      const result = await contactsService.removeContactsFromGroup(
        organizationId, req.params.groupId as string, contactIds
      );
      sendSuccess(res, result, result.message);
    } catch (error) { next(error); }
  }

  async getGroupContacts(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const rawPage = parseInt(req.query.page as string) || 1;
      const rawLimit = parseInt(req.query.limit as string) || 20;

      const query: ContactsQueryInput = {
        page: Math.max(1, rawPage),
        limit: Math.min(500, Math.max(1, rawLimit)),
        search: (req.query.search as string)?.trim() || undefined,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const result = await contactsService.getGroupContacts(
        organizationId, req.params.groupId as string, query
      );
      res.json({
        success: true,
        message: 'Group contacts fetched successfully',
        data: result.contacts,
        meta: result.meta,
      });
    } catch (error) { next(error); }
  }

  // ── FEATURE ACCESS ──────────────────────────────────────────
  async getFeatureAccess(
    req: AuthRequest, res: Response, next: NextFunction
  ) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization not found', 404);

      const access = await contactFeaturesService.getFeatureAccess(
        organizationId
      );
      return res.json({ success: true, data: access });
    } catch (error) { next(error); }
  }

  // ── COUNTRY CODES ───────────────────────────────────────────
  async getCountryCodes(req: AuthRequest, res: Response) {
    return res.json({ success: true, data: COUNTRY_CODES });
  }

  // ── SIMPLE BULK PASTE ───────────────────────────────────────
  async simpleBulkPaste(
    req: AuthRequest, res: Response, next: NextFunction
  ) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization not found', 404);

      await contactFeaturesService.validateAccess(
        organizationId, 'simpleBulkPaste'
      );

      const { phoneNumbers, tags = [], groupId } = req.body;

      if (!phoneNumbers || typeof phoneNumbers !== 'string') {
        throw new AppError('Phone numbers string required', 400);
      }

      const { valid, invalid } = parseMultiplePhones(phoneNumbers);

      if (valid.length === 0) {
        throw new AppError(
          'No valid phone numbers found. Include country code (e.g. +91, +1).',
          400
        );
      }

      const MAX_BULK = 5000;
      if (valid.length > MAX_BULK) {
        throw new AppError(`Maximum ${MAX_BULK} contacts per upload`, 400);
      }

      const phones = valid.map(p => p.fullNumber);

      // 1. Find existing (active + deleted)
      const existing = await prisma.contact.findMany({
        where: { organizationId, phone: { in: phones } },
        select: { id: true, phone: true, status: true },
      });

      const existingMap = new Map(existing.map(c => [c.phone, c]));

      const toRestore = existing
        .filter(c => c.status === 'DELETED')
        .map(c => c.id);
      const existingActive = new Set(
        existing.filter(c => c.status !== 'DELETED').map(c => c.phone)
      );
      const toCreate = valid.filter(
        p => !existingMap.has(p.fullNumber)
      );

      // 2. Restore deleted
      let restoredCount = 0;
      if (toRestore.length > 0) {
        const r = await prisma.contact.updateMany({
          where: { id: { in: toRestore } },
          data: { status: 'ACTIVE', deletedAt: null, deletedBy: null, source: 'BULK_PASTE' },
        });
        restoredCount = r.count;
      }

      // 3. Create new
      // ✅ FIX Bug3: Use 'Unknown' instead of generic "Contact N"
      let createdCount = 0;
      if (toCreate.length > 0) {
        const createData = toCreate.map(p => ({
          organizationId,
          phone: p.fullNumber,
          countryCode: p.countryCode || '+91',
          firstName: 'Unknown',          // ✅ WhatsApp name baad mein update karega
          tags: Array.isArray(tags) ? tags : [],
          source: 'BULK_PASTE',
          status: 'ACTIVE' as const,
        }));

        const r = await prisma.contact.createMany({
          data: createData,
          skipDuplicates: true,
        });
        createdCount = r.count;
      }

      // 4. Add to group if specified
      const total = createdCount + restoredCount;
      if (groupId && total > 0) {
        const processedPhones = [
          ...toCreate.map(p => p.fullNumber),
          ...existing.filter(c => c.status === 'DELETED').map(c => c.phone),
        ];

        const contactIds = await prisma.contact.findMany({
          where: { organizationId, phone: { in: processedPhones } },
          select: { id: true },
        });

        await prisma.contactGroupMember.createMany({
          data: contactIds.map(c => ({ groupId, contactId: c.id })),
          skipDuplicates: true,
        });
      }

      const message =
        createdCount > 0 && restoredCount > 0
          ? `${createdCount} created, ${restoredCount} restored`
          : createdCount > 0
            ? `${createdCount} contacts created`
            : restoredCount > 0
              ? `${restoredCount} contacts restored`
              : 'All contacts already exist';

      return res.json({
        success: true,
        data: {
          totalInput: valid.length + invalid.length,
          validNumbers: valid.length,
          invalidNumbers: invalid.length,
          created: total,
          newCreated: createdCount,
          restored: restoredCount,
          duplicatesSkipped: valid.length - total,
          invalidDetails: invalid.slice(0, 10),
        },
        message,
      });
    } catch (error) { next(error); }
  }

  // ── CSV UPLOAD ──────────────────────────────────────────────
  async csvUpload(
    req: AuthRequest, res: Response, next: NextFunction
  ) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization not found', 404);

      await contactFeaturesService.validateAccess(organizationId, 'csvUpload');

      const { contacts, groupId, tags = [] } = req.body;

      if (!Array.isArray(contacts) || contacts.length === 0) {
        throw new AppError('No contacts provided', 400);
      }

      const MAX_CSV = 10_000;
      if (contacts.length > MAX_CSV) {
        throw new AppError(`Maximum ${MAX_CSV} contacts per CSV upload`, 400);
      }

      const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

      // 1. Parse + validate phones
      const phoneToData = new Map<string, any>();
      const validPhones: string[] = [];

      for (const c of contacts) {
        const raw = String(
          c.phone || c.phoneNumber || c.mobile || ''
        ).trim();

        if (!raw) { results.skipped++; continue; }

        const { valid } = parseMultiplePhones(raw);
        if (!valid.length) {
          results.skipped++;
          results.errors.push(`Invalid: ${raw}`);
          continue;
        }

        const full = valid[0].fullNumber;
        if (!phoneToData.has(full)) validPhones.push(full);
        phoneToData.set(full, {
          ...c,
          fullNumber: full,
          countryCode: valid[0].countryCode,
        });
      }

      if (!validPhones.length) {
        return res.json({
          success: true,
          data: results,
          message: 'No valid contacts found',
        });
      }

      // 2. Fetch existing
      const existing = await prisma.contact.findMany({
        where: { organizationId, phone: { in: validPhones } },
        select: { id: true, phone: true, firstName: true, lastName: true, email: true },
      });
      const existingMap = new Map(existing.map(c => [c.phone, c]));

      const toCreate: any[] = [];
      const toUpdate: any[] = [];

      for (const [phone, data] of phoneToData) {
        const ex = existingMap.get(phone);
        if (ex) {
          toUpdate.push({
            id: ex.id,
            firstName: data.firstName || data.first_name || ex.firstName,
            lastName: data.lastName || data.last_name || ex.lastName,
            email: data.email || ex.email,
          });
        } else {
          toCreate.push({
            organizationId,
            phone,
            countryCode: data.countryCode || '+91',
            firstName: (data.firstName || data.first_name || 'Unknown').toString().trim(),
            lastName: (data.lastName || data.last_name || '').toString().trim() || undefined,
            email: (data.email || '').toString().trim() || undefined,
            tags: Array.isArray(tags) ? tags : [],
            source: 'CSV_IMPORT',
            status: 'ACTIVE' as const,
          });
        }
      }

      // 3. Bulk create
      if (toCreate.length > 0) {
        const r = await prisma.contact.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
        results.created = r.count;
      }

      // ✅ FIX Bug2: Sequential updates instead of parallel
      // Batch size of 25 to prevent DB overload
      if (toUpdate.length > 0) {
        const BATCH = 25;
        for (let i = 0; i < toUpdate.length; i += BATCH) {
          const batch = toUpdate.slice(i, i + BATCH);
          // Sequential in each batch
          for (const u of batch) {
            await prisma.contact.update({
              where: { id: u.id },
              data: {
                firstName: u.firstName,
                lastName: u.lastName || undefined,
                email: u.email || undefined,
                ...(tags.length > 0 ? { tags: { push: tags } } : {}),
              },
            }).catch(() => { results.errors.push(`Update failed: ${u.id}`); });
          }
        }
        results.updated = toUpdate.length;
      }

      // 4. Add to group
      if (groupId && (results.created > 0 || results.updated > 0)) {
        const allIds = await prisma.contact.findMany({
          where: { organizationId, phone: { in: validPhones } },
          select: { id: true },
        });

        await prisma.contactGroupMember.createMany({
          data: allIds.map(c => ({ groupId, contactId: c.id })),
          skipDuplicates: true,
        }).catch(() => { });
      }

      return res.json({
        success: true,
        data: {
          totalProcessed: contacts.length,
          created: results.created,
          updated: results.updated,
          skipped: results.skipped,
          errors: results.errors.slice(0, 10),
        },
        message: `${results.created} created, ${results.updated} updated`,
      });
    } catch (error) { next(error); }
  }

  // ── IMPORT STATS ────────────────────────────────────────────
  async getImportStats(
    req: AuthRequest, res: Response, next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const stats = await contactsService.getImportStats(organizationId);
      sendSuccess(res, stats, 'Import stats fetched successfully');
    } catch (error) { next(error); }
  }

  // ── GET AUDIENCE COUNT ───────────────────────────────────────
  async getAudienceCount(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { type, tags, groupId } = req.query;

      let count = 0;

      if (type === 'all') {
        count = await prisma.contact.count({
          where: {
            organizationId,
            status: 'ACTIVE',
          },
        });
      } else if (type === 'tags' && tags) {
        const tagArr = String(tags).split(',').filter(Boolean);
        if (tagArr.length > 0) {
          count = await prisma.contact.count({
            where: {
              organizationId,
              status: 'ACTIVE',
              tags: { hasSome: tagArr },
            },
          });
        }
      } else if (type === 'group' && groupId) {
        count = await prisma.contactGroupMember.count({
          where: {
            groupId: String(groupId),
            contact: {
              organizationId,
              status: 'ACTIVE',
            },
          },
        });
      }

      sendSuccess(res, { count }, 'Audience count fetched');
    } catch (error) {
      next(error);
    }
  }
}

export const contactsController = new ContactsController();