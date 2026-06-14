/**
 * Manual staging seed for the CRM pipeline (Faz A).
 *
 * Guarded by ALLOW_SEED=true so it can never run by accident in prod.
 * Idempotent-ish: it only seeds when the pipeline is empty, so re-running
 * is a no-op once data exists. Owner = first LONDON_SALES (or ADMIN) user.
 *
 * Run:  ALLOW_SEED=true pnpm --filter api exec tsx prisma/seed-projects.ts
 */
import {
  PrismaClient,
  ProjectStage,
  ProjectSource,
  ProjectCategory,
  CompanyRole,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.ALLOW_SEED !== "true") {
    console.error("Refusing to seed: set ALLOW_SEED=true to run.");
    process.exit(1);
  }

  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log(`Pipeline already has ${existing} project(s); nothing to seed.`);
    return;
  }

  const owner =
    (await prisma.user.findFirst({ where: { role: "LONDON_SALES" } })) ??
    (await prisma.user.findFirst({ where: { role: "ADMIN" } }));
  if (!owner) {
    console.error("No LONDON_SALES or ADMIN user found to own seeded projects.");
    process.exit(1);
  }

  // ── Companies (with categories) ──────────────────────────────────
  const client = await prisma.customerCompany.create({
    data: { name: "Bankside Hospitality Group", category: CompanyRole.CLIENT_EMPLOYER, city: "London", country: "United Kingdom", postcode: "SE1 9PG" },
  });
  const contractor = await prisma.customerCompany.create({
    data: { name: "Mace Fit-Out Ltd", category: CompanyRole.MAIN_CONTRACTOR, city: "London", country: "United Kingdom" },
  });
  const architect = await prisma.customerCompany.create({
    data: { name: "Studio North Architects", category: CompanyRole.ARCHITECT, city: "Manchester", country: "United Kingdom" },
  });

  const clientContact = await prisma.contact.create({
    data: { fullName: "Sarah Whitfield", title: "Development Director", email: "sarah.whitfield@example.com", companyId: client.id },
  });

  // ── Projects across stages ───────────────────────────────────────
  const seeds: Array<{
    title: string;
    stage: ProjectStage;
    category: ProjectCategory;
    value: number;
    unitCount?: number;
    siteCity: string;
    withRelations?: boolean;
  }> = [
    { title: "Hilton Bankside FF&E refurbishment", stage: ProjectStage.ENGAGED, category: ProjectCategory.FFE, value: 480000, unitCount: 292, siteCity: "London", withRelations: true },
    { title: "Soho House members' bar joinery", stage: ProjectStage.IDENTIFIED, category: ProjectCategory.BAR_RESTAURANT, value: 120000, siteCity: "London" },
    { title: "Canary Wharf reception fit-out", stage: ProjectStage.CONTACTED, category: ProjectCategory.RECEPTION, value: 95000, siteCity: "London" },
    { title: "Edinburgh boutique hotel bedrooms", stage: ProjectStage.TENDER, category: ProjectCategory.BEDROOM_CASEGOODS, value: 340000, unitCount: 88, siteCity: "Edinburgh" },
    { title: "Mayfair retail flagship casework", stage: ProjectStage.WON, category: ProjectCategory.RETAIL, value: 210000, siteCity: "London" },
  ];

  for (const s of seeds) {
    const project = await prisma.project.create({
      data: {
        title: s.title,
        stage: s.stage,
        source: ProjectSource.MANUAL,
        projectCategory: s.category,
        value: s.value,
        currency: "GBP",
        unitCount: s.unitCount ?? null,
        siteCity: s.siteCity,
        siteRegion: "Greater London",
        ownerId: owner.id,
        stageEvents: {
          create: { fromStage: null, toStage: s.stage, changedById: owner.id, note: "Seeded" },
        },
      },
    });

    if (s.withRelations) {
      await prisma.projectCompany.createMany({
        data: [
          { projectId: project.id, companyId: client.id, role: CompanyRole.CLIENT_EMPLOYER, isPrimary: true },
          { projectId: project.id, companyId: contractor.id, role: CompanyRole.MAIN_CONTRACTOR },
          { projectId: project.id, companyId: architect.id, role: CompanyRole.ARCHITECT },
        ],
      });
      await prisma.projectContact.create({ data: { projectId: project.id, contactId: clientContact.id, note: "Primary decision maker" } });
    }
  }

  console.log(`Seeded ${seeds.length} projects + 3 companies, owned by ${owner.fullName}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
