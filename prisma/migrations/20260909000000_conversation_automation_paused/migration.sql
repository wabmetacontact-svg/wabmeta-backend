-- Human handoff: pause channel automation on a conversation once an agent takes over.
-- Idempotent and production-safe.

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "automationPaused" BOOLEAN NOT NULL DEFAULT false;
