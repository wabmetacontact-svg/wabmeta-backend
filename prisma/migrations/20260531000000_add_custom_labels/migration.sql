-- AlterTable
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "customLabels" TEXT[] DEFAULT ARRAY[]::TEXT[];
