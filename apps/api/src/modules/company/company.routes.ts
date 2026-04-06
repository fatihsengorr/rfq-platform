import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { extractBearerToken, resolveAccessToken } from "../auth/auth.service.js";

const createCompanySchema = z.object({
  name: z.string().min(2),
  sector: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  // Optional first contact to create alongside the company
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
  // Helper: extract authenticated user
  async function requireAuth(request: any, reply: any) {
    const token = extractBearerToken(request);
    if (!token) {
      reply.status(401).send({ code: "UNAUTHORIZED", message: "Missing access token." });
      return null;
    }
    const session = await resolveAccessToken(token);
    if (!session) {
      reply.status(401).send({ code: "UNAUTHORIZED", message: "Invalid or expired access token." });
      return null;
    }
    return session;
  }

  // GET /api/companies?q=search_term — search/list companies
  server.get("/", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { q } = request.query as { q?: string };

    const companies = await prisma.customerCompany.findMany({
      where: q
        ? { name: { contains: q, mode: "insensitive" } }
        : undefined,
      include: {
        contacts: {
          orderBy: { fullName: "asc" },
        },
        _count: { select: { rfqs: true } },
      },
      orderBy: { name: "asc" },
      take: 50,
    });

    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      sector: c.sector,
      country: c.country,
      city: c.city,
      website: c.website,
      notes: c.notes,
      rfqCount: c._count.rfqs,
      contacts: c.contacts.map((ct) => ({
        id: ct.id,
        fullName: ct.fullName,
        email: ct.email,
        phone: ct.phone,
        title: ct.title,
      })),
    }));
  });

  // GET /api/companies/:id — single company with stats
  server.get("/:id", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid company ID." });
    }

    const company = await prisma.customerCompany.findUnique({
      where: { id: params.data.id },
      include: {
        contacts: { orderBy: { fullName: "asc" } },
        rfqs: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            projectName: true,
            status: true,
            createdAt: true,
            deadline: true,
          },
        },
        _count: { select: { rfqs: true } },
      },
    });

    if (!company) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Company not found." });
    }

    return {
      id: company.id,
      name: company.name,
      sector: company.sector,
      country: company.country,
      city: company.city,
      website: company.website,
      notes: company.notes,
      rfqCount: company._count.rfqs,
      contacts: company.contacts.map((ct) => ({
        id: ct.id,
        fullName: ct.fullName,
        email: ct.email,
        phone: ct.phone,
        title: ct.title,
      })),
      recentRfqs: company.rfqs.map((r) => ({
        id: r.id,
        projectName: r.projectName,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        deadline: r.deadline.toISOString(),
      })),
    };
  });

  // POST /api/companies — create new company (optionally with first contact)
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

    const { contact, ...companyData } = parsed.data;

    const company = await prisma.customerCompany.create({
      data: {
        ...companyData,
        contacts: contact
          ? { create: contact }
          : undefined,
      },
      include: {
        contacts: true,
        _count: { select: { rfqs: true } },
      },
    });

    return reply.status(201).send({
      id: company.id,
      name: company.name,
      sector: company.sector,
      country: company.country,
      city: company.city,
      website: company.website,
      notes: company.notes,
      rfqCount: company._count.rfqs,
      contacts: company.contacts.map((ct) => ({
        id: ct.id,
        fullName: ct.fullName,
        email: ct.email,
        phone: ct.phone,
        title: ct.title,
      })),
    });
  });

  // POST /api/companies/:id/contacts — add contact to existing company
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

    const company = await prisma.customerCompany.findUnique({ where: { id: params.data.id } });
    if (!company) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Company not found." });
    }

    const contact = await prisma.contact.create({
      data: {
        ...parsed.data,
        companyId: params.data.id,
      },
    });

    return reply.status(201).send({
      id: contact.id,
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      title: contact.title,
    });
  });
};
