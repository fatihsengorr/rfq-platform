export const CURRENCIES = ["GBP", "EUR", "USD", "TRY"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const ROLES = ["LONDON_SALES", "ISTANBUL_PRICING", "ISTANBUL_MANAGER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

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

export type RfqSummary = {
  id: string;
  projectName: string;
  deadline: string;
  requestedBy: string;
  status: RfqStatus;
};
