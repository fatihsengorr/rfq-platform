// Re-export domain types from the shared package so existing imports keep working.
export type {
  RfqStatus,
  Attachment,
  QuoteRevision,
  Approval,
  CompanySummary,
  ContactSummary,
  RfqRecord,
} from "@crm/shared";

export { RFQ_STATUSES as rfqStatuses } from "@crm/shared";

import type { RfqRecord, RfqStatus } from "@crm/shared";

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
