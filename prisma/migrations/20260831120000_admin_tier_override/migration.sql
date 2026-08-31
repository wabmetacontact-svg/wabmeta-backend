-- Admin ka messaging tier override. Meta ka assigned tier alag rehta hai;
-- ye sirf WabMeta ki send speed ke liye hai.
ALTER TABLE "WhatsAppAccount"
  ADD COLUMN IF NOT EXISTS "messagingLimitOverride" TEXT,
  ADD COLUMN IF NOT EXISTS "messagingLimitSetBy" TEXT,
  ADD COLUMN IF NOT EXISTS "messagingLimitSetAt" TIMESTAMP(3);
