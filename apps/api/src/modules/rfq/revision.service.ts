/**
 * Faz 3 — Feature 2: RFQ + Quote revision timeline and diff.
 *
 * This module is read-only (snapshots are created by rfqStore.reviseRequest
 * and quote revisions by rfqStore.addQuoteRevision). It exposes two queries:
 *
 *   - list(rfqId): full timeline of RFQ + Quote revisions, newest first,
 *     including attachments linked to each snapshot.
 *   - compare(rfqId, a, b): diff two RFQ revisions, or a revision vs. the
 *     current live RFQ (use revisionNumber 0 to reference "current").
 */

import { ApiError } from "../../errors.js";
import { prisma } from "../../prisma.js";
import { config } from "../../config.js";
import type {
  Attachment,
  QuoteRevision,
  RfqRevisionRecord,
  RfqRevisionDiff,
  RevisionTimelineItem,
} from "@crm/shared";

const API_PUBLIC_BASE_URL = config.publicApiBaseUrl;

const attachmentSelect = {
  include: { uploadedBy: true },
  orderBy: { createdAt: "asc" as const },
};

function attachmentToDto(a: {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: Date;
  uploadedBy: { fullName: string };
}): Attachment {
  return {
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    url: `${API_PUBLIC_BASE_URL}/api/rfqs/attachments/${a.id}/download`,
    uploadedAt: a.createdAt.toISOString(),
    uploadedBy: a.uploadedBy.fullName,
  };
}

export async function listRevisions(rfqId: string): Promise<RevisionTimelineItem[]> {
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    select: { id: true },
  });
  if (!rfq) throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);

  const [rfqRevisions, quoteRevisions] = await Promise.all([
    prisma.rfqRevision.findMany({
      where: { rfqId },
      orderBy: { revisionNumber: "desc" },
      include: {
        changedBy: true,
        attachments: attachmentSelect,
      },
    }),
    prisma.quoteRevision.findMany({
      where: { rfqId },
      orderBy: { versionNumber: "desc" },
      include: {
        createdBy: true,
        attachments: attachmentSelect,
        approvals: { include: { decidedBy: true } },
        rfqRevision: { select: { revisionNumber: true } },
      },
    }),
  ]);

  const rfqItems: RevisionTimelineItem[] = rfqRevisions.map((r): RevisionTimelineItem => ({
    kind: "rfq",
    id: r.id,
    rfqId: r.rfqId,
    revisionNumber: r.revisionNumber,
    changeReason: r.changeReason,
    projectName: r.projectName,
    deadline: r.deadline.toISOString(),
    projectDetails: r.projectDetails,
    requestedBy: r.requestedBy,
    companyId: r.companyId,
    contactId: r.contactId,
    changedBy: r.changedBy.fullName,
    changedById: r.changedById,
    changedAt: r.changedAt.toISOString(),
    attachments: r.attachments.map(attachmentToDto),
  }));

  const quoteItems: RevisionTimelineItem[] = quoteRevisions.map((q): RevisionTimelineItem => ({
    kind: "quote",
    id: q.id,
    versionNumber: q.versionNumber,
    currency: q.currency as QuoteRevision["currency"],
    totalAmount: Number(q.totalAmount),
    notes: q.notes,
    status: q.status,
    createdAt: q.createdAt.toISOString(),
    createdBy: q.createdBy.fullName,
    attachments: q.attachments.map(attachmentToDto),
    changeReason: q.changeReason ?? null,
    rfqRevisionId: q.rfqRevisionId ?? null,
    rfqRevisionNumber: q.rfqRevision?.revisionNumber ?? null,
  }));

  // Combine by chronological timestamp, newest first.
  const combined = [...rfqItems, ...quoteItems].sort((a, b) => {
    const ta = a.kind === "rfq" ? a.changedAt : a.createdAt;
    const tb = b.kind === "rfq" ? b.changedAt : b.createdAt;
    return tb.localeCompare(ta);
  });

  return combined;
}

// Resolve a "revision reference" — an integer where 0 means "current live RFQ".
async function loadRevisionSnapshot(rfqId: string, revisionNumber: number): Promise<{
  revisionNumber: number;
  source: "current" | "revision";
  projectName: string;
  deadline: string;
  projectDetails: string;
  requestedBy: string;
  companyId: string | null;
  contactId: string | null;
  attachments: Attachment[];
}> {
  if (revisionNumber === 0) {
    const rfq = await prisma.rfq.findUnique({
      where: { id: rfqId },
      include: {
        attachments: {
          where: { rfqRevisionId: null }, // attachments still bound to live RFQ
          ...attachmentSelect,
        },
      },
    });
    if (!rfq) throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);
    return {
      revisionNumber: 0,
      source: "current",
      projectName: rfq.projectName,
      deadline: rfq.deadline.toISOString(),
      projectDetails: rfq.projectDetails,
      requestedBy: rfq.requestedBy,
      companyId: rfq.companyId,
      contactId: rfq.contactId,
      attachments: rfq.attachments.map(attachmentToDto),
    };
  }

  const rev = await prisma.rfqRevision.findUnique({
    where: { rfqId_revisionNumber: { rfqId, revisionNumber } },
    include: { attachments: attachmentSelect },
  });
  if (!rev) {
    throw new ApiError("REVISION_NOT_FOUND", `RFQ revision v${revisionNumber} was not found.`, 404);
  }
  return {
    revisionNumber: rev.revisionNumber,
    source: "revision",
    projectName: rev.projectName,
    deadline: rev.deadline.toISOString(),
    projectDetails: rev.projectDetails,
    requestedBy: rev.requestedBy,
    companyId: rev.companyId,
    contactId: rev.contactId,
    attachments: rev.attachments.map(attachmentToDto),
  };
}

export async function compareRevisions(
  rfqId: string,
  a: number,
  b: number
): Promise<RfqRevisionDiff> {
  const [snapA, snapB] = await Promise.all([
    loadRevisionSnapshot(rfqId, a),
    loadRevisionSnapshot(rfqId, b),
  ]);

  const fields: RfqRevisionDiff["fields"] = [
    { field: "projectName", before: snapA.projectName, after: snapB.projectName, changed: snapA.projectName !== snapB.projectName },
    { field: "deadline", before: snapA.deadline, after: snapB.deadline, changed: snapA.deadline !== snapB.deadline },
    { field: "projectDetails", before: snapA.projectDetails, after: snapB.projectDetails, changed: snapA.projectDetails !== snapB.projectDetails },
    { field: "requestedBy", before: snapA.requestedBy, after: snapB.requestedBy, changed: snapA.requestedBy !== snapB.requestedBy },
    { field: "companyId", before: snapA.companyId, after: snapB.companyId, changed: snapA.companyId !== snapB.companyId },
    { field: "contactId", before: snapA.contactId, after: snapB.contactId, changed: snapA.contactId !== snapB.contactId },
  ];

  // Attachment diff by id.
  const aIds = new Set(snapA.attachments.map((x) => x.id));
  const bIds = new Set(snapB.attachments.map((x) => x.id));
  const added = snapB.attachments.filter((x) => !aIds.has(x.id));
  const removed = snapA.attachments.filter((x) => !bIds.has(x.id));
  const unchanged = snapA.attachments.filter((x) => bIds.has(x.id));

  return {
    a: { revisionNumber: snapA.revisionNumber, source: snapA.source },
    b: { revisionNumber: snapB.revisionNumber, source: snapB.source },
    fields,
    attachments: { added, removed, unchanged },
  };
}

// Latest revision number or 0 if none.
export async function latestRevisionNumber(rfqId: string): Promise<number> {
  const agg = await prisma.rfqRevision.aggregate({
    where: { rfqId },
    _max: { revisionNumber: true },
  });
  return agg._max.revisionNumber ?? 0;
}
