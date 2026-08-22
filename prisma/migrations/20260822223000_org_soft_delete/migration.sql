-- Soft delete for organizations: retain the financial ledger on customer deletion.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Organization_deletedAt_idx" ON "Organization" ("deletedAt");
