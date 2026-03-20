-- AlterTable
ALTER TABLE "Automation" ADD COLUMN     "excludeExisting" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "targetGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
