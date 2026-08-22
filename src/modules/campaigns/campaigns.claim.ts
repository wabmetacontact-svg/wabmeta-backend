// src/modules/campaigns/campaigns.claim.ts
import prisma from '../../config/database';

/**
 * Atomically claim a batch of a campaign's contacts for sending.
 *
 * Marks up to `batchSize` PENDING rows (and any QUEUED rows abandoned by a
 * crashed worker more than 5 minutes ago) as QUEUED, and returns their ids.
 *
 * The claim is a single `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP
 * LOCKED)`. SKIP LOCKED means two workers racing over the same campaign never
 * pick the same row — the second simply skips locked rows and claims different
 * ones. This replaces `findMany({ status: 'PENDING' })`, where both workers read
 * the same rows and both sent them (duplicate messages, double charges).
 *
 * The 5-minute reclaim window lets recovery pick up rows a dead worker claimed
 * but never sent, without any pause/resume bookkeeping.
 */
export async function claimContactBatch(
  campaignId: string,
  batchSize: number
): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "CampaignContact"
       SET "status" = 'QUEUED', "updatedAt" = now()
     WHERE "id" IN (
       SELECT "id" FROM "CampaignContact"
        WHERE "campaignId" = ${campaignId}
          AND (
            "status" = 'PENDING'
            OR ("status" = 'QUEUED' AND "updatedAt" < now() - interval '5 minutes')
          )
        ORDER BY "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING "id"
  `;
  return rows.map((r) => r.id);
}
