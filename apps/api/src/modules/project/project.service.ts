import type { Prisma } from "@prisma/client";
import {
  ProjectStage,
  ProjectSource,
  ProjectCategory,
  CompanyRole,
  LossReason,
} from "@prisma/client";
import { ApiError } from "../../errors.js";
import { prisma } from "../../prisma.js";
import { config } from "../../config.js";
import type {
  ProjectBoard,
  ProjectCard,
  ProjectRecord,
  ProjectStageEventRecord,
  Currency,
} from "@crm/shared";

const API_PUBLIC_BASE_URL = config.publicApiBaseUrl;

const OPEN_STAGES: ProjectStage[] = [
  ProjectStage.IDENTIFIED,
  ProjectStage.CONTACTED,
  ProjectStage.ENGAGED,
  ProjectStage.TENDER,
];

// All board columns, in workflow order.
const BOARD_STAGES: ProjectStage[] = [
  ProjectStage.IDENTIFIED,
  ProjectStage.CONTACTED,
  ProjectStage.ENGAGED,
  ProjectStage.TENDER,
  ProjectStage.WON,
  ProjectStage.LOST,
];

// ── Prisma include shapes ──────────────────────────────────────────
const projectDetailInclude = {
  owner: true,
  companies: { include: { company: true } },
  contacts: { include: { contact: { include: { company: true } } } },
  rfqs: { select: { id: true, projectName: true, status: true } },
  attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ProjectInclude;

type ProjectWithDetail = Prisma.ProjectGetPayload<{ include: typeof projectDetailInclude }>;

// ── Mappers ────────────────────────────────────────────────────────
function projectToDto(p: ProjectWithDetail): ProjectRecord {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    stage: p.stage,
    source: p.source,
    externalRef: p.externalRef,
    importedAt: p.importedAt?.toISOString() ?? null,
    projectCategory: p.projectCategory,
    unitCount: p.unitCount,
    value: p.value === null ? null : Number(p.value),
    currency: p.currency as Currency,
    expectedStartDate: p.expectedStartDate?.toISOString() ?? null,
    siteCity: p.siteCity,
    siteRegion: p.siteRegion,
    sitePostcode: p.sitePostcode,
    probability: p.probability,
    lostReasonCode: p.lostReasonCode,
    lostReason: p.lostReason,
    stageUpdatedAt: p.stageUpdatedAt.toISOString(),
    ownerId: p.ownerId,
    ownerName: p.owner.fullName,
    createdAt: p.createdAt.toISOString(),
    companies: p.companies.map((pc) => ({
      id: pc.id,
      companyId: pc.companyId,
      companyName: pc.company.name,
      role: pc.role,
      isPrimary: pc.isPrimary,
    })),
    contacts: p.contacts.map((pcontact) => ({
      id: pcontact.id,
      contactId: pcontact.contactId,
      fullName: pcontact.contact.fullName,
      email: pcontact.contact.email,
      phone: pcontact.contact.phone,
      title: pcontact.contact.title,
      companyName: pcontact.contact.company.name,
      note: pcontact.note,
    })),
    rfqs: p.rfqs.map((r) => ({ id: r.id, projectName: r.projectName, status: r.status })),
    attachments: p.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      url: `${API_PUBLIC_BASE_URL}/api/attachments/${a.id}/download`,
      uploadedAt: a.createdAt.toISOString(),
      uploadedBy: a.uploadedBy.fullName,
    })),
  };
}

// ── List ───────────────────────────────────────────────────────────
export type ProjectListFilter = {
  stage?: ProjectStage;
  ownerId?: string;
  source?: ProjectSource;
  category?: ProjectCategory;
  q?: string;
  page?: number;
  limit?: number;
};

export async function listProjects(filter: ProjectListFilter = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.max(1, Math.min(100, filter.limit ?? 25));

  const where: Prisma.ProjectWhereInput = {};
  if (filter.stage) where.stage = filter.stage;
  if (filter.ownerId) where.ownerId = filter.ownerId;
  if (filter.source) where.source = filter.source;
  if (filter.category) where.projectCategory = filter.category;
  if (filter.q) {
    where.OR = [
      { title: { contains: filter.q, mode: "insensitive" } },
      { externalRef: { equals: filter.q } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { stageUpdatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        owner: { select: { fullName: true } },
        companies: { where: { isPrimary: true }, include: { company: { select: { name: true } } }, take: 1 },
      },
    }),
    prisma.project.count({ where }),
  ]);

  const data: ProjectCard[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    stage: r.stage,
    projectCategory: r.projectCategory,
    value: r.value === null ? null : Number(r.value),
    currency: r.currency as Currency,
    primaryCompanyName: r.companies[0]?.company.name ?? null,
    ownerName: r.owner.fullName,
    stageUpdatedAt: r.stageUpdatedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));

  return { data, total, page, limit };
}

// ── Board (kanban) ─────────────────────────────────────────────────
export async function getBoard(ownerId?: string): Promise<ProjectBoard> {
  const baseWhere: Prisma.ProjectWhereInput = ownerId ? { ownerId } : {};

  const columns = await Promise.all(
    BOARD_STAGES.map(async (stage) => {
      const where = { ...baseWhere, stage };
      const [rows, count, valueRows] = await Promise.all([
        prisma.project.findMany({
          where,
          orderBy: { stageUpdatedAt: "desc" },
          take: 50,
          include: {
            owner: { select: { fullName: true } },
            companies: { where: { isPrimary: true }, include: { company: { select: { name: true } } }, take: 1 },
          },
        }),
        prisma.project.count({ where }),
        prisma.project.groupBy({
          by: ["currency"],
          where: { ...where, value: { not: null } },
          _sum: { value: true },
        }),
      ]);

      const cards: ProjectCard[] = rows.map((r) => ({
        id: r.id,
        title: r.title,
        stage: r.stage,
        projectCategory: r.projectCategory,
        value: r.value === null ? null : Number(r.value),
        currency: r.currency as Currency,
        primaryCompanyName: r.companies[0]?.company.name ?? null,
        ownerName: r.owner.fullName,
        stageUpdatedAt: r.stageUpdatedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
      }));

      return {
        stage,
        count,
        totalValueByCurrency: valueRows.map((v) => ({
          currency: v.currency,
          total: Number(v._sum.value ?? 0),
        })),
        cards,
      };
    })
  );

  return { columns };
}

// ── Get by id ──────────────────────────────────────────────────────
export async function getProjectById(id: string): Promise<ProjectRecord> {
  const project = await prisma.project.findUnique({ where: { id }, include: projectDetailInclude });
  if (!project) throw new ApiError("PROJECT_NOT_FOUND", "Project was not found.", 404);
  return projectToDto(project);
}

// ── Create ─────────────────────────────────────────────────────────
export type CreateProjectInput = {
  title: string;
  description?: string;
  projectCategory?: ProjectCategory;
  unitCount?: number;
  value?: number;
  currency?: string;
  expectedStartDate?: string;
  siteCity?: string;
  siteRegion?: string;
  sitePostcode?: string;
  probability?: number;
  source?: ProjectSource;
  ownerId: string;
  // optional first company link
  firstCompanyId?: string;
  firstCompanyRole?: CompanyRole;
};

export async function createProject(input: CreateProjectInput): Promise<ProjectRecord> {
  const created = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        projectCategory: input.projectCategory ?? null,
        unitCount: input.unitCount ?? null,
        value: input.value ?? null,
        currency: input.currency ?? "GBP",
        expectedStartDate: input.expectedStartDate ? new Date(input.expectedStartDate) : null,
        siteCity: input.siteCity ?? null,
        siteRegion: input.siteRegion ?? null,
        sitePostcode: input.sitePostcode ?? null,
        probability: input.probability ?? null,
        source: input.source ?? ProjectSource.MANUAL,
        stage: ProjectStage.IDENTIFIED,
        ownerId: input.ownerId,
      },
    });

    await tx.projectStageEvent.create({
      data: { projectId: project.id, fromStage: null, toStage: ProjectStage.IDENTIFIED, changedById: input.ownerId },
    });

    if (input.firstCompanyId && input.firstCompanyRole) {
      await tx.projectCompany.create({
        data: {
          projectId: project.id,
          companyId: input.firstCompanyId,
          role: input.firstCompanyRole,
          isPrimary: true,
        },
      });
    }

    return project.id;
  });

  return getProjectById(created);
}

// ── Update fields ──────────────────────────────────────────────────
export type UpdateProjectInput = Partial<{
  title: string;
  description: string | null;
  projectCategory: ProjectCategory | null;
  unitCount: number | null;
  value: number | null;
  currency: string;
  expectedStartDate: string | null;
  siteCity: string | null;
  siteRegion: string | null;
  sitePostcode: string | null;
  probability: number | null;
}>;

export async function updateProject(id: string, input: UpdateProjectInput): Promise<ProjectRecord> {
  const data: Prisma.ProjectUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.projectCategory !== undefined) data.projectCategory = input.projectCategory;
  if (input.unitCount !== undefined) data.unitCount = input.unitCount;
  if (input.value !== undefined) data.value = input.value;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.expectedStartDate !== undefined)
    data.expectedStartDate = input.expectedStartDate ? new Date(input.expectedStartDate) : null;
  if (input.siteCity !== undefined) data.siteCity = input.siteCity;
  if (input.siteRegion !== undefined) data.siteRegion = input.siteRegion;
  if (input.sitePostcode !== undefined) data.sitePostcode = input.sitePostcode;
  if (input.probability !== undefined) data.probability = input.probability;

  try {
    await prisma.project.update({ where: { id }, data });
  } catch {
    throw new ApiError("PROJECT_NOT_FOUND", "Project was not found.", 404);
  }
  return getProjectById(id);
}

// ── Move stage (writes history) ────────────────────────────────────
export async function moveStage(
  id: string,
  toStage: ProjectStage,
  changedById: string,
  opts: { lostReasonCode?: LossReason; lostReason?: string; note?: string } = {}
): Promise<ProjectRecord> {
  if (toStage === ProjectStage.LOST && !opts.lostReasonCode) {
    throw new ApiError("INVALID_REQUEST", "lostReasonCode is required when moving a project to LOST.", 400);
  }

  const current = await prisma.project.findUnique({ where: { id }, select: { stage: true } });
  if (!current) throw new ApiError("PROJECT_NOT_FOUND", "Project was not found.", 404);

  if (current.stage === toStage) {
    // No-op move; just return current detail without writing a spurious event.
    return getProjectById(id);
  }

  await prisma.$transaction([
    prisma.project.update({
      where: { id },
      data: {
        stage: toStage,
        stageUpdatedAt: new Date(),
        lostReasonCode: toStage === ProjectStage.LOST ? (opts.lostReasonCode ?? null) : null,
        lostReason: toStage === ProjectStage.LOST ? (opts.lostReason ?? null) : null,
      },
    }),
    prisma.projectStageEvent.create({
      data: { projectId: id, fromStage: current.stage, toStage, changedById, note: opts.note ?? null },
    }),
  ]);

  return getProjectById(id);
}

export async function listStageHistory(projectId: string): Promise<ProjectStageEventRecord[]> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new ApiError("PROJECT_NOT_FOUND", "Project was not found.", 404);

  const events = await prisma.projectStageEvent.findMany({
    where: { projectId },
    orderBy: { changedAt: "desc" },
  });

  // changedById has no relation in schema (kept lean); resolve names in one query.
  const userIds = [...new Set(events.map((e) => e.changedById))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } });
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));

  return events.map((e) => ({
    id: e.id,
    fromStage: e.fromStage,
    toStage: e.toStage,
    changedBy: nameById.get(e.changedById) ?? "Unknown",
    changedAt: e.changedAt.toISOString(),
    note: e.note,
  }));
}

// ── Company links ──────────────────────────────────────────────────
export async function addProjectCompany(
  projectId: string,
  input: { companyId: string; role: CompanyRole; isPrimary?: boolean }
): Promise<ProjectRecord> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new ApiError("PROJECT_NOT_FOUND", "Project was not found.", 404);

  await prisma.$transaction(async (tx) => {
    // Only one primary at a time.
    if (input.isPrimary) {
      await tx.projectCompany.updateMany({ where: { projectId }, data: { isPrimary: false } });
    }
    try {
      await tx.projectCompany.create({
        data: { projectId, companyId: input.companyId, role: input.role, isPrimary: input.isPrimary ?? false },
      });
    } catch {
      throw new ApiError("INVALID_REQUEST", "This company already has that role on the project.", 400);
    }
  });

  return getProjectById(projectId);
}

export async function removeProjectCompany(projectId: string, linkId: string): Promise<ProjectRecord> {
  await prisma.projectCompany.deleteMany({ where: { id: linkId, projectId } });
  return getProjectById(projectId);
}

// ── Contact links ──────────────────────────────────────────────────
export async function addProjectContact(
  projectId: string,
  input: { contactId: string; note?: string }
): Promise<ProjectRecord> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new ApiError("PROJECT_NOT_FOUND", "Project was not found.", 404);

  try {
    await prisma.projectContact.create({
      data: { projectId, contactId: input.contactId, note: input.note ?? null },
    });
  } catch {
    throw new ApiError("INVALID_REQUEST", "This contact is already linked to the project.", 400);
  }
  return getProjectById(projectId);
}

export async function removeProjectContact(projectId: string, linkId: string): Promise<ProjectRecord> {
  await prisma.projectContact.deleteMany({ where: { id: linkId, projectId } });
  return getProjectById(projectId);
}

// ── RFQ conversion helper (used by rfq.store when projectId supplied) ──
// Advances an open project to TENDER when its first RFQ is created. Safe:
// only touches projects in pre-tender open stages; never reverses WON/LOST.
export async function advanceToTenderOnRfq(projectId: string, changedById: string): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { stage: true } });
  if (!project) return;
  const advanceable: ProjectStage[] = [ProjectStage.IDENTIFIED, ProjectStage.CONTACTED, ProjectStage.ENGAGED];
  if (!advanceable.includes(project.stage)) return;

  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: { stage: ProjectStage.TENDER, stageUpdatedAt: new Date() } }),
    prisma.projectStageEvent.create({
      data: { projectId, fromStage: project.stage, toStage: ProjectStage.TENDER, changedById, note: "RFQ created" },
    }),
  ]);
}

export { OPEN_STAGES };
