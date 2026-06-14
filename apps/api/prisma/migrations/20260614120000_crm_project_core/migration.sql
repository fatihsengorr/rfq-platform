-- CRM Faz A — Project pipeline + ilişkisel firma/kişi çekirdeği
-- Lead modeli ölüydü (prod row count = 0 doğrulandı) → drop edilip Project
-- ailesiyle değiştiriliyor. Diğer her şey additive.

-- ── Enums ────────────────────────────────────────────────────────────
CREATE TYPE "ProjectStage" AS ENUM ('IDENTIFIED', 'CONTACTED', 'ENGAGED', 'TENDER', 'WON', 'LOST');
CREATE TYPE "ProjectSource" AS ENUM ('MANUAL', 'BARBOUR', 'REFERRAL', 'REPEAT_CLIENT', 'OTHER');
CREATE TYPE "ProjectCategory" AS ENUM ('JOINERY', 'FFE', 'FIT_OUT', 'KITCHEN', 'BAR_RESTAURANT', 'RECEPTION', 'BEDROOM_CASEGOODS', 'RETAIL', 'OTHER');
CREATE TYPE "CompanyRole" AS ENUM ('CLIENT_EMPLOYER', 'MAIN_CONTRACTOR', 'ARCHITECT', 'QS_COST_CONSULTANT', 'INTERIOR_DESIGNER', 'SUBCONTRACTOR', 'DEVELOPER', 'OTHER');
CREATE TYPE "LossReason" AS ENUM ('PRICE', 'TIMELINE', 'LOST_TO_COMPETITOR', 'CANCELLED', 'NO_BUDGET', 'OTHER');

-- ── Drop dead Lead model ─────────────────────────────────────────────
DROP TABLE IF EXISTS "Lead";

-- ── Project (merkez entity) ──────────────────────────────────────────
CREATE TABLE "Project" (
  "id"                TEXT NOT NULL,
  "title"             TEXT NOT NULL,
  "description"       TEXT,
  "stage"             "ProjectStage" NOT NULL DEFAULT 'IDENTIFIED',
  "source"            "ProjectSource" NOT NULL DEFAULT 'MANUAL',
  "externalRef"       TEXT,
  "importedAt"        TIMESTAMP(3),
  "projectCategory"   "ProjectCategory",
  "unitCount"         INTEGER,
  "value"             DECIMAL(18,2),
  "currency"          TEXT NOT NULL DEFAULT 'GBP',
  "expectedStartDate" TIMESTAMP(3),
  "siteCity"          TEXT,
  "siteRegion"        TEXT,
  "sitePostcode"      TEXT,
  "probability"       INTEGER,
  "lostReasonCode"    "LossReason",
  "lostReason"        TEXT,
  "stageUpdatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ownerId"           TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Project_source_externalRef_key" ON "Project"("source", "externalRef");
CREATE INDEX "Project_stage_idx" ON "Project"("stage");
CREATE INDEX "Project_ownerId_stage_idx" ON "Project"("ownerId", "stage");
CREATE INDEX "Project_source_idx" ON "Project"("source");
CREATE INDEX "Project_projectCategory_idx" ON "Project"("projectCategory");
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── ProjectStageEvent (aşama geçmişi) ────────────────────────────────
CREATE TABLE "ProjectStageEvent" (
  "id"          TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "fromStage"   "ProjectStage",
  "toStage"     "ProjectStage" NOT NULL,
  "changedById" TEXT NOT NULL,
  "changedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note"        TEXT,
  CONSTRAINT "ProjectStageEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectStageEvent_projectId_changedAt_idx" ON "ProjectStageEvent"("projectId", "changedAt");
ALTER TABLE "ProjectStageEvent" ADD CONSTRAINT "ProjectStageEvent_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ProjectCompany (M:N firma rolleri) ───────────────────────────────
CREATE TABLE "ProjectCompany" (
  "id"        TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "role"      "CompanyRole" NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ProjectCompany_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectCompany_projectId_companyId_role_key" ON "ProjectCompany"("projectId", "companyId", "role");
CREATE INDEX "ProjectCompany_companyId_idx" ON "ProjectCompany"("companyId");
ALTER TABLE "ProjectCompany" ADD CONSTRAINT "ProjectCompany_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectCompany" ADD CONSTRAINT "ProjectCompany_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "CustomerCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── ProjectContact (projeye özel kişiler) ────────────────────────────
CREATE TABLE "ProjectContact" (
  "id"        TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "note"      TEXT,
  CONSTRAINT "ProjectContact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectContact_projectId_contactId_key" ON "ProjectContact"("projectId", "contactId");
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── CustomerCompany: kategori + adres ────────────────────────────────
ALTER TABLE "CustomerCompany"
  ADD COLUMN "category"    "CompanyRole",
  ADD COLUMN "addressLine" TEXT,
  ADD COLUMN "postcode"    TEXT,
  ADD COLUMN "phone"       TEXT;

-- ── Rfq: projectId ───────────────────────────────────────────────────
ALTER TABLE "Rfq" ADD COLUMN "projectId" TEXT;
CREATE INDEX "Rfq_projectId_idx" ON "Rfq"("projectId");
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Attachment: project/company hedefleri ────────────────────────────
ALTER TABLE "Attachment"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "companyId" TEXT;
CREATE INDEX "Attachment_projectId_idx" ON "Attachment"("projectId");
CREATE INDEX "Attachment_companyId_idx" ON "Attachment"("companyId");
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "CustomerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
