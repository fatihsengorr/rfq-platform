import { Prisma, RfqStatus as DbRfqStatus, UserRole as DbUserRole } from "@prisma/client";
import { ApiError } from "../../errors.js";
import { prisma } from "../../prisma.js";
import { config } from "../../config.js";
import type { Approval, Attachment, CompanySummary, ContactSummary, QuoteRevision, RfqRecord, RfqStatus, UserRole } from "./rfq.types.js";

const API_PUBLIC_BASE_URL = config.publicApiBaseUrl;

const rfqInclude = {
  createdBy: true,
  assignedPricingUser: true,
  assignedBy: true,
  company: true,
  contact: true,
  attachments: {
    include: {
      uploadedBy: true
    },
    orderBy: {
      createdAt: "asc" as const
    }
  },
  quoteRevisions: {
    include: {
      attachments: {
        include: {
          uploadedBy: true
        },
        orderBy: {
          createdAt: "asc" as const
        }
      },
      approvals: {
        include: {
          decidedBy: true
        },
        orderBy: {
          decidedAt: "asc" as const
        }
      },
      createdBy: true
    },
    orderBy: {
      versionNumber: "asc" as const
    }
  }
};

type RfqWithRelations = Prisma.RfqGetPayload<{ include: typeof rfqInclude }>;
type QuoteRevisionWithRelations = Prisma.QuoteRevisionGetPayload<{
  include: {
    attachments: { include: { uploadedBy: true } };
    createdBy: true;
    approvals: { include: { decidedBy: true } };
  };
}>;
type QuoteApprovalWithUser = Prisma.QuoteApprovalGetPayload<{ include: { decidedBy: true } }>;
type DbAttachmentWithUser = Prisma.AttachmentGetPayload<{ include: { uploadedBy: true } }>;

function attachmentToDto(item: DbAttachmentWithUser): Attachment {
  return {
    id: item.id,
    fileName: item.fileName,
    mimeType: item.mimeType,
    url: `${API_PUBLIC_BASE_URL}/api/rfqs/attachments/${item.id}/download`,
    uploadedAt: item.createdAt.toISOString(),
    uploadedBy: item.uploadedBy.fullName
  };
}

function quoteRevisionToDto(item: QuoteRevisionWithRelations): QuoteRevision {
  return {
    id: item.id,
    versionNumber: item.versionNumber,
    currency: item.currency as QuoteRevision["currency"],
    totalAmount: Number(item.totalAmount),
    notes: item.notes,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    createdBy: item.createdBy.fullName,
    attachments: item.attachments.map(attachmentToDto)
  };
}

function approvalToDto(item: QuoteApprovalWithUser): Approval {
  return {
    id: item.id,
    quoteRevisionId: item.quoteRevisionId,
    decidedBy: item.decidedBy.fullName,
    decision: item.decision,
    comment: item.comment,
    decidedAt: item.decidedAt.toISOString()
  };
}

function canAccessRfq(item: { assignedPricingUserId: string | null }, viewerRole: UserRole, viewerUserId: string): boolean {
  if (viewerRole === "ADMIN" || viewerRole === "ISTANBUL_MANAGER" || viewerRole === "LONDON_SALES") {
    return true;
  }

  return item.assignedPricingUserId === viewerUserId;
}

function filterVisibleRevisions(item: RfqWithRelations, viewerRole: UserRole): QuoteRevisionWithRelations[] {
  if (viewerRole === "LONDON_SALES") {
    return item.quoteRevisions.filter((revision) => revision.status === "APPROVED");
  }

  return item.quoteRevisions;
}

function rfqToDto(item: RfqWithRelations, viewerRole: UserRole): RfqRecord {
  const visibleRevisions = filterVisibleRevisions(item, viewerRole);

  return {
    id: item.id,
    projectName: item.projectName,
    deadline: item.deadline.toISOString(),
    projectDetails: item.projectDetails,
    requestedBy: item.requestedBy,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    assignedPricingUserId: item.assignedPricingUserId,
    assignedPricingUser: item.assignedPricingUser?.fullName ?? null,
    assignedBy: item.assignedBy?.fullName ?? null,
    assignedAt: item.assignedAt ? item.assignedAt.toISOString() : null,
    company: item.company
      ? { id: item.company.id, name: item.company.name, sector: item.company.sector, country: item.company.country, city: item.company.city }
      : null,
    contact: item.contact
      ? { id: item.contact.id, fullName: item.contact.fullName, email: item.contact.email, phone: item.contact.phone, title: item.contact.title }
      : null,
    attachments: item.attachments.map(attachmentToDto),
    quoteRevisions: visibleRevisions.map(quoteRevisionToDto),
    approvals: visibleRevisions.flatMap((revision) => revision.approvals.map(approvalToDto))
  };
}

function mapRole(role: UserRole): DbUserRole {
  if (role === "LONDON_SALES") return DbUserRole.LONDON_SALES;
  if (role === "ISTANBUL_PRICING") return DbUserRole.ISTANBUL_PRICING;
  if (role === "ISTANBUL_MANAGER") return DbUserRole.ISTANBUL_MANAGER;
  return DbUserRole.ADMIN;
}

export class RfqStore {
  async list(
    viewerRole: UserRole,
    viewerUserId: string,
    pagination?: { page: number; limit: number }
  ): Promise<{ data: RfqRecord[]; total: number }> {
    const where =
      viewerRole === "ISTANBUL_PRICING"
        ? { assignedPricingUserId: viewerUserId }
        : undefined;

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 200;

    const [rows, total] = await Promise.all([
      prisma.rfq.findMany({
        where,
        include: rfqInclude,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.rfq.count({ where }),
    ]);

    return { data: rows.map((item) => rfqToDto(item, viewerRole)), total };
  }

  async getById(id: string, viewerRole: UserRole, viewerUserId: string): Promise<RfqRecord | undefined> {
    const row = await prisma.rfq.findUnique({
      where: { id },
      include: rfqInclude
    });

    if (!row) {
      return undefined;
    }

    if (!canAccessRfq(row, viewerRole, viewerUserId)) {
      return undefined;
    }

    return rfqToDto(row, viewerRole);
  }

  async create(input: {
    projectName: string;
    deadline: string;
    projectDetails: string;
    requestedBy: string;
    createdById: string;
    companyId?: string;
    contactId?: string;
  }): Promise<RfqRecord> {
    const row = await prisma.rfq.create({
      data: {
        projectName: input.projectName,
        deadline: new Date(input.deadline),
        projectDetails: input.projectDetails,
        requestedBy: input.requestedBy,
        createdById: input.createdById,
        companyId: input.companyId ?? null,
        contactId: input.contactId ?? null,
        status: DbRfqStatus.NEW
      },
      include: rfqInclude
    });

    return rfqToDto(row, "LONDON_SALES");
  }

  async reviseRequest(
    rfqId: string,
    input: {
      projectName: string;
      deadline: string;
      projectDetails: string;
      requestedBy: string;
    }
  ): Promise<RfqRecord> {
    try {
      await prisma.rfq.update({
        where: {
          id: rfqId
        },
        data: {
          projectName: input.projectName,
          deadline: new Date(input.deadline),
          projectDetails: input.projectDetails,
          requestedBy: input.requestedBy,
          status: "REVISION_REQUESTED"
        }
      });
    } catch {
      throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);
    }

    const updated = await this.getById(rfqId, "ADMIN", "");

    if (!updated) {
      throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);
    }

    return updated;
  }

  async assignPricingUser(rfqId: string, input: { assignedPricingUserId: string; assignedById: string }): Promise<RfqRecord> {
    const assignee = await prisma.user.findUnique({
      where: {
        id: input.assignedPricingUserId
      },
      select: {
        id: true,
        role: true
      }
    });

    if (!assignee || assignee.role !== DbUserRole.ISTANBUL_PRICING) {
      throw new ApiError("INVALID_REQUEST", "Assigned user must be an active ISTANBUL_PRICING user.", 400);
    }

    try {
      await prisma.rfq.update({
        where: {
          id: rfqId
        },
        data: {
          assignedPricingUserId: input.assignedPricingUserId,
          assignedById: input.assignedById,
          assignedAt: new Date(),
          status: "IN_REVIEW"
        }
      });
    } catch {
      throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);
    }

    const updated = await this.getById(rfqId, "ADMIN", "");

    if (!updated) {
      throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);
    }

    return updated;
  }

  async addQuoteRevision(
    rfqId: string,
    input: {
      currency: "GBP" | "EUR" | "USD" | "TRY";
      totalAmount: number;
      notes: string;
      createdById: string;
      createdByRole: UserRole;
      autoSubmitForApproval: boolean;
    }
  ): Promise<QuoteRevision> {
    const rfq = await prisma.rfq.findUnique({
      where: { id: rfqId },
      select: {
        id: true,
        assignedPricingUserId: true
      }
    });

    if (!rfq) {
      throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);
    }

    if (input.createdByRole === "ISTANBUL_PRICING") {
      if (!rfq.assignedPricingUserId) {
        throw new ApiError("FORBIDDEN", "RFQ must be assigned by Istanbul manager before quoting.", 403);
      }

      if (rfq.assignedPricingUserId !== input.createdById) {
        throw new ApiError("FORBIDDEN", "This RFQ is assigned to a different Istanbul pricing user.", 403);
      }
    }

    const maxVersion = await prisma.quoteRevision.aggregate({
      where: { rfqId },
      _max: { versionNumber: true }
    });

    const versionNumber = (maxVersion._max.versionNumber ?? 0) + 1;
    const revisionStatus = input.autoSubmitForApproval ? "SUBMITTED" : "DRAFT";

    const revision = await prisma.quoteRevision.create({
      data: {
        rfqId,
        versionNumber,
        currency: input.currency,
        totalAmount: new Prisma.Decimal(input.totalAmount),
        notes: input.notes,
        status: revisionStatus,
        createdById: input.createdById
      },
      include: {
        attachments: {
          include: {
            uploadedBy: true
          }
        },
        createdBy: true,
        approvals: {
          include: {
            decidedBy: true
          }
        }
      }
    });

    await prisma.rfq.update({
      where: { id: rfqId },
      data: {
        status: input.autoSubmitForApproval ? "PENDING_MANAGER_APPROVAL" : "PRICING_IN_PROGRESS"
      }
    });

    return quoteRevisionToDto(revision);
  }

  async decideApproval(
    rfqId: string,
    input: {
      quoteRevisionId: string;
      decision: "APPROVED" | "REJECTED";
      comment: string;
      decidedById: string;
    }
  ): Promise<Approval> {
    const revision = await prisma.quoteRevision.findFirst({
      where: {
        id: input.quoteRevisionId,
        rfqId
      }
    });

    if (!revision) {
      throw new ApiError("QUOTE_REVISION_NOT_FOUND", "Quote revision was not found for this RFQ.", 404);
    }

    if (revision.status !== "SUBMITTED") {
      throw new ApiError("INVALID_REQUEST", "Only submitted quote revisions can be approved or rejected.", 400);
    }

    await prisma.quoteRevision.update({
      where: {
        id: input.quoteRevisionId
      },
      data: {
        status: input.decision
      }
    });

    const approval = await prisma.quoteApproval.create({
      data: {
        quoteRevisionId: input.quoteRevisionId,
        decision: input.decision,
        comment: input.comment,
        decidedById: input.decidedById
      },
      include: {
        decidedBy: true
      }
    });

    await prisma.rfq.update({
      where: {
        id: rfqId
      },
      data: {
        status: input.decision === "APPROVED" ? "QUOTED" : "REVISION_REQUESTED"
      }
    });

    return approvalToDto(approval);
  }

  async setStatus(rfqId: string, status: RfqStatus): Promise<RfqRecord> {
    try {
      await prisma.rfq.update({
        where: { id: rfqId },
        data: {
          status
        }
      });
    } catch {
      throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);
    }

    const updated = await this.getById(rfqId, "ADMIN", "");

    if (!updated) {
      throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);
    }

    return updated;
  }

  async addAttachment(input: {
    rfqId: string;
    quoteRevisionId?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    uploadedById: string;
    uploadedByRole: UserRole;
  }): Promise<Attachment> {
    const rfq = await prisma.rfq.findUnique({
      where: {
        id: input.rfqId
      },
      select: {
        id: true,
        assignedPricingUserId: true
      }
    });

    if (!rfq) {
      throw new ApiError("RFQ_NOT_FOUND", "RFQ record was not found.", 404);
    }

    if (input.uploadedByRole === "LONDON_SALES" && input.quoteRevisionId) {
      throw new ApiError("FORBIDDEN", "London users can upload files only to RFQ request.", 403);
    }

    if (input.uploadedByRole === "ISTANBUL_PRICING" && !input.quoteRevisionId) {
      throw new ApiError("FORBIDDEN", "Istanbul pricing users can upload files only to quote revisions.", 403);
    }

    if (input.uploadedByRole === "ISTANBUL_PRICING") {
      if (!rfq.assignedPricingUserId || rfq.assignedPricingUserId !== input.uploadedById) {
        throw new ApiError("FORBIDDEN", "This RFQ is assigned to a different Istanbul pricing user.", 403);
      }
    }

    let quoteRevisionId: string | null = null;

    if (input.quoteRevisionId) {
      const revision = await prisma.quoteRevision.findFirst({
        where: {
          id: input.quoteRevisionId,
          rfqId: input.rfqId
        },
        select: {
          id: true,
          createdById: true
        }
      });

      if (!revision) {
        throw new ApiError("QUOTE_REVISION_NOT_FOUND", "Quote revision was not found for this RFQ.", 404);
      }

      if (input.uploadedByRole === "ISTANBUL_PRICING" && revision.createdById !== input.uploadedById) {
        throw new ApiError("FORBIDDEN", "Istanbul pricing users can upload only to their own quote revisions.", 403);
      }

      quoteRevisionId = revision.id;
    }

    const attachment = await prisma.attachment.create({
      data: {
        category: quoteRevisionId ? "QUOTE_REVISION" : "RFQ_REQUEST",
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageKey: input.storageKey,
        publicUrl: "",
        rfqId: input.rfqId,
        quoteRevisionId,
        uploadedById: input.uploadedById
      },
      include: {
        uploadedBy: true
      }
    });

    return attachmentToDto(attachment);
  }

  async getAttachmentForDownload(
    attachmentId: string,
    viewerRole: UserRole,
    viewerUserId: string
  ): Promise<{ id: string; fileName: string; mimeType: string; storageKey: string } | null> {
    const attachment = await prisma.attachment.findUnique({
      where: {
        id: attachmentId
      },
      include: {
        rfq: {
          select: {
            id: true,
            assignedPricingUserId: true
          }
        },
        quoteRevision: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

    if (!attachment || !attachment.rfq) {
      return null;
    }

    if (!canAccessRfq(attachment.rfq, viewerRole, viewerUserId)) {
      return null;
    }

    if (viewerRole === "LONDON_SALES" && attachment.quoteRevision && attachment.quoteRevision.status !== "APPROVED") {
      return null;
    }

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      storageKey: attachment.storageKey
    };
  }

  canPerform(role: UserRole, action: "CREATE_RFQ" | "UPDATE_RFQ_REQUEST" | "CREATE_QUOTE" | "APPROVE_QUOTE" | "ASSIGN_RFQ") {
    if (role === "ADMIN") {
      return true;
    }

    if (action === "CREATE_RFQ" || action === "UPDATE_RFQ_REQUEST") {
      return role === "LONDON_SALES";
    }

    if (action === "CREATE_QUOTE") {
      return role === "ISTANBUL_PRICING";
    }

    if (action === "APPROVE_QUOTE" || action === "ASSIGN_RFQ") {
      return role === "ISTANBUL_MANAGER";
    }

    return false;
  }

  async getUserEmail(userId: string): Promise<{ id: string; email: string; fullName: string } | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true },
    });
  }

  async getManagerUsers(): Promise<Array<{ id: string; email: string; fullName: string }>> {
    return prisma.user.findMany({
      where: { role: DbUserRole.ISTANBUL_MANAGER, isActive: true },
      select: { id: true, email: true, fullName: true },
    });
  }

  async getRfqCreatorId(rfqId: string): Promise<string | null> {
    const rfq = await prisma.rfq.findUnique({
      where: { id: rfqId },
      select: { createdById: true },
    });
    return rfq?.createdById ?? null;
  }

  async listPricingUsers() {
    const rows = await prisma.user.findMany({
      where: {
        role: mapRole("ISTANBUL_PRICING"),
        isActive: true
      },
      orderBy: {
        fullName: "asc"
      },
      select: {
        id: true,
        fullName: true,
        email: true
      }
    });

    return rows;
  }
}

export const rfqStore = new RfqStore();
