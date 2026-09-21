-- The Multi-Partner Solution a client was onboarded through.
--
-- Clients who sign up through a solution are billed on the Solution
-- Partner's credit line rather than their own card, so the account has to
-- record which solution - if any - it came in through.
--
-- Both columns are nullable: every existing account came in without a
-- solution, and nothing reads these until one is configured.
-- Idempotent and production-safe.

ALTER TABLE "WhatsAppAccount"
  ADD COLUMN IF NOT EXISTS "solutionId" TEXT,
  ADD COLUMN IF NOT EXISTS "solutionConfirmedAt" TIMESTAMP(3);
