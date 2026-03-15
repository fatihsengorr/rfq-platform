import Link from "next/link";
import { redirect } from "next/navigation";
import { getRfqs, isApiClientError } from "./api";
import { statusLabel, type RfqRecord } from "./data";
import { getSession, type SessionUser } from "../lib/session";

type MetricTone = "teal" | "amber" | "slate";
type MetricItem = { label: string; value: string; tone: MetricTone };

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

  if (role === "LONDON_SALES") {
    return [
      { label: "Open Requests", value: String(rfqs.filter((item) => item.status !== "CLOSED").length), tone: "teal" },
      { label: "Approved Quotes", value: String(quoted), tone: "amber" },
      { label: "Needs Revision", value: String(rfqs.filter((item) => item.status === "REVISION_REQUESTED").length), tone: "slate" }
    ];
  }

  if (role === "ISTANBUL_PRICING") {
    return [
      { label: "Assigned To Me", value: String(assignedToMe), tone: "teal" },
      {
        label: "Awaiting My Pricing",
        value: String(rfqs.filter((item) => item.status === "PRICING_IN_PROGRESS" && item.assignedPricingUserId === userId).length),
        tone: "amber"
      },
      {
        label: "Submitted For Approval",
        value: String(rfqs.filter((item) => item.status === "PENDING_MANAGER_APPROVAL" && item.assignedPricingUserId === userId).length),
        tone: "slate"
      }
    ];
  }

  if (role === "ISTANBUL_MANAGER") {
    return [
      { label: "Pending Approval", value: String(pendingApproval), tone: "amber" },
      { label: "Unassigned RFQs", value: String(unassigned), tone: "teal" },
      { label: "Quoted", value: String(quoted), tone: "slate" }
    ];
  }

  return [
    { label: "Total RFQs", value: String(rfqs.length), tone: "teal" },
    { label: "Pending Approval", value: String(pendingApproval), tone: "amber" },
    { label: "Unassigned", value: String(unassigned), tone: "slate" }
  ];
}

function quickLinksForRole(role: SessionUser["role"]) {
  const links: Array<{ href: string; label: string; variant: "primary-btn" | "secondary-btn" }> = [
    { href: "/requests", label: "Open Requests", variant: "primary-btn" },
    { href: "/quotes", label: "Quotes", variant: "secondary-btn" }
  ];

  if (role === "LONDON_SALES" || role === "ADMIN") {
    links.push({ href: "/requests/new", label: "Create New RFQ", variant: "secondary-btn" });
  }

  if (role === "ISTANBUL_MANAGER" || role === "ADMIN") {
    links.push({ href: "/requests?focus=approval", label: "Review Approvals", variant: "secondary-btn" });
  }

  if (role === "ADMIN") {
    links.push({ href: "/admin/users", label: "Manage Users", variant: "secondary-btn" });
  }

  return links;
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

  const queue = queueForRole(session.user.role, rfqs, session.user.id).slice(0, 8);
  const links = quickLinksForRole(session.user.role);

  return (
    <main className="shell">
      <header className="hero dashboard-hero">
        <p className="tag">{roleHeadline(session.user.role)}</p>
        <h1>Quote Workflow Overview</h1>
        <p className="sub">{roleSubline(session.user.role)}</p>
        <div className="hero-actions">
          {links.map((link) => (
            <a key={link.href} href={link.href} className={link.variant}>
              {link.label}
            </a>
          ))}
        </div>
      </header>

      <section className="metrics-grid">
        {metricsForRole(session.user.role, rfqs, session.user.id).map((item) => (
          <article key={item.label} className={`metric metric-${item.tone}`}>
            <p>{item.label}</p>
            <h3>{item.value}</h3>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>Priority Queue</h2>
          <Link href="/requests" className="ghost-link">
            View all
          </Link>
        </div>

        {queue.length === 0 ? (
          <p>No records to show in your queue.</p>
        ) : (
          <div className="data-table">
            <div className="data-head dashboard-grid">
              <span>Project</span>
              <span>Deadline</span>
              <span>Status</span>
            </div>
            {queue.map((item) => (
              <Link href={`/requests/${item.id}`} key={item.id} className="data-row dashboard-grid">
                <span>{item.projectName}</span>
                <span>{new Date(item.deadline).toLocaleString("en-GB")}</span>
                <span className={`status-pill status-${item.status}`}>{statusLabel(item.status)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
