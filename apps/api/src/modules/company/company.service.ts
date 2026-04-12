import { ApiError } from "../../errors.js";
import { prisma } from "../../prisma.js";

// ── Mapping helpers ────────────────────────────────────────────────

function mapContact(ct: { id: string; fullName: string; email: string | null; phone: string | null; title: string | null }) {
  return { id: ct.id, fullName: ct.fullName, email: ct.email, phone: ct.phone, title: ct.title };
}

// ── Service functions ──────────────────────────────────────────────

export async function searchCompanies(query?: string) {
  const companies = await prisma.customerCompany.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
    include: {
      contacts: { orderBy: { fullName: "asc" } },
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
    contacts: c.contacts.map(mapContact),
  }));
}

export async function getCompanyById(id: string) {
  const company = await prisma.customerCompany.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { fullName: "asc" } },
      rfqs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, projectName: true, status: true, createdAt: true, deadline: true },
      },
      _count: { select: { rfqs: true } },
    },
  });

  if (!company) {
    throw new ApiError("RFQ_NOT_FOUND", "Company not found.", 404);
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
    contacts: company.contacts.map(mapContact),
    recentRfqs: company.rfqs.map((r) => ({
      id: r.id,
      projectName: r.projectName,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      deadline: r.deadline.toISOString(),
    })),
  };
}

export async function createCompany(data: {
  name: string;
  sector?: string;
  country?: string;
  city?: string;
  website?: string;
  notes?: string;
  contact?: { fullName: string; email?: string; phone?: string; title?: string };
}) {
  const { contact, ...companyData } = data;

  const company = await prisma.customerCompany.create({
    data: {
      ...companyData,
      contacts: contact ? { create: contact } : undefined,
    },
    include: {
      contacts: true,
      _count: { select: { rfqs: true } },
    },
  });

  return {
    id: company.id,
    name: company.name,
    sector: company.sector,
    country: company.country,
    city: company.city,
    website: company.website,
    notes: company.notes,
    rfqCount: company._count.rfqs,
    contacts: company.contacts.map(mapContact),
  };
}

export async function addContact(companyId: string, data: { fullName: string; email?: string; phone?: string; title?: string }) {
  const company = await prisma.customerCompany.findUnique({ where: { id: companyId } });
  if (!company) {
    throw new ApiError("RFQ_NOT_FOUND", "Company not found.", 404);
  }

  const contact = await prisma.contact.create({
    data: { ...data, companyId },
  });

  return mapContact(contact);
}
