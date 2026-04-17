"use client";

import { useState } from "react";
import Link from "next/link";
import type { RfqRecord } from "../../../data";
import { statusLabel, latestQuoteLabel } from "../../../data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Paperclip } from "lucide-react";
import { FilePreviewItem } from "@/components/ui/file-preview";
import { PillTabList, PillTab } from "@/components/ui/pill-tabs";
import { formatDateTime } from "@/lib/format";

// Faz 3 — Feature 2: Revisions and Timeline moved to the top-level
// "Revisions" tab. DetailsCard now only shows Overview + Files.
type DetailTab = "overview" | "files";

type DetailsCardProps = {
  record: RfqRecord;
};

const tabConfig: Array<{ key: DetailTab; icon: React.ReactNode; label: string }> = [
  { key: "overview", icon: <FileText className="size-3" />, label: "Overview" },
  { key: "files", icon: <Paperclip className="size-3" />, label: "Files" },
];

export function DetailsCard({ record }: DetailsCardProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Details</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/quotes">Open Quotes</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <PillTabList className="mb-4">
          {tabConfig.map((tab) => (
            <PillTab
              key={tab.key}
              active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              icon={tab.icon}
            >
              {tab.label}
            </PillTab>
          ))}
        </PillTabList>

        {activeTab === "overview" && (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
            {[
              ["Deadline", formatDateTime(record.deadline)],
              ["Requested By", record.requestedBy],
              ["Status", statusLabel(record.status)],
              ["Assigned Pricing User", record.assignedPricingUser ?? "Not assigned yet"],
              ["Assigned By", record.assignedBy ?? "-"],
              ["Latest Quote Visible", latestQuoteLabel(record) === "-" ? "None yet" : latestQuoteLabel(record)],
              ["Request Attachment Count", String(record.attachments.length)],
            ].map(([label, value]) => (
              <div key={label} className="py-2 border-b border-dashed border-border">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold text-sm mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "files" && (
          <div className="grid sm:grid-cols-2 gap-6 items-start">
            <FileColumn
              title="Request Files"
              emptyMessage="No request attachments yet."
              isEmpty={record.attachments.length === 0}
            >
              {record.attachments.map((a) => (
                <FilePreviewItem key={a.id} attachment={a} />
              ))}
            </FileColumn>
            <FileColumn
              title="Quote Files"
              emptyMessage="No quote attachments visible."
              isEmpty={record.quoteRevisions.every((r) => r.attachments.length === 0)}
            >
              {record.quoteRevisions.flatMap((r) =>
                r.attachments.map((a) => (
                  <FilePreviewItem key={a.id} attachment={a} versionLabel={`V${r.versionNumber}`} />
                ))
              )}
            </FileColumn>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

/**
 * Each files column (Request / Quote) renders inside its own bordered block
 * so an empty state has the same visual weight as a populated one. Without
 * this, a single-line "No attachments" string on one side was visually
 * colliding with the file tiles on the other side (grid row-stretch made
 * the text land in the middle of a neighbouring tile).
 */
function FileColumn({
  title,
  emptyMessage,
  isEmpty,
  children,
}: {
  title: string;
  emptyMessage: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h3 className="font-bold text-sm mb-3">{title}</h3>
      {isEmpty ? (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-2">{children}</div>
      )}
    </div>
  );
}
