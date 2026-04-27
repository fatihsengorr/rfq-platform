import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock prisma ──────────────────────────────────────────────────────
const mockGroupBy = vi.fn();
const mockQuoteRevFindMany = vi.fn();
const mockRfqFindMany = vi.fn();
const mockRfqCount = vi.fn();

vi.mock("../../prisma.js", () => ({
  prisma: {
    rfq: {
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
      findMany: (...args: unknown[]) => mockRfqFindMany(...args),
      count: (...args: unknown[]) => mockRfqCount(...args),
    },
    quoteRevision: {
      findMany: (...args: unknown[]) => mockQuoteRevFindMany(...args),
    },
    customerCompany: { findUnique: vi.fn() },
    contact: { create: vi.fn() },
  },
}));

import { computeCompanyKpi, listCompanyRfqs } from "./company.service.js";

describe("computeCompanyKpi", () => {
  beforeEach(() => {
    mockGroupBy.mockReset();
    mockQuoteRevFindMany.mockReset();
    mockRfqFindMany.mockReset();
  });

  it("returns zeros and null win rate for a brand-new company with no RFQs", async () => {
    mockGroupBy.mockResolvedValue([]);
    mockQuoteRevFindMany.mockResolvedValue([]);
    mockRfqFindMany.mockResolvedValue([]);

    const kpi = await computeCompanyKpi("c1");

    expect(kpi.totalRfqs).toBe(0);
    expect(kpi.activeRfqs).toBe(0);
    expect(kpi.wonRfqs).toBe(0);
    expect(kpi.lostRfqs).toBe(0);
    expect(kpi.winRate).toBeNull();
    expect(kpi.lifetimeQuoteValue).toEqual([]);
    expect(kpi.avgResponseTimeDays).toBeNull();
  });

  it("computes win rate from won/lost only — CLOSED is excluded from the denominator", async () => {
    mockGroupBy.mockResolvedValue([
      { status: "WON", _count: { _all: 3 } },
      { status: "LOST", _count: { _all: 1 } },
      { status: "CLOSED", _count: { _all: 5 } }, // legacy bucket — must NOT count
      { status: "QUOTED", _count: { _all: 2 } },
    ]);
    mockQuoteRevFindMany.mockResolvedValue([]);
    mockRfqFindMany.mockResolvedValue([]);

    const kpi = await computeCompanyKpi("c1");

    expect(kpi.wonRfqs).toBe(3);
    expect(kpi.lostRfqs).toBe(1);
    expect(kpi.closedRfqs).toBe(5);
    // 3 / (3 + 1) = 0.75
    expect(kpi.winRate).toBe(0.75);
  });

  it("counts open statuses (NEW, IN_REVIEW, ...) as active RFQs", async () => {
    mockGroupBy.mockResolvedValue([
      { status: "NEW", _count: { _all: 1 } },
      { status: "IN_REVIEW", _count: { _all: 2 } },
      { status: "PRICING_IN_PROGRESS", _count: { _all: 1 } },
      { status: "PENDING_MANAGER_APPROVAL", _count: { _all: 1 } },
      { status: "QUOTED", _count: { _all: 3 } },
      { status: "REVISION_REQUESTED", _count: { _all: 1 } },
      { status: "WON", _count: { _all: 4 } },
    ]);
    mockQuoteRevFindMany.mockResolvedValue([]);
    mockRfqFindMany.mockResolvedValue([]);

    const kpi = await computeCompanyKpi("c1");
    // 1+2+1+1+3+1 = 9
    expect(kpi.activeRfqs).toBe(9);
    expect(kpi.totalRfqs).toBe(13);
  });

  it("groups lifetime quote value by currency, sorted descending by total", async () => {
    mockGroupBy.mockResolvedValue([{ status: "WON", _count: { _all: 3 } }]);
    mockQuoteRevFindMany.mockResolvedValue([
      { currency: "GBP", totalAmount: "45000" },
      { currency: "GBP", totalAmount: "20000" },
      { currency: "EUR", totalAmount: "30000" },
    ]);
    mockRfqFindMany.mockResolvedValue([]);

    const kpi = await computeCompanyKpi("c1");
    expect(kpi.lifetimeQuoteValue).toEqual([
      { currency: "GBP", total: 65000 },
      { currency: "EUR", total: 30000 },
    ]);
  });

  it("computes avg response time in days from RFQ created -> first APPROVED quote", async () => {
    mockGroupBy.mockResolvedValue([{ status: "QUOTED", _count: { _all: 2 } }]);
    mockQuoteRevFindMany.mockResolvedValue([]);
    mockRfqFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-01-01T00:00:00Z"),
        quoteRevisions: [{ createdAt: new Date("2026-01-04T00:00:00Z") }], // 3 days
      },
      {
        createdAt: new Date("2026-02-01T00:00:00Z"),
        quoteRevisions: [{ createdAt: new Date("2026-02-06T00:00:00Z") }], // 5 days
      },
    ]);

    const kpi = await computeCompanyKpi("c1");
    expect(kpi.avgResponseTimeDays).toBe(4); // (3 + 5) / 2
  });
});

describe("listCompanyRfqs", () => {
  beforeEach(() => {
    mockRfqFindMany.mockReset();
    mockRfqCount.mockReset();
  });

  it("translates 'open' status filter into the open-status enum list", async () => {
    mockRfqFindMany.mockResolvedValue([]);
    mockRfqCount.mockResolvedValue(0);

    await listCompanyRfqs("c1", { status: "open" });

    const where = mockRfqFindMany.mock.calls[0]![0]!.where as Record<string, unknown>;
    expect(where.status).toEqual({
      in: [
        "NEW",
        "IN_REVIEW",
        "PRICING_IN_PROGRESS",
        "PENDING_MANAGER_APPROVAL",
        "QUOTED",
        "REVISION_REQUESTED",
      ],
    });
  });

  it("upper-cases a single-status filter (won -> WON)", async () => {
    mockRfqFindMany.mockResolvedValue([]);
    mockRfqCount.mockResolvedValue(0);

    await listCompanyRfqs("c1", { status: "won" });

    const where = mockRfqFindMany.mock.calls[0]![0]!.where as Record<string, unknown>;
    expect(where.status).toBe("WON");
  });

  it("applies amount range as a quote revision constraint", async () => {
    mockRfqFindMany.mockResolvedValue([]);
    mockRfqCount.mockResolvedValue(0);

    await listCompanyRfqs("c1", { minAmount: 10000, maxAmount: 100000, currency: "GBP" });

    const where = mockRfqFindMany.mock.calls[0]![0]!.where as Record<string, unknown>;
    expect(where.quoteRevisions).toEqual({
      some: {
        totalAmount: { gte: 10000, lte: 100000 },
        currency: "GBP",
      },
    });
  });

  it("returns paginated rows with the latest quote attached", async () => {
    mockRfqFindMany.mockResolvedValue([
      {
        id: "rfq-1",
        projectName: "Marriott Lobby",
        status: "WON",
        createdAt: new Date("2026-03-01"),
        deadline: new Date("2026-04-01"),
        wonAt: new Date("2026-03-15"),
        lostAt: null,
        quoteRevisions: [
          { currency: "GBP", totalAmount: "68000", versionNumber: 2, status: "APPROVED" },
        ],
      },
    ]);
    mockRfqCount.mockResolvedValue(1);

    const result = await listCompanyRfqs("c1", { page: 1, limit: 10 });
    expect(result.total).toBe(1);
    expect(result.data[0]!.latestQuote).toEqual({
      currency: "GBP",
      totalAmount: 68000,
      versionNumber: 2,
      status: "APPROVED",
    });
    expect(result.data[0]!.wonAt).toBe(new Date("2026-03-15").toISOString());
  });
});
