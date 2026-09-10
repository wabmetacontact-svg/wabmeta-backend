-- Telegram broadcasts to bot subscribers. Idempotent and production-safe.

CREATE TABLE IF NOT EXISTS "TelegramBroadcast" (
  "id"             TEXT         NOT NULL,
  "organizationId" TEXT         NOT NULL,
  "botId"          TEXT,
  "message"        TEXT         NOT NULL,
  "buttons"        JSONB,
  "audienceTag"    TEXT,
  "status"         TEXT         NOT NULL DEFAULT 'SENDING',
  "total"          INTEGER      NOT NULL DEFAULT 0,
  "sent"           INTEGER      NOT NULL DEFAULT 0,
  "failed"         INTEGER      NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"    TIMESTAMP(3),
  CONSTRAINT "TelegramBroadcast_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TelegramBroadcast_organizationId_idx" ON "TelegramBroadcast"("organizationId");
CREATE INDEX IF NOT EXISTS "TelegramBroadcast_organizationId_createdAt_idx" ON "TelegramBroadcast"("organizationId", "createdAt" DESC);
DO $$ BEGIN
  ALTER TABLE "TelegramBroadcast"
    ADD CONSTRAINT "TelegramBroadcast_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
