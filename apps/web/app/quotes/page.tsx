import Link from "next/link";
import { redirect } from "next/navigation";
import { getRfqs, isApiClientError } from "../api";
import { statusLabel, type RfqRecord, type QuoteRevision } from "../data";
import { getSession, type SessionUser } from "../../lib/session";

type QuoteStatus = QuoteRevision["status"];
type Currency = QuoteRevision["currency"];

type QuoteRow = {
  versionNumber: number;
  currency: Currency;
  totalAmount: number;
  quoteStatus: QuoteStatus;
  createdBy: string;
  createdAt: string;
};

type ProjectQuoteGroup = {
  rfqId: string;
  projectName: string;
  requestedBy: string;
  rfqStatus: RfqRecord["status"];
  latestCreatedAt: string;
  rows: QuoteRow[];
};

function roleSummary(role: SessionUser["role"]) {
  if (role === "LONDON_SALES") {
    return "Approved quote revisions are visible for London office.";
  }

  if (role === "ISTANBUL_PRICING") {
    return "Quote revisions for your assigned RFQs are listed here.";
  }

  if (role === "ISTANBUL_MANAGER") {
    return "Review submitted, approved, rejected, and draft quote revisions.";
  }

  return "Full quote visibility across all offices and statuses.";
}

function flattenQuoteRows(rfqs: RfqRecord[]): QuoteRow[] {
  return rfqs
    .flatMap((rfq) =>
      rfq.quoteRevisions.map((revision) => ({
        versionNumber: revision.versionNumber,
        currency: revision.currency,
        totalAmount: revision.totalAmount,
        quoteStatus: revision.status,
        createdBy: revision.createdBy,
        createdAt: revision.createdAt
      }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function groupQuoteRows(rfqs: RfqRecord[], statusFilter: QuoteStatus | "", currencyFilter: Currency | ""): ProjectQuoteGroup[] {
  return rfqs
    .map((rfq) => {
      const rows = rfq.quoteRevisions
        .map((revision) => ({
          versionNumber: revision.versionNumber,
          currency: revision.currency,
          totalAmount: revision.totalAmount,
          quoteStatus: revision.status,
          createdBy: revision.createdBy,
          createdAt: revision.createdAt
        }))
        .filter((row) => {
          if (statusFilter && row.quoteStatus !== statusFilter) return false;
          if (currencyFilter && row.currency !== currencyFilter) return false;
          return true;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (rows.length === 0) {
        return null;
      }

      return {
        rfqId: rfq.id,
        projectName: rfq.projectName,
        requestedBy: rfq.requestedBy,
        rfqStatus: rfq.status,
        latestCreatedAt: rows[0].createdAt,
        rows
      };
    })
    .filter((group): group is ProjectQuoteGroup => group !== null)
    .sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime());
}

const quoteStatuses: QuoteStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"];
const currencies: Currency[] = ["GBP", "EUR", "USD", "TRY"];

function buildQuotesHref(statusFilter: QuoteStatus | "", currencyFilter: Currency | "", rfqId?: string): string {
  const query = new URLSearchParams();

  if (statusFilter) {
    query.set("status", statusFilter);
  }

  if (currencyFilter) {
    query.set("currency", currencyFilter);
  }

  if (rfqId) {
    query.set("rfqId", rfqId);
  }

  const serialized = query.toString();
  return serialized ? `/quotes?${serialized}` : "/quotes";
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

  try {
    rfqs = await getRfqs();
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") {
      redirect("/login");
    }

    rfqs = [];
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
    <main className="shell">
      <header className="page-header">
        <h1>Quotes</h1>
        <p>{roleSummary(session.user.role)}</p>
      </header>

      <section className="panel">
        <div className="panel-title-row">
          <h2>Filters</h2>
          <span className="inline-hint">
            Total revisions: {allRows.length} | Showing: {shownRows}
          </span>
        </div>

        <form className="rfq-form clean-form" method="get" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
          {selectedRfqId && <input type="hidden" name="rfqId" value={selectedRfqId} />}
          <label>
            <span>Quote Status</span>
            <select name="status" defaultValue={statusFilter}>
              <option value="">All</option>
              {quoteStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Currency</span>
            <select name="currency" defaultValue={currencyFilter}>
              <option value="">All</option>
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="primary-btn" style={{ alignSelf: "end" }}>
            Apply
          </button>
        </form>
      </section>

      <section className="panel quotes-workspace">
        <aside className="quotes-master">
          <div className="panel-title-row">
            <h2>Projects</h2>
            <span className="inline-hint">{groupedRows.length} listed</span>
          </div>

          {groupedRows.length === 0 ? (
            <p className="quotes-empty">No projects found for this filter.</p>
          ) : (
            <div className="quotes-project-list">
              {groupedRows.map((group) => {
                const isActive = group.rfqId === selectedRfqId;
                const latestRevision = group.rows[0];

                return (
                  <a href={buildQuotesHref(statusFilter, currencyFilter, group.rfqId)} key={group.rfqId} className={`quotes-project-link${isActive ? " is-active" : ""}`}>
                    <strong>{group.projectName}</strong>
                    <span className="quotes-project-sub">Requested by {group.requestedBy}</span>
                    <span className="quotes-project-sub">
                      Revisions: {group.rows.length} | Latest: V{latestRevision.versionNumber}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </aside>

        <article className="quotes-detail">
          {!selectedGroup ? (
            <p className="quotes-empty">Select a project to view quote revisions.</p>
          ) : (
            <>
              <div className="quotes-detail-head">
                <div>
                  <h2>{selectedGroup.projectName}</h2>
                  <p className="quotes-detail-sub">Requested by {selectedGroup.requestedBy}</p>
                </div>
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span className={`status-pill status-${selectedGroup.rfqStatus}`}>{statusLabel(selectedGroup.rfqStatus)}</span>
                  <Link href={`/requests/${selectedGroup.rfqId}`} className="ghost-link">
                    Open request
                  </Link>
                </div>
              </div>

              <div className="data-table">
                <div className="data-head quotes-group-grid">
                  <span>Revision</span>
                  <span>Amount</span>
                  <span>Quote Status</span>
                  <span>Created By</span>
                  <span>Created At</span>
                </div>

                {selectedGroup.rows.map((row) => (
                  <Link
                    href={`/requests/${selectedGroup.rfqId}`}
                    key={`${selectedGroup.rfqId}-${row.versionNumber}-${row.createdAt}`}
                    className="data-row quotes-group-grid"
                  >
                    <span>V{row.versionNumber}</span>
                    <span>
                      {row.currency} {row.totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`status-pill status-${row.quoteStatus}`}>{row.quoteStatus}</span>
                    <span>{row.createdBy}</span>
                    <span>{new Date(row.createdAt).toLocaleString("en-GB")}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
