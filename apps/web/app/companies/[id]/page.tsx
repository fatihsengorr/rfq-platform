import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone, Briefcase, MapPin, Tag } from "lucide-react";
import { getSession } from "../../../lib/session";
import { getCompanyById, getCompanyRfqs, isApiClientError } from "../../api";
import { COMPANY_ROLE_LABELS } from "@crm/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCards } from "./kpi-cards";
import { RfqsList } from "./rfqs-list";
import { CompanyEditDialog } from "./company-edit-dialog";
import { StageBadge } from "../../projects/stage-badge";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  status?: string;
  from?: string;
  to?: string;
  minAmount?: string;
  maxAmount?: string;
  currency?: string;
  page?: string;
}>;

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session.accessToken || !session.user) redirect("/login");

  const canEditCompany = session.user.role === "LONDON_SALES" || session.user.role === "ADMIN";

  const { id } = await params;
  const sp = await searchParams;

  let company: Awaited<ReturnType<typeof getCompanyById>> = null;
  try {
    company = await getCompanyById(id);
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
  }

  if (!company) {
    return (
      <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
        <Card className="p-6">
          <h1 className="text-xl font-bold">Company not found</h1>
          <Button asChild className="mt-3">
            <Link href="/companies">Back to companies</Link>
          </Button>
        </Card>
      </main>
    );
  }

  // Server-fetch the filtered RFQ list using URL params so deep-links work.
  const filter = {
    status: sp.status as "open" | "won" | "lost" | "closed" | "all" | undefined,
    from: sp.from,
    to: sp.to,
    minAmount: sp.minAmount ? Number(sp.minAmount) : undefined,
    maxAmount: sp.maxAmount ? Number(sp.maxAmount) : undefined,
    currency: sp.currency as "GBP" | "EUR" | "USD" | "TRY" | undefined,
    page: sp.page ? Number(sp.page) : 1,
    limit: 25,
  };

  let rfqList: Awaited<ReturnType<typeof getCompanyRfqs>> = {
    data: [],
    total: 0,
    page: 1,
    limit: 25,
  };
  try {
    rfqList = await getCompanyRfqs(id, filter);
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
  }

  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6 space-y-4">
      <Link
        href="/companies"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="size-3" /> Back to companies
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
            {company.category && (
              <span className="inline-flex items-center gap-1">
                <Tag className="size-3" /> {COMPANY_ROLE_LABELS[company.category]}
              </span>
            )}
            {company.sector && (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="size-3" /> {company.sector}
              </span>
            )}
            {(company.addressLine || company.city || company.postcode || company.country) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />{" "}
                {[company.addressLine, company.city, company.postcode, company.country].filter(Boolean).join(", ")}
              </span>
            )}
            {company.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" /> {company.phone}
              </span>
            )}
            {company.website && (
              <a
                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary"
              >
                <ExternalLink className="size-3" /> {company.website}
              </a>
            )}
          </div>
        </div>
        {canEditCompany && <CompanyEditDialog company={company} />}
      </div>

      {/* KPI cards */}
      <KpiCards kpi={company.kpi} />

      {/* Two-column: RFQs list (left) + Contacts/Notes (right) */}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <RfqsList
            companyId={company.id}
            initialRows={rfqList.data}
            initialTotal={rfqList.total}
            initialPage={rfqList.page}
            initialFilter={filter}
          />
        </div>

        <div className="space-y-3">
          {/* Projects (CRM — Faz A) */}
          {canEditCompany && (
            <Card className="p-4">
              <h3 className="font-bold text-sm mb-3">Projects ({company.projects.length})</h3>
              {company.projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not linked to any project yet.</p>
              ) : (
                <ul className="space-y-2">
                  {company.projects.map((p) => (
                    <li key={p.linkId} className="border-l-2 border-primary/30 pl-3">
                      <Link href={`/projects/${p.projectId}`} className="font-semibold text-sm hover:text-primary block truncate">
                        {p.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StageBadge stage={p.stage} />
                        <span className="text-xs text-muted-foreground">{COMPANY_ROLE_LABELS[p.role]}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Contacts */}
          <Card className="p-4">
            <h3 className="font-bold text-sm mb-3">Contacts ({company.contacts.length})</h3>
            {company.contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts yet.</p>
            ) : (
              <ul className="space-y-3">
                {company.contacts.map((ct) => (
                  <li key={ct.id} className="border-l-2 border-primary/30 pl-3">
                    <p className="font-semibold text-sm">{ct.fullName}</p>
                    {ct.title && <p className="text-xs text-muted-foreground">{ct.title}</p>}
                    {ct.email && (
                      <a
                        href={`mailto:${ct.email}`}
                        className="text-xs inline-flex items-center gap-1 mt-0.5 hover:text-primary"
                      >
                        <Mail className="size-3" /> {ct.email}
                      </a>
                    )}
                    {ct.phone && (
                      <p className="text-xs inline-flex items-center gap-1 mt-0.5">
                        <Phone className="size-3" /> {ct.phone}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Notes */}
          {company.notes && (
            <Card className="p-4">
              <h3 className="font-bold text-sm mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{company.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
