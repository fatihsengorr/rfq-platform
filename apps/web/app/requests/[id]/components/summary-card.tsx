import type { RfqRecord } from "../../../data";
import { latestQuoteLabel } from "../../../data";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeadlineBadge } from "@/components/ui/deadline-badge";

type SummaryCardProps = {
  record: RfqRecord;
};

export function SummaryCard({ record }: SummaryCardProps) {
  const totalFiles = record.attachments.length +
    record.quoteRevisions.reduce((sum, r) => sum + r.attachments.length, 0);

  return (
    <Card className="mt-4">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground">RFQ Status</p>
            <div className="mt-1"><StatusBadge status={record.status} /></div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground">Deadline</p>
            <p className="mt-1 font-semibold text-sm">{new Date(record.deadline).toLocaleString("en-GB")}</p>
            {record.status !== "CLOSED" && <DeadlineBadge deadline={record.deadline} className="mt-1" />}
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground">Requested By</p>
            <p className="mt-1 font-semibold text-sm">{record.requestedBy}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground">Assigned Pricing</p>
            <p className="mt-1 font-semibold text-sm">{record.assignedPricingUser ?? "Not assigned yet"}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground">Latest Quote</p>
            <p className="mt-1 font-semibold text-sm">{latestQuoteLabel(record) === "-" ? "None yet" : latestQuoteLabel(record)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground">Total Files</p>
            <p className="mt-1 font-semibold text-sm">{totalFiles}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-foreground leading-relaxed">{record.projectDetails}</p>
      </CardContent>
    </Card>
  );
}
