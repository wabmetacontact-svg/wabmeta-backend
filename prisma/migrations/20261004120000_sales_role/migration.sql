-- Who sold a client, kept apart from who onboards it.
--
-- A sales person creates the client and later hands it to an onboarder. If both
-- lived in onboardedById, the handoff would overwrite the sale and the sales
-- person's credit - in the admin panel and in TeamOS - would vanish with it.
--
-- Nullable, no default, no backfill: every existing client was created by an
-- onboarder or an admin, and none of them has a sales person to name.

ALTER TABLE "Organization" ADD COLUMN "soldById" TEXT;
ALTER TABLE "Organization" ADD COLUMN "soldAt" TIMESTAMP(3);

CREATE INDEX "Organization_soldById_idx" ON "Organization"("soldById");
