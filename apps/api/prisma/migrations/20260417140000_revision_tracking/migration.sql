-- Faz 3 — Feature 2: RFQ + Quote revision tracking
-- Adds RfqRevision snapshot table + changeReason/rfqRevisionId on QuoteRevision
-- and Attachment. Fully additive: existing data is untouched.

-- ── RfqRevision (snapshots) ──────────────────────────────────────────
CREATE TABLE "RfqRevision" (
  "id"             TEXT         NOT NULL,
  "rfqId"          TEXT         NOT NULL,
  "revisionNumber" INTEGER      NOT NULL,
  "changeReason"   TEXT         NOT NULL,
  "projectName"    TEXT         NOT NULL,
  "deadline"       TIMESTAMP(3) NOT NULL,
  "projectDetails" TEXT         NOT NULL,
  "requestedBy"    TEXT         NOT NULL,
  "companyId"      TEXT,
  "contactId"      TEXT,
  "changedById"    TEXT         NOT NULL,
  "changedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RfqRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RfqRevision_rfqId_revisionNumber_key"
  ON "RfqRevision"("rfqId", "revisionNumber");

CREATE INDEX "RfqRevision_rfqId_revisionNumber_idx"
  ON "RfqRevision"("rfqId", "revisionNumber");

ALTER TABLE "RfqRevision"
  ADD CONSTRAINT "RfqRevision_rfqId_fkey"
      FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RfqRevision_changedById_fkey"
      FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── QuoteRevision: changeReason (nullable, enforced at API layer) ────
ALTER TABLE "QuoteRevision"
  ADD COLUMN "changeReason"  TEXT,
  ADD COLUMN "rfqRevisionId" TEXT;

CREATE INDEX "QuoteRevision_rfqRevisionId_idx" ON "QuoteRevision"("rfqRevisionId");

ALTER TABLE "QuoteRevision"
  ADD CONSTRAINT "QuoteRevision_rfqRevisionId_fkey"
      FOREIGN KEY ("rfqRevisionId") REFERENCES "RfqRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Attachment: rfqRevisionId (existing files stay attached to live RFQ) ─
ALTER TABLE "Attachment"
  ADD COLUMN "rfqRevisionId" TEXT;

CREATE INDEX "Attachment_rfqRevisionId_idx" ON "Attachment"("rfqRevisionId");

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_rfqRevisionId_fkey"
      FOREIGN KEY ("rfqRevisionId") REFERENCES "RfqRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
