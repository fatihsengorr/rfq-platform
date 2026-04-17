"use client";

/**
 * Faz 3 — Feature 2: Revisions timeline view.
 *
 * Shows the interleaved history of:
 *   - RFQ revisions (snapshots of the scope when it was revised)
 *   - Quote revisions (each pricing round, linked to an optional RFQ revision)
 *
 * Also offers a "Compare" widget: pick two RFQ revisions (or one + current)
 * and see a field-by-field diff with attachment changes.
 */

import { useEffect, useState } from "react";
import { fetchRevisionDiff, fetchRevisions } from "../revision-actions";
import type { RevisionTimelineItem, RfqRevisionDiff } from "@crm/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, History, GitCompare, Paperclip } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type Props = {
  rfqId: string;
  initialItems?: RevisionTimelineItem[];
};

const selectCls =
  "h-9 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RevisionsTab({ rfqId, initialItems }: Props) {
  // Start with data from the server render when available — avoids a flash
  // of "loading" and an extra round-trip on first paint.
  const [items, setItems] = useState<RevisionTimelineItem[] | null>(initialItems ?? null);
  const [loading, setLoading] = useState(!initialItems);
  const [error, setError] = useState<string | null>(null);

  // Compare picker state — both default to "current" (0) until user picks.
  const [compareA, setCompareA] = useState<number>(() => {
    const firstRfq = initialItems?.find((i) => i.kind === "rfq");
    return firstRfq && firstRfq.kind === "rfq" ? firstRfq.revisionNumber : -1;
  });
  const [compareB, setCompareB] = useState<number>(0);
  const [diff, setDiff] = useState<RfqRevisionDiff | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    // Skip the fetch when the server already handed us initial data.
    if (initialItems) return;

    let cancelled = false;
    setLoading(true);
    fetchRevisions(rfqId)
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setError(null);
          const firstRfq = data.find((i) => i.kind === "rfq");
          if (firstRfq && firstRfq.kind === "rfq") {
            setCompareA(firstRfq.revisionNumber);
          }
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rfqId, initialItems]);

  async function runCompare() {
    if (compareA < 0) return;
    setComparing(true);
    setDiff(null);
    try {
      const result = await fetchRevisionDiff(rfqId, compareA, compareB);
      setDiff(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setComparing(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Loading revisions…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-danger">Failed to load revisions: {error}</CardContent>
      </Card>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <History className="size-4" />
          No revisions yet. When you revise the request or issue a new quote, they will appear here.
        </CardContent>
      </Card>
    );
  }

  const rfqRevs = items.filter((i): i is Extract<RevisionTimelineItem, { kind: "rfq" }> => i.kind === "rfq");

  return (
    <div className="space-y-4">
      {/* Compare picker */}
      {rfqRevs.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GitCompare className="size-4" /> Compare RFQ revisions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">From (A)</Label>
                <select
                  className={selectCls}
                  value={compareA}
                  onChange={(e) => setCompareA(Number(e.target.value))}
                >
                  <option value={-1} disabled>— choose —</option>
                  {rfqRevs.map((r) => (
                    <option key={r.id} value={r.revisionNumber}>
                      RFQ v{r.revisionNumber} · {formatDateTime(r.changedAt)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-muted-foreground pb-2">→</div>
              <div className="grid gap-1">
                <Label className="text-xs">To (B)</Label>
                <select
                  className={selectCls}
                  value={compareB}
                  onChange={(e) => setCompareB(Number(e.target.value))}
                >
                  <option value={0}>Current</option>
                  {rfqRevs.map((r) => (
                    <option key={r.id} value={r.revisionNumber}>
                      RFQ v{r.revisionNumber}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={runCompare} disabled={compareA < 0 || comparing}>
                {comparing ? <><Loader2 className="size-4 animate-spin" />Comparing…</> : "Compare"}
              </Button>
            </div>

            {diff && <DiffView diff={diff} />}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="size-4" /> Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <TimelineRow key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineRow({ item }: { item: RevisionTimelineItem }) {
  if (item.kind === "rfq") {
    return (
      <div className="rounded-md border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="new">RFQ v{item.revisionNumber}</Badge>
              <span className="text-sm font-semibold truncate">{item.projectName}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDateTime(item.changedAt)} · {item.changedBy}
            </p>
          </div>
        </div>
        <p className="mt-2 text-sm">
          <span className="font-semibold">Reason:</span> {item.changeReason}
        </p>
        {item.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.attachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs hover:bg-muted"
                title={att.fileName}
              >
                <Paperclip className="size-3" />
                <span className="truncate max-w-[180px]">{att.fileName}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Quote revision
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="approved">Quote v{item.versionNumber}</Badge>
            <span className="text-sm font-semibold">
              {item.currency} {item.totalAmount.toLocaleString("en-GB")}
            </span>
            <Badge variant={item.status === "APPROVED" ? "approved" : item.status === "REJECTED" ? "rejected" : "pending"}>
              {item.status}
            </Badge>
            {item.rfqRevisionNumber != null && (
              <Badge variant="outline" className="text-[10px]">↳ priced against RFQ v{item.rfqRevisionNumber}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDateTime(item.createdAt)} · {item.createdBy}
          </p>
        </div>
      </div>
      {item.changeReason && (
        <p className="mt-2 text-sm">
          <span className="font-semibold">Reason:</span> {item.changeReason}
        </p>
      )}
      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
      {item.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.attachments.map((att) => (
            <a
              key={att.id}
              href={att.url}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs hover:bg-muted"
              title={att.fileName}
            >
              <FileText className="size-3" />
              <span className="truncate max-w-[180px]">{att.fileName}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DiffView({ diff }: { diff: RfqRevisionDiff }) {
  const fieldLabels: Record<string, string> = {
    projectName: "Project Name",
    deadline: "Deadline",
    projectDetails: "Project Details",
    requestedBy: "Requested By",
    companyId: "Company",
    contactId: "Contact",
  };

  const changed = diff.fields.filter((f) => f.changed);
  const unchanged = diff.fields.filter((f) => !f.changed);

  return (
    <div className="mt-2 space-y-3">
      <p className="text-xs text-muted-foreground">
        Comparing {diff.a.source === "current" ? "Current" : `v${diff.a.revisionNumber}`} →{" "}
        {diff.b.source === "current" ? "Current" : `v${diff.b.revisionNumber}`}
      </p>

      {changed.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No field-level changes between these revisions.</p>
      ) : (
        <div className="space-y-2">
          {changed.map((f) => (
            <div key={f.field} className="rounded-md border border-border p-2">
              <p className="text-xs font-semibold text-muted-foreground mb-1">{fieldLabels[f.field] ?? f.field}</p>
              <div className="grid md:grid-cols-2 gap-2">
                <div className="rounded bg-[#fdeaea] border border-[#ebb2b2] p-2 text-xs whitespace-pre-wrap break-words">
                  <span className="font-semibold text-[#882f2f]">Before: </span>
                  {f.before ?? <em className="opacity-60">empty</em>}
                </div>
                <div className="rounded bg-[#e7f7ed] border border-[#98d4af] p-2 text-xs whitespace-pre-wrap break-words">
                  <span className="font-semibold text-[#2d6a1e]">After: </span>
                  {f.after ?? <em className="opacity-60">empty</em>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attachment diff */}
      <div className="rounded-md border border-border p-2">
        <p className="text-xs font-semibold text-muted-foreground mb-1">Attachments</p>
        <div className="grid gap-1 text-xs">
          {diff.attachments.added.map((a) => (
            <div key={`add-${a.id}`} className="text-[#2d6a1e]">+ {a.fileName}</div>
          ))}
          {diff.attachments.removed.map((a) => (
            <div key={`rem-${a.id}`} className="text-[#882f2f]">− {a.fileName}</div>
          ))}
          {diff.attachments.added.length === 0 && diff.attachments.removed.length === 0 && (
            <div className="text-muted-foreground italic">No attachment changes.</div>
          )}
        </div>
      </div>

      {unchanged.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Unchanged fields: {unchanged.map((f) => fieldLabels[f.field] ?? f.field).join(", ")}
        </p>
      )}
    </div>
  );
}
