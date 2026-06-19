// src/modules/contacts/contacts.controller.ts

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/express';
import { contactsService } from './contacts.service';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { contactFeaturesService } from './contacts.features';
import { parseMultiplePhones, COUNTRY_CODES } from '../../utils/phoneInternational';
import {
  CreateContactInput,
  UpdateContactInput,
  ImportContactsInput,
  BulkUpdateContactsInput,
  ContactsQueryInput,
  CreateContactGroupInput,
  UpdateContactGroupInput,
} from './contacts.types';

export class ContactsController {

  // ==========================================
  // CREATE CONTACT
  // ==========================================
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input: CreateContactInput = req.body;
      const contact = await contactsService.create(organizationId, input);

      const message = contact.whatsappProfileFetched
        ? 'Contact created with provided name'
        : 'Contact created - name will update when they send a message';

      sendSuccess(res, contact, message, 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CONTACTS LIST
  // ==========================================
  async getList(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const query: ContactsQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search as string,
        status: req.query.status as any,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        groupId: req.query.groupId as string,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
        hasWhatsAppProfile: req.query.hasWhatsAppProfile === 'true' ? true :
          req.query.hasWhatsAppProfile === 'false' ? false : undefined,
      };

      const result = await contactsService.getList(organizationId, query);
      res.json({
        success: true,
        message: 'Contacts fetched successfully',
        data: result.contacts,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CONTACT BY ID
  // ==========================================
  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const contact = await contactsService.getById(organizationId, id);
      sendSuccess(res, contact, 'Contact fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE CONTACT
  // ==========================================
  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const input: UpdateContactInput = req.body;
      const contact = await contactsService.update(organizationId, id, input);
      sendSuccess(res, contact, 'Contact updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DELETE CONTACT
  // ==========================================
  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id; // ✅ NEW
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      const result = await contactsService.delete(organizationId, id, userId); // ✅ Pass userId
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // IMPORT CONTACTS (FIXED)
  // ==========================================
  async import(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      let input: ImportContactsInput & { csvData?: string; groupName?: string; groupId?: string } = req.body;

      // ✅ Handle file upload (multer)
      const file = (req as any).file;
      if (file) {
        const csvData = file.buffer.toString('utf-8');
        console.log(`📁 Received CSV file: ${file.originalname}, Size: ${file.size} bytes`);
        input.csvData = csvData;
      }

      // ✅ Handle raw CSV in body
      if (req.body.csvData && typeof req.body.csvData === 'string') {
        input.csvData = req.body.csvData;
      }

      // ✅ Handle contacts array directly
      if (req.body.contacts && Array.isArray(req.body.contacts)) {
        input.contacts = req.body.contacts;
      }

      // Get tags
      if (req.body.tags) {
        if (typeof req.body.tags === 'string') {
          try {
            input.tags = JSON.parse(req.body.tags);
          } catch {
            input.tags = req.body.tags.split(',').map((t: string) => t.trim());
          }
        } else if (Array.isArray(req.body.tags)) {
          input.tags = req.body.tags;
        }
      }

      // Get group info
      input.groupId = req.body.groupId;
      input.groupName = req.body.groupName;

      console.log('Import input:', {
        hasCSVData: !!input.csvData,
        csvLength: input.csvData?.length,
        contactsCount: input.contacts?.length,
        tags: input.tags,
        groupId: input.groupId,
        groupName: input.groupName,
      });

      const result = await contactsService.import(organizationId, input);

      const message = result.failed > 0
        ? `Imported ${result.imported} contacts. ${result.failed} failed (only Indian +91 numbers allowed).`
        : `Successfully imported ${result.imported} contacts.`;

      sendSuccess(res, result, message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // BULK UPDATE CONTACTS
  // ==========================================
  async bulkUpdate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input: BulkUpdateContactsInput = req.body;
      const result = await contactsService.bulkUpdate(organizationId, input);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // BULK DELETE CONTACTS
  // ==========================================
  async bulkDelete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id; // ✅ NEW
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { contactIds } = req.body;
      const result = await contactsService.bulkDelete(organizationId, contactIds, userId); // ✅
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DELETE ALL CONTACTS
  // ==========================================
  async deleteAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id; // ✅ NEW
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const result = await contactsService.deleteAll(organizationId, userId); // ✅
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CONTACT STATS
  // ==========================================
  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const stats = await contactsService.getStats(organizationId);
      sendSuccess(res, stats, 'Stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET ALL TAGS
  // ==========================================
  async getTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const tags = await contactsService.getAllTags(organizationId);
      sendSuccess(res, tags, 'Tags fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // EXPORT CONTACTS
  // ==========================================
  async export(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { groupId } = req.query;
      const contacts = await contactsService.export(organizationId, groupId as string);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');

      if (contacts.length === 0) {
        res.send('No contacts found');
        return;
      }

      const headers = Object.keys(contacts[0]).join(',');
      const rows = contacts.map((contact) =>
        Object.values(contact)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      );

      const csv = [headers, ...rows].join('\n');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // REFRESH UNKNOWN NAMES (NEW)
  // ==========================================
  async refreshUnknownNames(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const result = await contactsService.refreshUnknownNames(organizationId);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // CONTACT GROUPS
  // ==========================================

  async createGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input: CreateContactGroupInput = req.body;
      const group = await contactsService.createGroup(organizationId, input);
      sendSuccess(res, group, 'Group created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getGroups(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groups = await contactsService.getGroups(organizationId);
      sendSuccess(res, groups, 'Groups fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getGroupById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groupId = req.params.groupId as string;
      const group = await contactsService.getGroupById(organizationId, groupId);
      sendSuccess(res, group, 'Group fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groupId = req.params.groupId as string;
      const input: UpdateContactGroupInput = req.body;
      const group = await contactsService.updateGroup(organizationId, groupId, input);
      sendSuccess(res, group, 'Group updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groupId = req.params.groupId as string;
      const result = await contactsService.deleteGroup(organizationId, groupId);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async addContactsToGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groupId = req.params.groupId as string;
      const { contactIds } = req.body;
      const result = await contactsService.addContactsToGroup(organizationId, groupId, contactIds);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async removeContactsFromGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groupId = req.params.groupId as string;
      const { contactIds } = req.body;
      const result = await contactsService.removeContactsFromGroup(organizationId, groupId, contactIds);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async getGroupContacts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groupId = req.params.groupId as string;
      const query: ContactsQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search as string,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const result = await contactsService.getGroupContacts(organizationId, groupId, query);
      res.json({
        success: true,
        message: 'Group contacts fetched successfully',
        data: result.contacts,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // FEATURE ACCESS
  // ============================================

  async getFeatureAccess(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization not found', 404);
      }

      const access = await contactFeaturesService.getFeatureAccess(organizationId);

      return res.json({
        success: true,
        data: access
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET COUNTRY CODES
  // ============================================

  async getCountryCodes(req: AuthRequest, res: Response) {
    return res.json({
      success: true,
      data: COUNTRY_CODES
    });
  }

  // ============================================
  // SIMPLE BULK PASTE (₹2,500+ Plans)
  // ============================================

  async simpleBulkPaste(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization not found', 404);
      }

      // ✅ Check feature access (Quarterly+)
      await contactFeaturesService.validateAccess(organizationId, 'simpleBulkPaste');

      const {
        phoneNumbers,      // Raw string with numbers
        // ❌ No countryCode parameter - auto detect
        tags = [],
        groupId
      } = req.body;

      if (!phoneNumbers || typeof phoneNumbers !== 'string') {
        throw new AppError('Phone numbers are required', 400);
      }

      // ✅ Parse with auto-detection
      const { valid, invalid } = parseMultiplePhones(phoneNumbers);

      if (valid.length === 0) {
        throw new AppError('No valid phone numbers found. Make sure to include country code (e.g., +91, +1)', 400);
      }

      // ✅ Limit check
      const MAX_BULK = 5000;
      if (valid.length > MAX_BULK) {
        throw new AppError(`Maximum ${MAX_BULK} contacts per upload`, 400);
      }

      // ✅ Get existing contacts (check duplicates)
      const existingContacts = await prisma.contact.findMany({
        where: {
          organizationId,
          phone: { in: valid.map(p => p.fullNumber) }
        },
        select: { phone: true }
      });

      const existingPhones = new Set(existingContacts.map(c => c.phone));
      const newContacts = valid.filter(p => !existingPhones.has(p.fullNumber));

      // ✅ Create contacts
      const contactsToCreate = newContacts.map((parsed, index) => ({
        organizationId,
        phone: parsed.fullNumber,
        countryCode: parsed.countryCode,
        firstName: `Contact ${index + 1}`,
        tags: Array.isArray(tags) ? tags : [],
        source: 'BULK_PASTE',
        status: 'ACTIVE' as const
      }));

      let createdCount = 0;

      if (contactsToCreate.length > 0) {
        const result = await prisma.contact.createMany({
          data: contactsToCreate,
          skipDuplicates: true
        });
        createdCount = result.count;
      }

      // ✅ Add to group if specified
      if (groupId && createdCount > 0) {
        const newContactIds = await prisma.contact.findMany({
          where: {
            organizationId,
            phone: { in: newContacts.map(p => p.fullNumber) }
          },
          select: { id: true }
        });

        await prisma.contactGroupMember.createMany({
          data: newContactIds.map(c => ({
            groupId,
            contactId: c.id
          })),
          skipDuplicates: true
        });
      }

      return res.json({
        success: true,
        data: {
          totalInput: valid.length + invalid.length,
          validNumbers: valid.length,
          invalidNumbers: invalid.length,
          created: createdCount,
          duplicatesSkipped: valid.length - createdCount,
          invalidDetails: invalid.slice(0, 10) // Return first 10 invalid
        },
        message: `${createdCount} contacts created successfully`
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // CSV UPLOAD (₹899+ Plans)
  // ============================================

  async csvUpload(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization not found', 404);
      }

      // ✅ Check feature access (Monthly+)
      await contactFeaturesService.validateAccess(organizationId, 'csvUpload');

      const {
        contacts,           // Array of contact objects from CSV
        groupId,
        tags = []
      } = req.body;

      if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
        throw new AppError('No contacts provided', 400);
      }

      // ✅ Limit check
      const MAX_CSV = 10000;
      if (contacts.length > MAX_CSV) {
        throw new AppError(`Maximum ${MAX_CSV} contacts per CSV upload`, 400);
      }

      const results = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[]
      };

      // 1. Pre-process and validate phone numbers
      const phoneToContactMap = new Map<string, any>();
      const validPhones: string[] = [];

      for (const contact of contacts) {
        const phoneInput = contact.phone || contact.phoneNumber || contact.mobile;
        if (!phoneInput) {
          results.skipped++;
          continue;
        }

        const { valid } = parseMultiplePhones(String(phoneInput));
        if (valid.length === 0) {
          results.skipped++;
          results.errors.push(`Invalid: ${phoneInput}`);
          continue;
        }

        const parsed = valid[0];
        // If multiple contacts have the same phone in the same CSV, last one wins or we can handle it
        if (!phoneToContactMap.has(parsed.fullNumber)) {
          validPhones.push(parsed.fullNumber);
        }
        phoneToContactMap.set(parsed.fullNumber, {
          ...contact,
          fullNumber: parsed.fullNumber,
          countryCode: parsed.countryCode
        });
      }

      if (validPhones.length === 0) {
        return res.json({
          success: true,
          data: results,
          message: 'No valid contacts found to process'
        });
      }

      // 2. Fetch existing contacts in one query
      const existingContacts = await prisma.contact.findMany({
        where: {
          organizationId,
          phone: { in: validPhones }
        },
        select: { id: true, phone: true, firstName: true, lastName: true, email: true }
      });

      const existingPhoneMap = new Map(existingContacts.map(c => [c.phone, c]));
      const news: any[] = [];
      const updates: any[] = [];

      // 3. Categorize into news and updates
      for (const [fullPhone, contactData] of phoneToContactMap.entries()) {
        const existing = existingPhoneMap.get(fullPhone);
        if (existing) {
          updates.push({
            id: existing.id,
            data: {
              firstName: contactData.firstName || contactData.first_name || existing.firstName,
              lastName: contactData.lastName || contactData.last_name || existing.lastName,
              email: contactData.email || existing.email,
              tags: Array.isArray(tags) && tags.length > 0 ? { push: tags } : undefined
            }
          });
        } else {
          news.push({
            organizationId,
            phone: fullPhone,
            countryCode: contactData.countryCode,
            firstName: contactData.firstName || contactData.first_name || 'Unknown',
            lastName: contactData.lastName || contactData.last_name || undefined,
            email: contactData.email || undefined,
            tags: tags,
            source: 'CSV_IMPORT',
            status: 'ACTIVE'
          });
        }
      }

      // 4. Bulk Create
      if (news.length > 0) {
        const createResult = await prisma.contact.createMany({
          data: news,
          skipDuplicates: true
        });
        results.created = createResult.count;
      }

      // 5. Sequential or Batched Updates (Prisma doesn't have bulk unique update)
      // We'll do them in small batches or Promise.all to speed up, 
      // but for very large numbers we still need to be careful.
      // 50-100 updates at a time is usually fine.
      if (updates.length > 0) {
        const updateBatchSize = 100;
        for (let i = 0; i < updates.length; i += updateBatchSize) {
          const batch = updates.slice(i, i + updateBatchSize);
          await Promise.all(batch.map(u => 
            prisma.contact.update({
              where: { id: u.id },
              data: u.data
            }).catch(err => {
              results.errors.push(`Update failed for ${u.id}: ${err.message}`);
            })
          ));
        }
        results.updated = updates.length;
      }

      // 6. Bulk Add to Group if specified
      if (groupId && (results.created > 0 || results.updated > 0)) {
        // Fetch fresh IDs for new contacts
        const allTargetContactIds = await prisma.contact.findMany({
          where: {
            organizationId,
            phone: { in: validPhones }
          },
          select: { id: true }
        });

        const memberData = allTargetContactIds.map(c => ({
          groupId,
          contactId: c.id
        }));

        await prisma.contactGroupMember.createMany({
          data: memberData,
          skipDuplicates: true
        }).catch(() => {});
      }

      return res.json({
        success: true,
        data: {
          totalProcessed: contacts.length,
          created: results.created,
          updated: results.updated,
          skipped: results.skipped,
          errors: results.errors.slice(0, 10)
        },
        message: `${results.created} created, ${results.updated} updated`
      });

    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET IMPORT STATS
  // ==========================================
  async getImportStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const stats = await contactsService.getImportStats(organizationId);
      sendSuccess(res, stats, 'Import stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const contactsController = new ContactsController();