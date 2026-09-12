-- Telegram/Instagram DM se aaye contacts ka CRM lead banna chahiye ya nahi.
-- Default true: feature ka matlab hi yahi hai ki wo channels CRM me dikhein.
-- Jo org sirf inbox use karta hai wo Settings se band kar sakta hai.
-- Idempotent and production-safe.

ALTER TABLE "OrganizationSettings"
  ADD COLUMN IF NOT EXISTS "autoLeadFromSocial" BOOLEAN NOT NULL DEFAULT true;
