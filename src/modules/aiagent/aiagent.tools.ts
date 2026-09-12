// src/modules/aiagent/aiagent.tools.ts
//
// AI agent ke tools - Gemini function calling. Model inhe bulata hai, kaam
// yahan hota hai. dryRun ("Try it" page) me koi DB write nahi hota, sirf
// batate hain ki kya hota.

import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import prisma from '../../config/database';
import { crmService } from '../crm/crm.service';
import { notificationsService } from '../notifications/notifications.service';
import {
  AgentConfig,
  HandoffReason,
  INTEREST_SCORE,
  enabledHandoffReasons,
  formatPrice,
  isHighValue,
  parseCallbackTime,
} from './aiagent.prompt';

export interface ToolContext {
  organizationId: string;
  /** "Try it" me customer nahi hota */
  contactId?: string;
  conversationId?: string;
  agent: AgentConfig & { notifyUserId: string | null };
  /** update_lead_stage ke allowed stages (Won/Lost nahi - wo insaan ya payment tay karega) */
  stageNames: string[];
  /** Client ka Razorpay juda hai - tabhi send_payment_link chalta hai */
  canTakePayments?: boolean;
  dryRun: boolean;
  now: Date;
  /** Is turn me handoff hua to engine ko pata chale */
  state: { handoff?: HandoffReason };
}

const enumString = (values: string[], description: string) =>
  ({ type: SchemaType.STRING, format: 'enum', enum: values, description }) as any;

export function buildToolDeclarations(
  agent: AgentConfig,
  stageNames: string[],
  canTakePayments = false
): FunctionDeclaration[] {
  const tools: FunctionDeclaration[] = [
    {
      name: 'save_customer_details',
      description:
        'Save what the customer has told you about themselves and what they want. Call it whenever they share a name, city, budget, need or show buying interest. Only pass fields they actually said.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: "Customer's name" },
          city: { type: SchemaType.STRING, description: 'City or area' },
          service_interest: { type: SchemaType.STRING, description: 'Product or service they want' },
          budget: { type: SchemaType.STRING, description: 'Budget in their own words, e.g. "around 50k"' },
          budget_amount: { type: SchemaType.NUMBER, description: 'Budget or order value as a number in INR, if known' },
          email: { type: SchemaType.STRING, description: 'Email address' },
          notes: { type: SchemaType.STRING, description: 'Anything else useful for the sales team' },
          interest_level: enumString(['cold', 'warm', 'hot'], 'How likely they are to buy'),
        },
      },
    },
    {
      name: 'schedule_callback',
      description:
        'Book a call or appointment the customer asked for at a specific time. Creates a task for the team.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          when: { type: SchemaType.STRING, description: 'ISO 8601 date-time with UTC offset, e.g. 2026-09-12T17:00:00+05:30' },
          note: { type: SchemaType.STRING, description: 'What the call is about' },
        },
        required: ['when'],
      },
    },
  ];

  if (stageNames.length > 0) {
    tools.push({
      name: 'update_lead_stage',
      description: 'Move the customer to a sales pipeline stage when they have clearly progressed, e.g. qualified or asked for a quote.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          stage: enumString(stageNames, 'Pipeline stage name'),
          reason: { type: SchemaType.STRING, description: 'Why, in a few words' },
        },
        required: ['stage'],
      },
    });
  }

  if (canTakePayments) {
    tools.push({
      name: 'send_payment_link',
      description:
        'Create a payment link for an amount the customer has agreed to pay. Returns the link - put it in your reply. Only for prices that come from the product list.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          amount: { type: SchemaType.NUMBER, description: 'Amount in rupees (not paise)' },
          description: { type: SchemaType.STRING, description: 'What the payment is for' },
        },
        required: ['amount'],
      },
    });
  }

  const reasons = enabledHandoffReasons(agent);
  if (reasons.length > 0) {
    tools.push({
      name: 'handoff_to_human',
      description:
        'Hand this chat to a human team member and stop replying. Use only for the situations listed in your instructions.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          reason: enumString(reasons, 'Why the chat needs a human'),
          summary: { type: SchemaType.STRING, description: 'One or two lines for the team: who the customer is and what they need' },
        },
        required: ['reason', 'summary'],
      },
    });
  }

  return tools;
}

const clean = (v: unknown, max = 500): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, max) : undefined;
};

const REASON_LABEL: Record<HandoffReason, string> = {
  customer_request: 'customer asked for a person',
  complaint: 'complaint / unhappy customer',
  unknown_answer: 'question the AI could not answer',
  high_value: 'high-value deal',
};

async function openLead(ctx: ToolContext) {
  if (!ctx.contactId) return null;
  return prisma.lead.findFirst({
    where: { organizationId: ctx.organizationId, contactId: ctx.contactId, status: { notIn: ['WON', 'LOST'] } },
    orderBy: { createdAt: 'desc' },
  });
}

async function ensureLead(ctx: ToolContext) {
  const existing = await openLead(ctx);
  if (existing) return existing;
  const { lead } = await crmService.smartCreateLead({
    organizationId: ctx.organizationId,
    contactId: ctx.contactId!,
    conversationId: ctx.conversationId,
    source: 'ai_agent',
    qualificationData: { aiAgent: true },
  });
  return lead;
}

export async function handoff(
  reason: HandoffReason,
  summary: string,
  ctx: ToolContext
): Promise<Record<string, any>> {
  const message = 'Chat handed to the team. Tell the customer a team member will reply shortly, and stop selling.';

  // high_value server khud lagata hai (threshold set ho to); baaki sirf jo on hain
  if (reason !== 'high_value' && !enabledHandoffReasons(ctx.agent).includes(reason)) {
    return { ok: false, error: 'Handoff for this reason is turned off. Help the customer yourself.' };
  }
  if (ctx.state.handoff) return { ok: true, handedOff: true, message };
  ctx.state.handoff = reason;

  if (ctx.dryRun) return { ok: true, dryRun: true, handedOff: true, reason, message };
  if (!ctx.conversationId) return { ok: false, error: 'No conversation' };

  await prisma.conversation.updateMany({
    where: { id: ctx.conversationId, organizationId: ctx.organizationId },
    data: { automationPaused: true, aiHandoffReason: reason, aiHandoffAt: ctx.now },
  });

  const lead = await openLead(ctx);
  if (lead) {
    await prisma.leadNote.create({
      data: { leadId: lead.id, content: `🙋 AI handed this chat to a person (${REASON_LABEL[reason]}): ${summary}`, isPinned: true },
    });
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: ctx.conversationId },
    select: {
      assignedTo: true,
      contact: { select: { firstName: true, lastName: true, whatsappProfileName: true, phone: true } },
    },
  });
  const userId =
    conv?.assignedTo ||
    ctx.agent.notifyUserId ||
    (await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { ownerId: true } }))?.ownerId;

  const c = conv?.contact;
  const who =
    [c?.firstName, c?.lastName].filter((x) => x && x !== 'Unknown').join(' ') ||
    c?.whatsappProfileName ||
    c?.phone ||
    'A customer';

  if (userId) {
    notificationsService
      .create({
        userId,
        organizationId: ctx.organizationId,
        type: 'alert',
        title: '🙋 Customer needs a person',
        description: `${who} - ${REASON_LABEL[reason]}: ${summary}`.slice(0, 300),
        actionUrl: '/(app)/inbox',
        metadata: { conversationId: ctx.conversationId, reason, webUrl: '/dashboard/inbox' },
      })
      .catch((e: any) => console.error('Handoff notification failed:', e?.message));
  }

  import('../inbox/inbox.service')
    .then(({ inboxService }) => inboxService.clearCache(ctx.organizationId))
    .catch(() => {});

  return { ok: true, handedOff: true, message };
}

async function saveCustomerDetails(args: Record<string, any>, ctx: ToolContext) {
  const level = String(args.interest_level || '').toLowerCase();
  const score = INTEREST_SCORE[level] ?? 0;
  const highValue = isHighValue(args.budget_amount, ctx.agent.handoffDealAbove);

  let leadId: string | undefined;

  if (!ctx.dryRun) {
    if (!ctx.contactId) return { ok: false, error: 'No customer in this chat' };

    // Naam/email sirf tab jab contact me pehle se nahi hai
    const contact = await prisma.contact.findUnique({
      where: { id: ctx.contactId },
      select: { firstName: true, email: true },
    });
    const data: Record<string, string> = {};
    const name = clean(args.name, 100);
    if (name && (!contact?.firstName || contact.firstName === 'Unknown')) {
      const [first, ...rest] = name.split(/\s+/);
      data.firstName = first;
      if (rest.length) data.lastName = rest.join(' ');
    }
    const email = clean(args.email, 200);
    if (email && !contact?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) data.email = email;
    if (Object.keys(data).length) {
      await prisma.contact.update({ where: { id: ctx.contactId }, data });
    }

    const amount = Number(args.budget_amount);
    const budget = clean(args.budget, 100) || (amount > 0 ? formatPrice(amount, 'INR') : undefined);
    const notes = clean(args.notes, 1000);

    const { lead, wasExisting } = await crmService.smartCreateLead({
      organizationId: ctx.organizationId,
      contactId: ctx.contactId,
      conversationId: ctx.conversationId,
      source: 'ai_agent',
      score,
      serviceInterest: clean(args.service_interest, 200),
      budget,
      city: clean(args.city, 100),
      qualificationData: {
        aiAgent: true,
        ...(level ? { interestLevel: level } : {}),
        ...(amount > 0 ? { budgetAmount: amount } : {}),
      },
      notes,
    });
    leadId = lead.id;

    // smartCreateLead note sirf naye lead par likhta hai
    if (wasExisting && notes) {
      await prisma.leadNote.create({ data: { leadId: lead.id, content: `🤖 ${notes}` } });
    }
  }

  const result: Record<string, any> = { ok: true, ...(ctx.dryRun ? { dryRun: true } : { leadId }) };

  // Badi deal: model ke bharose nahi - rakam threshold se upar to server khud saunpta hai
  if (highValue) {
    const summary = `Budget ${formatPrice(Number(args.budget_amount), 'INR')}${args.service_interest ? ` for ${args.service_interest}` : ''}`;
    Object.assign(result, await handoff('high_value', summary, ctx));
  }
  return result;
}

async function updateLeadStage(args: Record<string, any>, ctx: ToolContext) {
  const wanted = String(args.stage || '').trim().toLowerCase();
  const stageName = ctx.stageNames.find((s) => s.toLowerCase() === wanted);
  if (!stageName) return { ok: false, error: `Unknown stage. Allowed: ${ctx.stageNames.join(', ')}` };
  if (ctx.dryRun) return { ok: true, dryRun: true, stage: stageName };
  if (!ctx.contactId) return { ok: false, error: 'No customer in this chat' };

  const lead = await ensureLead(ctx);
  if (!lead.pipelineId) return { ok: false, error: 'Lead has no pipeline' };

  const stage = await prisma.pipelineStage.findFirst({
    where: { pipelineId: lead.pipelineId, name: { equals: stageName, mode: 'insensitive' }, isWon: false, isLost: false },
  });
  if (!stage) return { ok: false, error: "That stage is not in this lead's pipeline" };
  if (stage.id === lead.stageId) return { ok: true, stage: stage.name, unchanged: true };

  // crm.updateLead se - activity log + LEAD_STAGE_CHANGED follow-ups
  await crmService.updateLead(ctx.organizationId, lead.id, null as any, { stageId: stage.id });
  return { ok: true, stage: stage.name };
}

async function scheduleCallback(args: Record<string, any>, ctx: ToolContext) {
  const when = parseCallbackTime(args.when, ctx.now);
  if (!when) {
    return {
      ok: false,
      error: 'Invalid time. Use a future ISO 8601 time with the UTC offset, e.g. 2026-09-12T17:00:00+05:30',
    };
  }
  const note = clean(args.note, 150) || 'Customer asked for a call';
  const localTime = when.toLocaleString('en-IN', {
    timeZone: ctx.agent.timezone || 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  if (ctx.dryRun) return { ok: true, dryRun: true, when: when.toISOString(), localTime };
  if (!ctx.contactId) return { ok: false, error: 'No customer in this chat' };

  const lead = await ensureLead(ctx);
  // TASK_DUE isi dueDate par agent ko reminder bhejta hai
  const task = await crmService.addLeadTask(ctx.organizationId, lead.id, (lead.assignedToId || null) as any, {
    title: `📞 Callback: ${note}`,
    dueDate: when,
    priority: 'HIGH',
  });
  return { ok: true, when: when.toISOString(), localTime, taskId: task.id };
}

async function sendPaymentLink(args: Record<string, any>, ctx: ToolContext) {
  if (!ctx.canTakePayments) {
    return { ok: false, error: 'Payments are not set up. Tell the customer the team will share payment details.' };
  }

  const amount = Number(args.amount);
  if (!Number.isFinite(amount) || amount < 1) {
    return { ok: false, error: 'Amount must be a number in rupees, at least 1' };
  }
  const description = clean(args.description, 200) || 'Payment';

  if (ctx.dryRun) {
    return { ok: true, dryRun: true, amount, description, paymentLink: 'https://rzp.io/i/dry-run-link' };
  }
  if (!ctx.contactId) return { ok: false, error: 'No customer in this chat' };

  const lead = await ensureLead(ctx);
  const { paymentsService } = await import('../payments/payments.service');

  try {
    const { payment } = await paymentsService.createPaymentLink({
      organizationId: ctx.organizationId,
      amountPaise: Math.round(amount * 100),
      description,
      leadId: lead.id,
      contactId: ctx.contactId,
      conversationId: ctx.conversationId,
      createdVia: 'ai_agent',
      // Link AI apne jawab me bhejta hai - warna do message jate
      sendOnWhatsApp: false,
    });
    return {
      ok: true,
      paymentLink: payment.shortUrl,
      amount,
      message: 'Put this link in your reply to the customer.',
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Could not create the payment link' };
  }
}

export async function executeTool(
  name: string,
  args: Record<string, any>,
  ctx: ToolContext
): Promise<Record<string, any>> {
  switch (name) {
    case 'save_customer_details':
      return saveCustomerDetails(args, ctx);
    case 'update_lead_stage':
      return updateLeadStage(args, ctx);
    case 'schedule_callback':
      return scheduleCallback(args, ctx);
    case 'send_payment_link':
      return sendPaymentLink(args, ctx);
    case 'handoff_to_human': {
      const reason = String(args.reason || '') as HandoffReason;
      if (!(reason in REASON_LABEL)) return { ok: false, error: 'Unknown reason' };
      return handoff(reason, clean(args.summary, 500) || REASON_LABEL[reason], ctx);
    }
    default:
      return { ok: false, error: `Unknown tool ${name}` };
  }
}
