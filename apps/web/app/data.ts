export type RfqStatus =
  | "NEW"
  | "IN_REVIEW"
  | "PRICING_IN_PROGRESS"
  | "PENDING_MANAGER_APPROVAL"
  | "QUOTED"
  | "REVISION_REQUESTED"
  | "CLOSED";

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
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
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
  attachments: Attachment[];
  quoteRevisions: QuoteRevision[];
  approvals: Approval[];
};

export const rfqStatuses: RfqStatus[] = [
  "NEW", "IN_REVIEW", "PRICING_IN_PROGRESS",
  "PENDING_MANAGER_APPROVAL", "QUOTED", "REVISION_REQUESTED", "CLOSED"
];

export function statusLabel(status: RfqStatus) {
  const labels: Record<RfqStatus, string> = {
    NEW: "New",
    IN_REVIEW: "In Review",
    PRICING_IN_PROGRESS: "Pricing In Progress",
    PENDING_MANAGER_APPROVAL: "Pending Manager Approval",
    QUOTED: "Quoted",
    REVISION_REQUESTED: "Revision Requested",
    CLOSED: "Closed"
  };

  return labels[status];
}

export function latestQuoteLabel(rfq: RfqRecord): string {
  if (rfq.quoteRevisions.length === 0) {
    return "-";
  }

  const latest = [...rfq.quoteRevisions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
  const amount = latest.totalAmount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `V${latest.versionNumber} - ${latest.currency} ${amount}`;
}
