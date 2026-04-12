import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendError, requireAuth } from "../../middleware.js";
import { searchCompanies, getCompanyById, createCompany, addContact } from "./company.service.js";

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
