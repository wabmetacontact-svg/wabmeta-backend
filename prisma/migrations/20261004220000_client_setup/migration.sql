-- The onboarder's setup sheet for a client.
--
-- Until now this lived in a spreadsheet, passwords included. Each line of the
-- sheet is a row: what was set up, what it was charged, the IDs, a status, and
-- optionally a password - encrypted with ENCRYPTION_KEY, readable only by the
-- client's onboarder or a super admin, and never sent to TeamOS.
--
-- New nullable columns and a new table: nothing existing changes.

ALTER TABLE "Organization" ADD COLUMN "businessType" TEXT;
ALTER TABLE "Organization" ADD COLUMN "setupDoneAt" TIMESTAMP(3);

CREATE TABLE "ClientSetupItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "chargePaise" INTEGER,
    "chargeNote" TEXT NOT NULL DEFAULT '',
    "details" TEXT NOT NULL DEFAULT '',
    "passwordEnc" TEXT,
    "status" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSetupItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientSetupItem_organizationId_idx" ON "ClientSetupItem"("organizationId");

ALTER TABLE "ClientSetupItem" ADD CONSTRAINT "ClientSetupItem_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
