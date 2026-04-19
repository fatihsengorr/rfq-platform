-- Faz 3 — Feature 3: Follow-up tracking + stall detection
-- Additive migration: no existing rows are touched.

-- ── Rfq: track when we last heard from / contacted the customer ──
ALTER TABLE "Rfq"
  ADD COLUMN "lastCustomerActivityAt" TIMESTAMP(3);

-- Cheap lookup for the daily stall-detection scan
CREATE INDEX "Rfq_status_lastCustomerActivityAt_idx"
  ON "Rfq"("status", "lastCustomerActivityAt");

-- Backfill: treat any RFQ already in QUOTED as having been "sent to
-- customer" on its updatedAt timestamp. This prevents the first cron
-- run from bulk-alerting about every historic RFQ.
UPDATE "Rfq"
SET "lastCustomerActivityAt" = "updatedAt"
WHERE "status" = 'QUOTED' AND "lastCustomerActivityAt" IS NULL;

-- ── FollowUpActivity: one row per logged follow-up attempt ──
CREATE TABLE "FollowUpActivity" (
  "id"            TEXT         NOT NULL,
  "rfqId"         TEXT         NOT NULL,
  "performedById" TEXT         NOT NULL,
  "note"          TEXT,
  "performedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FollowUpActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FollowUpActivity_rfqId_performedAt_idx"
  ON "FollowUpActivity"("rfqId", "performedAt");

ALTER TABLE "FollowUpActivity"
  ADD CONSTRAINT "FollowUpActivity_rfqId_fkey"
      FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FollowUpActivity_performedById_fkey"
      FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
