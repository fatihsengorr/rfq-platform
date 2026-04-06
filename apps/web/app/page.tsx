import Link from "next/link";
import { redirect } from "next/navigation";
import { getRfqs, isApiClientError } from "./api";
import { statusLabel, type RfqRecord } from "./data";
import { getSession, type SessionUser } from "../lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeadlineBadge } from "@/components/ui/deadline-badge";
import { getDeadlineUrgency } from "@/lib/deadline";
import { ArrowRight, Inbox, Plus, ShieldCheck, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";

type MetricAccent = "primary" | "accent" | "muted";
type MetricItem = { label: string; value: string; accent: MetricAccent; href?: string };

function roleHeadline(role: SessionUser["role"]) {
  if (role === "LONDON_SALES") return "London Sales Dashboard";
  if (role === "ISTANBUL_PRICING") return "Istanbul Pricing Dashboard";
  if (role === "ISTANBUL_MANAGER") return "Istanbul Manager Dashboard";
  return "Admin Control Dashboard";
}

function roleSubline(role: SessionUser["role"]) {
  if (role === "LONDON_SALES") return "Track sent requests, deadlines, and approved quote visibility.";
  if (role === "ISTANBUL_PRICING") return "Focus on assigned requests and submit quote revisions quickly.";
  if (role === "ISTANBUL_MANAGER") return "Manage assignment workload and approve quote submissions.";
  return "Control users, permissions, and cross-team RFQ performance.";
}

function queueForRole(role: SessionUser["role"], rfqs: RfqRecord[], userId: string) {
  if (role === "ISTANBUL_PRICING") {
    return rfqs.filter((item) => item.assignedPricingUserId === userId);
  }
  if (role === "ISTANBUL_MANAGER") {
    return rfqs.filter((item) => item.status === "PENDING_MANAGER_APPROVAL" || item.assignedPricingUserId === null);
  }
  if (role === "LONDON_SALES") {
    return rfqs.filter((item) => item.status === "NEW" || item.status === "QUOTED" || item.status === "REVISION_REQUESTED");
  }
  return rfqs;
}

function metricsForRole(role: SessionUser["role"], rfqs: RfqRecord[], userId: string): MetricItem[] {
  const unassigned = rfqs.filter((item) => item.assignedPricingUserId === null).length;
  const pendingApproval = rfqs.filter((item) => item.status === "PENDING_MANAGER_APPROVAL").length;
  const quoted = rfqs.filter((item) => item.status === "QUOTED").length;
  const assignedToMe = rfqs.filter((item) => item.assignedPricingUserId === userId).length;
  const overdue = rfqs.filter((item) => item.status !== "CLOSED" && getDeadlineUrgency(item.deadline) === "overdue").length;

  if (role === "LONDON_SALES") {
    return [
      { label: "Open Requests", value: String(rfqs.filter((item) => item.status !== "CLOSED").length), accent: "primary", href: "/requests" },
      { label: "Approved Quotes", value: String(quoted), accent: "accent", href: "/requests?status=QUOTED" },
      { label: "Overdue", value: String(overdue), accent: overdue > 0 ? "primary" : "muted", href: "/requests?sort=deadline" },
      { label: "Needs Revision", value: String(rfqs.filter((item) => item.status === "REVISION_REQUESTED").length), accent: "muted", href: "/requests?status=REVISION_REQUESTED" }
    ];
  }
  if (role === "ISTANBUL_PRICING") {
    return [
      { label: "Assigned To Me", value: String(assignedToMe), accent: "primary", href: "/requests" },
      { label: "Awaiting My Pricing", value: String(rfqs.filter((item) => item.status === "PRICING_IN_PROGRESS" && item.assignedPricingUserId === userId).length), accent: "accent", href: "/requests?status=PRICING_IN_PROGRESS" },
      { label: "Overdue", value: String(overdue), accent: overdue > 0 ? "primary" : "muted", href: "/requests?sort=deadline" },
      { label: "Submitted For Approval", value: String(rfqs.filter((item) => item.status === "PENDING_MANAGER_APPROVAL" && item.assignedPricingUserId === userId).length), accent: "muted", href: "/requests?status=PENDING_MANAGER_APPROVAL" }
    ];
  }
  if (role === "ISTANBUL_MANAGER") {
    return [
      { label: "Pending Approval", value: String(pendingApproval), accent: "accent", href: "/requests?focus=approval" },
      { label: "Unassigned RFQs", value: String(unassigned), accent: "primary", href: "/requests?assigned=unassigned" },
      { label: "Overdue", value: String(overdue), accent: overdue > 0 ? "primary" : "muted", href: "/requests?sort=deadline" },
      { label: "Quoted", value: String(quoted), accent: "muted", href: "/requests?status=QUOTED" }
    ];
  }
  return [
    { label: "Total RFQs", value: String(rfqs.length), accent: "primary", href: "/requests" },
    { label: "Pending Approval", value: String(pendingApproval), accent: "accent", href: "/requests?focus=approval" },
    { label: "Overdue", value: String(overdue), accent: overdue > 0 ? "primary" : "muted", href: "/requests?sort=deadline" },
    { label: "Unassigned", value: String(unassigned), accent: "muted", href: "/requests?assigned=unassigned" }
  ];
}

export default async function HomePage() {
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  let rfqs: RfqRecord[] = [];

  try {
    rfqs = await getRfqs();
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") {
      redirect("/login");
    }
    rfqs = [];
  }

  const queue = queueForRole(session.user.role, rfqs, session.user.id)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 8);
  const role = session.user.role;
  const canCreateRfq = role === "LONDON_SALES" || role === "ADMIN";
  const canReviewApprovals = role === "ISTANBUL_MANAGER" || role === "ADMIN";

  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      {/* ── Hero ─────────────────────────── */}
      <Card className="bg-gradient-to-br from-white via-background to-[#fff5e8] p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          {roleHeadline(session.user.role)}
        </p>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold">Quote Workflow Overview</h1>
        <p className="mt-1 text-muted-foreground">{roleSubline(session.user.role)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/requests">Open Requests</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/quotes">Quotes</Link>
          </Button>
          {canCreateRfq && (
            <Button variant="outline" asChild>
              <Link href="/requests/new"><Plus className="size-4" />Create New RFQ</Link>
            </Button>
          )}
          {canReviewApprovals && (
            <Button variant="outline" asChild>
              <Link href="/requests?focus=approval"><ShieldCheck className="size-4" />Review Approvals</Link>
            </Button>
          )}
          {role === "ADMIN" && (
            <Button variant="outline" asChild>
              <Link href="/admin/users"><Users className="size-4" />Manage Users</Link>
            </Button>
          )}
        </div>
      </Card>

      {/* ── Metrics ──────────────────────── */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metricsForRole(session.user.role, rfqs, session.user.id).map((item) => (
          <KpiCard
            key={item.label}
            label={item.label}
            value={item.value}
            accent={item.accent}
            href={item.href}
          />
        ))}
      </div>

      {/* ── Priority Queue ───────────────── */}
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Priority Queue</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/requests">View all <ArrowRight className="size-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Queue is empty"
              description="No priority items right now. All caught up!"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link href={`/requests/${item.id}`} className="font-semibold hover:text-primary transition-colors">
                        {item.projectName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">{formatDateTime(item.deadline)}</span>
                        {item.status !== "CLOSED" && <DeadlineBadge deadline={item.deadline} />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
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
