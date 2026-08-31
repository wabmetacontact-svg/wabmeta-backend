-- Admin ka connection status override (sirf display).
ALTER TABLE "WhatsAppAccount"
  ADD COLUMN IF NOT EXISTS "healthCanSendOverride" TEXT;
