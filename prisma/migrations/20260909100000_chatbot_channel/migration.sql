-- Let a visual chatbot flow target a specific channel (and a Telegram bot).
-- Idempotent and production-safe. Existing bots stay on WhatsApp.

ALTER TABLE "Chatbot" ADD COLUMN IF NOT EXISTS "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "Chatbot" ADD COLUMN IF NOT EXISTS "telegramBotId" TEXT;
CREATE INDEX IF NOT EXISTS "Chatbot_channel_idx" ON "Chatbot"("channel");
