-- Coexistence onboarding: contacts/history sync request state (see src/modules/meta/coexistence.ts)
ALTER TABLE "WhatsAppAccount" ADD COLUMN "smbSyncState" JSONB;
