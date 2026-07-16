// src/modules/contacts/contacts.types.ts

import { Contact, ContactStatus } from '@prisma/client';

// ============================================
// REQUEST TYPES
// ============================================

export interface CreateContactInput {
  phone: string;
  countryCode?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  groupIds?: string[];
}

export interface UpdateContactInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  countryCode?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  status?: ContactStatus;
}

export interface ImportContactsInput {
  contacts: CreateContactInput[];
  groupId?: string;
  tags?: string[];
  skipDuplicates?: boolean;
}

export interface BulkUpdateContactsInput {
  contactIds: string[];
  tags?: string[];
  groupIds?: string[];
  status?: ContactStatus;
}

export interface BulkDeleteContactsInput {
  contactIds: string[];
}

export interface ContactsQueryInput {
  page?: number;
  limit?: number;
  search?: string;
  status?: ContactStatus;
  tags?: string[];
  groupId?: string;
  sortBy?: 'createdAt' | 'firstName' | 'lastName' | 'lastMessageAt';
  sortOrder?: 'asc' | 'desc';
  hasWhatsAppProfile?: boolean; // NEW
}

// Contact Groups
export interface CreateContactGroupInput {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateContactGroupInput {
  name?: string;
  description?: string;
  color?: string;
}

export interface AddContactsToGroupInput {
  contactIds: string[];
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface ContactResponse {
  id: string;
  phone: string;
  countryCode: string;
  fullPhone: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
  avatar: string | null;
  tags: string[];
  customFields: Record<string, any>;
  status: ContactStatus;
  source: string | null;
  lastMessageAt: Date | null;
  messageCount: number;

  // WhatsApp Profile Fields (NEW)
  whatsappProfileFetched?: boolean;
  lastProfileFetchAt?: Date | null;
  profileFetchAttempts?: number;
  whatsappProfileName?: string | null;
  whatsappAbout?: string | null;
  whatsappProfilePicUrl?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface ContactWithGroups extends ContactResponse {
  groups: {
    id: string;
    name: string;
    color: string | null;
  }[];
}

export interface ContactGroupResponse {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  contactCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactsListResponse {
  contacts: ContactResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ImportContactsResponse {
  imported: number;
  skipped: number;
  failed: number;
  totalErrors?: number;
  errors: { row?: number; phone?: string; error: string }[];
}

export interface ContactStats {
  total: number;
  active: number;
  blocked: number;
  unsubscribed: number;
  recentlyAdded: number;
  withMessages: number;
  whatsappVerified?: number; // NEW
}

// ============================================
// INTERNAL TYPES
// ============================================

export interface ParsedContact {
  phone: string;
  countryCode: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

export type SafeContact = Omit<Contact, 'organizationId'>;