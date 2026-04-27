/**
 * Faz 3 — Feature 4: Global search.
 *
 * 4 user-selectable criteria, all optional and combinable:
 *   - company name (LIKE on CustomerCompany.name)
 *   - project name (LIKE on Rfq.projectName)
 *   - location / project type (LIKE on Rfq.projectDetails OR Company city/country/sector)
 *   - amount range (against latest QuoteRevision on each RFQ)
 *
 * Output is grouped — companies first, RFQs after. Each list capped so the
 * palette stays snappy; the user refines the query if there are more.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma.js";

export type SearchFields = {
  customer?: boolean;
  project?: boolean;
  location?: boolean;
  amount?: boolean;
};

export type SearchInput = {
  q?: string;
  fields?: SearchFields;
  minAmount?: number;
  maxAmount?: number;
  currency?: "GBP" | "EUR" | "USD" | "TRY";
  limit?: number;
};

export type SearchResults = {
  companies: Array<{
    id: string;
    name: string;
    sector: string | null;
    country: string | null;
    city: string | null;
    rfqCount: number;
  }>;
  rfqs: Array<{
    id: string;
    projectName: string;
    status: string;
    createdAt: string;
    companyId: string | null;
    companyName: string | null;
    latestQuote: { currency: string; totalAmount: number } | null;
  }>;
  totals: { companies: number; rfqs: number };
};

// Default behaviour when no fields filter is given: search across everything
// the user could mean. Faz 3 plan asked for an opt-in checkbox UI — when the
// frontend opts none in, the API still tries to give useful results.
function effectiveFields(input: SearchInput): SearchFields {
  const f = input.fields ?? {};
  // If absolutely nothing is opted in we treat it as "search everywhere".
  if (!f.customer && !f.project && !f.location && !f.amount) {
    return { customer: true, project: true, location: true, amount: true };
  }
  return f;
}

export async function searchAll(input: SearchInput): Promise<SearchResults> {
  const fields = effectiveFields(input);
  const q = input.q?.trim() ?? "";
  const limit = Math.max(1, Math.min(50, input.limit ?? 10));
  const hasText = q.length >= 2;
  const hasAmount =
    fields.amount && (input.minAmount !== undefined || input.maxAmount !== undefined);

  // Nothing to search on — return empty.
  if (!hasText && !hasAmount) {
    return { companies: [], rfqs: [], totals: { companies: 0, rfqs: 0 } };
  }

  // ── Companies ────────────────────────────────────────────────────
  // We only return company-level matches when the customer field is enabled
  // (or when location is enabled — country/city/sector live on the company).
  const companyMatchers: Prisma.CustomerCompanyWhereInput[] = [];
  if (hasText && fields.customer) {
    companyMatchers.push({ name: { contains: q, mode: "insensitive" } });
  }
  if (hasText && fields.location) {
    companyMatchers.push({ city: { contains: q, mode: "insensitive" } });
    companyMatchers.push({ country: { contains: q, mode: "insensitive" } });
    companyMatchers.push({ sector: { contains: q, mode: "insensitive" } });
  }

  let companies: SearchResults["companies"] = [];
  let companyTotal = 0;
  if (companyMatchers.length > 0) {
    const where: Prisma.CustomerCompanyWhereInput = { OR: companyMatchers };
    const [rows, count] = await Promise.all([
      prisma.customerCompany.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        select: {
          id: true,
          name: true,
          sector: true,
          country: true,
          city: true,
          _count: { select: { rfqs: true } },
        },
      }),
      prisma.customerCompany.count({ where }),
    ]);
    companies = rows.map((c) => ({
      id: c.id,
      name: c.name,
      sector: c.sector,
      country: c.country,
      city: c.city,
      rfqCount: c._count.rfqs,
    }));
    companyTotal = count;
  }

  // ── RFQs ─────────────────────────────────────────────────────────
  const rfqMatchers: Prisma.RfqWhereInput[] = [];
  if (hasText && fields.project) {
    rfqMatchers.push({ projectName: { contains: q, mode: "insensitive" } });
  }
  if (hasText && fields.location) {
    rfqMatchers.push({ projectDetails: { contains: q, mode: "insensitive" } });
    // Also pick up RFQs whose company matches a location term.
    rfqMatchers.push({
      company: {
        OR: [
          { city: { contains: q, mode: "insensitive" } },
          { country: { contains: q, mode: "insensitive" } },
          { sector: { contains: q, mode: "insensitive" } },
        ],
      },
    });
  }
  if (hasText && fields.customer) {
    // Customer text term should also match RFQs *of* that company.
    rfqMatchers.push({
      company: { name: { contains: q, mode: "insensitive" } },
    });
  }

  const rfqWhere: Prisma.RfqWhereInput = {};
  if (rfqMatchers.length > 0) rfqWhere.OR = rfqMatchers;

  if (hasAmount) {
    const amountFilter: Prisma.DecimalFilter = {};
    if (input.minAmount !== undefined) amountFilter.gte = input.minAmount;
    if (input.maxAmount !== undefined) amountFilter.lte = input.maxAmount;
    const revisionWhere: Prisma.QuoteRevisionWhereInput = { totalAmount: amountFilter };
    if (input.currency) revisionWhere.currency = input.currency;
    rfqWhere.quoteRevisions = { some: revisionWhere };
  } else if (input.currency) {
    rfqWhere.quoteRevisions = { some: { currency: input.currency } };
  }

  // If neither text nor amount filter applied to RFQs, skip the query.
  const hasRfqQuery = rfqMatchers.length > 0 || hasAmount || (input.currency != null);

  let rfqs: SearchResults["rfqs"] = [];
  let rfqTotal = 0;
  if (hasRfqQuery) {
    const [rows, count] = await Promise.all([
      prisma.rfq.findMany({
        where: rfqWhere,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          projectName: true,
          status: true,
          createdAt: true,
          companyId: true,
          company: { select: { name: true } },
          quoteRevisions: {
            select: { currency: true, totalAmount: true },
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      }),
      prisma.rfq.count({ where: rfqWhere }),
    ]);
    rfqs = rows.map((r) => ({
      id: r.id,
      projectName: r.projectName,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      companyId: r.companyId,
      companyName: r.company?.name ?? null,
      latestQuote: r.quoteRevisions[0]
        ? {
            currency: r.quoteRevisions[0].currency,
            totalAmount: Number(r.quoteRevisions[0].totalAmount),
          }
        : null,
    }));
    rfqTotal = count;
  }

  return {
    companies,
    rfqs,
    totals: { companies: companyTotal, rfqs: rfqTotal },
  };
}
