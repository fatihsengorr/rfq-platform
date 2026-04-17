import { Badge, type BadgeProps } from "./badge";

const rfqStatusMap: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  NEW: { label: "New", variant: "new" },
  IN_REVIEW: { label: "In Review", variant: "progress" },
  PRICING_IN_PROGRESS: { label: "Pricing", variant: "progress" },
  PENDING_MANAGER_APPROVAL: { label: "Pending Approval", variant: "pending" },
  QUOTED: { label: "Quoted", variant: "approved" },
  REVISION_REQUESTED: { label: "Revision Requested", variant: "revision" },
  WON: { label: "Won", variant: "won" },
  LOST: { label: "Lost", variant: "lost" },
  CLOSED: { label: "Closed", variant: "closed" },
  // Quote revision statuses
  DRAFT: { label: "Draft", variant: "progress" },
  SUBMITTED: { label: "Submitted", variant: "pending" },
  APPROVED: { label: "Approved", variant: "approved" },
  REJECTED: { label: "Rejected", variant: "rejected" },
  // User statuses
  active: { label: "Active", variant: "active" },
  inactive: { label: "Inactive", variant: "inactive" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = rfqStatusMap[status] ?? { label: status, variant: "outline" as const };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
