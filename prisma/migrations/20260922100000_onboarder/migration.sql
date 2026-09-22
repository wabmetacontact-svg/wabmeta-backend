-- Onboarders: which admin brought a client in, the capacity add-ons sold to
-- that client, and money received outside Razorpay.
--
-- Every existing organization has no onboarder, no add-ons and no manual
-- payments, so nothing about current customers changes.
-- Idempotent and production-safe.

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "onboardedById" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Organization_onboardedById_idx" ON "Organization"("onboardedById");

CREATE TABLE IF NOT EXISTS "ClientAddOn" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type"           TEXT NOT NULL,
  "label"          TEXT NOT NULL,
  "quantity"       INTEGER NOT NULL DEFAULT 1,
  "unitPricePaise" INTEGER NOT NULL,
  "billing"        TEXT NOT NULL DEFAULT 'MONTHLY',
  "startsAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt"         TIMESTAMP(3),
  "note"           TEXT,
  "createdById"    TEXT,
  "createdByEmail" TEXT,
  "removedAt"      TIMESTAMP(3),
  "removedBy"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientAddOn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClientAddOn_organizationId_idx" ON "ClientAddOn"("organizationId");

CREATE TABLE IF NOT EXISTS "ManualPayment" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "amountPaise"     INTEGER NOT NULL,
  "method"          TEXT NOT NULL,
  "reference"       TEXT,
  "description"     TEXT,
  "paidAt"          TIMESTAMP(3) NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'PENDING',
  "recordedById"    TEXT,
  "recordedByEmail" TEXT,
  "verifiedById"    TEXT,
  "verifiedByEmail" TEXT,
  "verifiedAt"      TIMESTAMP(3),
  "rejectReason"    TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ManualPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ManualPayment_organizationId_idx" ON "ManualPayment"("organizationId");
CREATE INDEX IF NOT EXISTS "ManualPayment_status_createdAt_idx" ON "ManualPayment"("status", "createdAt");
