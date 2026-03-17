-- Fix Index Drift
-- Adding the index that Prisma expects but is missing from migration history
CREATE INDEX IF NOT EXISTS "WhatsAppAccount_connectionType_idx" ON "WhatsAppAccount"("connectionType");
