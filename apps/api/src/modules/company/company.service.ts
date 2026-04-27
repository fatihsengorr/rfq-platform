import type { Prisma } from "@prisma/client";
import { ApiError } from "../../errors.js";
import { prisma } from "../../prisma.js";

// ── Mapping helpers ────────────────────────────────────────────────

function mapContact(ct: { id: string; fullName: string; email: string | null; phone: string | null; title: string | null }) {
  return { id: ct.id, fullName: ct.fullName, email: ct.email, phone: ct.phone, title: ct.title };
}

// ── KPI computation ────────────────────────────────────────────────
// Builds the headline numbers for a company detail page in one pass:
// - active RFQs (open statuses)
// - quoted-but-not-resolved RFQs
// - won / lost / closed counts
// - lifetime quote value (sum of approved quote amounts on won deals)
// - win rate (won / (won+lost), CLOSED legacy bucket excluded)

const OPEN_STATUSES = [
  "NEW",
  "IN_REVIEW",
  "PRICING_IN_PROGRESS",
  "PENDING_MANAGER_APPROVAL",
  "QUOTED",
  "REVISION_REQUESTED",
] as const;

type CompanyKpi = {
  totalRfqs: number;
  activeRfqs: number;
  quotedRfqs: number;
  wonRfqs: number;
  lostRfqs: number;
  closedRfqs: number;
  // Win rate as a 0..1 fraction over (won+lost). null when there's no data yet.
  winRate: number | null;
  // Sum of approved quote amounts on won deals, by currency. We don't try to
  // normalise across currencies since the FX layer is out of scope (per Faz 3
  // plan). The UI shows each currency separately.
  lifetimeQuoteValue: Array<{ currency: string; total: number }>;
  // Average days from RFQ creation to first APPROVED quote, null if none.
  avgResponseTimeDays: number | null;
};

export async function computeCompanyKpi(companyId: string): Promise<CompanyKpi> {
  // Single grouped query for status counts.
  const statusGroups = await prisma.rfq.groupBy({
    by: ["status"],
    where: { companyId },
    _count: { _all: true },
  });

  const counts = Object.fromEntries(
    statusGroups.map((g) => [g.status, g._count._all]),
  ) as Record<string, number>;

  const totalRfqs = statusGroups.reduce((sum, g) => sum + g._count._all, 0);
  const activeRfqs = OPEN_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const quotedRfqs = counts.QUOTED ?? 0;
  const wonRfqs = counts.WON ?? 0;
  const lostRfqs = counts.LOST ?? 0;
  const closedRfqs = counts.CLOSED ?? 0;

  // Win rate excludes legacy CLOSED so it doesn't muddy the signal.
  const decided = wonRfqs + lostRfqs;
  const winRate = decided > 0 ? wonRfqs / decided : null;

  // Lifetime value: sum of APPROVED quote revisions on WON RFQs, grouped by currency.
  const wonQuotes = await prisma.quoteRevision.findMany({
    where: {
      status: "APPROVED",
      rfq: { companyId, status: "WON" },
    },
    select: { currency: true, totalAmount: true },
  });

  const totalsByCurrency = new Map<string, number>();
  for (const q of wonQuotes) {
    totalsByCurrency.set(
      q.currency,
      (totalsByCurrency.get(q.currency) ?? 0) + Number(q.totalAmount),
    );
  }
  const lifetimeQuoteValue = [...totalsByCurrency.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total);

  // Average response time: createdAt of RFQ vs createdAt of its first
  // APPROVED quote revision. Null when no approved quote exists yet.
  const respondedRfqs = await prisma.rfq.findMany({
    where: {
      companyId,
      quoteRevisions: { some: { status: "APPROVED" } },
    },
    select: {
      createdAt: true,
      quoteRevisions: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  let avgResponseTimeDays: number | null = null;
  if (respondedRfqs.length > 0) {
    const totalMs = respondedRfqs.reduce((sum, r) => {
      const first = r.quoteRevisions[0];
      if (!first) return sum;
      return sum + (first.createdAt.getTime() - r.createdAt.getTime());
    }, 0);
    avgResponseTimeDays = totalMs / respondedRfqs.length / (1000 * 60 * 60 * 24);
  }

  return {
    totalRfqs,
    activeRfqs,
    quotedRfqs,
    wonRfqs,
    lostRfqs,
    closedRfqs,
    winRate,
    lifetimeQuoteValue,
    avgResponseTimeDays,
  };
}

// ── Filtered RFQ list for a company ────────────────────────────────
// Pain #1 from Feature 4: "what did we quote ACME last year?"

const RFQ_STATUSES_LIST = [
  "NEW",
  "IN_REVIEW",
  "PRICING_IN_PROGRESS",
  "PENDING_MANAGER_APPROVAL",
  "QUOTED",
  "REVISION_REQUESTED",
  "WON",
  "LOST",
  "CLOSED",
] as const;
type RfqStatusValue = (typeof RFQ_STATUSES_LIST)[number];

export type CompanyRfqFilter = {
  status?: "open" | "won" | "lost" | "closed" | "all";
  from?: Date;
  to?: Date;
  // Tutar filtresi mevcut quote revisions'ın (latest) totalAmount'ı üzerinden
  // çalışır. Filtre uygulanırsa, RFQ'da en az bir quote olması da şarttır.
  minAmount?: number;
  maxAmount?: number;
  currency?: "GBP" | "EUR" | "USD" | "TRY";
  page?: number;
  limit?: number;
};

export async function listCompanyRfqs(companyId: string, filter: CompanyRfqFilter = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.max(1, Math.min(100, filter.limit ?? 25));

  const where: Prisma.RfqWhereInput = { companyId };

  if (filter.status && filter.status !== "all") {
    if (filter.status === "open") {
      where.status = { in: OPEN_STATUSES as unknown as RfqStatusValue[] };
    } else {
      where.status = filter.status.toUpperCase() as RfqStatusValue;
    }
  }
  if (filter.from || filter.to) {
    where.createdAt = {};
    if (filter.from) where.createdAt.gte = filter.from;
    if (filter.to) where.createdAt.lte = filter.to;
  }
  if (filter.minAmount !== undefined || filter.maxAmount !== undefined) {
    const amountConstraint: Prisma.DecimalFilter = {};
    if (filter.minAmount !== undefined) amountConstraint.gte = filter.minAmount;
    if (filter.maxAmount !== undefined) amountConstraint.lte = filter.maxAmount;
    const revisionWhere: Prisma.QuoteRevisionWhereInput = { totalAmount: amountConstraint };
    if (filter.currency) revisionWhere.currency = filter.currency;
    where.quoteRevisions = { some: revisionWhere };
  } else if (filter.currency) {
    where.quoteRevisions = { some: { currency: filter.currency } };
  }

  const [rows, total] = await Promise.all([
    prisma.rfq.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        projectName: true,
        status: true,
        createdAt: true,
        deadline: true,
        wonAt: true,
        lostAt: true,
        quoteRevisions: {
          select: { currency: true, totalAmount: true, versionNumber: true, status: true },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    }),
    prisma.rfq.count({ where }),
  ]);

  return {
    data: rows.map((r) => {
      const latest = r.quoteRevisions[0];
      return {
        id: r.id,
        projectName: r.projectName,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        deadline: r.deadline.toISOString(),
        wonAt: r.wonAt?.toISOString() ?? null,
        lostAt: r.lostAt?.toISOString() ?? null,
        latestQuote: latest
          ? {
              currency: latest.currency,
              totalAmount: Number(latest.totalAmount),
              versionNumber: latest.versionNumber,
              status: latest.status,
            }
          : null,
      };
    }),
    total,
    page,
    limit,
  };
}

// ── Service functions ──────────────────────────────────────────────

export async function searchCompanies(query?: string) {
  const companies = await prisma.customerCompany.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
    include: {
      contacts: { orderBy: { fullName: "asc" } },
      _count: { select: { rfqs: true } },
    },
    orderBy: { name: "asc" },
    take: 50,
  });

  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    sector: c.sector,
    country: c.country,
    city: c.city,
    website: c.website,
    notes: c.notes,
    rfqCount: c._count.rfqs,
    contacts: c.contacts.map(mapContact),
  }));
}

export async function getCompanyById(id: string) {
  const company = await prisma.customerCompany.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { fullName: "asc" } },
      rfqs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, projectName: true, status: true, createdAt: true, deadline: true },
      },
      _count: { select: { rfqs: true } },
    },
  });

  if (!company) {
    throw new ApiError("RFQ_NOT_FOUND", "Company not found.", 404);
  }

  // Faz 3 — Feature 4: KPI panel ile aynı endpoint'ten dönüyor.
  const kpi = await computeCompanyKpi(id);

  return {
    id: company.id,
    name: company.name,
    sector: company.sector,
    country: company.country,
    city: company.city,
    website: company.website,
    notes: company.notes,
    rfqCount: company._count.rfqs,
    contacts: company.contacts.map(mapContact),
    recentRfqs: company.rfqs.map((r) => ({
      id: r.id,
      projectName: r.projectName,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      deadline: r.deadline.toISOString(),
    })),
    kpi,
  };
}

export async function createCompany(data: {
  name: string;
  sector?: string;
  country?: string;
  city?: string;
  website?: string;
  notes?: string;
  contact?: { fullName: string; email?: string; phone?: string; title?: string };
}) {
  const { contact, ...companyData } = data;

  const company = await prisma.customerCompany.create({
    data: {
      ...companyData,
      contacts: contact ? { create: contact } : undefined,
    },
    include: {
      contacts: true,
      _count: { select: { rfqs: true } },
    },
  });

  return {
    id: company.id,
    name: company.name,
    sector: company.sector,
    country: company.country,
    city: company.city,
    website: company.website,
    notes: company.notes,
    rfqCount: company._count.rfqs,
    contacts: company.contacts.map(mapContact),
  };
}

export async function addContact(companyId: string, data: { fullName: string; email?: string; phone?: string; title?: string }) {
  const company = await prisma.customerCompany.findUnique({ where: { id: companyId } });
  if (!company) {
    throw new ApiError("RFQ_NOT_FOUND", "Company not found.", 404);
  }

  const contact = await prisma.contact.create({
    data: { ...data, companyId },
  });

  return mapContact(contact);
}
