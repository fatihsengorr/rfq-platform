"use client";

import { useState } from "react";
import Link from "next/link";
import type { RfqRecord } from "../../../data";
import { statusLabel, latestQuoteLabel } from "../../../data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Paperclip, Receipt, Clock } from "lucide-react";

type DetailTab = "overview" | "files" | "revisions" | "timeline";

type DetailsCardProps = {
  record: RfqRecord;
};

const tabConfig: Array<{ key: DetailTab; icon: React.ReactNode; label: string }> = [
  { key: "overview", icon: <FileText className="size-3" />, label: "Overview" },
  { key: "files", icon: <Paperclip className="size-3" />, label: "Files" },
  { key: "revisions", icon: <Receipt className="size-3" />, label: "Revisions" },
  { key: "timeline", icon: <Clock className="size-3" />, label: "Timeline" },
];

export function DetailsCard({ record }: DetailsCardProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Details</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/quotes">Open Quotes</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {tabConfig.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${
                activeTab === tab.key
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
            {[
              ["Deadline", new Date(record.deadline).toLocaleString("en-GB")],
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
              <h3 className="font-bold text-sm mb-2">Request Files</h3>
              {record.attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No request attachments yet.</p>
              ) : (
                <ul className="grid gap-2">
                  {record.attachments.map((a) => (
                    <li key={a.id} className="flex items-start gap-2 text-sm">
                      <Paperclip className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      <span>
                        <a href={`/attachments/${a.id}`} target="_blank" rel="noreferrer" className="font-semibold hover:text-primary transition-colors">{a.fileName}</a>{" "}
                        <span className="text-muted-foreground">({a.mimeType}) by {a.uploadedBy}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm mb-2">Quote Files</h3>
              {record.quoteRevisions.every((r) => r.attachments.length === 0) ? (
                <p className="text-sm text-muted-foreground">No quote attachments visible.</p>
              ) : (
                <ul className="grid gap-2">
                  {record.quoteRevisions.flatMap((r) =>
                    r.attachments.map((a) => (
                      <li key={a.id} className="flex items-start gap-2 text-sm">
                        <Paperclip className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <span>
                          V{r.versionNumber}:{" "}
                          <a href={`/attachments/${a.id}`} target="_blank" rel="noreferrer" className="font-semibold hover:text-primary transition-colors">{a.fileName}</a>{" "}
                          <span className="text-muted-foreground">({a.mimeType}) by {a.uploadedBy}</span>
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === "revisions" && (
          <>
            {record.quoteRevisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quote revisions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {record.quoteRevisions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold">V{r.versionNumber}</TableCell>
                      <TableCell>{r.currency} {r.totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-sm">{r.createdBy}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleString("en-GB")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}

        {activeTab === "timeline" && (
          <ol className="grid gap-2 pl-4 list-decimal">
            <li className="text-sm"><span className="font-semibold">RFQ created</span> — {new Date(record.createdAt).toLocaleString("en-GB")}</li>
            {record.quoteRevisions.map((r) => (
              <li key={r.id} className="text-sm">
                <span className="font-semibold">Quote V{r.versionNumber}</span> ({r.status}) {r.currency} {r.totalAmount.toLocaleString("en-GB")} — {new Date(r.createdAt).toLocaleString("en-GB")}
              </li>
            ))}
            {record.approvals.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-semibold">Manager decision</span> ({a.decision}) — {new Date(a.decidedAt).toLocaleString("en-GB")}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
