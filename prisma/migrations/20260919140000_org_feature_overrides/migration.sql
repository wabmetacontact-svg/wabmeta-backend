-- Per-organization exceptions to the plan.
--
-- Until now a lock could only be added: the effective state was
-- "admin locked OR plan does not include it", so an admin could switch a
-- feature off but never on. A Starter customer who wanted Telegram had to
-- move up a whole tier or lose the deal.
--
-- featureOverrides names the features this organization keeps regardless of
-- its plan, e.g. {"telegram": true}. The admin's own lock still wins, so
-- "turn this off" always works.
-- Idempotent and production-safe.

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "featureOverrides" JSONB;
