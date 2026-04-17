import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────
// Tests reviseRequest snapshot behavior — when called, the OLD state of
// the Rfq row should be written to RfqRevision (via $transaction) before
// the Rfq row is updated with the new values.

const mockRfqFindUnique = vi.fn();
const mockRfqRevAggregate = vi.fn();
const mockTransaction = vi.fn();

// rfqRevision.create and rfq.update are wrapped in prisma.$transaction —
// they return a *PrismaPromise-like* value that is resolved inside the
// transaction runner, not awaited directly. Returning null is fine here
// because we only inspect the arguments they were called with.
const mockRfqRevCreate = vi.fn((_arg: unknown) => null);
const mockRfqUpdate = vi.fn((_arg: unknown) => null);

vi.mock("../../prisma.js", () => ({
  prisma: {
    rfq: {
      findUnique: (arg: unknown) => mockRfqFindUnique(arg),
      update: (arg: unknown) => mockRfqUpdate(arg),
    },
    rfqRevision: {
      aggregate: (arg: unknown) => mockRfqRevAggregate(arg),
      create: (arg: unknown) => mockRfqRevCreate(arg),
    },
    $transaction: (arg: unknown) => mockTransaction(arg),
  },
}));

vi.mock("../../config.js", () => ({
  config: { publicApiBaseUrl: "https://api.test" },
}));

import { RfqStore } from "./rfq.store.js";

describe("RfqStore.reviseRequest — snapshot behavior", () => {
  const store = new RfqStore();

  beforeEach(() => {
    mockRfqFindUnique.mockReset();
    mockRfqRevAggregate.mockReset();
    mockTransaction.mockReset();
    mockRfqRevCreate.mockClear();
    mockRfqUpdate.mockClear();
  });

  it("rejects when changeReason is missing or too short", async () => {
    await expect(
      store.reviseRequest("rfq-1", {
        projectName: "New",
        deadline: "2026-06-01T00:00:00Z",
        projectDetails: "new details",
        requestedBy: "Alice",
        changeReason: "too short",
        changedById: "u1",
      })
    ).rejects.toThrow(/changeReason is required/i);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects when RFQ does not exist", async () => {
    mockRfqFindUnique.mockResolvedValue(null);
    await expect(
      store.reviseRequest("missing", {
        projectName: "New",
        deadline: "2026-06-01T00:00:00Z",
        projectDetails: "new details with enough length",
        requestedBy: "Alice",
        changeReason: "Architect sent new drawings showing extra rooms",
        changedById: "u1",
      })
    ).rejects.toThrow(/not found/i);
  });

  it("snapshots the OLD state into RfqRevision before updating the Rfq row", async () => {
    // Old RFQ state
    mockRfqFindUnique
      .mockResolvedValueOnce({
        id: "rfq-1",
        projectName: "Old Project",
        deadline: new Date("2026-05-01T00:00:00Z"),
        projectDetails: "Old details",
        requestedBy: "Old requester",
        companyId: "co-1",
        contactId: "c-1",
      })
      // Later call by getById — the second findUnique returns a full RFQ
      .mockResolvedValueOnce({
        id: "rfq-1",
        projectName: "New Project",
        deadline: new Date("2026-06-01T00:00:00Z"),
        projectDetails: "New details",
        requestedBy: "Alice",
        status: "REVISION_REQUESTED",
        createdAt: new Date(),
        assignedPricingUserId: null,
        assignedPricingUser: null,
        assignedById: null,
        assignedBy: null,
        assignedAt: null,
        wonAt: null,
        lostAt: null,
        lostReason: null,
        companyId: null,
        company: null,
        contactId: null,
        contact: null,
        attachments: [],
        quoteRevisions: [],
      });

    mockRfqRevAggregate.mockResolvedValue({ _max: { revisionNumber: 2 } });
    mockTransaction.mockResolvedValue([{}, {}]);

    await store.reviseRequest("rfq-1", {
      projectName: "New Project",
      deadline: "2026-06-01T00:00:00Z",
      projectDetails: "New details with sufficient length",
      requestedBy: "Alice",
      changeReason: "Architect sent new drawings showing extra rooms",
      changedById: "u1",
    });

    // prisma.$transaction was called with an array of two deferred operations.
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // The rfqRevision.create mock was invoked (inside the transaction payload).
    expect(mockRfqRevCreate).toHaveBeenCalled();
    const revCreateCall = mockRfqRevCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    if (!revCreateCall) throw new Error("rfqRevision.create was not invoked");
    expect(revCreateCall.data).toMatchObject({
      rfqId: "rfq-1",
      // Next revision is max+1 = 3
      revisionNumber: 3,
      changeReason: "Architect sent new drawings showing extra rooms",
      // Snapshots OLD state, not new
      projectName: "Old Project",
      projectDetails: "Old details",
      requestedBy: "Old requester",
      companyId: "co-1",
      contactId: "c-1",
      changedById: "u1",
    });

    // And rfq.update was called with the new values
    expect(mockRfqUpdate).toHaveBeenCalled();
    const updateCall = mockRfqUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    if (!updateCall) throw new Error("rfq.update was not invoked");
    expect(updateCall.data).toMatchObject({
      projectName: "New Project",
      status: "REVISION_REQUESTED",
    });
  });

  it("numbers the first revision as 1 when no prior revisions exist", async () => {
    mockRfqFindUnique
      .mockResolvedValueOnce({
        id: "rfq-1",
        projectName: "Old",
        deadline: new Date(),
        projectDetails: "Old details",
        requestedBy: "Alice",
        companyId: null,
        contactId: null,
      })
      .mockResolvedValueOnce({
        id: "rfq-1",
        projectName: "New",
        deadline: new Date(),
        projectDetails: "New details",
        requestedBy: "Alice",
        status: "REVISION_REQUESTED",
        createdAt: new Date(),
        assignedPricingUserId: null,
        assignedPricingUser: null,
        assignedById: null,
        assignedBy: null,
        assignedAt: null,
        wonAt: null,
        lostAt: null,
        lostReason: null,
        companyId: null,
        company: null,
        contactId: null,
        contact: null,
        attachments: [],
        quoteRevisions: [],
      });

    mockRfqRevAggregate.mockResolvedValue({ _max: { revisionNumber: null } });
    mockTransaction.mockResolvedValue([{}, {}]);

    await store.reviseRequest("rfq-1", {
      projectName: "New",
      deadline: "2026-06-01T00:00:00Z",
      projectDetails: "New details at least ten chars long",
      requestedBy: "Alice",
      changeReason: "Very first revision after creation",
      changedById: "u1",
    });

    const revCreateCall = mockRfqRevCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    if (!revCreateCall) throw new Error("rfqRevision.create was not invoked");
    expect(revCreateCall.data.revisionNumber).toBe(1);
  });
});
