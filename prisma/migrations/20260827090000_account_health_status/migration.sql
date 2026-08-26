-- Meta ka health_status store karne ke liye. Wahi batata hai ki number
-- business-initiated messages bhej sakta hai ya nahi, aur kyun nahi.
ALTER TABLE "WhatsAppAccount"
  ADD COLUMN IF NOT EXISTS "healthCanSend" TEXT,
  ADD COLUMN IF NOT EXISTS "healthBlockedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "healthStatus" JSONB,
  ADD COLUMN IF NOT EXISTS "healthCheckedAt" TIMESTAMP(3);
