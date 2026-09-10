-- Telegram command/keyword auto-reply rules. Idempotent and production-safe.

CREATE TABLE IF NOT EXISTS "TelegramAutomation" (
  "id"             TEXT         NOT NULL,
  "organizationId" TEXT         NOT NULL,
  "botId"          TEXT,
  "name"           TEXT         NOT NULL,
  "triggerType"    TEXT         NOT NULL,
  "pattern"        TEXT,
  "matchType"      TEXT         NOT NULL DEFAULT 'contains',
  "responseText"   TEXT         NOT NULL,
  "isActive"       BOOLEAN      NOT NULL DEFAULT true,
  "triggerCount"   INTEGER      NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramAutomation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TelegramAutomation_organizationId_idx" ON "TelegramAutomation"("organizationId");
CREATE INDEX IF NOT EXISTS "TelegramAutomation_organizationId_isActive_idx" ON "TelegramAutomation"("organizationId", "isActive");
DO $$ BEGIN
  ALTER TABLE "TelegramAutomation"
    ADD CONSTRAINT "TelegramAutomation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
