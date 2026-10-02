-- WhatsApp Cloud API Calling: one row per call (see src/modules/calling/calling.service.ts).
-- Written to be safe to re-run: the old calling code wrote to a "CallLog" model
-- that never existed, and a table of that name must not break the deploy.

CREATE TABLE IF NOT EXISTS "CallLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "whatsappAccountId" TEXT,
    "contactId" TEXT,
    "conversationId" TEXT,
    "callId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "offerSdp" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "answeredById" TEXT,
    "initiatedById" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CallLog_callId_key" ON "CallLog"("callId");
CREATE INDEX IF NOT EXISTS "CallLog_organizationId_startedAt_idx" ON "CallLog"("organizationId", "startedAt");
CREATE INDEX IF NOT EXISTS "CallLog_contactId_idx" ON "CallLog"("contactId");
CREATE INDEX IF NOT EXISTS "CallLog_status_idx" ON "CallLog"("status");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CallLog_organizationId_fkey') THEN
        ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_organizationId_fkey"
            FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CallLog_contactId_fkey') THEN
        ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_contactId_fkey"
            FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
