-- New feature tiers, and a flag to retire the old duration plans without
-- deleting them.
--
-- The old MONTHLY / QUARTERLY / BIANNUAL / ANNUAL values stay: existing
-- customers keep their plan, and their rows must keep resolving. isPublic
-- only decides whether a plan is offered to new signups.
--
-- Postgres will not let a new enum value be USED in the transaction that adds
-- it, so this migration only declares them. The plan rows themselves are
-- written by prisma/set-billing-plans.ts afterwards.
-- Idempotent and production-safe.

ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'STARTER';
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'GROWTH';
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'PRO';
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'BUSINESS';

ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT true;
