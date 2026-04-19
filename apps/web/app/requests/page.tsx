import Link from "next/link";
import { redirect } from "next/navigation";
import { getRfqs, isApiClientError } from "../api";
import { FlashNotice } from "../components/flash-notice";
import { latestQuoteLabel, statusLabel, rfqStatuses, type RfqRecord, type RfqStatus } from "../data";
import { computeStallLevel } from "@crm/shared";
import { getSession, type SessionUser } from "../../lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeadlineBadge } from "@/components/ui/deadline-badge";
import { FileText, Plus, Filter, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";

const requestNotices = {
  rfq_create_failed: {
    tone: "error",
    text: "RFQ could not be created. Please check fields and try again."
  },
  rfq_create_invalid: {
    tone: "error",
    text: "Request validation failed. Please review the required fields."
  },
  rfq_create_forbidden: {
    tone: "error",
    text: "You do not have permission to create an RFQ."
  },
  rfq_not_found: {
    tone: "error",
    text: "RFQ record was not found."
  },
  login_success: {
    tone: "success",
    text: "You have signed in successfully."
  },
  api_unreachable: {
    tone: "error",
    text: "API is unreachable. Please check if backend is running."
  }
} as const;

function roleSummary(role: SessionUser["role"]) {
  if (role === "LONDON_SALES") return "Create and revise request details, then follow approved offer visibility.";
  if (role === "ISTANBUL_PRICING") return "Work only on assigned requests and submit quote revisions with files.";
  if (role === "ISTANBUL_MANAGER") return "Assign requests to pricing users and process approval decisions.";
  return "See every request and manage cross-team workflow.";
}

const statusOrder: Record<string, number> = {
  NEW: 0, IN_REVIEW: 1, PRICING_IN_PROGRESS: 2,
  PENDING_MANAGER_APPROVAL: 3, REVISION_REQUESTED: 4, QUOTED: 5, CLOSED: 6,
};

/**
 * Faz 3 — Feature 3: Stall indicator next to status on the list.
 * Only shown for QUOTED RFQs that have been silent for 10+ days.
 */
function StallBadge({ rfq }: { rfq: RfqRecord }) {
  const { level, daysSilent } = computeStallLevel(rfq.status, rfq.lastCustomerActivityAt);
  if (level === "fresh" || daysSilent === null) return null;
  const className =
    level === "stale"
      ? "bg-[#fdeaea] text-[#882f2f] border-[#ebb2b2]"
      : "bg-[#fff1d7] text-[#855615] border-[#ebcc8f]";
  const label = level === "stale" ? `🕸️ ${daysSilent}d silent` : `⏱️ ${daysSilent}d silent`;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string; q?: string; status?: string; assigned?: string; sort?: string; stall?: string }>;
}) {
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  const canCreateRfq = session.user.role === "LONDON_SALES" || session.user.role === "ADMIN";
  const params = await searchParams;
  const focus = params.focus;

  let rfqs: RfqRecord[] = [];

  try {
    rfqs = await getRfqs();
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") {
      redirect("/login");
    }
    rfqs = [];
  }

  // ── Filtering ────────────────────────
  const searchQuery = (params.q ?? "").trim().toLowerCase();
  const statusFilter = rfqStatuses.includes(params.status as RfqStatus) ? (params.status as RfqStatus) : "";
  const assignedFilter = params.assigned ?? "";
  const sortParam = params.sort ?? "deadline";
  // Faz 3 — Feature 3: "Follow-up needed" filter surfaces quotes that have
  // gone silent for 10+ days so managers can act without digging through
  // the whole list.
  const stallFilter = params.stall === "needed" ? "needed" : "";

  let rows = [...rfqs];

  // Dashboard "focus=approval" shortcut
  if (focus === "approval") {
    rows = rows.filter((item) => item.status === "PENDING_MANAGER_APPROVAL");
  }

  // Text search
  if (searchQuery) {
    rows = rows.filter((item) =>
      item.projectName.toLowerCase().includes(searchQuery) ||
      item.requestedBy.toLowerCase().includes(searchQuery) ||
      (item.company?.name ?? "").toLowerCase().includes(searchQuery)
    );
  }

  // Status filter
  if (statusFilter) {
    rows = rows.filter((item) => item.status === statusFilter);
  }

  // Assignment filter
  if (assignedFilter === "assigned") {
    rows = rows.filter((item) => item.assignedPricingUserId !== null);
  } else if (assignedFilter === "unassigned") {
    rows = rows.filter((item) => item.assignedPricingUserId === null);
  }

  // Faz 3 — Feature 3: follow-up needed filter
  if (stallFilter === "needed") {
    rows = rows.filter((item) => {
      const { level } = computeStallLevel(item.status, item.lastCustomerActivityAt);
      return level === "warning" || level === "stale";
    });
  }

  // Sorting
  if (sortParam === "deadline") {
    rows.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  } else if (sortParam === "created") {
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sortParam === "status") {
    rows.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));
  }

  const hasActiveFilters = !!(searchQuery || statusFilter || assignedFilter || stallFilter);

  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      <PageHeader
        title="RFQ Requests"
        description={roleSummary(session.user.role)}
      />

      <FlashNotice path="/requests" notices={requestNotices} />

      {canCreateRfq && (
        <Card className="mt-4">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">Create New RFQ</p>
              <p className="text-sm text-muted-foreground">London users and admin can create requests.</p>
            </div>
            <Button asChild>
              <Link href="/requests/new"><Plus className="size-4" />New Request</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Filters ──────────────────────── */}
      {focus !== "approval" && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <form method="get" className="flex flex-wrap items-end gap-4">
              <div className="grid gap-1">
                <Label className="text-xs">Search</Label>
                <input
                  name="q"
                  type="text"
                  defaultValue={searchQuery}
                  placeholder="Project name, company, or contact..."
                  className="h-9 w-56 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Status</Label>
                <select
                  name="status"
                  defaultValue={statusFilter}
                  className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All Statuses</option>
                  {rfqStatuses.map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Assignment</Label>
                <select
                  name="assigned"
                  defaultValue={assignedFilter}
                  className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
                </select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Follow-up</Label>
                <select
                  name="stall"
                  defaultValue={stallFilter}
                  className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All</option>
                  <option value="needed">Follow-up needed</option>
                </select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Sort By</Label>
                <select
                  name="sort"
                  defaultValue={sortParam}
                  className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="deadline">Deadline</option>
                  <option value="created">Created Date</option>
                  <option value="status">Status</option>
                </select>
              </div>
              <Button type="submit" size="sm">
                <Filter className="size-4" />
                Apply
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/requests">
                    <X className="size-4" />
                    Clear
                  </Link>
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Request List</CardTitle>
          <div className="flex items-center gap-2">
            {focus === "approval" && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/requests">
                  <X className="size-4" />
                  Clear filter
                </Link>
              </Button>
            )}
            <Badge variant="outline">
              {focus === "approval"
                ? "Filtered: pending manager approval"
                : hasActiveFilters
                  ? `Total: ${rfqs.length} | Showing: ${rows.length}`
                  : `Total: ${rows.length}`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No requests found"
              description={hasActiveFilters ? "Try adjusting your filters or search terms." : "No RFQ requests have been created yet."}
              action={canCreateRfq ? { label: "Create New RFQ", href: "/requests/new" } : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Assigned Pricing</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Latest Quote</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link href={`/requests/${item.id}`} className="font-semibold hover:text-primary transition-colors">
                        {item.projectName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.company?.name ?? item.requestedBy}
                      {item.contact && (
                        <span className="block text-xs text-muted-foreground">{item.contact.fullName}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{item.assignedPricingUser ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">{formatDateTime(item.deadline)}</span>
                        {item.status !== "CLOSED" && <DeadlineBadge deadline={item.deadline} />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={item.status} />
                        <StallBadge rfq={item} />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{latestQuoteLabel(item)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
