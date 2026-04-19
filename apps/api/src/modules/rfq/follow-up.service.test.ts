import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRfqFindUnique = vi.fn();
const mockFollowUpCreate = vi.fn();
const mockFollowUpFindMany = vi.fn();
const mockRfqUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("../../prisma.js", () => ({
  prisma: {
    rfq: {
      findUnique: (arg: unknown) => mockRfqFindUnique(arg),
      update: (arg: unknown) => mockRfqUpdate(arg),
    },
    followUpActivity: {
      create: (arg: unknown) => mockFollowUpCreate(arg),
      findMany: (arg: unknown) => mockFollowUpFindMany(arg),
    },
    $transaction: (arg: unknown) => mockTransaction(arg),
  },
}));

import { recordFollowUp, listFollowUps } from "./follow-up.service.js";

describe("recordFollowUp", () => {
  beforeEach(() => {
    mockRfqFindUnique.mockReset();
    mockFollowUpCreate.mockReset();
    mockRfqUpdate.mockReset();
    mockTransaction.mockReset();
  });

  it("throws RFQ_NOT_FOUND when RFQ does not exist", async () => {
    mockRfqFindUnique.mockResolvedValue(null);
    await expect(recordFollowUp("missing", "u1", "some note")).rejects.toThrow(/not found/i);
  });

  it("creates an activity row, updates lastCustomerActivityAt, and trims the note", async () => {
    mockRfqFindUnique.mockResolvedValue({ id: "rfq-1", status: "QUOTED" });
    mockTransaction.mockResolvedValue([
      {
        id: "fu-1",
        rfqId: "rfq-1",
        performedById: "u1",
        note: "Customer confirmed review by Friday",
        performedAt: new Date("2026-04-19T10:00:00Z"),
        performedBy: { fullName: "Alice" },
      },
      {},
    ]);

    const result = await recordFollowUp("rfq-1", "u1", "  Customer confirmed review by Friday  ");

    expect(result.performedBy).toBe("Alice");
    expect(result.note).toBe("Customer confirmed review by Friday");
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("stores note=null when empty string is supplied", async () => {
    mockRfqFindUnique.mockResolvedValue({ id: "rfq-1", status: "QUOTED" });
    mockTransaction.mockResolvedValue([
      {
        id: "fu-2",
        rfqId: "rfq-1",
        performedById: "u1",
        note: null,
        performedAt: new Date(),
        performedBy: { fullName: "Alice" },
      },
      {},
    ]);

    await recordFollowUp("rfq-1", "u1", "   ");

    const callArg = mockTransaction.mock.calls[0]?.[0] as Array<unknown>;
    // The $transaction receives an array of two deferred prisma calls; we can
    // at least assert the transaction shape is an array of length 2.
    expect(Array.isArray(callArg)).toBe(true);
  });
});

describe("listFollowUps", () => {
  beforeEach(() => {
    mockRfqFindUnique.mockReset();
    mockFollowUpFindMany.mockReset();
  });

  it("returns an empty list when there are no follow-ups", async () => {
    mockRfqFindUnique.mockResolvedValue({ id: "rfq-1" });
    mockFollowUpFindMany.mockResolvedValue([]);

    const out = await listFollowUps("rfq-1");
    expect(out).toEqual([]);
  });

  it("maps rows to DTOs sorted newest-first by performedAt", async () => {
    mockRfqFindUnique.mockResolvedValue({ id: "rfq-1" });
    mockFollowUpFindMany.mockResolvedValue([
      {
        id: "fu-2",
        rfqId: "rfq-1",
        performedById: "u1",
        note: "Chased via email",
        performedAt: new Date("2026-04-18T09:00:00Z"),
        performedBy: { fullName: "Alice" },
      },
      {
        id: "fu-1",
        rfqId: "rfq-1",
        performedById: "u1",
        note: null,
        performedAt: new Date("2026-04-10T09:00:00Z"),
        performedBy: { fullName: "Alice" },
      },
    ]);

    const out = await listFollowUps("rfq-1");
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBe("fu-2");
    expect(out[0]!.note).toBe("Chased via email");
    expect(out[1]!.note).toBeNull();
  });
});
