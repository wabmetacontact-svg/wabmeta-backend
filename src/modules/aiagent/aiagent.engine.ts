// src/modules/aiagent/aiagent.engine.ts
//
// AI Sales Agent ka ek turn: knowledge base + customer ki jaankari se prompt,
// Gemini tools ke saath, aur jawab WhatsApp par. Webhook ise tabhi bulata hai
// jab automation/chatbot ne message nahi pakda (aiagent.prompt shouldAiReply).

import prisma from '../../config/database';
import { aiService, AiErrorCode, ToolCallRecord } from '../chatbot/ai.service';
import { consumeAiQuota } from '../chatbot/ai.ratelimit';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { getFeatureLocks } from '../../middleware/featureLock';
import {
  AgentConfig,
  CustomerContext,
  HandoffReason,
  HistoryMessage,
  KnowledgeEntry,
  buildAgentPrompt,
  buildHistory,
} from './aiagent.prompt';
import { ToolContext, buildToolDeclarations, executeTool } from './aiagent.tools';

export type AgentSettings = AgentConfig & { isEnabled: boolean; notifyUserId: string | null };

/** Model ne handoff kiya par kuch likha nahi - customer ko adhoora na chhodo. */
export const HANDOFF_REPLY =
  'Thank you! I have passed this to our team - a team member will reply to you shortly. 🙏';

export interface AgentTurnResult {
  reply: string;
  toolCalls: ToolCallRecord[];
  handoff?: HandoffReason;
  /** Model se jawab hi nahi mila (key galat/missing, ya model fail) */
  errorCode?: AiErrorCode;
}

async function loadKnowledge(organizationId: string): Promise<KnowledgeEntry[]> {
  const items = await prisma.knowledgeItem.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { type: true, title: true, content: true, price: true, currency: true },
  });
  return items.map((i) => ({ ...i, price: i.price === null ? null : Number(i.price) }));
}

async function loadCustomer(
  organizationId: string,
  contactId?: string
): Promise<{ customer: CustomerContext; pipelineId?: string | null }> {
  if (!contactId) return { customer: {} };

  const [contact, lead] = await Promise.all([
    prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      select: { firstName: true, lastName: true, whatsappProfileName: true },
    }),
    prisma.lead.findFirst({
      where: { organizationId, contactId, status: { notIn: ['WON', 'LOST'] } },
      orderBy: { createdAt: 'desc' },
      select: { pipelineId: true, serviceInterest: true, budget: true, city: true, stage: { select: { name: true } } },
    }),
  ]);

  const realName = [contact?.firstName, contact?.lastName].filter((x) => x && x !== 'Unknown').join(' ');
  return {
    customer: {
      name: realName || contact?.whatsappProfileName || null,
      serviceInterest: lead?.serviceInterest,
      budget: lead?.budget,
      city: lead?.city,
      stageName: lead?.stage?.name,
    },
    pipelineId: lead?.pipelineId,
  };
}

/** update_lead_stage ke stages: lead ki pipeline, warna default. Won/Lost nahi. */
async function stageNamesFor(organizationId: string, pipelineId?: string | null): Promise<string[]> {
  let id = pipelineId;
  if (!id) {
    const def = await prisma.pipeline.findFirst({
      where: { organizationId, isDefault: true, isActive: true },
      select: { id: true },
    });
    id = def?.id;
  }
  if (!id) return [];
  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId: id, isWon: false, isLost: false },
    orderBy: { order: 'asc' },
    select: { name: true },
  });
  return stages.map((s) => s.name);
}

export async function runAgentTurn(input: {
  organizationId: string;
  agent: AgentSettings;
  contactId?: string;
  conversationId?: string;
  history: HistoryMessage[];
  userMessage: string;
  dryRun: boolean;
  now?: Date;
}): Promise<AgentTurnResult> {
  const now = input.now ?? new Date();
  const [org, knowledge, { customer, pipelineId }, gateway] = await Promise.all([
    prisma.organization.findUnique({ where: { id: input.organizationId }, select: { name: true } }),
    loadKnowledge(input.organizationId),
    loadCustomer(input.organizationId, input.contactId),
    prisma.paymentGateway.findUnique({
      where: { organizationId: input.organizationId },
      select: { isActive: true },
    }),
  ]);
  const canTakePayments = !!gateway?.isActive;
  const stageNames = await stageNamesFor(input.organizationId, pipelineId);

  const systemPrompt = buildAgentPrompt({
    agent: input.agent,
    businessName: org?.name || 'our business',
    knowledge,
    customer,
    stageNames,
    now,
    canTakePayments,
  });

  const ctx: ToolContext = {
    organizationId: input.organizationId,
    contactId: input.contactId,
    conversationId: input.conversationId,
    agent: input.agent,
    stageNames,
    canTakePayments,
    dryRun: input.dryRun,
    now,
    state: {},
  };

  const result = await aiService.runToolTurn({
    systemPrompt,
    history: input.history,
    userMessage: input.userMessage,
    tools: buildToolDeclarations(input.agent, stageNames, canTakePayments),
    onToolCall: (name, args) => executeTool(name, args, ctx),
  });

  return {
    reply: result.text || (ctx.state.handoff ? HANDOFF_REPLY : ''),
    toolCalls: result.toolCalls,
    handoff: ctx.state.handoff,
    errorCode: result.errorCode,
  };
}

// Ek chat ke messages ek-ek karke - customer lagatar do message bheje to do
// AI jawab ek saath na banein, aur doosre turn ko pehle wala jawab history me
// dikhe. (Ek instance ke andar; multi-instance par ye bound nahi hai.)
const chains = new Map<string, Promise<unknown>>();

function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) || Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  chains.set(key, next);
  const cleanup = () => {
    if (chains.get(key) === next) chains.delete(key);
  };
  next.then(cleanup, cleanup);
  return next;
}

/** Inbound WhatsApp text ka jawab. true = AI ne jawab bheja. */
async function handleInbound(input: {
  organizationId: string;
  conversationId: string;
  contactId: string;
  phone: string;
  text: string;
  whatsappAccountId?: string;
  /** Abhi aaya message - history me nahi, userMessage me jata hai */
  excludeMessageId?: string;
}): Promise<boolean> {
  return serialize(input.conversationId, async () => {
    const agent = await prisma.aiAgent.findUnique({ where: { organizationId: input.organizationId } });
    if (!agent?.isEnabled) return false;

    // Plan/admin ne chatbot band kiya ho to AI agent bhi (routes par featureLock('chatbot'))
    const locks = await getFeatureLocks(input.organizationId);
    if (locks?.chatbot) return false;

    // Queue me intezar ke dauraan agent ne chat le li ho sakti hai - taaza padho
    const [conversation, contact] = await Promise.all([
      prisma.conversation.findFirst({
        where: { id: input.conversationId, organizationId: input.organizationId },
        select: { automationPaused: true },
      }),
      prisma.contact.findUnique({ where: { id: input.contactId }, select: { status: true } }),
    ]);
    if (!conversation || conversation.automationPaused) return false;
    if (contact?.status !== 'ACTIVE') return false;

    if (!(await consumeAiQuota(input.organizationId))) {
      console.warn(`⚠️ AI daily limit reached for org ${input.organizationId}; AI agent silent`);
      return false;
    }

    const recent = await prisma.message.findMany({
      where: {
        conversationId: input.conversationId,
        ...(input.excludeMessageId ? { id: { not: input.excludeMessageId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { direction: true, content: true },
    });

    const turn = await runAgentTurn({
      organizationId: input.organizationId,
      agent,
      contactId: input.contactId,
      conversationId: input.conversationId,
      history: buildHistory(recent.reverse()),
      userMessage: input.text,
      dryRun: false,
    });

    if (turn.toolCalls.length) {
      console.log(`🤖 [AI agent] tools: ${turn.toolCalls.map((t) => t.name).join(', ')}`);
    }
    if (!turn.reply) return false;

    const accountId =
      input.whatsappAccountId ||
      (
        await prisma.whatsAppAccount.findFirst({
          where: { organizationId: input.organizationId, status: 'CONNECTED' },
          orderBy: { isDefault: 'desc' },
          select: { id: true },
        })
      )?.id;
    if (!accountId) return false;

    await whatsappService.sendTextMessage(
      accountId,
      input.phone,
      turn.reply,
      input.conversationId,
      input.organizationId
    );
    return true;
  }).catch((err: any) => {
    console.error('❌ AI agent error:', err?.message || err);
    return false;
  });
}

export const aiAgentEngine = { handleInbound, runAgentTurn };
