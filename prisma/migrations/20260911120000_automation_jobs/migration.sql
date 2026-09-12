-- Durable follow-ups for automations.
--
-- Before this, a `delay` action was a setTimeout capped at 30 seconds, so a
-- "follow up after 1 day" step fired after 30s, and anything pending was lost
-- on restart. AutomationJob stores the resume point; the scheduler claims due
-- rows every minute.
--
-- Also: three new triggers, a TASK_DUE dedupe column, and opt-in quiet hours.
-- Idempotent and production-safe.

ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'LEAD_STAGE_CHANGED';
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'NO_REPLY';
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'TASK_DUE';

CREATE TABLE IF NOT EXISTS "AutomationJob" (
    "id"             TEXT         NOT NULL,
    "organizationId" TEXT         NOT NULL,
    "automationId"   TEXT         NOT NULL,
    "contactId"      TEXT         NOT NULL,
    "type"           TEXT         NOT NULL,
    "status"         TEXT         NOT NULL DEFAULT 'PENDING',
    "runAt"          TIMESTAMP(3) NOT NULL,
    "attempts"       INTEGER      NOT NULL DEFAULT 0,
    "lastError"      TEXT,
    "payload"        JSONB        NOT NULL DEFAULT '{}',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AutomationJob_status_runAt_idx"
    ON "AutomationJob"("status", "runAt");
CREATE INDEX IF NOT EXISTS "AutomationJob_contactId_status_idx"
    ON "AutomationJob"("contactId", "status");
CREATE INDEX IF NOT EXISTS "AutomationJob_automationId_contactId_status_idx"
    ON "AutomationJob"("automationId", "contactId", "status");

DO $$ BEGIN
    ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_automationId_fkey"
        FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_contactId_fkey"
        FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- TASK_DUE reminders
ALTER TABLE "LeadTask" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "LeadTask_isCompleted_reminderSentAt_dueDate_idx"
    ON "LeadTask"("isCompleted", "reminderSentAt", "dueDate");

-- Tasks that were already overdue before this deploy must not all fire a
-- reminder on the first scheduler tick. Only due dates from now on remind.
UPDATE "LeadTask"
   SET "reminderSentAt" = CURRENT_TIMESTAMP
 WHERE "isCompleted" = false
   AND "reminderSentAt" IS NULL
   AND "dueDate" < CURRENT_TIMESTAMP;

-- Quiet hours (off by default)
ALTER TABLE "OrganizationSettings" ADD COLUMN IF NOT EXISTS "quietHoursEnabled"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrganizationSettings" ADD COLUMN IF NOT EXISTS "quietHoursStart"    TEXT    NOT NULL DEFAULT '21:00';
ALTER TABLE "OrganizationSettings" ADD COLUMN IF NOT EXISTS "quietHoursEnd"      TEXT    NOT NULL DEFAULT '09:00';
ALTER TABLE "OrganizationSettings" ADD COLUMN IF NOT EXISTS "quietHoursTimezone" TEXT    NOT NULL DEFAULT 'Asia/Kolkata';
