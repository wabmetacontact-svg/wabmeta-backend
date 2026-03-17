-- AlterEnum
ALTER TYPE "AutomationTrigger" ADD VALUE 'UNKNOWN_MESSAGE';

-- CreateTable
CREATE TABLE "AutomationSequence" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastStepAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationSequence_automationId_idx" ON "AutomationSequence"("automationId");

-- CreateIndex
CREATE INDEX "AutomationSequence_contactId_idx" ON "AutomationSequence"("contactId");

-- CreateIndex
CREATE INDEX "AutomationSequence_status_idx" ON "AutomationSequence"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationSequence_automationId_contactId_key" ON "AutomationSequence"("automationId", "contactId");

-- AddForeignKey
ALTER TABLE "AutomationSequence" ADD CONSTRAINT "AutomationSequence_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationSequence" ADD CONSTRAINT "AutomationSequence_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
