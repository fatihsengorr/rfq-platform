// ── Currencies ─────────────────────────────────────────────────────
export const CURRENCIES = ["GBP", "EUR", "USD", "TRY"] as const;
export type Currency = (typeof CURRENCIES)[number];

// ── User Roles ─────────────────────────────────────────────────────
export const USER_ROLES = ["LONDON_SALES", "ISTANBUL_PRICING", "ISTANBUL_MANAGER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ── RFQ Statuses ───────────────────────────────────────────────────
export const RFQ_STATUSES = [
  "NEW",
  "IN_REVIEW",
  "PRICING_IN_PROGRESS",
  "PENDING_MANAGER_APPROVAL",
  "QUOTED",
  "REVISION_REQUESTED",
  "WON",
  "LOST",
  "CLOSED",
] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

// Resolved (terminal) outcome statuses — an RFQ here is no longer active.
export const RESOLVED_RFQ_STATUSES = ["WON", "LOST", "CLOSED"] as const satisfies readonly RfqStatus[];

export function isResolvedStatus(status: RfqStatus): boolean {
  return (RESOLVED_RFQ_STATUSES as readonly RfqStatus[]).includes(status);
}

// ── Quote Revision Status ──────────────────────────────────────────
export type QuoteRevisionStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

// ── Domain Types ───────────────────────────────────────────────────
export type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
};

export type QuoteRevision = {
  id: string;
  versionNumber: number;
  currency: Currency;
  totalAmount: number;
  notes: string;
  status: QuoteRevisionStatus;
  createdAt: string;
  createdBy: string;
  attachments: Attachment[];
  // Faz 3 — Feature 2: reason for this revision (null on v1 legacy rows)
  changeReason: string | null;
  // Which RFQ revision this quote was priced against (optional manual link)
  rfqRevisionId: string | null;
  rfqRevisionNumber: number | null;
};

// Faz 3 — Feature 2: snapshot of an RFQ at a prior revision point.
export type RfqRevisionRecord = {
  id: string;
  rfqId: string;
  revisionNumber: number;
  changeReason: string;
  projectName: string;
  deadline: string;
  projectDetails: string;
  requestedBy: string;
  companyId: string | null;
  contactId: string | null;
  changedBy: string;
  changedById: string;
  changedAt: string;
  attachments: Attachment[];
};

// Unified timeline item: either an RFQ revision, or a Quote revision.
export type RevisionTimelineItem =
  | ({ kind: "rfq" } & RfqRevisionRecord)
  | ({ kind: "quote" } & QuoteRevision);

// Diff of two RFQ revisions (or revision vs current state).
export type RfqRevisionDiff = {
  a: { revisionNumber: number; source: "revision" | "current" };
  b: { revisionNumber: number; source: "revision" | "current" };
  fields: Array<{
    field: "projectName" | "deadline" | "projectDetails" | "requestedBy" | "companyId" | "contactId";
    before: string | null;
    after: string | null;
    changed: boolean;
  }>;
  attachments: {
    added: Attachment[];
    removed: Attachment[];
    unchanged: Attachment[];
  };
};

export type Approval = {
  id: string;
  quoteRevisionId: string;
  decidedBy: string;
  decision: "APPROVED" | "REJECTED";
  comment: string;
  decidedAt: string;
};

export type CompanySummary = {
  id: string;
  name: string;
  sector: string | null;
  country: string | null;
  city: string | null;
};

export type ContactSummary = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
};

export type RfqRecord = {
  id: string;
  projectName: string;
  deadline: string;
  projectDetails: string;
  requestedBy: string;
  status: RfqStatus;
  createdAt: string;
  assignedPricingUserId: string | null;
  assignedPricingUser: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  // Faz 3: Deal outcome tracking
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  // Faz 3 — Feature 3: stall / follow-up tracking
  lastCustomerActivityAt: string | null;
  company: CompanySummary | null;
  contact: ContactSummary | null;
  attachments: Attachment[];
  quoteRevisions: QuoteRevision[];
  approvals: Approval[];
};

// Faz 3 — Feature 3: A recorded follow-up attempt.
export type FollowUpActivityRecord = {
  id: string;
  rfqId: string;
  performedBy: string;
  performedById: string;
  note: string | null;
  performedAt: string;
};

// Faz 3 — Feature 3: Derived stall indicator used by UI badges and filters.
export type StallLevel = "fresh" | "warning" | "stale";

export function computeStallLevel(
  status: RfqStatus,
  lastCustomerActivityAt: string | null
): { level: StallLevel; daysSilent: number | null } {
  if (status !== "QUOTED" || !lastCustomerActivityAt) {
    return { level: "fresh", daysSilent: null };
  }
  const daysSilent = Math.floor(
    (Date.now() - new Date(lastCustomerActivityAt).getTime()) / (24 * 60 * 60 * 1000)
  );
  if (daysSilent >= 60) return { level: "stale", daysSilent };
  if (daysSilent >= 10) return { level: "warning", daysSilent };
  return { level: "fresh", daysSilent };
}

// ── CRM (Faz A) ────────────────────────────────────────────────────
export const PROJECT_STAGES = [
  "IDENTIFIED",
  "CONTACTED",
  "ENGAGED",
  "TENDER",
  "WON",
  "LOST",
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const PROJECT_STAGE_LABELS: Record<ProjectStage, string> = {
  IDENTIFIED: "Identified",
  CONTACTED: "Contacted",
  ENGAGED: "Engaged",
  TENDER: "Tender / RFQ",
  WON: "Won",
  LOST: "Lost",
};

// Pipeline'da hâlâ aktif (kapanmamış) aşamalar.
export const OPEN_PROJECT_STAGES = [
  "IDENTIFIED",
  "CONTACTED",
  "ENGAGED",
  "TENDER",
] as const satisfies readonly ProjectStage[];

export const PROJECT_SOURCES = ["MANUAL", "BARBOUR", "REFERRAL", "REPEAT_CLIENT", "OTHER"] as const;
export type ProjectSource = (typeof PROJECT_SOURCES)[number];

export const PROJECT_CATEGORIES = [
  "JOINERY",
  "FFE",
  "FIT_OUT",
  "KITCHEN",
  "BAR_RESTAURANT",
  "RECEPTION",
  "BEDROOM_CASEGOODS",
  "RETAIL",
  "OTHER",
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  JOINERY: "Joinery",
  FFE: "FF&E",
  FIT_OUT: "Fit-Out",
  KITCHEN: "Kitchen",
  BAR_RESTAURANT: "Bar / Restaurant",
  RECEPTION: "Reception",
  BEDROOM_CASEGOODS: "Bedroom Casegoods",
  RETAIL: "Retail",
  OTHER: "Other",
};

export const COMPANY_ROLES = [
  "CLIENT_EMPLOYER",
  "MAIN_CONTRACTOR",
  "ARCHITECT",
  "QS_COST_CONSULTANT",
  "INTERIOR_DESIGNER",
  "SUBCONTRACTOR",
  "DEVELOPER",
  "OTHER",
] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  CLIENT_EMPLOYER: "Client / Employer",
  MAIN_CONTRACTOR: "Main Contractor",
  ARCHITECT: "Architect",
  QS_COST_CONSULTANT: "QS / Cost Consultant",
  INTERIOR_DESIGNER: "Interior Designer",
  SUBCONTRACTOR: "Subcontractor",
  DEVELOPER: "Developer",
  OTHER: "Other",
};

export const LOSS_REASONS = [
  "PRICE",
  "TIMELINE",
  "LOST_TO_COMPETITOR",
  "CANCELLED",
  "NO_BUDGET",
  "OTHER",
] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
  PRICE: "Price too high",
  TIMELINE: "Timeline mismatch",
  LOST_TO_COMPETITOR: "Lost to competitor",
  CANCELLED: "Project cancelled",
  NO_BUDGET: "No budget",
  OTHER: "Other",
};

export function isOpenProjectStage(stage: ProjectStage): boolean {
  return (OPEN_PROJECT_STAGES as readonly ProjectStage[]).includes(stage);
}

// A company in its role on a specific project.
export type ProjectCompanyLink = {
  id: string;
  companyId: string;
  companyName: string;
  role: CompanyRole;
  isPrimary: boolean;
};

// A contact attached to a project.
export type ProjectContactLink = {
  id: string;
  contactId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  companyName: string;
  note: string | null;
};

export type ProjectStageEventRecord = {
  id: string;
  fromStage: ProjectStage | null;
  toStage: ProjectStage;
  changedBy: string;
  changedAt: string;
  note: string | null;
};

// Compact card for the pipeline board.
export type ProjectCard = {
  id: string;
  title: string;
  stage: ProjectStage;
  projectCategory: ProjectCategory | null;
  value: number | null;
  currency: Currency;
  primaryCompanyName: string | null;
  ownerName: string;
  stageUpdatedAt: string;
  createdAt: string;
};

// Full project detail.
export type ProjectRecord = {
  id: string;
  title: string;
  description: string | null;
  stage: ProjectStage;
  source: ProjectSource;
  externalRef: string | null;
  importedAt: string | null;
  projectCategory: ProjectCategory | null;
  unitCount: number | null;
  value: number | null;
  currency: Currency;
  expectedStartDate: string | null;
  siteCity: string | null;
  siteRegion: string | null;
  sitePostcode: string | null;
  probability: number | null;
  lostReasonCode: LossReason | null;
  lostReason: string | null;
  stageUpdatedAt: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  companies: ProjectCompanyLink[];
  contacts: ProjectContactLink[];
  rfqs: Array<{ id: string; projectName: string; status: RfqStatus }>;
  attachments: Attachment[];
};

// One column of the kanban board.
export type ProjectBoardColumn = {
  stage: ProjectStage;
  count: number;
  totalValueByCurrency: Array<{ currency: string; total: number }>;
  cards: ProjectCard[];
};

export type ProjectBoard = {
  columns: ProjectBoardColumn[];
};

// ── Action Result (for server actions) ─────────────────────────────
export type ActionResult = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
};

export const IDLE_RESULT: ActionResult = { status: "idle", message: "" };
