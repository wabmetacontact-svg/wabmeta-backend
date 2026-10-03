-- The outbox for what WabMeta pushes to TeamOS.
--
-- One row per mirrored thing, upserted on (kind, externalId), rather than one
-- row per change: the queue then stays the size of the data instead of growing
-- with every edit ever made, and "has this already been delivered in exactly
-- this state" is a single column comparison.
--
-- Nothing else in the application reads or writes this table, so adding it
-- changes no existing behaviour.

CREATE TABLE "SyncEvent" (
  "id"            TEXT NOT NULL,
  "kind"          TEXT NOT NULL,
  "externalId"    TEXT NOT NULL,
  "payload"       JSONB NOT NULL,
  "fingerprint"   TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError"     TEXT,
  "deliveredAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- What the projector upserts on.
CREATE UNIQUE INDEX "SyncEvent_kind_externalId_key" ON "SyncEvent"("kind", "externalId");

-- What the worker claims each tick: the due, undelivered rows.
CREATE INDEX "SyncEvent_status_nextAttemptAt_idx" ON "SyncEvent"("status", "nextAttemptAt");
