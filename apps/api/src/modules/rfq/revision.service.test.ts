import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────
// The revision service reads from rfq, rfqRevision, quoteRevision. We
// stub those queries so we can assert the shape of returned items and
// the diff output for a hand-crafted pair of snapshots.

const mockRfqFindUnique = vi.fn();
const mockRfqRevFindMany = vi.fn();
const mockRfqRevFindUnique = vi.fn();
const mockQuoteRevFindMany = vi.fn();

vi.mock("../../prisma.js", () => ({
  prisma: {
    rfq: {
      findUnique: (...args: unknown[]) => mockRfqFindUnique(...args),
    },
    rfqRevision: {
      findMany: (...args: unknown[]) => mockRfqRevFindMany(...args),
      findUnique: (...args: unknown[]) => mockRfqRevFindUnique(...args),
    },
    quoteRevision: {
      findMany: (...args: unknown[]) => mockQuoteRevFindMany(...args),
    },
  },
}));

vi.mock("../../config.js", () => ({
  config: { publicApiBaseUrl: "https://api.test" },
}));

import { listRevisions, compareRevisions } from "./revision.service.js";

function rfqRevRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rev-1",
    rfqId: "rfq-1",
    revisionNumber: 1,
    changeReason: "Architect increased room count from 20 to 25",
    projectName: "Old Project Name",
    deadline: new Date("2026-05-30T00:00:00Z"),
    projectDetails: "Old details",
    requestedBy: "Old requester",
    companyId: null,
    contactId: null,
    changedById: "u1",
    changedBy: { fullName: "Ahmet" },
    changedAt: new Date("2026-04-10T10:00:00Z"),
    attachments: [],
    ...overrides,
  };
}

function rfqCurrentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rfq-1",
    projectName: "New Project Name",
    deadline: new Date("2026-06-15T00:00:00Z"),
    projectDetails: "New details with more rooms",
    requestedBy: "New requester",
    companyId: null,
    contactId: null,
    attachments: [],
    ...overrides,
  };
}

describe("listRevisions", () => {
  beforeEach(() => {
    mockRfqFindUnique.mockReset();
    mockRfqRevFindMany.mockReset();
    mockQuoteRevFindMany.mockReset();
  });

  it("throws RFQ_NOT_FOUND when RFQ does not exist", async () => {
    mockRfqFindUnique.mockResolvedValue(null);
    await expect(listRevisions("missing-id")).rejects.toThrow(/not found/i);
  });

  it("combines RFQ revisions and quote revisions into a single timeline sorted newest-first", async () => {
    mockRfqFindUnique.mockResolvedValue({ id: "rfq-1" });
    mockRfqRevFindMany.mockResolvedValue([
      rfqRevRow({ revisionNumber: 2, changedAt: new Date("2026-04-12T10:00:00Z") }),
      rfqRevRow({ revisionNumber: 1, changedAt: new Date("2026-04-10T10:00:00Z") }),
    ]);
    mockQuoteRevFindMany.mockResolvedValue([
      {
        id: "q2",
        versionNumber: 2,
        currency: "GBP",
        totalAmount: "52000",
        notes: "updated",
        status: "APPROVED",
        createdAt: new Date("2026-04-13T10:00:00Z"),
        createdBy: { fullName: "Mehmet" },
        attachments: [],
        approvals: [],
        changeReason: "Reflect new room count",
        rfqRevisionId: "rev-2",
        rfqRevision: { revisionNumber: 2 },
      },
    ]);

    const items = await listRevisions("rfq-1");
    // 3 items total: 2 rfq + 1 quote
    expect(items).toHaveLength(3);
    // Newest first — quote at 04-13 is newest, then rfq v2 at 04-12, then rfq v1 at 04-10
    expect(items[0]!.kind).toBe("quote");
    expect(items[1]!.kind).toBe("rfq");
    expect(items[1]!.kind === "rfq" && items[1]!.revisionNumber).toBe(2);
    expect(items[2]!.kind === "rfq" && items[2]!.revisionNumber).toBe(1);
  });
});

describe("compareRevisions", () => {
  beforeEach(() => {
    mockRfqFindUnique.mockReset();
    mockRfqRevFindUnique.mockReset();
  });

  it("computes field diff between an RFQ revision and current state (b=0)", async () => {
    mockRfqRevFindUnique.mockResolvedValue(
      rfqRevRow({
        revisionNumber: 1,
        projectName: "Old Project Name",
        deadline: new Date("2026-05-30T00:00:00Z"),
        projectDetails: "Old details",
        requestedBy: "Alice",
      })
    );
    mockRfqFindUnique.mockResolvedValue(
      rfqCurrentRow({
        projectName: "New Project Name",
        deadline: new Date("2026-06-15T00:00:00Z"),
        projectDetails: "New details with more rooms",
        requestedBy: "Alice",
      })
    );

    const diff = await compareRevisions("rfq-1", 1, 0);

    expect(diff.a.revisionNumber).toBe(1);
    expect(diff.a.source).toBe("revision");
    expect(diff.b.revisionNumber).toBe(0);
    expect(diff.b.source).toBe("current");

    const byField = Object.fromEntries(diff.fields.map((f) => [f.field, f]));
    expect(byField.projectName!.changed).toBe(true);
    expect(byField.deadline!.changed).toBe(true);
    expect(byField.projectDetails!.changed).toBe(true);
    expect(byField.requestedBy!.changed).toBe(false);
    expect(byField.companyId!.changed).toBe(false);
  });

  it("flags attachments added/removed/unchanged", async () => {
    const attA = {
      id: "a1",
      fileName: "v1-spec.pdf",
      mimeType: "application/pdf",
      createdAt: new Date(),
      uploadedBy: { fullName: "Ahmet" },
    };
    const attB = {
      id: "a2",
      fileName: "v2-spec.pdf",
      mimeType: "application/pdf",
      createdAt: new Date(),
      uploadedBy: { fullName: "Ahmet" },
    };
    const attShared = {
      id: "a3",
      fileName: "misc.pdf",
      mimeType: "application/pdf",
      createdAt: new Date(),
      uploadedBy: { fullName: "Ahmet" },
    };

    mockRfqRevFindUnique.mockImplementationOnce(() =>
      Promise.resolve(rfqRevRow({ revisionNumber: 1, attachments: [attA, attShared] }))
    );
    mockRfqRevFindUnique.mockImplementationOnce(() =>
      Promise.resolve(rfqRevRow({ revisionNumber: 2, attachments: [attB, attShared] }))
    );

    const diff = await compareRevisions("rfq-1", 1, 2);

    expect(diff.attachments.added.map((a) => a.id)).toEqual(["a2"]);
    expect(diff.attachments.removed.map((a) => a.id)).toEqual(["a1"]);
    expect(diff.attachments.unchanged.map((a) => a.id)).toEqual(["a3"]);
  });

  it("throws REVISION_NOT_FOUND when revision number does not exist", async () => {
    mockRfqRevFindUnique.mockResolvedValue(null);
    await expect(compareRevisions("rfq-1", 99, 0)).rejects.toThrow(/revision v99 was not found/i);
  });
});
