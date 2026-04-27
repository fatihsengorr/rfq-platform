import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ──────────────────────────────────────────────────────
const mockCompanyFindMany = vi.fn();
const mockCompanyCount = vi.fn();
const mockRfqFindMany = vi.fn();
const mockRfqCount = vi.fn();

vi.mock("../../prisma.js", () => ({
  prisma: {
    customerCompany: {
      findMany: (...args: unknown[]) => mockCompanyFindMany(...args),
      count: (...args: unknown[]) => mockCompanyCount(...args),
    },
    rfq: {
      findMany: (...args: unknown[]) => mockRfqFindMany(...args),
      count: (...args: unknown[]) => mockRfqCount(...args),
    },
  },
}));

import { searchAll } from "./search.service.js";

describe("searchAll", () => {
  beforeEach(() => {
    mockCompanyFindMany.mockReset();
    mockCompanyCount.mockReset();
    mockRfqFindMany.mockReset();
    mockRfqCount.mockReset();
    mockCompanyFindMany.mockResolvedValue([]);
    mockCompanyCount.mockResolvedValue(0);
    mockRfqFindMany.mockResolvedValue([]);
    mockRfqCount.mockResolvedValue(0);
  });

  it("returns empty when there's no text and no amount filter", async () => {
    const result = await searchAll({});
    expect(result.companies).toHaveLength(0);
    expect(result.rfqs).toHaveLength(0);
    expect(mockCompanyFindMany).not.toHaveBeenCalled();
    expect(mockRfqFindMany).not.toHaveBeenCalled();
  });

  it("ignores text shorter than 2 chars (avoid runaway LIKE %a%)", async () => {
    const result = await searchAll({ q: "a" });
    expect(result.companies).toHaveLength(0);
    expect(result.rfqs).toHaveLength(0);
    expect(mockCompanyFindMany).not.toHaveBeenCalled();
  });

  it("when no fields are explicitly opted in, searches across all fields by default", async () => {
    await searchAll({ q: "ACME" });
    // Should query both company and rfq tables
    expect(mockCompanyFindMany).toHaveBeenCalled();
    expect(mockRfqFindMany).toHaveBeenCalled();
  });

  it("with only fields=customer, queries companies by name and RFQs by company.name", async () => {
    await searchAll({ q: "ACME", fields: { customer: true } });

    const companyWhere = mockCompanyFindMany.mock.calls[0]![0]!.where as {
      OR: Array<Record<string, unknown>>;
    };
    expect(companyWhere.OR.some((m) => "name" in m)).toBe(true);

    const rfqWhere = mockRfqFindMany.mock.calls[0]![0]!.where as {
      OR: Array<Record<string, unknown>>;
    };
    expect(rfqWhere.OR.some((m) => "company" in m)).toBe(true);
    // Project/location/details matchers must NOT be present.
    expect(rfqWhere.OR.some((m) => "projectName" in m)).toBe(false);
    expect(rfqWhere.OR.some((m) => "projectDetails" in m)).toBe(false);
  });

  it("with only fields=project, only matches RFQ projectName (no company query)", async () => {
    await searchAll({ q: "Lobby", fields: { project: true } });

    expect(mockCompanyFindMany).not.toHaveBeenCalled();
    const rfqWhere = mockRfqFindMany.mock.calls[0]![0]!.where as {
      OR: Array<Record<string, unknown>>;
    };
    expect(rfqWhere.OR.some((m) => "projectName" in m)).toBe(true);
  });

  it("with only fields=location, queries company city/country/sector + RFQ projectDetails", async () => {
    await searchAll({ q: "Ankara", fields: { location: true } });

    expect(mockCompanyFindMany).toHaveBeenCalled();
    const rfqWhere = mockRfqFindMany.mock.calls[0]![0]!.where as {
      OR: Array<Record<string, unknown>>;
    };
    expect(rfqWhere.OR.some((m) => "projectDetails" in m)).toBe(true);
  });

  it("with amount range and no text, still queries RFQs (text not required)", async () => {
    await searchAll({ minAmount: 10000, maxAmount: 100000, fields: { amount: true } });

    expect(mockCompanyFindMany).not.toHaveBeenCalled();
    expect(mockRfqFindMany).toHaveBeenCalled();
    const rfqWhere = mockRfqFindMany.mock.calls[0]![0]!.where as Record<string, unknown>;
    expect(rfqWhere.quoteRevisions).toEqual({
      some: { totalAmount: { gte: 10000, lte: 100000 } },
    });
  });

  it("formats results with grouped totals", async () => {
    mockCompanyFindMany.mockResolvedValue([
      { id: "c1", name: "ACME", sector: "Hospitality", country: "UK", city: "London", _count: { rfqs: 5 } },
    ]);
    mockCompanyCount.mockResolvedValue(7);
    mockRfqFindMany.mockResolvedValue([
      {
        id: "r1",
        projectName: "Marriott",
        status: "WON",
        createdAt: new Date("2026-03-01"),
        companyId: "c1",
        company: { name: "ACME" },
        quoteRevisions: [{ currency: "GBP", totalAmount: "45000" }],
      },
    ]);
    mockRfqCount.mockResolvedValue(12);

    const result = await searchAll({ q: "ACME" });

    expect(result.companies[0]!.rfqCount).toBe(5);
    expect(result.rfqs[0]!.companyName).toBe("ACME");
    expect(result.rfqs[0]!.latestQuote).toEqual({ currency: "GBP", totalAmount: 45000 });
    expect(result.totals).toEqual({ companies: 7, rfqs: 12 });
  });
});
