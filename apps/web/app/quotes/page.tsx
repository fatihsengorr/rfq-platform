import Link from "next/link";
import { redirect } from "next/navigation";
import { getRfqs, isApiClientError } from "../api";
import { type RfqRecord } from "../data";
import { getSession, type SessionUser } from "../../lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Filter } from "lucide-react";
import {
  type QuoteStatus,
  type Currency,
  quoteStatuses,
  currencies,
  flattenQuoteRows,
  groupQuoteRows,
  buildQuotesHref
} from "./helpers";

function roleSummary(role: SessionUser["role"]) {
  if (role === "LONDON_SALES") return "Approved quote revisions are visible for London office.";
  if (role === "ISTANBUL_PRICING") return "Quote revisions for your assigned RFQs are listed here.";
  if (role === "ISTANBUL_MANAGER") return "Review submitted, approved, rejected, and draft quote revisions.";
  return "Full quote visibility across all offices and statuses.";
}

export default async function QuotesPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; currency?: string; rfqId?: string }>;
}) {
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  let rfqs: RfqRecord[] = [];

  let quotesRedirect = "";

  try {
    rfqs = await getRfqs();
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") {
      quotesRedirect = "/login";
    }
    rfqs = [];
  }

  if (quotesRedirect) {
    redirect(quotesRedirect);
  }

  const params = await searchParams;
  const statusFilter = quoteStatuses.includes((params.status ?? "") as QuoteStatus) ? ((params.status as QuoteStatus) ?? "") : "";
  const currencyFilter = currencies.includes((params.currency ?? "") as Currency) ? ((params.currency as Currency) ?? "") : "";
  const requestedRfqId = (params.rfqId ?? "").trim();

  const allRows = flattenQuoteRows(rfqs);
  const groupedRows = groupQuoteRows(rfqs, statusFilter, currencyFilter);
  const shownRows = groupedRows.reduce((total, group) => total + group.rows.length, 0);
  const selectedRfqId =
    groupedRows.some((group) => group.rfqId === requestedRfqId) ? requestedRfqId : (groupedRows[0]?.rfqId ?? "");
  const selectedGroup = groupedRows.find((group) => group.rfqId === selectedRfqId) ?? null;

  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      <PageHeader
        title="Quotes"
        description={roleSummary(session.user.role)}
      />

      {/* ── Filters ──────────────────────── */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <form method="get" className="flex flex-wrap items-end gap-4">
            {selectedRfqId && <input type="hidden" name="rfqId" value={selectedRfqId} />}
            <div className="grid gap-1">
              <Label className="text-xs">Quote Status</Label>
              <select
                name="status"
                defaultValue={statusFilter}
                className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All</option>
                {quoteStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Currency</Label>
              <select
                name="currency"
                defaultValue={currencyFilter}
                className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All</option>
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Button type="submit" size="sm">
              <Filter className="size-4" />
              Apply
            </Button>
            <Badge variant="outline" className="self-end">
              Total: {allRows.length} | Showing: {shownRows}
            </Badge>
          </form>
        </CardContent>
      </Card>

      {/* ── Split Pane ───────────────────── */}
      <div className="mt-4 grid lg:grid-cols-[320px_1fr] gap-4">
        {/* Left — project list */}
        <Card>
          <CardHeader className="flex-row items-center justify-between p-4">
            <CardTitle className="text-base">Projects</CardTitle>
            <Badge variant="outline">{groupedRows.length} listed</Badge>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {groupedRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects found for this filter.</p>
            ) : (
              <div className="grid gap-2">
                {groupedRows.map((group) => {
                  const isActive = group.rfqId === selectedRfqId;
                  const latestRevision = group.rows[0];

                  return (
                    <a
                      href={buildQuotesHref(statusFilter, currencyFilter, group.rfqId)}
                      key={group.rfqId}
                      className={`block rounded-lg border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                        isActive
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <p className="font-semibold text-sm leading-tight">{group.projectName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Requested by {group.requestedBy}</p>
                      <p className="text-xs text-muted-foreground">
                        Revisions: {group.rows.length} | Latest: V{latestRevision.versionNumber}
                      </p>
                    </a>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right — quote detail */}
        <Card>
          <CardContent className="p-4">
            {!selectedGroup ? (
              <p className="text-sm text-muted-foreground">Select a project to view quote revisions.</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <h2 className="text-lg font-bold">{selectedGroup.projectName}</h2>
                    <p className="text-sm text-muted-foreground">Requested by {selectedGroup.requestedBy}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedGroup.rfqStatus} />
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/requests/${selectedGroup.rfqId}`}>
                        Open request <ExternalLink className="size-3" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Revision</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGroup.rows.map((row) => (
                      <TableRow key={`${selectedGroup.rfqId}-${row.versionNumber}-${row.createdAt}`}>
                        <TableCell className="font-semibold">V{row.versionNumber}</TableCell>
                        <TableCell>
                          {row.currency} {row.totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell><StatusBadge status={row.quoteStatus} /></TableCell>
                        <TableCell className="text-sm">{row.createdBy}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(row.createdAt).toLocaleString("en-GB")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
