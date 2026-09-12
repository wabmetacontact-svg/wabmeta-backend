-- AI Sales Agent (Phase 2): one agent per organization, its knowledge base,
-- and why/when it handed a conversation to a human.
-- Idempotent and production-safe.

CREATE TABLE IF NOT EXISTS "AiAgent" (
    "id"                 TEXT         NOT NULL,
    "organizationId"     TEXT         NOT NULL,
    "isEnabled"          BOOLEAN      NOT NULL DEFAULT false,
    "name"               TEXT         NOT NULL DEFAULT 'Assistant',
    "businessInfo"       TEXT         NOT NULL DEFAULT '',
    "instructions"       TEXT         NOT NULL DEFAULT '',
    "timezone"           TEXT         NOT NULL DEFAULT 'Asia/Kolkata',
    "handoffOnRequest"   BOOLEAN      NOT NULL DEFAULT true,
    "handoffOnComplaint" BOOLEAN      NOT NULL DEFAULT true,
    "handoffOnUnknown"   BOOLEAN      NOT NULL DEFAULT true,
    "handoffDealAbove"   INTEGER,
    "notifyUserId"       TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAgent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiAgent_organizationId_key" ON "AiAgent"("organizationId");

DO $$ BEGIN
    ALTER TABLE "AiAgent" ADD CONSTRAINT "AiAgent_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "KnowledgeItem" (
    "id"             TEXT           NOT NULL,
    "organizationId" TEXT           NOT NULL,
    "type"           TEXT           NOT NULL,
    "title"          TEXT           NOT NULL,
    "content"        TEXT           NOT NULL DEFAULT '',
    "price"          DECIMAL(12,2),
    "currency"       TEXT           NOT NULL DEFAULT 'INR',
    "isActive"       BOOLEAN        NOT NULL DEFAULT true,
    "sortOrder"      INTEGER        NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KnowledgeItem_organizationId_type_idx" ON "KnowledgeItem"("organizationId", "type");

DO $$ BEGIN
    ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "aiHandoffReason" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "aiHandoffAt"     TIMESTAMP(3);
