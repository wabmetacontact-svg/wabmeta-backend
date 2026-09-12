// src/modules/aiagent/aiagent.service.ts
//
// AI agent ki settings, knowledge base CRUD, aur "Try it" (dry run).

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { consumeAiQuota } from '../chatbot/ai.ratelimit';
import { AgentSettings, AgentTurnResult, runAgentTurn } from './aiagent.engine';
import { buildHistory } from './aiagent.prompt';

const AGENT_DEFAULTS: AgentSettings = {
  isEnabled: false,
  name: 'Assistant',
  businessInfo: '',
  instructions: '',
  timezone: 'Asia/Kolkata',
  handoffOnRequest: true,
  handoffOnComplaint: true,
  handoffOnUnknown: true,
  handoffDealAbove: null,
  notifyUserId: null,
};

const MAX_KNOWLEDGE_ITEMS = 500;

function text(
  v: unknown,
  field: string,
  max: number,
  opts: { required?: boolean } = {}
): string | undefined {
  if (v === undefined) return undefined;
  if (v === null) v = '';
  if (typeof v !== 'string') throw new AppError(`${field} must be text`, 400);
  const s = v.trim();
  if (opts.required && !s) throw new AppError(`${field} is required`, 400);
  if (s.length > max) throw new AppError(`${field} is too long (max ${max} characters)`, 400);
  return s;
}

function flag(v: unknown, field: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw new AppError(`${field} must be true or false`, 400);
  return v;
}

function parseKnowledge(body: any, creating: boolean) {
  const data: Record<string, any> = {};

  if (creating || body.type !== undefined) {
    const type = String(body.type || '').toUpperCase();
    if (type !== 'PRODUCT' && type !== 'FAQ') throw new AppError('type must be PRODUCT or FAQ', 400);
    data.type = type;
  }

  const title = text(body.title, 'title', 200, { required: creating });
  if (title !== undefined) {
    if (!title) throw new AppError('title is required', 400);
    data.title = title;
  }

  const content = text(body.content, 'content', 4000);
  if (content !== undefined) data.content = content;
  if (creating && data.type === 'FAQ' && !data.content) {
    throw new AppError('An FAQ needs an answer', 400);
  }

  if (body.price !== undefined) {
    if (body.price === null || body.price === '') data.price = null;
    else {
      const n = Number(body.price);
      if (!Number.isFinite(n) || n < 0) throw new AppError('price must be a positive number', 400);
      data.price = n;
    }
  }

  if (body.currency !== undefined) {
    const c = String(body.currency || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) throw new AppError('currency must be a 3-letter code like INR', 400);
    data.currency = c;
  }

  const isActive = flag(body.isActive, 'isActive');
  if (isActive !== undefined) data.isActive = isActive;

  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isInteger(n)) throw new AppError('sortOrder must be a whole number', 400);
    data.sortOrder = n;
  }

  return data;
}

export const aiAgentService = {
  async getSettings(organizationId: string): Promise<AgentSettings & Record<string, any>> {
    const agent = await prisma.aiAgent.findUnique({ where: { organizationId } });
    return agent ?? { ...AGENT_DEFAULTS, organizationId };
  },

  async updateSettings(organizationId: string, body: any) {
    const data: Record<string, any> = {};
    const put = (key: string, value: unknown) => {
      if (value !== undefined) data[key] = value;
    };

    put('isEnabled', flag(body.isEnabled, 'isEnabled'));
    put('name', text(body.name, 'name', 60));
    put('businessInfo', text(body.businessInfo, 'businessInfo', 8000));
    put('instructions', text(body.instructions, 'instructions', 4000));
    put('handoffOnRequest', flag(body.handoffOnRequest, 'handoffOnRequest'));
    put('handoffOnComplaint', flag(body.handoffOnComplaint, 'handoffOnComplaint'));
    put('handoffOnUnknown', flag(body.handoffOnUnknown, 'handoffOnUnknown'));

    if (body.timezone !== undefined) {
      const tz = text(body.timezone, 'timezone', 64, { required: true })!;
      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: tz });
      } catch {
        throw new AppError('timezone must be an IANA timezone like "Asia/Kolkata"', 400);
      }
      data.timezone = tz;
    }

    if (body.handoffDealAbove !== undefined) {
      if (body.handoffDealAbove === null || body.handoffDealAbove === '') data.handoffDealAbove = null;
      else {
        const n = Number(body.handoffDealAbove);
        if (!Number.isInteger(n) || n < 0) throw new AppError('handoffDealAbove must be a whole amount in INR', 400);
        data.handoffDealAbove = n;
      }
    }

    if (body.notifyUserId !== undefined) {
      if (!body.notifyUserId) data.notifyUserId = null;
      else {
        const userId = String(body.notifyUserId);
        const [member, org] = await Promise.all([
          prisma.organizationMember.findFirst({ where: { organizationId, userId }, select: { id: true } }),
          prisma.organization.findUnique({ where: { id: organizationId }, select: { ownerId: true } }),
        ]);
        if (!member && org?.ownerId !== userId) {
          throw new AppError('notifyUserId must be a member of this organization', 400);
        }
        data.notifyUserId = userId;
      }
    }

    return prisma.aiAgent.upsert({
      where: { organizationId },
      create: { ...data, organizationId },
      update: data,
    });
  },

  async listKnowledge(organizationId: string) {
    return prisma.knowledgeItem.findMany({
      where: { organizationId },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  },

  async createKnowledge(organizationId: string, body: any) {
    const count = await prisma.knowledgeItem.count({ where: { organizationId } });
    if (count >= MAX_KNOWLEDGE_ITEMS) {
      throw new AppError(`You can add up to ${MAX_KNOWLEDGE_ITEMS} knowledge items`, 400);
    }
    const data = parseKnowledge(body || {}, true);
    return prisma.knowledgeItem.create({
      data: { ...(data as any), organizationId },
    });
  },

  async updateKnowledge(organizationId: string, id: string, body: any) {
    const existing = await prisma.knowledgeItem.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!existing) throw new AppError('Knowledge item not found', 404);
    return prisma.knowledgeItem.update({ where: { id }, data: parseKnowledge(body || {}, false) });
  },

  async deleteKnowledge(organizationId: string, id: string) {
    const result = await prisma.knowledgeItem.deleteMany({ where: { id, organizationId } });
    if (result.count === 0) throw new AppError('Knowledge item not found', 404);
    return { deleted: true };
  },

  /**
   * "Try it": bina WhatsApp ke agent se baat. Tools dry run me chalte hain -
   * lead/handoff/task kuch nahi banta, sirf result me dikhta hai ki kya hota.
   * Agent band ho tab bhi chalta hai, taaki on karne se pehle parkh sako.
   */
  async test(organizationId: string, body: any): Promise<AgentTurnResult> {
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
      throw new AppError('messages must be a list of 1-40 chat messages', 400);
    }

    const chat = messages.map((m: any, i: number) => {
      const role = m?.role === 'user' ? 'user' : m?.role === 'assistant' || m?.role === 'model' ? 'model' : null;
      if (!role) throw new AppError(`messages[${i}].role must be "user" or "assistant"`, 400);
      return { role, content: text(m?.text, `messages[${i}].text`, 2000, { required: true })! };
    });

    const last = chat[chat.length - 1];
    if (last.role !== 'user') throw new AppError('The last message must be from the customer', 400);

    if (!(await consumeAiQuota(organizationId))) {
      throw new AppError('Daily AI limit reached for your organization. Try again tomorrow.', 429);
    }

    const agent = await this.getSettings(organizationId);
    const history = buildHistory(
      chat.slice(0, -1).map((m) => ({ direction: m.role === 'user' ? 'INBOUND' : 'OUTBOUND', content: m.content }))
    );

    const result = await runAgentTurn({ organizationId, agent, history, userMessage: last.content, dryRun: true });

    // Khaali "(no reply)" ki jagah asli wajah - warna client samajh hi nahi
    // pata ki AI server par configure hi nahi hai
    if (!result.reply && result.toolCalls.length === 0 && result.errorCode) {
      throw new AppError(
        result.errorCode === 'FAILED'
          ? 'The AI model did not answer. Please try again in a moment.'
          : 'AI is not configured on the server: the Gemini API key is missing or invalid.',
        503
      );
    }
    return result;
  },
};
