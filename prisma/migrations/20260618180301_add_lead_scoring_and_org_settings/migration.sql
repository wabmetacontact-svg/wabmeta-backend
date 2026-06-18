-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "conversationId" TEXT,
ADD COLUMN "serviceInterest" TEXT,
ADD COLUMN "budget" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "adSource" TEXT,
ADD COLUMN "adId" TEXT,
ADD COLUMN "campaignId" TEXT,
ADD COLUMN "chatbotQualified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "qualificationData" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadCreationMode" TEXT NOT NULL DEFAULT 'FLOW_BASED',
    "leadScoreThreshold" INTEGER NOT NULL DEFAULT 50,
    "autoAssignLeads" BOOLEAN NOT NULL DEFAULT false,
    "defaultAssigneeId" TEXT,
    "defaultPipelineId" TEXT,
    "notifyOnNewLead" BOOLEAN NOT NULL DEFAULT true,
    "notifyUserId" TEXT,
    "trackAdSource" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSettings_organizationId_key" ON "OrganizationSettings"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationSettings_organizationId_idx" ON "OrganizationSettings"("organizationId");

-- CreateIndex
CREATE INDEX "Lead_score_idx" ON "Lead"("score");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_chatbotQualified_idx" ON "Lead"("chatbotQualified");

-- CreateIndex
CREATE INDEX "Lead_conversationId_idx" ON "Lead"("conversationId");

-- AddForeignKey
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
