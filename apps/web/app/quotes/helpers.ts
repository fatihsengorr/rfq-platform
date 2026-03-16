import type { RfqRecord, QuoteRevision } from "../data";

export type QuoteStatus = QuoteRevision["status"];
export type Currency = QuoteRevision["currency"];

export type QuoteRow = {
  versionNumber: number;
  currency: Currency;
  totalAmount: number;
  quoteStatus: QuoteStatus;
  createdBy: string;
  createdAt: string;
};

export type ProjectQuoteGroup = {
  rfqId: string;
  projectName: string;
  requestedBy: string;
  rfqStatus: RfqRecord["status"];
  latestCreatedAt: string;
  rows: QuoteRow[];
};

export const quoteStatuses: QuoteStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"];
export const currencies: Currency[] = ["GBP", "EUR", "USD", "TRY"];

export function flattenQuoteRows(rfqs: RfqRecord[]): QuoteRow[] {
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

export function groupQuoteRows(rfqs: RfqRecord[], statusFilter: QuoteStatus | "", currencyFilter: Currency | ""): ProjectQuoteGroup[] {
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

      if (rows.length === 0) return null;

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

export function buildQuotesHref(statusFilter: QuoteStatus | "", currencyFilter: Currency | "", rfqId?: string): string {
  const query = new URLSearchParams();
  if (statusFilter) query.set("status", statusFilter);
  if (currencyFilter) query.set("currency", currencyFilter);
  if (rfqId) query.set("rfqId", rfqId);
  const serialized = query.toString();
  return serialized ? `/quotes?${serialized}` : "/quotes";
}
