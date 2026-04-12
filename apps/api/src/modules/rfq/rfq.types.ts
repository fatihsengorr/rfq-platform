// Re-export all domain types from the shared package.
// This file is kept so existing imports within the API don't need to change.
export type {
  UserRole,
  RfqStatus,
  QuoteRevisionStatus,
  Attachment,
  QuoteRevision,
  Approval,
  CompanySummary,
  ContactSummary,
  RfqRecord,
} from "@crm/shared";

export { USER_ROLES, RFQ_STATUSES } from "@crm/shared";
