// src/modules/inbox/inbox.types.ts

import { MessageType } from '@prisma/client';

export interface ConversationsQueryInput {
  page?: number;
  limit?: number;
  search?: string;
  isArchived?: boolean;
  isRead?: boolean;
  assignedTo?: string;
  labels?: string[];
  channel?: 'WHATSAPP' | 'INSTAGRAM' | 'TELEGRAM';
  sortBy?: 'lastMessageAt' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface MessagesQueryInput {
  page?: number;
  limit?: number;
  before?: string;
  after?: string;
}

export interface SendMessageInput {
  conversationId?: string;
  type?: MessageType;
  content?: string;
  mediaUrl?: string;
}

export interface UpdateConversationInput {
  isArchived?: boolean;
  isRead?: boolean;
  assignedTo?: string | null;
  labels?: string[];
}