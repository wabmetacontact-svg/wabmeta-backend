-- Meta business verification of the portfolio that owns the WABA
ALTER TABLE "WhatsAppAccount" ADD COLUMN IF NOT EXISTS "businessVerificationStatus" TEXT;
