-- Refund idempotency: enforce one wallet transaction per (metaChargeId, metaService).
-- Meta retries webhook deliveries; without this, two deliveries of the same
-- failed-message status could both create a refund (a double credit).

-- 1. Remove any existing duplicates, keeping the earliest row per pair.
DELETE FROM "WalletTransaction" a
USING "WalletTransaction" b
WHERE a."metaChargeId" IS NOT NULL
  AND a."metaChargeId" = b."metaChargeId"
  AND a."metaService"  = b."metaService"
  AND a."createdAt"    > b."createdAt";

-- 2. Partial unique index (NULL metaChargeId rows are exempt).
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_charge_service"
  ON "WalletTransaction" ("metaChargeId", "metaService")
  WHERE "metaChargeId" IS NOT NULL;
