import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "../../../lib/session";
import { getProjectById, getProjectStageHistory, getCompanyContacts, isApiClientError } from "../../api";
import {
  PROJECT_STAGE_LABELS,
  PROJECT_CATEGORY_LABELS,
  LOSS_REASON_LABELS,
} from "@crm/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate, formatDateTime } from "../../../lib/format";
import { StageBadge } from "../stage-badge";
import { MoveStageDialog } from "../move-stage-dialog";
import { CompaniesSection } from "./companies-section";
import { ContactsSection, type PickableContact } from "./contacts-section";
import { FilesSection } from "./files-section";
import { ArrowLeft, FilePlus2, MapPin, Calendar, Layers, PoundSterling, Percent, User } from "lucide-react";

type Params = Promise<{ id: string }>;

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session.accessToken || !session.user) redirect("/login");
  if (session.user.role !== "LONDON_SALES" && session.user.role !== "ADMIN") redirect("/");

  const { id } = await params;

  let project: Awaited<ReturnType<typeof getProjectById>> = null;
  try {
    project = await getProjectById(id);
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
  }

  if (!project) {
    return (
      <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
        <Card className="p-6">
          <h1 className="text-xl font-bold">Project not found</h1>
          <Button asChild className="mt-3">
            <Link href="/projects">Back to projects</Link>
          </Button>
        </Card>
      </main>
    );
  }

  // Stage history (timeline) + contact picker source (contacts of linked companies).
  const [history, contactGroups] = await Promise.all([
    getProjectStageHistory(id).catch(() => []),
    Promise.all(
      project.companies.map(async (c) => ({
        companyName: c.companyName,
        contacts: await getCompanyContacts(c.companyId).catch(() => []),
      }))
    ),
  ]);

  const pickable: PickableContact[] = contactGroups.flatMap((g) =>
    g.contacts.map((ct) => ({ id: ct.id, fullName: ct.fullName, title: ct.title, companyName: g.companyName }))
  );

  const siteLocation = [project.siteCity, project.siteRegion, project.sitePostcode].filter(Boolean).join(", ") || "—";

  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6 space-y-4">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="size-3" /> Back to projects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <StageBadge stage={project.stage} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
            <span>{project.source}</span>
            {project.externalRef && <span>Ref: {project.externalRef}</span>}
            <span className="inline-flex items-center gap-1">
              <User className="size-3" /> {project.ownerName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MoveStageDialog projectId={project.id} currentStage={project.stage} />
          <Button asChild>
            <Link href={`/requests/new?projectId=${project.id}`}>
              <FilePlus2 className="size-4" /> Create RFQ
            </Link>
          </Button>
        </div>
      </div>

      {project.description && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
        </Card>
      )}

      {/* Facts */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Fact icon={<Layers className="size-4" />} label="Category" value={project.projectCategory ? PROJECT_CATEGORY_LABELS[project.projectCategory] : "—"} />
          <Fact icon={<Layers className="size-4" />} label="Units" value={project.unitCount != null ? String(project.unitCount) : "—"} />
          <Fact icon={<PoundSterling className="size-4" />} label="Value" value={project.value != null ? formatCurrency(project.value, project.currency) : "—"} />
          <Fact icon={<Percent className="size-4" />} label="Probability" value={project.probability != null ? `${project.probability}%` : "—"} />
          <Fact icon={<Calendar className="size-4" />} label="Expected start" value={project.expectedStartDate ? formatDate(project.expectedStartDate) : "—"} />
          <Fact icon={<MapPin className="size-4" />} label="Site" value={siteLocation} />
          <Fact icon={<Calendar className="size-4" />} label="Created" value={formatDate(project.createdAt)} />
          <Fact icon={<Calendar className="size-4" />} label="In stage since" value={formatDate(project.stageUpdatedAt)} />
        </div>

        {project.stage === "LOST" && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
            <p className="text-sm font-semibold text-rose-600">
              Lost{project.lostReasonCode ? ` — ${LOSS_REASON_LABELS[project.lostReasonCode]}` : ""}
            </p>
            {project.lostReason && <p className="text-sm text-muted-foreground mt-0.5">{project.lostReason}</p>}
          </div>
        )}
      </Card>

      {/* Two-column layout */}
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4 min-w-0">
          {/* RFQs */}
          <Card className="p-4">
            <h3 className="font-bold text-sm mb-3">RFQs ({project.rfqs.length})</h3>
            {project.rfqs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No RFQs yet. Use “Create RFQ” to quote a package for this project.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {project.rfqs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/requests/${r.id}`} className="font-semibold text-sm hover:text-primary truncate">
                      {r.projectName}
                    </Link>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <FilesSection projectId={project.id} files={project.attachments} />
        </div>

        <div className="space-y-4">
          <CompaniesSection projectId={project.id} links={project.companies} />
          <ContactsSection projectId={project.id} links={project.contacts} pickable={pickable} />

          {/* Stage history */}
          <Card className="p-4">
            <h3 className="font-bold text-sm mb-3">Stage history</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stage changes yet.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((ev) => (
                  <li key={ev.id} className="border-l-2 border-primary/30 pl-3">
                    <p className="text-sm font-semibold">
                      {ev.fromStage ? `${PROJECT_STAGE_LABELS[ev.fromStage]} → ` : ""}
                      {PROJECT_STAGE_LABELS[ev.toStage]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ev.changedBy} · {formatDateTime(ev.changedAt)}
                    </p>
                    {ev.note && <p className="text-xs text-muted-foreground mt-0.5 italic">{ev.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
