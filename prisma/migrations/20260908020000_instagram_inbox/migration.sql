-- Instagram DMs in the unified inbox. Idempotent and production-safe.

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "instagramUserId" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "instagramUsername" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "instagramAccountId" TEXT;

CREATE INDEX IF NOT EXISTS "Contact_organizationId_instagramUserId_idx" ON "Contact"("organizationId", "instagramUserId");
CREATE INDEX IF NOT EXISTS "Conversation_instagramAccountId_idx" ON "Conversation"("instagramAccountId");
