-- Gupshup Solution Partner: per-number send provider and Gupshup app link state
ALTER TABLE "WhatsAppAccount" ADD COLUMN "sendProvider" TEXT NOT NULL DEFAULT 'META';
ALTER TABLE "WhatsAppAccount" ADD COLUMN "gupshupAppId" TEXT;
ALTER TABLE "WhatsAppAccount" ADD COLUMN "gupshupStatus" TEXT;
ALTER TABLE "WhatsAppAccount" ADD COLUMN "gupshupError" TEXT;
ALTER TABLE "WhatsAppAccount" ADD COLUMN "gupshupLinkedAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppAccount" ADD COLUMN "gupshupLiveAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppAccount" ADD COLUMN "gupshupSubscriptionId" TEXT;
CREATE UNIQUE INDEX "WhatsAppAccount_gupshupAppId_key" ON "WhatsAppAccount"("gupshupAppId");
