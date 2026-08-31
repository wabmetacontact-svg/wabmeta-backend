-- Admin ke display-only overrides. Meta par kuch nahi badalta - ye sirf
-- tay karta hai ki WabMeta me user ko kya dikhe.
ALTER TABLE "WhatsAppAccount"
  ADD COLUMN IF NOT EXISTS "qualityRatingOverride" TEXT,
  ADD COLUMN IF NOT EXISTS "overrideSetBy" TEXT,
  ADD COLUMN IF NOT EXISTS "overrideSetAt" TIMESTAMP(3);

ALTER TABLE "WhatsAppAccount" DROP COLUMN IF EXISTS "messagingLimitSetBy";
ALTER TABLE "WhatsAppAccount" DROP COLUMN IF EXISTS "messagingLimitSetAt";
