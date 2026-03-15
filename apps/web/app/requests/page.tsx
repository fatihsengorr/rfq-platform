import Link from "next/link";
import { redirect } from "next/navigation";
import { getRfqs, isApiClientError } from "../api";
import { FlashNotice } from "../components/flash-notice";
import { latestQuoteLabel, statusLabel, type RfqRecord } from "../data";
import { getSession, type SessionUser } from "../../lib/session";

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
      redirect("/logout?next=/login");
    }

    rfqs = [];
  }

  const rows = focus === "approval" ? rfqs.filter((item) => item.status === "PENDING_MANAGER_APPROVAL") : rfqs;

  return (
    <main className="shell">
      <header className="page-header">
        <h1>RFQ Requests</h1>
        <p>{roleSummary(session.user.role)}</p>
      </header>

      <FlashNotice path="/requests" notices={requestNotices} />

      {canCreateRfq && (
        <section className="panel">
          <div className="panel-title-row">
            <h2>Create New RFQ</h2>
            <span className="inline-hint">London users and admin can create requests.</span>
          </div>
          <div>
            <Link href="/requests/new" className="primary-btn">
              Go to New Request Form
            </Link>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-title-row">
          <h2>Request List</h2>
          <span className="inline-hint">{focus === "approval" ? "Filtered: pending manager approval" : `Total: ${rows.length}`}</span>
        </div>

        {rows.length === 0 ? (
          <p>No records found or API is unreachable.</p>
        ) : (
          <div className="data-table">
            <div className="data-head requests-grid">
              <span>Project</span>
              <span>Requested By</span>
              <span>Assigned Pricing</span>
              <span>Deadline</span>
              <span>Status</span>
              <span>Latest Quote</span>
            </div>

            {rows.map((item) => (
              <Link href={`/requests/${item.id}`} key={item.id} className="data-row requests-grid">
                <span>{item.projectName}</span>
                <span>{item.requestedBy}</span>
                <span>{item.assignedPricingUser ?? "-"}</span>
                <span>{new Date(item.deadline).toLocaleString("en-GB")}</span>
                <span className={`status-pill status-${item.status}`}>{statusLabel(item.status)}</span>
                <span>{latestQuoteLabel(item)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
