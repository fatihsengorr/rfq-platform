/**
 * Faz 3 — Feature 3: Follow-up activity log.
 *
 * When a sales user chases a customer about a sent quote, they log it here.
 * Two side-effects:
 *   1. Records the event in FollowUpActivity (audit trail)
 *   2. Resets Rfq.lastCustomerActivityAt so stall-detection quiets down
 */

import { ApiError } from "../../errors.js";
import { prisma } from "../../prisma.js";
import type { FollowUpActivityRecord } from "@crm/shared";

export async function recordFollowUp(
  rfqId: string,
  performedById: string,
  note?: string
): Promise<FollowUpActivityRecord> {
  // Ensure RFQ exists (and incidentally that FK won't throw confusingly).
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    select: { id: true, status: true },
  });
  if (!rfq) throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);

  // Only meaningful on RFQs that have been sent to the customer (QUOTED).
  // Still allow recording follow-ups on open statuses — sometimes sales
  // chases the architect for clarification before a quote even exists.
  // We don't gate by status.

  const trimmedNote = note?.trim();
  const now = new Date();

  const [activity] = await prisma.$transaction([
    prisma.followUpActivity.create({
      data: {
        rfqId,
        performedById,
        note: trimmedNote && trimmedNote.length > 0 ? trimmedNote : null,
        performedAt: now,
      },
      include: { performedBy: true },
    }),
    prisma.rfq.update({
      where: { id: rfqId },
      data: { lastCustomerActivityAt: now },
    }),
  ]);

  return {
    id: activity.id,
    rfqId: activity.rfqId,
    performedBy: activity.performedBy.fullName,
    performedById: activity.performedById,
    note: activity.note,
    performedAt: activity.performedAt.toISOString(),
  };
}

export async function listFollowUps(rfqId: string): Promise<FollowUpActivityRecord[]> {
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    select: { id: true },
  });
  if (!rfq) throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);

  const rows = await prisma.followUpActivity.findMany({
    where: { rfqId },
    orderBy: { performedAt: "desc" },
    include: { performedBy: true },
  });

  return rows.map((row) => ({
    id: row.id,
    rfqId: row.rfqId,
    performedBy: row.performedBy.fullName,
    performedById: row.performedById,
    note: row.note,
    performedAt: row.performedAt.toISOString(),
  }));
}
