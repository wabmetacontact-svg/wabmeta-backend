-- Telegram broadcast: media support + resumable per-recipient tracking.
-- Idempotent and production-safe.

ALTER TABLE "TelegramBroadcast" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
ALTER TABLE "TelegramBroadcast" ADD COLUMN IF NOT EXISTS "mediaType" TEXT;
CREATE INDEX IF NOT EXISTS "TelegramBroadcast_status_idx" ON "TelegramBroadcast"("status");

CREATE TABLE IF NOT EXISTS "TelegramBroadcastRecipient" (
  "id"             TEXT         NOT NULL,
  "broadcastId"    TEXT         NOT NULL,
  "conversationId" TEXT         NOT NULL,
  "chatId"         TEXT         NOT NULL,
  "botId"          TEXT         NOT NULL,
  "status"         TEXT         NOT NULL DEFAULT 'PENDING',
  "error"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramBroadcastRecipient_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TelegramBroadcastRecipient_broadcastId_status_idx" ON "TelegramBroadcastRecipient"("broadcastId", "status");
DO $$ BEGIN
  ALTER TABLE "TelegramBroadcastRecipient"
    ADD CONSTRAINT "TelegramBroadcastRecipient_broadcastId_fkey"
    FOREIGN KEY ("broadcastId") REFERENCES "TelegramBroadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
