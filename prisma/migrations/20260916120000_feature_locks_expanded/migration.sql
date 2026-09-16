-- Feature Access Control ab har module ko lock kar sakta hai, sirf
-- inbox/campaigns/chatbot/automation/connection ko nahi.
--
-- Telegram aur Instagram naye accounts par band rehne chahiye. Isliye wo do
-- columns pehle DEFAULT false ke saath add hote hain (taaki maujooda orgs ka
-- access na chhine) aur uske baad unka default true kar diya jaata hai -
-- ab bane har naye org par wo locked aayenge.
--
-- Idempotent and production-safe.

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "featureContactsLocked"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featureCrmLocked"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featureTemplatesLocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featureAiAgentLocked"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featureReportsLocked"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featureWalletLocked"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featureTelegramLocked"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featureInstagramLocked" BOOLEAN NOT NULL DEFAULT false;

-- Maujooda rows false par reh gaye; aage se naye orgs locked banenge.
ALTER TABLE "Organization"
  ALTER COLUMN "featureTelegramLocked"  SET DEFAULT true,
  ALTER COLUMN "featureInstagramLocked" SET DEFAULT true;
