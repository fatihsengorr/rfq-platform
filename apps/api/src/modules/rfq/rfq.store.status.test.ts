import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the prisma module ────────────────────────────────────────────
// rfqStore.setStatus writes to prisma.rfq.update and reads via getById
// (which calls prisma.rfq.findUnique). Both are mocked here so we can
// assert the exact data shape setStatus persists, with no real DB.

const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("../../prisma.js", () => ({
  prisma: {
    rfq: {
      update: (...args: unknown[]) => mockUpdate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock("../../config.js", () => ({
  config: { publicApiBaseUrl: "https://api.test" },
}));

import { RfqStore } from "./rfq.store.js";

// Minimal RFQ row shape to satisfy rfqToDto mapping.
function rfqRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "rfq-1",
    projectName: "Test Project",
    deadline: new Date("2026-06-01T00:00:00Z"),
    projectDetails: "details",
    requestedBy: "someone",
    status: overrides.status ?? "NEW",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    assignedPricingUserId: null,
    assignedPricingUser: null,
    assignedById: null,
    assignedBy: null,
    assignedAt: null,
    wonAt: overrides.wonAt ?? null,
    lostAt: overrides.lostAt ?? null,
    lostReason: overrides.lostReason ?? null,
    companyId: null,
    company: null,
    contactId: null,
    contact: null,
    attachments: [],
    quoteRevisions: [],
    ...overrides,
  };
}

describe("RfqStore.setStatus — WON/LOST outcome tracking", () => {
  const store = new RfqStore();

  beforeEach(() => {
    mockUpdate.mockReset();
    mockFindUnique.mockReset();
    mockUpdate.mockResolvedValue({});
  });

  it("records wonAt and clears lost fields when transitioning to WON", async () => {
    mockFindUnique.mockResolvedValue(rfqRow({ status: "WON", wonAt: new Date() }));

    await store.setStatus("rfq-1", "WON");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const call = mockUpdate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.status).toBe("WON");
    expect(call.data.wonAt).toBeInstanceOf(Date);
    expect(call.data.lostAt).toBeNull();
    expect(call.data.lostReason).toBeNull();
  });

  it("records lostAt + lostReason when transitioning to LOST", async () => {
    mockFindUnique.mockResolvedValue(
      rfqRow({ status: "LOST", lostAt: new Date(), lostReason: "Price too high" })
    );

    await store.setStatus("rfq-1", "LOST", "Price too high");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const call = mockUpdate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.status).toBe("LOST");
    expect(call.data.lostAt).toBeInstanceOf(Date);
    expect(call.data.wonAt).toBeNull();
    expect(call.data.lostReason).toBe("Price too high");
  });

  it("throws when status is LOST without a reason", async () => {
    await expect(store.setStatus("rfq-1", "LOST")).rejects.toThrow(/lostReason is required/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("throws when lostReason is too short", async () => {
    await expect(store.setStatus("rfq-1", "LOST", "no")).rejects.toThrow(/lostReason is required/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("clears all outcome fields when reverting to an open status", async () => {
    mockFindUnique.mockResolvedValue(rfqRow({ status: "IN_REVIEW" }));

    await store.setStatus("rfq-1", "IN_REVIEW");

    const call = mockUpdate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.status).toBe("IN_REVIEW");
    expect(call.data.wonAt).toBeNull();
    expect(call.data.lostAt).toBeNull();
    expect(call.data.lostReason).toBeNull();
  });

  it("trims whitespace from lostReason before persisting", async () => {
    mockFindUnique.mockResolvedValue(
      rfqRow({ status: "LOST", lostAt: new Date(), lostReason: "Customer chose competitor" })
    );

    await store.setStatus("rfq-1", "LOST", "  Customer chose competitor  ");

    const call = mockUpdate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.lostReason).toBe("Customer chose competitor");
  });
});
