// src/modules/contacts/contacts.service.ts

import prisma from '../../config/database';
import { parse } from 'csv-parse/sync';
import { AppError } from '../../middleware/errorHandler';
import { ContactStatus, Prisma } from '@prisma/client';
import {
  CreateContactInput,
  UpdateContactInput,
  ImportContactsInput,
  BulkUpdateContactsInput,
  ContactsQueryInput,
  ContactResponse,
  ContactWithGroups,
  ContactsListResponse,
  ImportContactsResponse,
  ContactStats,
  CreateContactGroupInput,
  UpdateContactGroupInput,
  ContactGroupResponse,
} from './contacts.types';
import { automationEngine } from '../automation/automation.engine';

import { buildPhoneVariants, formatFullPhone, toCanonicalPhone } from '../../utils/phone';

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatContact = (contact: any): ContactResponse => ({
  id: contact.id,
  phone: contact.phone,
  countryCode: contact.countryCode,
  fullPhone: formatFullPhone(contact.countryCode, contact.phone),
  firstName: contact.firstName,
  lastName: contact.lastName,
  fullName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.phone,
  email: contact.email,
  avatar: contact.avatar,
  tags: contact.tags || [],
  customFields: contact.customFields || {},
  status: contact.status,
  source: contact.source,
  lastMessageAt: contact.lastMessageAt,
  messageCount: contact.messageCount,
  whatsappProfileFetched: contact.whatsappProfileFetched || false,
  lastProfileFetchAt: contact.lastProfileFetchAt,
  profileFetchAttempts: contact.profileFetchAttempts || 0,
  whatsappProfileName: contact.whatsappProfileName,
  whatsappAbout: contact.whatsappAbout,
  whatsappProfilePicUrl: contact.whatsappProfilePicUrl,
  createdAt: contact.createdAt,
  updatedAt: contact.updatedAt,
});

const formatContactWithGroups = (contact: any): ContactWithGroups => ({
  ...formatContact(contact),
  groups:
    contact.groupMemberships?.map((gm: any) => ({
      id: gm.group.id,
      name: gm.group.name,
      color: gm.group.color,
    })) || [],
});

const formatContactGroup = (group: any): ContactGroupResponse => ({
  id: group.id,
  name: group.name,
  description: group.description,
  color: group.color,
  contactCount: group._count?.members || 0,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
});

/**
 * Extract country code from canonical E.164 phone number
 * E.g. "+919876543210" → "+91"
 *      "+14155551234"  → "+1"
 *      "+447911123456" → "+44"
 */
const extractCountryCode = (canonical: string): string => {
  // canonical is always "+XXXXXXXXXXX" format
  // Try longest prefix match
  const digits = canonical.slice(1); // Remove leading +

  // Common country code lengths: 1, 2, 3 digits
  // Try 3-digit first (more specific), then 2, then 1
  const prefixes3 = ['971', '966', '965', '974', '973', '968', '967', '972',
    '351', '353', '354', '355', '356', '880', '977', '855', '856', '234',
    '233', '254', '255', '256', '257', '237', '213', '212', '216'];
  const prefixes2 = ['91', '92', '93', '94', '95', '98', '20', '27', '30',
    '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46',
    '47', '48', '49', '51', '52', '55', '56', '57', '60', '61', '62', '63',
    '64', '65', '66', '81', '82', '84', '86', '90', '54'];

  for (const p of prefixes3) {
    if (digits.startsWith(p)) return `+${p}`;
  }
  for (const p of prefixes2) {
    if (digits.startsWith(p)) return `+${p}`;
  }
  return '+1'; // US/Canada fallback
};

// ============================================
// CONTACTS SERVICE CLASS
// ============================================

export class ContactsService {

  // ==========================================
  // ✅ PHONE VALIDATION HELPERS (FIXED)
  // ==========================================

  /**
   * ✅ Validate and normalize phone (throws error if invalid)
   */
  private validateAndNormalizePhone(phone: string): string {
    const canonical = toCanonicalPhone(phone);
    if (!canonical) {
      throw new AppError(
        `Invalid phone number: "${phone}". Include country code (e.g., +919876543210)`,
        400
      );
    }
    return canonical; // Always returns +91XXXXXXXXXX
  }

  /**
   * ✅ Try to normalize phone - returns full number if valid, returns null if invalid.
   */
  private tryNormalizePhone(phone: any): string | null {
    if (!phone) return null;
    return toCanonicalPhone(String(phone).trim());
  }

  // ==========================================
  // WHATSAPP NAME FETCHING
  // ==========================================

  async updateContactFromWebhook(
    phone:          string,
    profileName:    string,
    organizationId: string
  ): Promise<ContactResponse | null> {
    try {
      const normalized = this.tryNormalizePhone(phone);
      if (!normalized) return null;

      const variants = buildPhoneVariants(phone);

      let contact = await prisma.contact.findFirst({
        where: {
          organizationId,
          OR: variants.map(p => ({ phone: p })),
        },
      });

      if (contact) {
        const shouldUpdate =
          !contact.firstName ||
          contact.firstName === 'Unknown' ||
          (profileName &&
            profileName !== 'Unknown' &&
            contact.firstName !== profileName);

        if (shouldUpdate) {
          try {
            contact = await prisma.contact.update({
              where: { id: contact.id },
              data: {
                firstName:              profileName,
                whatsappProfileName:    profileName,
                phone:                  normalized,
                whatsappProfileFetched: true,
                lastProfileFetchAt:     new Date(),
              },
            });
          } catch (e: any) {
            if (e.code === 'P2002') {
              contact = await prisma.contact.update({
                where: { id: contact.id },
                data: {
                  firstName:              profileName,
                  whatsappProfileName:    profileName,
                  whatsappProfileFetched: true,
                  lastProfileFetchAt:     new Date(),
                },
              });
            } else throw e;
          }
        }
      } else {
        // New contact from webhook
        contact = await prisma.contact.create({
          data: {
            organizationId,
            phone:                  normalized,
            countryCode:            extractCountryCode(normalized), // ✅ Fixed
            firstName:              profileName,
            whatsappProfileName:    profileName,
            source:                 'whatsapp',
            status:                 'ACTIVE',
            whatsappProfileFetched: true,
            lastProfileFetchAt:     new Date(),
          },
        });

        // ✅ FIX Bug6: Single optimized upsert instead of findFirst + update
        await prisma.subscription.updateMany({
          where: { organizationId },
          data:  { contactsUsed: { increment: 1 } },
        });
      }

      return formatContact(contact);
    } catch (error) {
      console.error('Error in updateContactFromWebhook:', error);
      return null;
    }
  }

  async refreshUnknownNames(organizationId: string): Promise<{
    total: number;
    updated: number;
    message: string;
  }> {
    const unknownContacts = await prisma.contact.findMany({
      where: {
        organizationId,
        OR: [
          { firstName: null },
          { firstName: 'Unknown' },
          { whatsappProfileFetched: false },
        ],
      },
      take: 100,
    });

    return {
      total: unknownContacts.length,
      updated: 0,
      message: 'Names will be updated automatically when contacts send messages',
    };
  }

  // ==========================================
  // CREATE CONTACT
  // ==========================================

  async create(organizationId: string, input: CreateContactInput): Promise<ContactResponse> {
    const canonical = toCanonicalPhone(input.phone);
    if (!canonical) throw new AppError('Invalid phone number', 400);
    
    const variants = buildPhoneVariants(canonical);

    const existing = await prisma.contact.findFirst({
      where: {
        organizationId,
        OR: variants.map((p) => ({ phone: p })),
      },
    });

    if (existing) {
      // ✅ Agar DELETED contact hai toh restore karo (re-add ho gaya)
      if (existing.status === 'DELETED') {
        const restored = await prisma.contact.update({
          where: { id: existing.id },
          data: {
            status: 'ACTIVE',
            deletedAt: null,
            deletedBy: null,
            firstName: input.firstName || existing.firstName || 'Unknown',
            lastName: input.lastName ?? existing.lastName,
            email: input.email ?? existing.email,
            tags: input.tags || existing.tags,
            customFields: (input.customFields || existing.customFields) as any,
            updatedAt: new Date(),
          },
        });

        console.log(`♻️ Restored deleted contact: ${existing.id}`);

        // Subscription count increment karo (re-add hua)
        const subscription = await prisma.subscription.findFirst({
          where: { organizationId },
        });
        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { contactsUsed: { increment: 1 } },
          });
        }

        return formatContact(restored);
      }

      throw new AppError('Contact with this phone number already exists', 409);
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { contacts: true } },
      },
    });

    if (org?.subscription?.plan) {
      if (org._count.contacts >= org.subscription.plan.maxContacts) {
        throw new AppError('Contact limit reached. Please upgrade your plan.', 400);
      }
    }

    // ✅ Extract country code from canonical
    const countryCode = canonical.length > 11 
      ? '+' + canonical.slice(1, -10)  // e.g., +91
      : '+91';

    const contact = await prisma.contact.create({
      data: {
        organizationId,
        phone: canonical,        // ✅ Always +91XXXXXXXXXX
        countryCode,             // ✅ Always +91
        firstName: input.firstName || 'Unknown',
        lastName: input.lastName,
        email: input.email,
        tags: input.tags || [],
        customFields: input.customFields || {},
        source: 'manual',
        whatsappProfileFetched: !!input.firstName,
        profileFetchAttempts: 0,
      },
    });
    
    // Trigger automation for new contact
    try {
      automationEngine.triggerNewContact({
        organizationId,
        contactId: contact.id,
        phone: contact.phone,
      });
    } catch (e) {
      console.error('Automation trigger error:', e);
    }

    if (input.groupIds && input.groupIds.length > 0) {
      await prisma.contactGroupMember.createMany({
        data: input.groupIds.map((groupId) => ({
          contactId: contact.id,
          groupId,
        })),
        skipDuplicates: true,
      });
    }

    if (org?.subscription) {
      await prisma.subscription.update({
        where: { id: org.subscription.id },
        data: { contactsUsed: { increment: 1 } },
      });
    }

    return formatContact(contact);
  }

  // ==========================================
  // GET CONTACTS LIST
  // ==========================================

  async getList(
    organizationId: string,
    query:          ContactsQueryInput
  ): Promise<ContactsListResponse> {
    const {
      page = 1, limit = 20, search, status, tags,
      groupId, sortBy = 'createdAt', sortOrder = 'desc',
      hasWhatsAppProfile,
    } = query;

    // ✅ FIX Bug5: Max 500 per page
    const safeLimit = Math.min(500, Math.max(1, limit));
    const skip      = (Math.max(1, page) - 1) * safeLimit;

    const where: Prisma.ContactWhereInput = {
      organizationId,
      status: { not: 'DELETED' },
    };

    if (search?.trim()) {
      where.OR = [
        { phone:     { contains: search.trim(), mode: 'insensitive' } },
        { firstName: { contains: search.trim(), mode: 'insensitive' } },
        { lastName:  { contains: search.trim(), mode: 'insensitive' } },
        { email:     { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (tags?.length) where.tags = { hasSome: tags };
    if (groupId) where.groupMemberships = { some: { groupId } };
    if (hasWhatsAppProfile !== undefined) {
      where.whatsappProfileFetched = hasWhatsAppProfile;
    }

    // ✅ Only allow safe sort fields
    const ALLOWED_SORT = ['createdAt', 'updatedAt', 'firstName', 'lastName', 'phone', 'lastMessageAt'];
    const safeSortBy   = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take:    safeLimit,
        orderBy: { [safeSortBy]: sortOrder },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts: contacts.map(formatContact),
      meta: {
        page:       Math.max(1, page),
        limit:      safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  // ==========================================
  // GET CONTACT BY ID
  // ==========================================

  async getById(organizationId: string, contactId: string): Promise<ContactWithGroups> {
    const contact = await prisma.contact.findFirst({
      where: { 
        id: contactId, 
        organizationId,
        status: { not: 'DELETED' }, // ✅ Deleted contact user ko nahi dikhao
      },
      include: {
        groupMemberships: {
          include: {
            group: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    if (!contact) throw new AppError('Contact not found', 404);
    return formatContactWithGroups(contact);
  }

  // ==========================================
  // UPDATE CONTACT
  // ==========================================

  async update(
    organizationId: string,
    contactId: string,
    input: UpdateContactInput
  ): Promise<ContactResponse> {
    const existing = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
    });

    if (!existing) throw new AppError('Contact not found', 404);

    let normalizedPhone: string | undefined;

    if (input.phone) {
      normalizedPhone = this.validateAndNormalizePhone(input.phone);
      const variants = buildPhoneVariants(input.phone);

      const duplicate = await prisma.contact.findFirst({
        where: {
          organizationId,
          id: { not: contactId },
          OR: variants.map((p) => ({ phone: p })),
        },
      });

      if (duplicate) {
        throw new AppError('Contact with this phone number already exists', 409);
      }
    }

    const updateData: any = {
      phone: normalizedPhone,
      countryCode: input.countryCode || '+91',
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      tags: input.tags,
      customFields: input.customFields,
      status: input.status,
    };

    if (input.firstName && input.firstName !== 'Unknown') {
      updateData.whatsappProfileFetched = true;
      updateData.lastProfileFetchAt = new Date();
    }

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
    });

    return formatContact(updated);
  }

  // ==========================================
  // DELETE CONTACT
  // ==========================================

  async delete(
    organizationId: string,
    contactId: string,
    userId?: string
  ): Promise<{ message: string }> {
    const contact = await prisma.contact.findFirst({
      where: { 
        id: contactId, 
        organizationId,
        status: { not: 'DELETED' }, // ✅ Already deleted contact ko prevent karo
      },
    });

    if (!contact) throw new AppError('Contact not found', 404);

    // ✅ Soft delete - sirf status change karo
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: userId || null,
      },
    });

    // Subscription count decrement karo (user ke liye limit calculation)
    const subscription = await prisma.subscription.findFirst({ where: { organizationId } });
    if (subscription && subscription.contactsUsed > 0) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { contactsUsed: { decrement: 1 } },
      });
    }

    console.log(`🗑️ Contact soft-deleted: ${contactId} by user ${userId}`);
    return { message: 'Contact deleted successfully' };
  }

  // ==========================================
  // ✅ IMPORT CONTACTS (COMPLETE FIX)
  // ==========================================

  async import(
    organizationId: string,
    input: ImportContactsInput & { groupName?: string; csvData?: string }
  ): Promise<ImportContactsResponse> {
    let { contacts, groupId, groupName, tags = [], skipDuplicates = true, csvData } = input;

    // ✅ PARSE CSV IF PROVIDED
    if (csvData && (!contacts || contacts.length === 0)) {
      try {
        contacts = this.parseCSV(csvData);
        console.log(`📊 Parsed ${contacts.length} contacts from CSV`);
      } catch (error: any) {
        console.error('CSV parsing error:', error);
        throw new AppError(`CSV parsing failed: ${error.message}`, 400);
      }
    }

    if (!contacts || contacts.length === 0) {
      throw new AppError('No valid contacts found in CSV. Please check the file format.', 400);
    }

    console.log(`📊 Starting import of ${contacts.length} contacts for org ${organizationId}`);

    // ✅ 1. RESOLVE TARGET GROUP
    let targetGroupId = groupId;

    if (!targetGroupId && groupName) {
      const existingGroup = await prisma.contactGroup.findUnique({
        where: { organizationId_name: { organizationId, name: groupName } },
      });

      if (existingGroup) {
        targetGroupId = existingGroup.id;
        console.log(`✅ Using existing group: ${groupName}`);
      } else {
        const newGroup = await prisma.contactGroup.create({
          data: {
            organizationId,
            name: groupName,
            description: 'Created via CSV Import',
            color: '#25D366',
          },
        });
        targetGroupId = newGroup.id;
        console.log(`✅ Created new group: ${groupName}`);
      }
    } else if (targetGroupId) {
      const group = await prisma.contactGroup.findFirst({
        where: { id: targetGroupId, organizationId },
      });
      if (!group) throw new AppError('Contact group not found', 404);
    }

    // ✅ 2. CHECK LIMITS
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { contacts: true } },
      },
    });

    const currentCount = org?._count.contacts || 0;
    const maxContacts = org?.subscription?.plan?.maxContacts || 999999;
    const planName = org?.subscription?.plan?.name?.toLowerCase() || 'free';

    // ✅ FREE PLAN RESTRICTIONS
    if (planName.includes('free') || planName.includes('trial')) {
      // Free users can only import 500 contacts at a time (Increased from 10)
      const FREE_IMPORT_LIMIT = 500;

      if (contacts.length > FREE_IMPORT_LIMIT) {
        throw new AppError(
          `Free plan allows maximum ${FREE_IMPORT_LIMIT} contacts per import. Upgrade to import more.`,
          403
        );
      }

      // Free users can only have 1000 total contacts (Increased from 50)
      if (currentCount >= 1000) {
        throw new AppError(
          'Free plan limit of 1000 contacts reached. Upgrade to add more contacts.',
          403
        );
      }
    }

    const availableSlots = Math.max(0, maxContacts - currentCount);

    if (availableSlots === 0) {
      throw new AppError('Contact limit reached. Please upgrade your plan.', 400);
    }

    console.log(`📊 Plan: ${planName}, Current: ${currentCount}/${maxContacts}, Available: ${availableSlots}`);

    // ✅ 3. PROCESS & VALIDATE CONTACTS
    const validContacts: any[] = [];
    const errors: Array<{ row: number; phone: string; error: string }> = [];
    const seenPhones = new Set<string>();

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i] as any;
      const rowNumber = i + 2; // +2 for header row and 0-index

      try {
        // Get phone from contact
        const rawPhone = c.phone || c.Phone || c.PHONE || c.mobile || c.Mobile || c.number || c.Number || '';

        if (!rawPhone || rawPhone.toString().trim() === '') {
          errors.push({
            row: rowNumber,
            phone: 'N/A',
            error: 'Phone number is missing',
          });
          continue;
        }

        // Normalize phone
        const normalized = this.tryNormalizePhone(rawPhone.toString().trim());

        if (!normalized) {
          errors.push({
            row: rowNumber,
            phone: rawPhone.toString(),
            error: 'Invalid phone number. Must include country code (e.g., +91, +1).',
          });
          continue;
        }

        // Skip duplicates within CSV
        if (seenPhones.has(normalized)) {
          errors.push({
            row: rowNumber,
            phone: rawPhone.toString(),
            error: 'Duplicate phone number in CSV',
          });
          continue;
        }

        seenPhones.add(normalized);

        // Get name
        const firstName = c.firstName || c.name || c.Name || c.NAME || c.first_name || c.FirstName || 'Unknown';
        const lastName = c.lastName || c.last_name || c.LastName || '';
        const email = c.email || c.Email || c.EMAIL || '';

        // Merge tags
        const contactTags = c.tags ? (Array.isArray(c.tags) ? c.tags : c.tags.split(',').map((t: string) => t.trim())) : [];
        const mergedTags = Array.from(new Set([...contactTags, ...tags]));

        validContacts.push({
          organizationId,
          phone: normalized,
          countryCode: extractCountryCode(normalized), // ✅ Fixed
          firstName: firstName.toString().trim() || 'Unknown',
          lastName: lastName.toString().trim() || null,
          email: email.toString().trim() || null,
          tags: mergedTags,
          customFields: c.customFields || {},
          status: 'ACTIVE' as ContactStatus,
          source: 'import',
          whatsappProfileFetched: false,
        });

      } catch (error: any) {
        errors.push({
          row: rowNumber,
          phone: c.phone || 'N/A',
          error: error.message || 'Unknown error',
        });
      }
    }

    console.log(`✅ Validated: ${validContacts.length} valid, ${errors.length} errors`);

    if (validContacts.length === 0) {
      return {
        imported: 0,
        skipped: 0,
        failed: errors.length,
        totalErrors: errors.length,     // ✅ Total count
        errors: errors.slice(0, 100),   // ✅ First 100 for display
      };
    }

    // ✅ 4. LIMIT TO AVAILABLE SLOTS
    const contactsToImport = validContacts.slice(0, availableSlots);

    if (validContacts.length > availableSlots) {
      console.warn(`⚠️ Limit exceeded: ${validContacts.length - availableSlots} contacts skipped`);
    }

    // ✅ Check for DELETED contacts and restore them
    const phonesToImport = contactsToImport.map(c => c.phone);
    const deletedContacts = await prisma.contact.findMany({
      where: {
        organizationId,
        phone: { in: phonesToImport },
        status: 'DELETED',
      },
      select: { id: true, phone: true },
    });

    let restoredCount = 0;
    if (deletedContacts.length > 0) {
      const restored = await prisma.contact.updateMany({
        where: {
          id: { in: deletedContacts.map(c => c.id) },
        },
        data: {
          status: 'ACTIVE',
          deletedAt: null,
          deletedBy: null,
          source: 'import',
        },
      });
      restoredCount = restored.count;
      console.log(`♻️ Restored ${restoredCount} previously deleted contacts`);
    }

    // ✅ 5. CREATE CONTACTS
    let imported = 0;
    let skipped = 0;

    try {
      const result = await prisma.contact.createMany({
        data: contactsToImport,
        skipDuplicates: true,
      });

      imported = result.count;
      skipped = contactsToImport.length - imported;

      console.log(`✅ Created ${imported} contacts, ${skipped} duplicates skipped`);

    } catch (error: any) {
      console.error('❌ Bulk insert failed:', error);
      throw new AppError(`Import failed: ${error.message}`, 500);
    }

    // ✅ 6. ADD TO GROUP
    let addedToGroup = 0;

    if (targetGroupId && contactsToImport.length > 0) {
      try {
        const phones = contactsToImport.map((c) => c.phone);

        const allContacts = await prisma.contact.findMany({
          where: { organizationId, phone: { in: phones } },
          select: { id: true },
        });

        if (allContacts.length > 0) {
          const groupMemberData = allContacts.map((ct) => ({
            groupId: targetGroupId!,
            contactId: ct.id,
          }));

          const groupResult = await prisma.contactGroupMember.createMany({
            data: groupMemberData,
            skipDuplicates: true,
          });

          addedToGroup = groupResult.count;
          console.log(`✅ Added ${addedToGroup} contacts to group`);
        }
      } catch (err: any) {
        console.error('❌ Failed to add contacts to group:', err);
      }
    }

    // ✅ 7. UPDATE SUBSCRIPTION
    if (org?.subscription && imported > 0) {
      await prisma.subscription.update({
        where: { id: org.subscription.id },
        data: { contactsUsed: { increment: imported } },
      });
    }

    return {
      imported,
      skipped,
      failed: errors.length,
      totalErrors: errors.length,     // ✅ Total count
      errors: errors.slice(0, 100),   // ✅ First 100 for display
    };
  }

  // ==========================================
  // ✅ CSV PARSER HELPER
  // ==========================================

  private parseCSV(csvData: string): any[] {
    try {
      // Clean BOM if present
      let cleanedData = csvData;
      if (cleanedData.charCodeAt(0) === 0xFEFF) {
        cleanedData = cleanedData.slice(1);
      }

      // Try parsing with csv-parse
      try {
        const records = parse(cleanedData, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
          relax_quotes: true,
        });

        if (records && records.length > 0) {
          console.log(`✅ Parsed ${records.length} records using csv-parse`);
          return records;
        }
      } catch (parseError) {
        console.log('csv-parse failed, trying manual parsing');
      }

      // Manual CSV parsing as fallback
      const lines = cleanedData.split(/\r?\n/).filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('CSV must have header row and at least one data row');
      }

      // Parse header
      const headerLine = lines[0];
      const headers = this.parseCSVLine(headerLine);

      console.log('CSV Headers:', headers);

      const contacts: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = this.parseCSVLine(line);
        const contact: any = {};

        headers.forEach((header, index) => {
          const key = header.trim().toLowerCase();
          const value = values[index]?.trim() || '';

          // Map common column names
          if (['phone', 'mobile', 'number', 'contact', 'whatsapp', 'phone_number', 'phonenumber', 'phone number', 'mob'].includes(key)) {
            contact.phone = value;
          } else if (['name', 'firstname', 'first_name', 'first name', 'full name', 'fullname', 'contact name'].includes(key)) {
            contact.firstName = value;
          } else if (['lastname', 'last_name', 'last name', 'surname'].includes(key)) {
            contact.lastName = value;
          } else if (['email', 'email_address', 'emailaddress'].includes(key)) {
            contact.email = value;
          } else if (['tags', 'tag', 'labels'].includes(key)) {
            contact.tags = value;
          } else {
            // Store as custom field
            if (!contact.customFields) contact.customFields = {};
            contact.customFields[header.trim()] = value;
          }
        });

        if (contact.phone) {
          contacts.push(contact);
        }
      }

      console.log(`✅ Manually parsed ${contacts.length} contacts`);
      return contacts;

    } catch (error: any) {
      console.error('CSV parsing error:', error);
      throw new Error(`Failed to parse CSV: ${error.message}`);
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  // ==========================================
  // BULK UPDATE CONTACTS
  // ==========================================

  async bulkUpdate(
    organizationId: string,
    input:          BulkUpdateContactsInput
  ): Promise<{ message: string; updated: number }> {
    const { contactIds, tags, groupIds, status } = input;

    // Verify all contacts belong to org
    const count = await prisma.contact.count({
      where: { id: { in: contactIds }, organizationId },
    });

    if (count !== contactIds.length) {
      throw new AppError('Some contacts not found or access denied', 400);
    }

    // ✅ FIX Bug4: Tags update - do it in batches, not N+1
    if (tags && tags.length > 0) {
      // Get existing tags for all contacts in one query
      const contacts = await prisma.contact.findMany({
        where:  { id: { in: contactIds }, organizationId },
        select: { id: true, tags: true },
      });

      // Batch update: group contacts with same resulting tags
      const BATCH = 50;
      for (let i = 0; i < contacts.length; i += BATCH) {
        const batch = contacts.slice(i, i + BATCH);
        await Promise.all(
          batch.map(c =>
            prisma.contact.update({
              where: { id: c.id },
              data:  { tags: [...new Set([...(c.tags || []), ...tags])] },
            })
          )
        );
      }
    }

    if (status) {
      await prisma.contact.updateMany({
        where: { id: { in: contactIds } },
        data:  { status },
      });
    }

    if (groupIds && groupIds.length > 0) {
      await prisma.contactGroupMember.createMany({
        data: contactIds.flatMap(contactId =>
          groupIds.map(groupId => ({ contactId, groupId }))
        ),
        skipDuplicates: true,
      });
    }

    return { message: 'Contacts updated successfully', updated: count };
  }

  // ==========================================
  // BULK DELETE CONTACTS
  // ==========================================

  async bulkDelete(
    organizationId: string,
    contactIds: string[],
    userId?: string
  ): Promise<{ message: string; deleted: number }> {
    // ✅ Soft delete: updateMany use karo
    const result = await prisma.contact.updateMany({
      where: { 
        id: { in: contactIds }, 
        organizationId,
        status: { not: 'DELETED' }, // Already deleted skip karo
      },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: userId || null,
      },
    });

    const subscription = await prisma.subscription.findFirst({ where: { organizationId } });

    if (subscription && result.count > 0) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          contactsUsed: { decrement: Math.min(result.count, subscription.contactsUsed) },
        },
      });
    }

    console.log(`🗑️ Bulk soft-deleted ${result.count} contacts`);
    return { message: 'Contacts deleted successfully', deleted: result.count };
  }

  // ==========================================
  // DELETE ALL CONTACTS
  // ==========================================

  async deleteAll(
    organizationId: string,
    userId?: string
  ): Promise<{ message: string; deleted: number }> {
    // ✅ Soft delete: updateMany use karo
    const result = await prisma.contact.updateMany({
      where: { 
        organizationId,
        status: { not: 'DELETED' },
      },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: userId || null,
      },
    });

    const subscription = await prisma.subscription.findFirst({ where: { organizationId } });

    if (subscription && result.count > 0) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          contactsUsed: { decrement: Math.min(result.count, subscription.contactsUsed) },
        },
      });
    }

    return { message: 'All contacts deleted successfully', deleted: result.count };
  }

  // ==========================================
  // GET CONTACT STATS
  // ==========================================

  async getStats(organizationId: string): Promise<ContactStats> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // ✅ Base filter: DELETED exclude
    const baseWhere = { organizationId, status: { not: 'DELETED' as ContactStatus } };

    const [total, active, blocked, unsubscribed, recentlyAdded, withMessages, whatsappVerified] =
      await Promise.all([
        prisma.contact.count({ where: baseWhere }),
        prisma.contact.count({ where: { organizationId, status: 'ACTIVE' } }),
        prisma.contact.count({ where: { organizationId, status: 'BLOCKED' } }),
        prisma.contact.count({ where: { organizationId, status: 'UNSUBSCRIBED' } }),
        prisma.contact.count({ where: { ...baseWhere, createdAt: { gte: sevenDaysAgo } } }),
        prisma.contact.count({ where: { ...baseWhere, messageCount: { gt: 0 } } }),
        prisma.contact.count({ where: { ...baseWhere, whatsappProfileFetched: true } }),
      ]);

    return {
      total,
      active,
      blocked,
      unsubscribed,
      recentlyAdded,
      withMessages,
      whatsappVerified,
    };
  }

  // ==========================================
  // GET ALL TAGS
  // ==========================================

  async getAllTags(organizationId: string): Promise<{ tag: string; count: number }[]> {
    const contacts = await prisma.contact.findMany({
      where: { 
        organizationId,
        status: { not: 'DELETED' }, // ✅ Deleted contacts ke tags nahi
      },
      select: { tags: true },
    });

    const tagCounts = new Map<string, number>();
    for (const contact of contacts) {
      for (const tag of contact.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ==========================================
  // EXPORT CONTACTS
  // ==========================================

  async export(organizationId: string, groupId?: string): Promise<any[]> {
    const where: Prisma.ContactWhereInput = { 
      organizationId,
      status: { not: 'DELETED' }, // ✅ User export mein deleted nahi dikhao
    };
    if (groupId) where.groupMemberships = { some: { groupId } };

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return contacts.map((contact) => ({
      phone: contact.phone,
      countryCode: contact.countryCode,
      fullPhone: formatFullPhone(contact.countryCode, contact.phone),
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email || '',
      tags: (contact.tags || []).join(', '),
      status: contact.status,
      source: contact.source || '',
      whatsappVerified: contact.whatsappProfileFetched ? 'Yes' : 'No',
      whatsappName: contact.whatsappProfileName || '',
      createdAt: contact.createdAt.toISOString(),
    }));
  }

  // ==========================================
  // CONTACT GROUPS (Unchanged)
  // ==========================================

  async createGroup(organizationId: string, input: CreateContactGroupInput): Promise<ContactGroupResponse> {
    const existing = await prisma.contactGroup.findUnique({
      where: { organizationId_name: { organizationId, name: input.name } },
    });

    if (existing) throw new AppError('Group with this name already exists', 409);

    const group = await prisma.contactGroup.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description,
        color: input.color || '#25D366',
      },
      include: { _count: { select: { members: true } } },
    });

    return formatContactGroup(group);
  }

  async getGroups(organizationId: string): Promise<ContactGroupResponse[]> {
    const groups = await prisma.contactGroup.findMany({
      where: { organizationId },
      include: { _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    });

    return groups.map(formatContactGroup);
  }

  async getGroupById(organizationId: string, groupId: string): Promise<ContactGroupResponse & { contacts: ContactResponse[] }> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
      include: {
        _count: { select: { members: true } },
        members: { include: { contact: true }, take: 100 },
      },
    });

    if (!group) throw new AppError('Group not found', 404);

    return {
      ...formatContactGroup(group),
      contacts: group.members.map((m) => formatContact(m.contact)),
    };
  }

  async updateGroup(organizationId: string, groupId: string, input: UpdateContactGroupInput): Promise<ContactGroupResponse> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });

    if (!group) throw new AppError('Group not found', 404);

    if (input.name && input.name !== group.name) {
      const existing = await prisma.contactGroup.findUnique({
        where: { organizationId_name: { organizationId, name: input.name } },
      });
      if (existing) throw new AppError('Group with this name already exists', 409);
    }

    const updated = await prisma.contactGroup.update({
      where: { id: groupId },
      data: {
        name: input.name,
        description: input.description,
        color: input.color,
      },
      include: { _count: { select: { members: true } } },
    });

    return formatContactGroup(updated);
  }

  async deleteGroup(
    organizationId: string,
    groupId:        string
  ): Promise<{ message: string }> {
    const group = await prisma.contactGroup.findFirst({
      where:   { id: groupId, organizationId },
      include: { _count: { select: { members: true } } },
    });

    if (!group) throw new AppError('Group not found', 404);

    const memberCount = group._count.members;

    // ✅ FIX Bug1: Only nullify campaigns + delete memberships
    // Do NOT delete contacts themselves
    await prisma.$transaction([
      // 1. Nullify campaigns using this group
      prisma.campaign.updateMany({
        where: { contactGroupId: groupId },
        data:  { contactGroupId: null },
      }),
      // 2. Delete group memberships
      prisma.contactGroupMember.deleteMany({
        where: { groupId },
      }),
      // 3. Delete the group
      prisma.contactGroup.delete({
        where: { id: groupId },
      }),
    ]);

    return {
      message: `Group "${group.name}" deleted. ${memberCount} contacts remain in your contacts list.`,
    };
  }

  async addContactsToGroup(organizationId: string, groupId: string, contactIds: string[]): Promise<{ message: string; added: number }> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });

    if (!group) throw new AppError('Group not found', 404);

    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds }, organizationId },
    });

    if (contacts.length === 0) throw new AppError('No valid contacts found', 400);

    const result = await prisma.contactGroupMember.createMany({
      data: contacts.map((contact) => ({ groupId, contactId: contact.id })),
      skipDuplicates: true,
    });

    return { message: 'Contacts added to group successfully', added: result.count };
  }

  async removeContactsFromGroup(organizationId: string, groupId: string, contactIds: string[]): Promise<{ message: string; removed: number }> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });

    if (!group) throw new AppError('Group not found', 404);

    const result = await prisma.contactGroupMember.deleteMany({
      where: { groupId, contactId: { in: contactIds } },
    });

    return { message: 'Contacts removed from group successfully', removed: result.count };
  }

  async getGroupContacts(organizationId: string, groupId: string, query: ContactsQueryInput): Promise<ContactsListResponse> {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });

    if (!group) throw new AppError('Group not found', 404);

    const where: Prisma.ContactWhereInput = {
      organizationId,
      groupMemberships: { some: { groupId } },
    };

    if (search) {
      where.OR = [
        { phone: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts: contacts.map(formatContact),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getImportStats(organizationId: string): Promise<{
    totalContacts: number;
    maxContacts: number;
    remainingSlots: number;
    planName: string;
    canImport: boolean;
    maxPerImport: number;
  }> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { contacts: true } },
      },
    });

    const totalContacts = org?._count.contacts || 0;
    const maxContacts = org?.subscription?.plan?.maxContacts || 1000;
    const planName = org?.subscription?.plan?.name || 'Free';
    const isFree = planName.toLowerCase().includes('free') || planName.toLowerCase().includes('trial');

    const remainingSlots = Math.max(0, maxContacts - totalContacts);
    const maxPerImport = isFree ? 500 : 10000;

    return {
      totalContacts,
      maxContacts,
      remainingSlots,
      planName,
      canImport: remainingSlots > 0,
      maxPerImport,
    };
  }
}

export const contactsService = new ContactsService();