-- TelegramAutomation.buttons exists in the Prisma schema but no migration ever
-- created it, so any database built purely from migrations (production) was
-- missing it and every read of the model failed with P2022.
-- Idempotent and production-safe.

ALTER TABLE "TelegramAutomation" ADD COLUMN IF NOT EXISTS "buttons" JSONB;
