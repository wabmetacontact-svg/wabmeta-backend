// ✅ REPLACE: src/modules/chatbot/chatbot.service.ts

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { ChatbotStatus } from '@prisma/client';

export class ChatbotService {
  async getAll(organizationId: string, options: { page?: number, limit?: number, status?: ChatbotStatus, search?: string } = {}) {
    const { page = 1, limit = 20, status, search } = options;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [chatbots, total] = await Promise.all([
      prisma.chatbot.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.chatbot.count({ where }),
    ]);

    return { chatbots, total, page, limit };
  }

  async getById(organizationId: string, chatbotId: string) {
    const chatbot = await prisma.chatbot.findFirst({
      where: { id: chatbotId, organizationId },
    });

    if (!chatbot) throw new AppError('Chatbot not found', 404);
    return chatbot;
  }

  async create(organizationId: string, userId: string, data: {
    name: string;
    description?: string;
    triggerKeywords?: string[];
    isDefault?: boolean;
    welcomeMessage?: string;
    fallbackMessage?: string;
    flowData?: any;
  }) {
    // If setting as default, unset others
    if (data.isDefault) {
      await prisma.chatbot.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.chatbot.create({
      data: {
        organizationId,
        createdById: userId,
        name: data.name,
        description: data.description,
        triggerKeywords: data.triggerKeywords || [],
        isDefault: data.isDefault || false,
        welcomeMessage: data.welcomeMessage,
        fallbackMessage: data.fallbackMessage,
        flowData: data.flowData || { nodes: [], edges: [] },
        status: 'DRAFT',
      },
    });
  }

  async update(organizationId: string, chatbotId: string, data: {
    name?: string;
    description?: string;
    triggerKeywords?: string[];
    isDefault?: boolean;
    welcomeMessage?: string;
    fallbackMessage?: string;
    flowData?: any;
    status?: ChatbotStatus;
  }) {
    const chatbot = await prisma.chatbot.findFirst({
      where: { id: chatbotId, organizationId },
    });

    if (!chatbot) throw new AppError('Chatbot not found', 404);

    // If setting as default, unset others
    if (data.isDefault) {
      await prisma.chatbot.updateMany({
        where: { organizationId, isDefault: true, id: { not: chatbotId } },
        data: { isDefault: false },
      });
    }

    return prisma.chatbot.update({
      where: { id: chatbotId },
      data,
    });
  }

  async delete(organizationId: string, chatbotId: string) {
    const chatbot = await prisma.chatbot.findFirst({
      where: { id: chatbotId, organizationId },
    });

    if (!chatbot) throw new AppError('Chatbot not found', 404);

    await prisma.chatbot.delete({ where: { id: chatbotId } });
    return { message: 'Chatbot deleted successfully' };
  }

  async activate(organizationId: string, chatbotId: string) {
    const chatbot = await prisma.chatbot.findFirst({
      where: { id: chatbotId, organizationId },
    });

    if (!chatbot) throw new AppError('Chatbot not found', 404);

    // ✅ Validate flow before activating
    const flowData = chatbot.flowData as any;
    const nodes: any[] = flowData?.nodes || [];
    const hasStart = nodes.some((n: any) => n.type === 'start');
    const hasOtherNode = nodes.filter((n: any) => n.type !== 'start').length > 0;

    if (!hasStart || !hasOtherNode) {
      throw new AppError('Chatbot flow mein Start node aur kam se kam ek aur node hona zaroori hai', 400);
    }

    return prisma.chatbot.update({
      where: { id: chatbotId },
      data: { status: 'ACTIVE' },
    });
  }

  async deactivate(organizationId: string, chatbotId: string) {
    const chatbot = await prisma.chatbot.findFirst({
      where: { id: chatbotId, organizationId },
    });

    if (!chatbot) throw new AppError('Chatbot not found', 404);

    return prisma.chatbot.update({
      where: { id: chatbotId },
      data: { status: 'PAUSED' },
    });
  }

  async duplicate(organizationId: string, chatbotId: string, userId: string, newName?: string) {
    const chatbot = await prisma.chatbot.findFirst({
      where: { id: chatbotId, organizationId },
    });

    if (!chatbot) throw new AppError('Chatbot not found', 404);

    return prisma.chatbot.create({
      data: {
        organizationId,
        createdById: userId,
        name: newName || `${chatbot.name} (Copy)`,
        description: chatbot.description,
        triggerKeywords: chatbot.triggerKeywords as string[],
        isDefault: false,
        welcomeMessage: chatbot.welcomeMessage,
        fallbackMessage: chatbot.fallbackMessage,
        flowData: chatbot.flowData || { nodes: [], edges: [] },
        status: 'DRAFT',
      },
    });
  }

  async getStats(organizationId: string, chatbotId: string) {
    // Basic stats for now
    return {
      totalConversations: 0,
      activeSessions: 0,
      completedFlows: 0,
    };
  }
}

export const chatbotService = new ChatbotService();