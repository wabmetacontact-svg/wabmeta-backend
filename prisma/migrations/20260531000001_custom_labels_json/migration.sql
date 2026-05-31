-- AlterTable
ALTER TABLE "WhatsAppAccount" DROP COLUMN IF EXISTS "customLabels";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "customLabels";
ALTER TABLE "Organization" ADD COLUMN "customLabels" JSONB DEFAULT '[]'::JSONB;
