export const USER_ROLES = [
  "LONDON_SALES",
  "ISTANBUL_PRICING",
  "ISTANBUL_MANAGER",
  "ADMIN"
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const RFQ_STATUSES = [
  "NEW",
  "IN_REVIEW",
  "PRICING_IN_PROGRESS",
  "PENDING_MANAGER_APPROVAL",
  "QUOTED",
  "REVISION_REQUESTED",
  "CLOSED"
] as const;

export type RfqStatus = (typeof RFQ_STATUSES)[number];

export type QuoteRevisionStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

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
  currency: "GBP" | "EUR" | "USD" | "TRY";
  totalAmount: number;
  notes: string;
  status: QuoteRevisionStatus;
  createdAt: string;
  createdBy: string;
  attachments: Attachment[];
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
  company: CompanySummary | null;
  contact: ContactSummary | null;
  attachments: Attachment[];
  quoteRevisions: QuoteRevision[];
  approvals: Approval[];
};
