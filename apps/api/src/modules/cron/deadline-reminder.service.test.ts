import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockUserFindMany = vi.fn();

vi.mock("../../prisma.js", () => ({
  prisma: {
    rfq: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    notification: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    user: { findMany: (...args: unknown[]) => mockUserFindMany(...args) },
  },
}));

// Mock email service
const mockSendNotification = vi.fn();
vi.mock("../email/email.service.js", () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

// Mock email templates
vi.mock("../email/email.templates.js", () => ({
  deadlineWarningNotification: (projectName: string, _deadline: string, _rfqUrl: string) => ({
    subject: `Deadline approaching: ${projectName}`,
    html: "<p>test</p>",
  }),
}));

// Mock logger
vi.mock("../../logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

// Mock config
vi.mock("../../config.js", () => ({
  config: { webBaseUrl: "https://rfq.gorhan.co.uk" },
}));

import { runDeadlineReminders } from "./deadline-reminder.service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runDeadlineReminders", () => {
  it("returns zero counts when no open RFQs with approaching deadlines", async () => {
    mockFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([]);

    const result = await runDeadlineReminders();

    expect(result.scannedCount).toBe(0);
    expect(result.remindersSent).toBe(0);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("sends reminders for RFQs with deadline within 24h", async () => {
    const in12h = new Date(Date.now() + 12 * 60 * 60 * 1000);

    mockFindMany.mockResolvedValue([
      {
        id: "rfq-1",
        projectName: "Test Project",
        deadline: in12h,
        createdById: "user-1",
        assignedPricingUserId: null,
        createdBy: { id: "user-1", email: "creator@test.com" },
        assignedPricingUser: null,
      },
    ]);
    mockUserFindMany.mockResolvedValue([]); // no managers
    mockFindFirst.mockResolvedValue(null); // no existing reminder
    mockSendNotification.mockResolvedValue(undefined);

    const result = await runDeadlineReminders();

    expect(result.scannedCount).toBe(1);
    expect(result.remindersSent).toBe(1);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DEADLINE_REMINDER_24H",
        recipientId: "user-1",
        recipientEmail: "creator@test.com",
        rfqId: "rfq-1",
      })
    );
  });

  it("skips RFQs that already received a reminder today", async () => {
    const in12h = new Date(Date.now() + 12 * 60 * 60 * 1000);

    mockFindMany.mockResolvedValue([
      {
        id: "rfq-2",
        projectName: "Already Notified",
        deadline: in12h,
        createdById: "user-1",
        assignedPricingUserId: null,
        createdBy: { id: "user-1", email: "creator@test.com" },
        assignedPricingUser: null,
      },
    ]);
    mockUserFindMany.mockResolvedValue([]);
    // Already sent today
    mockFindFirst.mockResolvedValue({ id: "notif-existing" });

    const result = await runDeadlineReminders();

    expect(result.scannedCount).toBe(1);
    expect(result.skippedAlreadySent).toBe(1);
    expect(result.remindersSent).toBe(0);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("sends to multiple recipients (creator + pricing user + managers)", async () => {
    const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000);

    mockFindMany.mockResolvedValue([
      {
        id: "rfq-3",
        projectName: "Multi Recipient",
        deadline: in48h,
        createdById: "user-1",
        assignedPricingUserId: "user-2",
        createdBy: { id: "user-1", email: "creator@test.com" },
        assignedPricingUser: { id: "user-2", email: "pricing@test.com" },
      },
    ]);
    mockUserFindMany.mockResolvedValue([
      { id: "mgr-1", email: "manager@test.com" },
    ]);
    mockFindFirst.mockResolvedValue(null);
    mockSendNotification.mockResolvedValue(undefined);

    const result = await runDeadlineReminders();

    expect(result.remindersSent).toBe(3); // creator + pricing + manager
    expect(mockSendNotification).toHaveBeenCalledTimes(3);

    // 72h window → type should be DEADLINE_REMINDER_72H
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "DEADLINE_REMINDER_72H" })
    );
  });
});
