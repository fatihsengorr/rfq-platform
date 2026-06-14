import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock prisma ──────────────────────────────────────────────────────
const mockProjectFindUnique = vi.fn();
const mockProjectUpdate = vi.fn();
const mockProjectCreate = vi.fn();
const mockStageEventCreate = vi.fn();
const mockProjectCompanyCreate = vi.fn();
const mockProjectCompanyUpdateMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock("../../prisma.js", () => ({
  prisma: {
    project: {
      findUnique: (...a: unknown[]) => mockProjectFindUnique(...a),
      update: (...a: unknown[]) => mockProjectUpdate(...a),
      create: (...a: unknown[]) => mockProjectCreate(...a),
    },
    projectStageEvent: { create: (...a: unknown[]) => mockStageEventCreate(...a) },
    projectCompany: {
      create: (...a: unknown[]) => mockProjectCompanyCreate(...a),
      updateMany: (...a: unknown[]) => mockProjectCompanyUpdateMany(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

vi.mock("../../config.js", () => ({ config: { publicApiBaseUrl: "https://api.test" } }));

import { moveStage, advanceToTenderOnRfq } from "./project.service.js";

// Minimal full-detail row so getProjectById's mapper works after a mutation.
function detailRow(stage: string) {
  return {
    id: "p1", title: "T", description: null, stage, source: "MANUAL",
    externalRef: null, importedAt: null, projectCategory: null, unitCount: null,
    value: null, currency: "GBP", expectedStartDate: null, siteCity: null,
    siteRegion: null, sitePostcode: null, probability: null, lostReasonCode: null,
    lostReason: null, stageUpdatedAt: new Date(), ownerId: "u1",
    createdAt: new Date(), owner: { fullName: "Jane" },
    companies: [], contacts: [], rfqs: [], attachments: [],
  };
}

describe("moveStage", () => {
  beforeEach(() => {
    mockProjectFindUnique.mockReset();
    mockProjectUpdate.mockReset();
    mockStageEventCreate.mockReset();
    mockTransaction.mockReset();
    mockTransaction.mockResolvedValue([{}, {}]);
  });

  it("rejects a move to LOST without a lostReasonCode (before any DB write)", async () => {
    await expect(moveStage("p1", "LOST" as never, "u1")).rejects.toThrow(/lostReasonCode is required/i);
    expect(mockProjectFindUnique).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("is a no-op (no stage event) when moving to the same stage", async () => {
    // first findUnique → current stage; second findUnique → full detail for getProjectById
    mockProjectFindUnique
      .mockResolvedValueOnce({ stage: "CONTACTED" })
      .mockResolvedValueOnce(detailRow("CONTACTED"));

    await moveStage("p1", "CONTACTED" as never, "u1");

    expect(mockTransaction).not.toHaveBeenCalled(); // no event written
  });

  it("writes a stage event and updates stage on a real move", async () => {
    mockProjectFindUnique
      .mockResolvedValueOnce({ stage: "IDENTIFIED" })
      .mockResolvedValueOnce(detailRow("CONTACTED"));

    await moveStage("p1", "CONTACTED" as never, "u1");

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // The transaction array contains an update + a stageEvent.create call.
    expect(mockProjectUpdate).toHaveBeenCalled();
    expect(mockStageEventCreate).toHaveBeenCalled();
    const eventArg = mockStageEventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(eventArg.data).toMatchObject({ projectId: "p1", fromStage: "IDENTIFIED", toStage: "CONTACTED", changedById: "u1" });
  });

  it("throws when the project does not exist", async () => {
    mockProjectFindUnique.mockResolvedValueOnce(null);
    await expect(moveStage("missing", "CONTACTED" as never, "u1")).rejects.toThrow(/not found/i);
  });
});

describe("advanceToTenderOnRfq", () => {
  beforeEach(() => {
    mockProjectFindUnique.mockReset();
    mockTransaction.mockReset();
    mockTransaction.mockResolvedValue([{}, {}]);
  });

  it("advances an IDENTIFIED project to TENDER", async () => {
    mockProjectFindUnique.mockResolvedValueOnce({ stage: "IDENTIFIED" });
    await advanceToTenderOnRfq("p1", "u1");
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("advances ENGAGED → TENDER", async () => {
    mockProjectFindUnique.mockResolvedValueOnce({ stage: "ENGAGED" });
    await advanceToTenderOnRfq("p1", "u1");
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("does NOT touch a project already at TENDER", async () => {
    mockProjectFindUnique.mockResolvedValueOnce({ stage: "TENDER" });
    await advanceToTenderOnRfq("p1", "u1");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("does NOT reverse a WON/LOST project", async () => {
    mockProjectFindUnique.mockResolvedValueOnce({ stage: "WON" });
    await advanceToTenderOnRfq("p1", "u1");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("is a safe no-op when the project is missing", async () => {
    mockProjectFindUnique.mockResolvedValueOnce(null);
    await advanceToTenderOnRfq("missing", "u1");
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
