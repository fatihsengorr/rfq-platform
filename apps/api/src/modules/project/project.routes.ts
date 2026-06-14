import type { FastifyPluginAsync } from "fastify";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { sendError, requireRole } from "../../middleware.js";
import {
  listProjects,
  getBoard,
  getProjectById,
  createProject,
  updateProject,
  moveStage,
  listStageHistory,
  addProjectCompany,
  removeProjectCompany,
  addProjectContact,
  removeProjectContact,
} from "./project.service.js";

const STAGE = z.enum(["IDENTIFIED", "CONTACTED", "ENGAGED", "TENDER", "WON", "LOST"]);
const SOURCE = z.enum(["MANUAL", "BARBOUR", "REFERRAL", "REPEAT_CLIENT", "OTHER"]);
const CATEGORY = z.enum([
  "JOINERY", "FFE", "FIT_OUT", "KITCHEN", "BAR_RESTAURANT",
  "RECEPTION", "BEDROOM_CASEGOODS", "RETAIL", "OTHER",
]);
const ROLE = z.enum([
  "CLIENT_EMPLOYER", "MAIN_CONTRACTOR", "ARCHITECT", "QS_COST_CONSULTANT",
  "INTERIOR_DESIGNER", "SUBCONTRACTOR", "DEVELOPER", "OTHER",
]);
const LOSS = z.enum(["PRICE", "TIMELINE", "LOST_TO_COMPETITOR", "CANCELLED", "NO_BUDGET", "OTHER"]);

const createSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  projectCategory: CATEGORY.optional(),
  unitCount: z.number().int().positive().optional(),
  value: z.number().nonnegative().optional(),
  currency: z.enum(["GBP", "EUR", "USD", "TRY"]).optional(),
  expectedStartDate: z.string().datetime().optional(),
  siteCity: z.string().optional(),
  siteRegion: z.string().optional(),
  sitePostcode: z.string().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  source: SOURCE.optional(),
  ownerId: z.string().uuid().optional(),
  firstCompanyId: z.string().uuid().optional(),
  firstCompanyRole: ROLE.optional(),
});

const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().nullable().optional(),
  projectCategory: CATEGORY.nullable().optional(),
  unitCount: z.number().int().positive().nullable().optional(),
  value: z.number().nonnegative().nullable().optional(),
  currency: z.enum(["GBP", "EUR", "USD", "TRY"]).optional(),
  expectedStartDate: z.string().datetime().nullable().optional(),
  siteCity: z.string().nullable().optional(),
  siteRegion: z.string().nullable().optional(),
  sitePostcode: z.string().nullable().optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
});

const moveStageSchema = z.object({
  stage: STAGE,
  lostReasonCode: LOSS.optional(),
  lostReason: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
});

const idParam = z.object({ id: z.string().uuid() });

export const registerProjectRoutes: FastifyPluginAsync = async (server) => {
  // List with filters
  server.get("/", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;

    const query = z
      .object({
        stage: STAGE.optional(),
        ownerId: z.string().uuid().optional(),
        source: SOURCE.optional(),
        category: CATEGORY.optional(),
        q: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Query validation failed.", details: query.error.flatten() });
    }
    return await listProjects(query.data);
  });

  // Kanban board
  server.get("/board", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;

    const query = z.object({ ownerId: z.string().uuid().optional() }).safeParse(request.query);
    const ownerId = query.success ? query.data.ownerId : undefined;
    return await getBoard(ownerId);
  });

  // Create
  server.post("/", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Validation failed.", details: parsed.error.flatten() });
    }
    // firstCompanyId requires firstCompanyRole and vice versa
    if (Boolean(parsed.data.firstCompanyId) !== Boolean(parsed.data.firstCompanyRole)) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "firstCompanyId and firstCompanyRole must be provided together." });
    }
    try {
      const project = await createProject({ ...parsed.data, ownerId: parsed.data.ownerId ?? session.user.id });
      return reply.status(201).send(project);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Get by id
  server.get("/:id", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid project ID." });
    try {
      return await getProjectById(params.data.id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Update fields
  server.patch("/:id", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid project ID." });
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Validation failed.", details: parsed.error.flatten() });
    }
    try {
      return await updateProject(params.data.id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Move stage
  server.patch("/:id/stage", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid project ID." });
    const parsed = moveStageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Validation failed.", details: parsed.error.flatten() });
    }
    try {
      return await moveStage(params.data.id, parsed.data.stage, session.user.id, {
        lostReasonCode: parsed.data.lostReasonCode,
        lostReason: parsed.data.lostReason,
        note: parsed.data.note,
      });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Stage history
  server.get("/:id/stage-history", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid project ID." });
    try {
      return await listStageHistory(params.data.id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Add company link
  server.post("/:id/companies", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid project ID." });
    const parsed = z.object({ companyId: z.string().uuid(), role: ROLE, isPrimary: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Validation failed.", details: parsed.error.flatten() });
    }
    try {
      return await addProjectCompany(params.data.id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Remove company link (no DELETE in CORS → POST /remove)
  server.post("/:id/companies/remove", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid project ID." });
    const parsed = z.object({ linkId: z.string().uuid() }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: "INVALID_REQUEST", message: "linkId is required." });
    try {
      return await removeProjectCompany(params.data.id, parsed.data.linkId);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Add contact link
  server.post("/:id/contacts", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid project ID." });
    const parsed = z.object({ contactId: z.string().uuid(), note: z.string().max(500).optional() }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Validation failed.", details: parsed.error.flatten() });
    }
    try {
      return await addProjectContact(params.data.id, parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Remove contact link
  server.post("/:id/contacts/remove", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid project ID." });
    const parsed = z.object({ linkId: z.string().uuid() }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: "INVALID_REQUEST", message: "linkId is required." });
    try {
      return await removeProjectContact(params.data.id, parsed.data.linkId);
    } catch (error) {
      return sendError(reply, error);
    }
  });
};
