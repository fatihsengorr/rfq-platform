import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendError, requireAuth } from "../../middleware.js";
import {
  searchCompanies,
  getCompanyById,
  createCompany,
  addContact,
  listCompanyRfqs,
} from "./company.service.js";

const createCompanySchema = z.object({
  name: z.string().min(2),
  sector: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  contact: z
    .object({
      fullName: z.string().min(2),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      title: z.string().optional(),
    })
    .optional(),
});

const createContactSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
});

export const registerCompanyRoutes: FastifyPluginAsync = async (server) => {
  server.get("/", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { q } = request.query as { q?: string };
    return await searchCompanies(q);
  });

  server.get("/:id", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid company ID." });
    }

    try {
      return await getCompanyById(params.data.id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Faz 3 — Feature 4: filtered RFQ list for a single company
  server.get("/:id/rfqs", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid company ID." });
    }

    const querySchema = z.object({
      status: z.enum(["open", "won", "lost", "closed", "all"]).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      minAmount: z.coerce.number().nonnegative().optional(),
      maxAmount: z.coerce.number().positive().optional(),
      currency: z.enum(["GBP", "EUR", "USD", "TRY"]).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    });

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Query validation failed.",
        details: parsed.error.flatten(),
      });
    }

    const q = parsed.data;
    try {
      const result = await listCompanyRfqs(params.data.id, {
        status: q.status,
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        minAmount: q.minAmount,
        maxAmount: q.maxAmount,
        currency: q.currency,
        page: q.page,
        limit: q.limit,
      });
      return result;
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post("/", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const parsed = createCompanySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Validation failed.",
        details: parsed.error.flatten(),
      });
    }

    try {
      const company = await createCompany(parsed.data);
      return reply.status(201).send(company);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post("/:id/contacts", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid company ID." });
    }

    const parsed = createContactSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Validation failed.",
        details: parsed.error.flatten(),
      });
    }

    try {
      const contact = await addContact(params.data.id, parsed.data);
      return reply.status(201).send(contact);
    } catch (error) {
      return sendError(reply, error);
    }
  });
};
