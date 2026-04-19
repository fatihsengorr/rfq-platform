/**
 * Faz 3 — Feature 3: Stall Detection
 *
 * Finds RFQs in QUOTED status that have been silent (no customer activity
 * recorded via follow-up) for too long, and nudges the managers so they
 * don't fall through the cracks.
 *
 * Two thresholds:
 *   - 10 days: send a reminder email to London + Istanbul managers
 *   - 60 days: the stall badge shown in the UI becomes more urgent;
 *              managers still get a reminder (same day-level idempotency)
 *
 * Idempotent: we only send one reminder per RFQ per day, using the
 * Notification table to check prior sends (same pattern as deadline
 * reminders).
 */

import { prisma } from "../../prisma.js";
import { config } from "../../config.js";
import { logger } from "../../logger.js";
import { sendNotification } from "../email/email.service.js";
import { followUpReminderNotification } from "../email/email.templates.js";

const NOTIFICATION_TYPE_10D = "STALL_REMINDER_10D";
const NOTIFICATION_TYPE_60D = "STALL_REMINDER_60D";

const STALL_DAYS_WARN = 10;
const STALL_DAYS_STALE = 60;

type StallResult = {
  scannedCount: number;
  remindersSent: number;
  skippedAlreadySent: number;
  errors: number;
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function runStallDetection(): Promise<StallResult> {
  // Threshold: RFQs whose last customer activity was >= 10 days ago.
  // Uses the composite index (status, lastCustomerActivityAt).
  const threshold = daysAgo(STALL_DAYS_WARN);

  const rfqs = await prisma.rfq.findMany({
    where: {
      status: "QUOTED",
      lastCustomerActivityAt: { lte: threshold, not: null },
      // Skip RFQs that have been resolved (belt-and-braces — status=QUOTED
      // should already exclude WON/LOST but make it explicit).
      wonAt: null,
      lostAt: null,
    },
    select: {
      id: true,
      projectName: true,
      lastCustomerActivityAt: true,
      createdBy: { select: { id: true, email: true, fullName: true } },
      company: { select: { name: true } },
    },
  });

  const result: StallResult = {
    scannedCount: rfqs.length,
    remindersSent: 0,
    skippedAlreadySent: 0,
    errors: 0,
  };

  const webBase = config.webBaseUrl;

  // Per plan: remind London manager + Istanbul manager (not the individual
  // creator). The sales rep already sees the UI badge on their list.
  const managers = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["ISTANBUL_MANAGER", "LONDON_SALES"] },
    },
    select: { id: true, email: true, role: true },
  });

  // London "manager" concept: the repository today doesn't model a
  // LONDON_MANAGER role — London is all LONDON_SALES. Until that role
  // exists, fall back to *all* London sales users as the London-side
  // oversight. The Istanbul manager list is simple (only ISTANBUL_MANAGER).
  const notifyList = managers;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (const rfq of rfqs) {
    if (!rfq.lastCustomerActivityAt) continue;
    const daysSilent = Math.floor(
      (Date.now() - rfq.lastCustomerActivityAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    const notificationType =
      daysSilent >= STALL_DAYS_STALE ? NOTIFICATION_TYPE_60D : NOTIFICATION_TYPE_10D;

    // Day-level idempotency: same RFQ, same type, same calendar day => skip.
    const alreadySent = await prisma.notification.findFirst({
      where: {
        rfqId: rfq.id,
        type: notificationType,
        createdAt: { gte: today, lt: tomorrow },
      },
      select: { id: true },
    });
    if (alreadySent) {
      result.skippedAlreadySent++;
      continue;
    }

    const rfqUrl = `${webBase}/requests/${rfq.id}`;
    const tpl = followUpReminderNotification(
      rfq.projectName,
      rfq.company?.name ?? rfq.createdBy.fullName,
      daysSilent,
      rfqUrl
    );

    for (const recipient of notifyList) {
      try {
        await sendNotification({
          type: notificationType,
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          rfqId: rfq.id,
          ...tpl,
        });
        result.remindersSent++;
      } catch (err) {
        logger.error({ err, rfqId: rfq.id, recipientId: recipient.id }, "Failed to send stall reminder");
        result.errors++;
      }
    }
  }

  logger.info(
    { ...result },
    `Stall detection scan complete: ${result.remindersSent} sent, ${result.skippedAlreadySent} skipped`
  );

  return result;
}
