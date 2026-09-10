-- Multi-channel inbox + Telegram support.
-- Idempotent and production-safe: every statement is a no-op when its object
-- already exists, and the new `channel` columns default to WHATSAPP so all
-- existing Conversation/Message rows keep working unchanged.

-- 1. Channel enum ----------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'TELEGRAM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Conversation: channel + Telegram identifiers --------------------------
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "telegramBotId" TEXT;

-- 3. Message: channel + Telegram message id --------------------------------
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "telegramMessageId" TEXT;

-- 4. Contact: Telegram identity --------------------------------------------
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "telegramUserId" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "telegramUsername" TEXT;

-- 5. Conversation uniqueness now includes channel --------------------------
-- (existing rows are all WHATSAPP, so no collisions are possible)
ALTER TABLE "Conversation" DROP CONSTRAINT IF EXISTS "Conversation_organizationId_contactId_key";
DROP INDEX IF EXISTS "Conversation_organizationId_contactId_key";
DO $$ BEGIN
  ALTER TABLE "Conversation"
    ADD CONSTRAINT "Conversation_organizationId_contactId_channel_key"
    UNIQUE ("organizationId", "contactId", "channel");
EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;

-- 6. Indexes ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "Conversation_channel_idx" ON "Conversation"("channel");
CREATE INDEX IF NOT EXISTS "Conversation_telegramChatId_idx" ON "Conversation"("telegramChatId");
CREATE INDEX IF NOT EXISTS "Conversation_telegramBotId_idx" ON "Conversation"("telegramBotId");
CREATE INDEX IF NOT EXISTS "Message_channel_idx" ON "Message"("channel");
CREATE INDEX IF NOT EXISTS "Message_telegramMessageId_idx" ON "Message"("telegramMessageId");
CREATE INDEX IF NOT EXISTS "Contact_organizationId_telegramUserId_idx" ON "Contact"("organizationId", "telegramUserId");

-- 7. TelegramBot table -----------------------------------------------------
CREATE TABLE IF NOT EXISTS "TelegramBot" (
  "id"             TEXT         NOT NULL,
  "organizationId" TEXT         NOT NULL,
  "botToken"       TEXT         NOT NULL,
  "botUserId"      TEXT         NOT NULL,
  "username"       TEXT         NOT NULL,
  "firstName"      TEXT,
  "webhookSecret"  TEXT         NOT NULL,
  "status"         TEXT         NOT NULL DEFAULT 'CONNECTED',
  "isDefault"      BOOLEAN      NOT NULL DEFAULT false,
  "lastError"      TEXT,
  "lastErrorAt"    TIMESTAMP(3),
  "connectedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramBot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramBot_organizationId_botUserId_key" ON "TelegramBot"("organizationId", "botUserId");
CREATE INDEX IF NOT EXISTS "TelegramBot_organizationId_idx" ON "TelegramBot"("organizationId");
CREATE INDEX IF NOT EXISTS "TelegramBot_botUserId_idx" ON "TelegramBot"("botUserId");
DO $$ BEGIN
  ALTER TABLE "TelegramBot"
    ADD CONSTRAINT "TelegramBot_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
