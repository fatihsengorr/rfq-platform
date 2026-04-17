-- Faz 3 — Feature 1: WON/LOST deal outcome tracking
-- Adds new enum values and outcome columns. Fully backward compatible:
-- existing CLOSED RFQs are untouched.

ALTER TYPE "RfqStatus" ADD VALUE IF NOT EXISTS 'WON';
ALTER TYPE "RfqStatus" ADD VALUE IF NOT EXISTS 'LOST';

ALTER TABLE "Rfq"
  ADD COLUMN IF NOT EXISTS "wonAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lostAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lostReason" TEXT;
