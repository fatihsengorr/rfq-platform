import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock prisma ──────────────────────────────────────────────────────
const mockRfqFindMany = vi.fn();
const mockUserFindMany = vi.fn();
const mockNotifFindFirst = vi.fn();

vi.mock("../../prisma.js", () => ({
  prisma: {
    rfq: { findMany: (arg: unknown) => mockRfqFindMany(arg) },
    user: { findMany: (arg: unknown) => mockUserFindMany(arg) },
    notification: { findFirst: (arg: unknown) => mockNotifFindFirst(arg) },
  },
}));

const mockSendNotification = vi.fn();
vi.mock("../email/email.service.js", () => ({
  sendNotification: (arg: unknown) => mockSendNotification(arg),
}));

vi.mock("../email/email.templates.js", () => ({
  followUpReminderNotification: (name: string, _c: string, days: number) => ({
    subject: `follow up: ${name} (${days}d)`,
    html: "<p>test</p>",
  }),
}));

vi.mock("../../logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("../../config.js", () => ({
  config: { webBaseUrl: "https://rfq.gorhan.co.uk" },
}));

import { runStallDetection } from "./stall-detection.service.js";

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

describe("runStallDetection", () => {
  beforeEach(() => {
    mockRfqFindMany.mockReset();
    mockUserFindMany.mockReset();
    mockNotifFindFirst.mockReset();
    mockSendNotification.mockReset();
    mockSendNotification.mockResolvedValue(undefined);
  });

  it("sends nothing when no quoted RFQs are silent", async () => {
    mockRfqFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([]);

    const result = await runStallDetection();

    expect(result.scannedCount).toBe(0);
    expect(result.remindersSent).toBe(0);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("sends a 10-day reminder to managers when a quote has been silent for 12 days", async () => {
    mockRfqFindMany.mockResolvedValue([
      {
        id: "rfq-1",
        projectName: "Marriott Istanbul Lobby",
        lastCustomerActivityAt: daysAgo(12),
        createdBy: { id: "u1", email: "sales@londra.co", fullName: "Sales Person" },
        company: { name: "Marriott" },
      },
    ]);
    mockUserFindMany.mockResolvedValue([
      { id: "mg-ist", email: "mgr@istanbul.co", role: "ISTANBUL_MANAGER" },
      { id: "ls-lon", email: "ls@london.co", role: "LONDON_SALES" },
    ]);
    mockNotifFindFirst.mockResolvedValue(null);

    const result = await runStallDetection();

    expect(result.scannedCount).toBe(1);
    expect(result.remindersSent).toBe(2); // 1 rfq × 2 recipients
    expect(result.skippedAlreadySent).toBe(0);

    // 10-day variant (not 60-day) should be used
    const calls = mockSendNotification.mock.calls;
    expect(calls.every((c: unknown[]) => (c[0] as { type: string }).type === "STALL_REMINDER_10D")).toBe(true);
  });

  it("uses the 60-day stale variant when silence exceeds threshold", async () => {
    mockRfqFindMany.mockResolvedValue([
      {
        id: "rfq-2",
        projectName: "Hilton Ankara",
        lastCustomerActivityAt: daysAgo(75),
        createdBy: { id: "u1", email: "s@x.co", fullName: "Sales" },
        company: null,
      },
    ]);
    mockUserFindMany.mockResolvedValue([
      { id: "mg-ist", email: "mgr@istanbul.co", role: "ISTANBUL_MANAGER" },
    ]);
    mockNotifFindFirst.mockResolvedValue(null);

    const result = await runStallDetection();

    expect(result.remindersSent).toBe(1);
    const firstCall = mockSendNotification.mock.calls[0]?.[0] as { type: string };
    expect(firstCall?.type).toBe("STALL_REMINDER_60D");
  });

  it("skips RFQs when a reminder was already sent today (idempotent)", async () => {
    mockRfqFindMany.mockResolvedValue([
      {
        id: "rfq-3",
        projectName: "Project",
        lastCustomerActivityAt: daysAgo(15),
        createdBy: { id: "u1", email: "s@x.co", fullName: "Sales" },
        company: null,
      },
    ]);
    mockUserFindMany.mockResolvedValue([
      { id: "mg-ist", email: "mgr@istanbul.co", role: "ISTANBUL_MANAGER" },
    ]);
    mockNotifFindFirst.mockResolvedValue({ id: "already-sent" });

    const result = await runStallDetection();

    expect(result.skippedAlreadySent).toBe(1);
    expect(result.remindersSent).toBe(0);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});
