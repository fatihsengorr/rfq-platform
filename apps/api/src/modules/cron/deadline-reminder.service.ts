/**
 * Deadline Reminder Service
 *
 * Scans open RFQs and sends email notifications for:
 * - Deadline within 24 hours (critical)
 * - Deadline within 72 hours (warning) — only once per RFQ
 *
 * Idempotency: checks Notification table to avoid duplicate reminders
 * on the same day for the same RFQ.
 */
import { prisma } from "../../prisma.js";
import { config } from "../../config.js";
import { logger } from "../../logger.js";
import { sendNotification } from "../email/email.service.js";
import { deadlineWarningNotification } from "../email/email.templates.js";

/** Statuses that are still "open" and should be checked */
const OPEN_STATUSES = [
  "NEW",
  "IN_REVIEW",
  "PRICING_IN_PROGRESS",
  "PENDING_MANAGER_APPROVAL",
  "REVISION_REQUESTED",
] as const;

const NOTIFICATION_TYPE_24H = "DEADLINE_REMINDER_24H";
const NOTIFICATION_TYPE_72H = "DEADLINE_REMINDER_72H";

type ReminderResult = {
  scannedCount: number;
  remindersSent: number;
  skippedAlreadySent: number;
  errors: number;
};

export async function runDeadlineReminders(): Promise<ReminderResult> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  // Find open RFQs with deadline within the next 72 hours (and not already past)
  const rfqs = await prisma.rfq.findMany({
    where: {
      status: { in: [...OPEN_STATUSES] },
      deadline: {
        gte: now,
        lte: in72h,
      },
    },
    select: {
      id: true,
      projectName: true,
      deadline: true,
      createdById: true,
      assignedPricingUserId: true,
      createdBy: { select: { id: true, email: true } },
      assignedPricingUser: { select: { id: true, email: true } },
    },
  });

  const result: ReminderResult = {
    scannedCount: rfqs.length,
    remindersSent: 0,
    skippedAlreadySent: 0,
    errors: 0,
  };

  const webBase = config.webBaseUrl;

  // Get managers for notifications
  const managers = await prisma.user.findMany({
    where: { role: "ISTANBUL_MANAGER", isActive: true },
    select: { id: true, email: true },
  });

  for (const rfq of rfqs) {
    const isCritical = rfq.deadline <= in24h;
    const notificationType = isCritical ? NOTIFICATION_TYPE_24H : NOTIFICATION_TYPE_72H;

    // Check if we already sent this type of reminder for this RFQ today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingReminder = await prisma.notification.findFirst({
      where: {
        rfqId: rfq.id,
        type: notificationType,
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    if (existingReminder) {
      result.skippedAlreadySent++;
      continue;
    }

    // Build recipient list: creator + assigned pricing user + managers
    const recipients = new Map<string, string>();

    if (rfq.createdBy) {
      recipients.set(rfq.createdBy.id, rfq.createdBy.email);
    }
    if (rfq.assignedPricingUser) {
      recipients.set(rfq.assignedPricingUser.id, rfq.assignedPricingUser.email);
    }
    for (const mgr of managers) {
      recipients.set(mgr.id, mgr.email);
    }

    const rfqUrl = `${webBase}/requests/${rfq.id}`;
    const tpl = deadlineWarningNotification(rfq.projectName, rfq.deadline.toISOString(), rfqUrl);

    for (const [recipientId, recipientEmail] of recipients) {
      try {
        await sendNotification({
          type: notificationType,
          recipientId,
          recipientEmail,
          rfqId: rfq.id,
          ...tpl,
        });
        result.remindersSent++;
      } catch (err) {
        logger.error({ err, rfqId: rfq.id, recipientId }, "Failed to send deadline reminder");
        result.errors++;
      }
    }
  }

  logger.info(
    { ...result },
    `Deadline reminder scan complete: ${result.remindersSent} sent, ${result.skippedAlreadySent} skipped`
  );

  return result;
}
