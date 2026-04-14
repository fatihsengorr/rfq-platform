import { ApiError } from "../../errors.js";
import { config } from "../../config.js";
import { prisma } from "../../prisma.js";
import { sendNotification } from "../email/email.service.js";
import { newCommentNotification } from "../email/email.templates.js";

// ── Types ──────────────────────────────────────────────────────────

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; fullName: string; role: string };
};

// ── Service functions ──────────────────────────────────────────────

export async function listComments(rfqId: string): Promise<CommentView[]> {
  const comments = await prisma.comment.findMany({
    where: { rfqId },
    orderBy: { createdAt: "asc" },
    take: 500,
    include: {
      author: { select: { id: true, fullName: true, role: true } },
    },
  });

  return comments.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    author: { id: c.author.id, fullName: c.author.fullName, role: c.author.role },
  }));
}

export async function createComment(
  rfqId: string,
  body: string,
  authorId: string,
  authorFullName: string
): Promise<CommentView> {
  // Verify RFQ exists
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    select: { id: true, projectName: true, createdById: true, assignedPricingUserId: true },
  });

  if (!rfq) {
    throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);
  }

  const comment = await prisma.comment.create({
    data: { body, rfqId, authorId },
    include: {
      author: { select: { id: true, fullName: true, role: true } },
    },
  });

  // Email: notify all stakeholders except the comment author
  const webBase = config.webBaseUrl;
  const rfqUrl = `${webBase}/requests/${rfqId}`;

  const recipientIds = new Set<string>();
  if (rfq.createdById) recipientIds.add(rfq.createdById);
  if (rfq.assignedPricingUserId) recipientIds.add(rfq.assignedPricingUserId);

  const managers = await prisma.user.findMany({
    where: { role: "ISTANBUL_MANAGER", isActive: true },
    select: { id: true },
  });
  managers.forEach((m) => recipientIds.add(m.id));
  recipientIds.delete(authorId);

  for (const recipientId of recipientIds) {
    const user = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, email: true },
    });
    if (user) {
      const tpl = newCommentNotification(rfq.projectName, authorFullName, body, rfqUrl);
      sendNotification({ type: "NEW_COMMENT", recipientId: user.id, recipientEmail: user.email, rfqId, ...tpl });
    }
  }

  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    author: { id: comment.author.id, fullName: comment.author.fullName, role: comment.author.role },
  };
}
