// src/modules/contacts/contacts.service.ts - FINAL FIXED

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
import {
  buildPhoneVariants,
  formatFullPhone,
  toCanonicalPhone,
  extractCountryCode,
} from '../../utils/phone';

// ─── Formatters ───────────────────────────────────────────────

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
  groups: contact.groupMemberships?.map((gm: any) => ({
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

// ─── Service ──────────────────────────────────────────────────

export class ContactsService {

  // ── Phone helpers ────────────────────────────────────────

  private validateAndNormalizePhone(phone: string): string {
    const canonical = toCanonicalPhone(phone);
    if (!canonical) {
      throw new AppError(
        `Invalid phone number: "${phone}". Include country code (e.g., +919876543210)`,
        400
      );
    }
    return canonical;
  }

  private tryNormalizePhone(phone: any): string | null {
    if (!phone) return null;
    return toCanonicalPhone(String(phone).trim());
  }

  // ── Webhook contact update ───────────────────────────────

  async updateContactFromWebhook(
    phone: string,
    profileName: string,
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
        const hasGoodName = profileName && profileName !== 'Unknown';
        const isUnknown =
          !contact.firstName ||
          contact.firstName === 'Unknown' ||
          contact.firstName === '';

        if (hasGoodName && (contact.firstName !== profileName || isUnknown)) {
          try {
            contact = await prisma.contact.update({
              where: { id: contact.id },
              data: {
                firstName: profileName,
                whatsappProfileName: profileName,
                whatsappProfileFetched: true,
                lastProfileFetchAt: new Date(),
                // ✅ Normalize phone if old format
                ...(contact.phone !== normalized ? { phone: normalized } : {}),
              },
            });
          } catch (e: any) {
            if (e.code === 'P2002') {
              contact = await prisma.contact.update({
                where: { id: contact.id },
                data: {
                  firstName: profileName,
                  whatsappProfileName: profileName,
                  whatsappProfileFetched: true,
                  lastProfileFetchAt: new Date(),
                },
              });
            } else throw e;
          }
        }
        return formatContact(contact);
      }

      // New contact - upsert
      try {
        contact = await prisma.contact.upsert({
          where: {
            organizationId_phone: { organizationId, phone: normalized },
          },
          create: {
            organizationId,
            phone: normalized,
            countryCode: extractCountryCode(normalized),
            firstName: profileName || 'Unknown',
            whatsappProfileName: profileName || null,
            source: 'whatsapp',
            status: 'ACTIVE',
            whatsappProfileFetched: !!(profileName && profileName !== 'Unknown'),
            lastProfileFetchAt: new Date(),
          },
          update: {
            ...(profileName && profileName !== 'Unknown'
              ? {
                firstName: profileName,
                whatsappProfileName: profileName,
                whatsappProfileFetched: true,
                lastProfileFetchAt: new Date(),
              }
              : {}),
          },
        });

        const createdMsAgo = Date.now() - new Date(contact.createdAt).getTime();
        if (createdMsAgo < 5000) {
          prisma.subscription.updateMany({
            where: { organizationId },
            data: { contactsUsed: { increment: 1 } },
          }).catch((e: any) => console.error('Subscription update error:', e.message));
        }

        return formatContact(contact);
      } catch (e: any) {
        if (e.code === 'P2002') {
          const fallback = await prisma.contact.findFirst({
            where: {
              organizationId,
              OR: variants.map(p => ({ phone: p })),
            },
          });
          return fallback ? formatContact(fallback) : null;
        }
        throw e;
      }
    } catch (error) {
      console.error('Error in updateContactFromWebhook:', error);
      return null;
    }
  }

  async refreshUnknownNames(organizationId: string) {
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

  // ── CREATE ───────────────────────────────────────────────

  async create(
    organizationId: string,
    input: CreateContactInput
  ): Promise<ContactResponse> {
    const canonical = toCanonicalPhone(input.phone);
    if (!canonical) throw new AppError('Invalid phone number', 400);

    const variants = buildPhoneVariants(canonical);

    const existing = await prisma.contact.findFirst({
      where: {
        organizationId,
        OR: variants.map(p => ({ phone: p })),
      },
    });

    if (existing) {
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

    const contact = await prisma.contact.create({
      data: {
        organizationId,
        phone: canonical,
        countryCode: extractCountryCode(canonical), // ✅ FIX Bug#1
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

    try {
      automationEngine.triggerNewContact({
        organizationId,
        contactId: contact.id,
        phone: contact.phone,
      });
    } catch (e) {
      console.error('Automation trigger error:', e);
    }

    if (input.groupIds?.length) {
      await prisma.contactGroupMember.createMany({
        data: input.groupIds.map(groupId => ({
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

  // ── GET LIST ─────────────────────────────────────────────

  async getList(
    organizationId: string,
    query: ContactsQueryInput
  ): Promise<ContactsListResponse> {
    const {
      page = 1, limit = 20, search, status, tags,
      groupId, sortBy = 'createdAt', sortOrder = 'desc',
      hasWhatsAppProfile,
    } = query;

    const safeLimit = Math.min(500, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * safeLimit;

    const where: Prisma.ContactWhereInput = {
      organizationId,
      status: { not: 'DELETED' },
    };

    if (search?.trim()) {
      where.OR = [
        { phone: { contains: search.trim(), mode: 'insensitive' } },
        { firstName: { contains: search.trim(), mode: 'insensitive' } },
        { lastName: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (tags?.length) where.tags = { hasSome: tags };
    if (groupId) where.groupMemberships = { some: { groupId } };
    if (hasWhatsAppProfile !== undefined) {
      where.whatsappProfileFetched = hasWhatsAppProfile;
    }

    const ALLOWED_SORT = [
      'createdAt', 'updatedAt', 'firstName',
      'lastName', 'phone', 'lastMessageAt',
    ];
    const safeSortBy = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { [safeSortBy]: sortOrder },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts: contacts.map(formatContact),
      meta: {
        page: Math.max(1, page),
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  // ── GET BY ID ────────────────────────────────────────────

  async getById(
    organizationId: string,
    contactId: string
  ): Promise<ContactWithGroups> {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        organizationId,
        status: { not: 'DELETED' },
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

  // ── UPDATE ───────────────────────────────────────────────

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
      const variants = buildPhoneVariants(normalizedPhone);

      const duplicate = await prisma.contact.findFirst({
        where: {
          organizationId,
          id: { not: contactId },
          OR: variants.map(p => ({ phone: p })),
        },
      });
      if (duplicate) {
        throw new AppError('Contact with this phone number already exists', 409);
      }
    }

    // ✅ FIX Bug#2: extractCountryCode use karo, hardcode nahi
    const resolvedCountryCode = normalizedPhone
      ? extractCountryCode(normalizedPhone)
      : (input.countryCode || extractCountryCode(existing.phone));

    const updateData: any = {
      ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      countryCode: resolvedCountryCode,
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.tags ? { tags: input.tags } : {}),
      ...(input.customFields ? { customFields: input.customFields } : {}),
      ...(input.status ? { status: input.status } : {}),
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

  // ── DELETE ───────────────────────────────────────────────

  async delete(
    organizationId: string,
    contactId: string,
    userId?: string
  ): Promise<{ message: string }> {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        organizationId,
        status: { not: 'DELETED' },
      },
    });
    if (!contact) throw new AppError('Contact not found', 404);

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: userId || null,
      },
    });

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
    });
    if (subscription && subscription.contactsUsed > 0) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { contactsUsed: { decrement: 1 } },
      });
    }

    return { message: 'Contact deleted successfully' };
  }

  // ── IMPORT ───────────────────────────────────────────────

  async import(
    organizationId: string,
    input: ImportContactsInput & { groupName?: string; csvData?: string }
  ): Promise<ImportContactsResponse> {
    let { contacts, groupId, groupName, tags = [], csvData } = input;

    // Parse CSV if provided
    if (csvData && (!contacts || contacts.length === 0)) {
      try {
        contacts = this.parseCSV(csvData);
      } catch (error: any) {
        throw new AppError(`CSV parsing failed: ${error.message}`, 400);
      }
    }

    if (!contacts || contacts.length === 0) {
      throw new AppError('No valid contacts found. Check file format.', 400);
    }

    // ── Resolve group ──────────────────────────────────────
    let targetGroupId = groupId;

    if (!targetGroupId && groupName) {
      const existingGroup = await prisma.contactGroup.findUnique({
        where: { organizationId_name: { organizationId, name: groupName } },
      });

      targetGroupId = existingGroup?.id || (
        await prisma.contactGroup.create({
          data: {
            organizationId,
            name: groupName,
            description: 'Created via CSV Import',
            color: '#25D366',
          },
        })
      ).id;

    } else if (targetGroupId) {
      const group = await prisma.contactGroup.findFirst({
        where: { id: targetGroupId, organizationId },
      });
      if (!group) throw new AppError('Contact group not found', 404);
    }

    // ── Check limits ───────────────────────────────────────
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
    const isFree = planName.includes('free') || planName.includes('trial');

    if (isFree) {
      if (contacts.length > 500) {
        throw new AppError(
          'Free plan allows max 500 contacts per import. Upgrade to import more.',
          403
        );
      }
      if (currentCount >= 1000) {
        throw new AppError(
          'Free plan limit of 1000 contacts reached. Upgrade to add more.',
          403
        );
      }
    }

    const availableSlots = Math.max(0, maxContacts - currentCount);
    if (availableSlots === 0) {
      throw new AppError('Contact limit reached. Please upgrade your plan.', 400);
    }

    // ── Validate contacts ──────────────────────────────────
    const validContacts: any[] = [];
    const errors: Array<{ row: number; phone: string; error: string }> = [];
    const seenPhones = new Set<string>();

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i] as any;
      const rowNumber = i + 2;

      try {
        const rawPhone = String(
          c.phone || c.Phone || c.PHONE ||
          c.mobile || c.Mobile ||
          c.number || c.Number || ''
        ).trim();

        if (!rawPhone) {
          errors.push({ row: rowNumber, phone: 'N/A', error: 'Phone number is missing' });
          continue;
        }

        const normalized = this.tryNormalizePhone(rawPhone);
        if (!normalized) {
          errors.push({
            row: rowNumber, phone: rawPhone,
            error: 'Invalid phone. Include country code (e.g., +91, +1).',
          });
          continue;
        }

        if (seenPhones.has(normalized)) {
          errors.push({
            row: rowNumber, phone: rawPhone,
            error: 'Duplicate phone number in CSV',
          });
          continue;
        }
        seenPhones.add(normalized);

        const firstName = String(c.firstName || c.name || c.Name || c.first_name || 'Unknown').trim();
        const lastName = String(c.lastName || c.last_name || '').trim();
        const email = String(c.email || c.Email || '').trim();
        const contactTags = c.tags
          ? (Array.isArray(c.tags) ? c.tags : String(c.tags).split(',').map((t: string) => t.trim()))
          : [];
        const mergedTags = Array.from(new Set([...contactTags, ...(tags as string[])]));

        validContacts.push({
          organizationId,
          phone: normalized,
          countryCode: extractCountryCode(normalized),
          firstName: firstName || 'Unknown',
          lastName: lastName || null,
          email: email || null,
          tags: mergedTags,
          customFields: c.customFields || {},
          status: 'ACTIVE' as ContactStatus,
          source: 'import',
          whatsappProfileFetched: false,
        });
      } catch (error: any) {
        errors.push({
          row: rowNumber, phone: c.phone || 'N/A',
          error: error.message || 'Unknown error',
        });
      }
    }

    if (validContacts.length === 0) {
      return {
        imported: 0, skipped: 0, failed: errors.length,
        totalErrors: errors.length,
        errors: errors.slice(0, 100),
      };
    }

    const contactsToImport = validContacts.slice(0, availableSlots);

    // ✅ FIX Bug#3: Restore deleted - ALL VARIANTS check
    const allVariants = contactsToImport.flatMap(c => buildPhoneVariants(c.phone));
    const deletedContacts = await prisma.contact.findMany({
      where: {
        organizationId,
        phone: { in: allVariants },
        status: 'DELETED',
      },
      select: { id: true, phone: true },
    });

    let restoredCount = 0;
    if (deletedContacts.length > 0) {
      const r = await prisma.contact.updateMany({
        where: { id: { in: deletedContacts.map(c => c.id) } },
        data: {
          status: 'ACTIVE',
          deletedAt: null,
          deletedBy: null,
          source: 'import',
        },
      });
      restoredCount = r.count;
    }

    // Create new contacts
    let imported = 0;
    let skipped = 0;

    try {
      const r = await prisma.contact.createMany({
        data: contactsToImport,
        skipDuplicates: true,
      });
      imported = r.count;
      skipped = contactsToImport.length - imported - restoredCount;
    } catch (error: any) {
      throw new AppError(`Import failed: ${error.message}`, 500);
    }

    // Add to group
    if (targetGroupId && contactsToImport.length > 0) {
      try {
        const phones = contactsToImport.map(c => c.phone);
        const allContacts = await prisma.contact.findMany({
          where: { organizationId, phone: { in: phones } },
          select: { id: true },
        });

        if (allContacts.length > 0) {
          await prisma.contactGroupMember.createMany({
            data: allContacts.map(ct => ({
              groupId: targetGroupId!,
              contactId: ct.id,
            })),
            skipDuplicates: true,
          });
        }
      } catch (err: any) {
        console.error('Failed to add contacts to group:', err);
      }
    }

    // Update subscription
    const totalAdded = imported + restoredCount;
    if (org?.subscription && totalAdded > 0) {
      await prisma.subscription.update({
        where: { id: org.subscription.id },
        data: { contactsUsed: { increment: totalAdded } },
      });
    }

    // ✅ FIX Bug#5: Return restored count bhi
    return {
      imported: totalAdded,        // Naye + restored
      skipped: Math.max(0, skipped),
      failed: errors.length,
      totalErrors: errors.length,
      errors: errors.slice(0, 100),
      ...(restoredCount > 0 ? { restored: restoredCount } : {}),
    };
  }

  // ── CSV Parser ───────────────────────────────────────────

  private parseCSV(csvData: string): any[] {
    try {
      let cleanedData = csvData;
      if (cleanedData.charCodeAt(0) === 0xFEFF) {
        cleanedData = cleanedData.slice(1);
      }

      try {
        const records = parse(cleanedData, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
          relax_quotes: true,
        });
        if (records?.length > 0) return records;
      } catch {
        // fallback to manual
      }

      const lines = cleanedData.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        throw new Error('CSV must have header row and at least one data row');
      }

      const headers = this.parseCSVLine(lines[0]);
      const contacts: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = this.parseCSVLine(line);
        const contact: any = {};

        headers.forEach((header, index) => {
          const key = header.trim().toLowerCase();
          const value = values[index]?.trim() || '';

          if (['phone', 'mobile', 'number', 'contact', 'whatsapp',
            'phone_number', 'phonenumber', 'phone number', 'mob'].includes(key)) {
            contact.phone = value;
          } else if (['name', 'firstname', 'first_name', 'first name',
            'full name', 'fullname', 'contact name'].includes(key)) {
            contact.firstName = value;
          } else if (['lastname', 'last_name', 'last name', 'surname'].includes(key)) {
            contact.lastName = value;
          } else if (['email', 'email_address', 'emailaddress'].includes(key)) {
            contact.email = value;
          } else if (['tags', 'tag', 'labels'].includes(key)) {
            contact.tags = value;
          } else {
            if (!contact.customFields) contact.customFields = {};
            contact.customFields[header.trim()] = value;
          }
        });

        if (contact.phone) contacts.push(contact);
      }

      return contacts;
    } catch (error: any) {
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
        if (inQuotes && nextChar === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
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

  // ── BULK UPDATE ──────────────────────────────────────────

  async bulkUpdate(
    organizationId: string,
    input: BulkUpdateContactsInput
  ): Promise<{ message: string; updated: number }> {
    const { contactIds, tags, groupIds, status } = input;

    const count = await prisma.contact.count({
      where: { id: { in: contactIds }, organizationId },
    });
    if (count !== contactIds.length) {
      throw new AppError('Some contacts not found or access denied', 400);
    }

    if (tags?.length) {
      const contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds }, organizationId },
        select: { id: true, tags: true },
      });

      const BATCH = 50;
      for (let i = 0; i < contacts.length; i += BATCH) {
        const batch = contacts.slice(i, i + BATCH);
        await Promise.all(
          batch.map(c =>
            prisma.contact.update({
              where: { id: c.id },
              data: { tags: [...new Set([...(c.tags || []), ...tags])] },
            })
          )
        );
      }
    }

    if (status) {
      await prisma.contact.updateMany({
        where: { id: { in: contactIds } },
        data: { status },
      });
    }

    if (groupIds?.length) {
      await prisma.contactGroupMember.createMany({
        data: contactIds.flatMap(contactId =>
          groupIds.map(groupId => ({ contactId, groupId }))
        ),
        skipDuplicates: true,
      });
    }

    return { message: 'Contacts updated successfully', updated: count };
  }

  // ── BULK DELETE ──────────────────────────────────────────

  async bulkDelete(
    organizationId: string,
    contactIds: string[],
    userId?: string
  ): Promise<{ message: string; deleted: number }> {
    const result = await prisma.contact.updateMany({
      where: {
        id: { in: contactIds },
        organizationId,
        status: { not: 'DELETED' },
      },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: userId || null,
      },
    });

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
    });
    if (subscription && result.count > 0) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          contactsUsed: {
            decrement: Math.min(result.count, subscription.contactsUsed),
          },
        },
      });
    }

    return { message: 'Contacts deleted successfully', deleted: result.count };
  }

  // ── DELETE ALL ───────────────────────────────────────────

  async deleteAll(
    organizationId: string,
    userId?: string
  ): Promise<{ message: string; deleted: number }> {
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

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
    });
    if (subscription && result.count > 0) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          contactsUsed: {
            decrement: Math.min(result.count, subscription.contactsUsed),
          },
        },
      });
    }

    return { message: 'All contacts deleted successfully', deleted: result.count };
  }

  // ── STATS ────────────────────────────────────────────────

  async getStats(organizationId: string): Promise<ContactStats> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const base = { organizationId, status: { not: 'DELETED' as ContactStatus } };

    const [total, active, blocked, unsubscribed, recentlyAdded, withMessages, whatsappVerified] =
      await Promise.all([
        prisma.contact.count({ where: base }),
        prisma.contact.count({ where: { organizationId, status: 'ACTIVE' } }),
        prisma.contact.count({ where: { organizationId, status: 'BLOCKED' } }),
        prisma.contact.count({ where: { organizationId, status: 'UNSUBSCRIBED' } }),
        prisma.contact.count({ where: { ...base, createdAt: { gte: sevenDaysAgo } } }),
        prisma.contact.count({ where: { ...base, messageCount: { gt: 0 } } }),
        prisma.contact.count({ where: { ...base, whatsappProfileFetched: true } }),
      ]);

    return { total, active, blocked, unsubscribed, recentlyAdded, withMessages, whatsappVerified };
  }

  // ── GET ALL TAGS ─────────────────────────────────────────

  async getAllTags(organizationId: string): Promise<{ tag: string; count: number }[]> {
    const contacts = await prisma.contact.findMany({
      where: { organizationId, status: { not: 'DELETED' } },
      select: { tags: true },
    });

    const tagCounts = new Map<string, number>();
    for (const c of contacts) {
      for (const tag of c.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ── EXPORT ───────────────────────────────────────────────

  async export(organizationId: string, groupId?: string): Promise<any[]> {
    const where: Prisma.ContactWhereInput = {
      organizationId,
      status: { not: 'DELETED' },
    };
    if (groupId) where.groupMemberships = { some: { groupId } };

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return contacts.map(c => ({
      phone: c.phone,
      countryCode: c.countryCode,
      fullPhone: formatFullPhone(c.countryCode, c.phone),
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      email: c.email || '',
      tags: (c.tags || []).join(', '),
      status: c.status,
      source: c.source || '',
      whatsappVerified: c.whatsappProfileFetched ? 'Yes' : 'No',
      whatsappName: c.whatsappProfileName || '',
      createdAt: c.createdAt.toISOString(),
    }));
  }

  // ── GROUPS ───────────────────────────────────────────────

  async createGroup(
    organizationId: string,
    input: CreateContactGroupInput
  ): Promise<ContactGroupResponse> {
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

  async getGroupById(
    organizationId: string,
    groupId: string
  ): Promise<ContactGroupResponse & { contacts: ContactResponse[] }> {
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
      contacts: group.members.map(m => formatContact(m.contact)),
    };
  }

  async updateGroup(
    organizationId: string,
    groupId: string,
    input: UpdateContactGroupInput
  ): Promise<ContactGroupResponse> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });
    if (!group) throw new AppError('Group not found', 404);

    if (input.name && input.name !== group.name) {
      const dup = await prisma.contactGroup.findUnique({
        where: { organizationId_name: { organizationId, name: input.name } },
      });
      if (dup) throw new AppError('Group with this name already exists', 409);
    }

    const updated = await prisma.contactGroup.update({
      where: { id: groupId },
      data: { name: input.name, description: input.description, color: input.color },
      include: { _count: { select: { members: true } } },
    });

    return formatContactGroup(updated);
  }

  async deleteGroup(
    organizationId: string,
    groupId: string,
    deleteContacts = false
  ): Promise<{ message: string }> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
      include: { _count: { select: { members: true } } },
    });
    if (!group) throw new AppError('Group not found', 404);

    const memberCount = group._count.members;

    if (deleteContacts && memberCount > 0) {
      const members = await prisma.contactGroupMember.findMany({
        where: { groupId },
        select: { contactId: true },
      });
      const contactIds = members.map(m => m.contactId);

      await prisma.$transaction([
        prisma.contact.updateMany({
          where: { id: { in: contactIds }, organizationId },
          data: { status: 'DELETED', deletedAt: new Date() },
        }),
        prisma.campaign.updateMany({
          where: { contactGroupId: groupId },
          data: { contactGroupId: null },
        }),
        prisma.contactGroupMember.deleteMany({ where: { groupId } }),
        prisma.contactGroup.delete({ where: { id: groupId } }),
      ]);

      const subscription = await prisma.subscription.findFirst({
        where: { organizationId },
      });
      if (subscription && contactIds.length > 0) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            contactsUsed: {
              decrement: Math.min(contactIds.length, subscription.contactsUsed),
            },
          },
        });
      }

      return {
        message: `Group "${group.name}" and ${memberCount} contacts deleted.`,
      };
    }

    await prisma.$transaction([
      prisma.campaign.updateMany({
        where: { contactGroupId: groupId },
        data: { contactGroupId: null },
      }),
      prisma.contactGroupMember.deleteMany({ where: { groupId } }),
      prisma.contactGroup.delete({ where: { id: groupId } }),
    ]);

    return {
      message: `Group "${group.name}" deleted. ${memberCount} contacts remain.`,
    };
  }

  async addContactsToGroup(
    organizationId: string,
    groupId: string,
    contactIds: string[]
  ): Promise<{ message: string; added: number }> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });
    if (!group) throw new AppError('Group not found', 404);

    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds }, organizationId },
    });
    if (!contacts.length) throw new AppError('No valid contacts found', 400);

    const result = await prisma.contactGroupMember.createMany({
      data: contacts.map(c => ({ groupId, contactId: c.id })),
      skipDuplicates: true,
    });

    return { message: 'Contacts added to group successfully', added: result.count };
  }

  async removeContactsFromGroup(
    organizationId: string,
    groupId: string,
    contactIds: string[]
  ): Promise<{ message: string; removed: number }> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });
    if (!group) throw new AppError('Group not found', 404);

    const result = await prisma.contactGroupMember.deleteMany({
      where: { groupId, contactId: { in: contactIds } },
    });

    return { message: 'Contacts removed from group', removed: result.count };
  }

  // ✅ FIX Bug#4: DELETED contacts filter add kiya
  async getGroupContacts(
    organizationId: string,
    groupId: string,
    query: ContactsQueryInput
  ): Promise<ContactsListResponse> {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });
    if (!group) throw new AppError('Group not found', 404);

    const where: Prisma.ContactWhereInput = {
      organizationId,
      status: { not: 'DELETED' }, // ✅ FIX Bug#4
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
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts: contacts.map(formatContact),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getImportStats(organizationId: string) {
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
    const isFree = planName.toLowerCase().includes('free') ||
      planName.toLowerCase().includes('trial');
    const remainingSlots = Math.max(0, maxContacts - totalContacts);

    return {
      totalContacts,
      maxContacts,
      remainingSlots,
      planName,
      canImport: remainingSlots > 0,
      maxPerImport: isFree ? 500 : 10000,
    };
  }
}

export const contactsService = new ContactsService();