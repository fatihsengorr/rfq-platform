import Link from "next/link";
import { redirect } from "next/navigation";
import { getRfqs, isApiClientError } from "../api";
import { FlashNotice } from "../components/flash-notice";
import { latestQuoteLabel, statusLabel, type RfqRecord } from "../data";
import { getSession, type SessionUser } from "../../lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

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

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  const canCreateRfq = session.user.role === "LONDON_SALES" || session.user.role === "ADMIN";
  const focus = (await searchParams).focus;

  let rfqs: RfqRecord[] = [];

  try {
    rfqs = await getRfqs();
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") {
      redirect("/login");
    }
    rfqs = [];
  }

  const rows = focus === "approval" ? rfqs.filter((item) => item.status === "PENDING_MANAGER_APPROVAL") : rfqs;

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

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Request List</CardTitle>
          <Badge variant="outline">
            {focus === "approval" ? "Filtered: pending manager approval" : `Total: ${rows.length}`}
          </Badge>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No records found or API is unreachable.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Requested By</TableHead>
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
                    <TableCell className="text-sm">{item.requestedBy}</TableCell>
                    <TableCell className="text-sm">{item.assignedPricingUser ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.deadline).toLocaleString("en-GB")}
                    </TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
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
