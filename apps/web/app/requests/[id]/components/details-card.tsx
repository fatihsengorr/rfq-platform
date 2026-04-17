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
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-sm mb-3">Request Files</h3>
              {record.attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No request attachments yet.</p>
              ) : (
                <div className="grid gap-2">
                  {record.attachments.map((a) => (
                    <FilePreviewItem key={a.id} attachment={a} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm mb-3">Quote Files</h3>
              {record.quoteRevisions.every((r) => r.attachments.length === 0) ? (
                <p className="text-sm text-muted-foreground">No quote attachments visible.</p>
              ) : (
                <div className="grid gap-2">
                  {record.quoteRevisions.flatMap((r) =>
                    r.attachments.map((a) => (
                      <FilePreviewItem key={a.id} attachment={a} versionLabel={`V${r.versionNumber}`} />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
