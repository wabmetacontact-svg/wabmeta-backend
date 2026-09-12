// src/modules/automation/automation.jobs.ts
//
// Automation ke "baad me" wale kaam ki queue (AutomationJob table).
//
// Delivery at-most-once hai: engine job ko DONE mark karke hi steps chalata
// hai. Beech me process mar jaye to follow-up chhoot sakta hai, par ek hi
// message do baar nahi jayega aur do baar charge nahi hoga - WhatsApp par
// duplicate message chhoote hue follow-up se zyada nuksaan karta hai.

import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { retryBackoffMs } from './automation.timing';

export type JobType = 'RESUME_SEQUENCE' | 'WAIT_TIMEOUT';

export interface JobPayload {
  /** Automation.actions me kis index se aage chalna hai */
  fromStep: number;
  /** Us index wale action ki id - automation edit hone par steps khisak jayein to isi se dhoondhte hain */
  nextActionId?: string;
  phone?: string;
  conversationId?: string;
}

export interface ClaimedJob {
  id: string;
  organizationId: string;
  automationId: string;
  contactId: string;
  type: JobType;
  payload: JobPayload;
  attempts: number;
}

export const MAX_ATTEMPTS = 3;

/** Itni der RUNNING me pada job kisi mare hue worker ka hai - dobara uthao. */
const STALE_RUNNING_MINUTES = 10;

export async function scheduleJob(input: {
  organizationId: string;
  automationId: string;
  contactId: string;
  type: JobType;
  runAt: Date;
  payload: JobPayload;
}) {
  return prisma.automationJob.create({
    data: {
      organizationId: input.organizationId,
      automationId: input.automationId,
      contactId: input.contactId,
      type: input.type,
      runAt: input.runAt,
      payload: input.payload as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Contact ke PENDING jobs cancel karo. Kitne cancel hue wo lautata hai. */
export async function cancelPendingJobs(
  filter: { contactId: string; automationId?: string; type?: JobType },
  reason: string
): Promise<number> {
  // undefined contactId Prisma ke liye "koi filter nahi" hai - poori table.
  if (!filter.contactId) return 0;

  const result = await prisma.automationJob.updateMany({
    where: {
      contactId: filter.contactId,
      ...(filter.automationId ? { automationId: filter.automationId } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      status: 'PENDING',
    },
    data: { status: 'CANCELLED', lastError: reason },
  });
  return result.count;
}

/**
 * Due jobs ka ek batch claim karo. Wahi SKIP LOCKED pattern jo
 * campaigns.claim.ts me hai: do worker kabhi ek hi job nahi uthate.
 */
export async function claimDueJobs(limit: number): Promise<ClaimedJob[]> {
  const rows = await prisma.$queryRaw<ClaimedJob[]>`
    UPDATE "AutomationJob"
       SET "status" = 'RUNNING', "attempts" = "attempts" + 1, "updatedAt" = now()
     WHERE "id" IN (
       SELECT "id" FROM "AutomationJob"
        WHERE ("status" = 'PENDING' AND "runAt" <= now())
           OR ("status" = 'RUNNING' AND "updatedAt" < now() - (${STALE_RUNNING_MINUTES}::int * interval '1 minute'))
        ORDER BY "runAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING "id", "organizationId", "automationId", "contactId", "type", "payload", "attempts"
  `;
  return rows;
}

export async function finishJob(
  id: string,
  status: 'DONE' | 'CANCELLED' | 'FAILED',
  note?: string
): Promise<void> {
  await prisma.automationJob.update({
    where: { id },
    data: { status, lastError: note ?? null },
  });
}

/** Quiet hours jaisi wajah se aage khiskao - ye koshish gini nahi jati. */
export async function deferJob(id: string, runAt: Date, note: string): Promise<void> {
  await prisma.automationJob.update({
    where: { id },
    data: { status: 'PENDING', runAt, attempts: { decrement: 1 }, lastError: note },
  });
}

/** Transient failure: backoff ke saath dobara, ya MAX_ATTEMPTS ke baad FAILED. */
export async function retryOrFailJob(job: ClaimedJob, error: string): Promise<void> {
  if (job.attempts >= MAX_ATTEMPTS) {
    await finishJob(job.id, 'FAILED', error);
    return;
  }
  await prisma.automationJob.update({
    where: { id: job.id },
    data: {
      status: 'PENDING',
      runAt: new Date(Date.now() + retryBackoffMs(job.attempts)),
      lastError: error,
    },
  });
}
