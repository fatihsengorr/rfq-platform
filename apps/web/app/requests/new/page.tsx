import { redirect } from "next/navigation";
import { getSession } from "../../../lib/session";
import { setFlashNotice } from "../../../lib/flash";
import { getProjectById, getCompanyById, isApiClientError } from "../../api";
import type { CompanyOption } from "@/components/ui/company-combobox";
import { PageHeader } from "@/components/ui/page-header";
import { CreateRfqForm } from "./create-rfq-form";

type SearchParams = Promise<{ projectId?: string }>;

export default async function NewRequestPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  const canCreateRfq = session.user.role === "LONDON_SALES" || session.user.role === "ADMIN";

  if (!canCreateRfq) {
    await setFlashNotice("/requests", "rfq_create_forbidden");
    redirect("/requests");
  }

  // CRM (Faz A): if launched from a Project, prefill name/details + the
  // primary company, and link the RFQ back to the project.
  const { projectId } = await searchParams;
  let prefill: { projectId: string; name?: string; details?: string } | null = null;
  let defaultCompany: CompanyOption | null = null;
  if (projectId) {
    try {
      const project = await getProjectById(projectId);
      if (project) {
        prefill = { projectId: project.id, name: project.title, details: project.description ?? undefined };

        // Prefill the company we quote = the project's primary (or first) company.
        const primaryLink = project.companies.find((c) => c.isPrimary) ?? project.companies[0];
        if (primaryLink) {
          const company = await getCompanyById(primaryLink.companyId);
          if (company) {
            defaultCompany = {
              id: company.id,
              name: company.name,
              sector: company.sector,
              country: company.country,
              city: company.city,
              contacts: company.contacts.map((ct) => ({
                id: ct.id,
                fullName: ct.fullName,
                email: ct.email,
                phone: ct.phone,
                title: ct.title,
              })),
            };
          }
        }
      }
    } catch (error) {
      if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
    }
  }

  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      <PageHeader
        title="New RFQ Request"
        description="Create a request for Istanbul pricing. Required fields must be completed before submission."
      />
      <CreateRfqForm
        requestedBy={session.user.fullName}
        projectId={prefill?.projectId}
        defaultProjectName={prefill?.name}
        defaultProjectDetails={prefill?.details}
        defaultCompany={defaultCompany}
      />
    </main>
  );
}
