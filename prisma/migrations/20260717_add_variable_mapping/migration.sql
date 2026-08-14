-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "variableMapping" JSONB;
