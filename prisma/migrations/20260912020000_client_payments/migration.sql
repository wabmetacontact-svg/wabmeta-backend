-- Phase 3: each client connects their OWN Razorpay account and sends payment
-- links to customers. WabMeta's own Razorpay (subscriptions, wallet top-ups)
-- stays in env vars and is untouched.
-- Idempotent and production-safe.

ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'PAYMENT_RECEIVED';

CREATE TABLE IF NOT EXISTS "PaymentGateway" (
    "id"             TEXT         NOT NULL,
    "organizationId" TEXT         NOT NULL,
    "provider"       TEXT         NOT NULL DEFAULT 'RAZORPAY',
    "keyId"          TEXT         NOT NULL,
    "keySecret"      TEXT         NOT NULL,
    "webhookSecret"  TEXT,
    "displayName"    TEXT,
    "isActive"       BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGateway_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentGateway_organizationId_key" ON "PaymentGateway"("organizationId");

DO $$ BEGIN
    ALTER TABLE "PaymentGateway" ADD CONSTRAINT "PaymentGateway_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LeadPayment" (
    "id"                TEXT         NOT NULL,
    "organizationId"    TEXT         NOT NULL,
    "leadId"            TEXT,
    "contactId"         TEXT,
    "conversationId"    TEXT,
    "amountPaise"       INTEGER      NOT NULL,
    "currency"          TEXT         NOT NULL DEFAULT 'INR',
    "description"       TEXT,
    "status"            TEXT         NOT NULL DEFAULT 'PENDING',
    "provider"          TEXT         NOT NULL DEFAULT 'RAZORPAY',
    "providerLinkId"    TEXT         NOT NULL,
    "shortUrl"          TEXT         NOT NULL,
    "providerPaymentId" TEXT,
    "paidAt"            TIMESTAMP(3),
    "expiresAt"         TIMESTAMP(3),
    "createdVia"        TEXT         NOT NULL DEFAULT 'manual',
    "createdById"       TEXT,
    "lastCheckedAt"     TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadPayment_providerLinkId_key" ON "LeadPayment"("providerLinkId");
CREATE INDEX IF NOT EXISTS "LeadPayment_organizationId_status_idx" ON "LeadPayment"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "LeadPayment_leadId_idx" ON "LeadPayment"("leadId");
CREATE INDEX IF NOT EXISTS "LeadPayment_status_lastCheckedAt_idx" ON "LeadPayment"("status", "lastCheckedAt");

DO $$ BEGIN
    ALTER TABLE "LeadPayment" ADD CONSTRAINT "LeadPayment_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LeadPayment" ADD CONSTRAINT "LeadPayment_leadId_fkey"
        FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
