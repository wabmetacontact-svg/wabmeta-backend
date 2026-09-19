-- Plan-level feature flags.
--
-- Until now a plan could only withhold the five features that happened to have
-- a numeric limit (maxCampaigns, maxChatbots, maxAutomations,
-- maxWhatsAppAccounts). CRM, Reports, Telegram and Instagram could not be tied
-- to a plan at all - only an admin could switch them off per organization.
--
-- includedFeatures answers it outright per feature. A plan that says nothing
-- keeps today's behaviour exactly: fall back to the numeric limit, and if
-- there is none, the feature stays open. So this migration changes nothing on
-- its own - the new tiers are what will populate it.
-- Idempotent and production-safe.

ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "includedFeatures" JSONB;
