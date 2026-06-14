import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { getProjectBoard, isApiClientError } from "../api";
import { PROJECT_STAGES, PROJECT_STAGE_LABELS, PROJECT_CATEGORY_LABELS, type ProjectCard } from "@crm/shared";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "../../lib/format";
import { NewProjectDialog } from "./new-project-dialog";
import { MoveStageDialog } from "./move-stage-dialog";
import { Building2, User, Clock } from "lucide-react";

type SearchParams = Promise<{ view?: string }>;

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function BoardCard({ card }: { card: ProjectCard }) {
  return (
    <Card className="p-3 space-y-2">
      <Link href={`/projects/${card.id}`} className="font-semibold text-sm leading-snug hover:text-primary block">
        {card.title}
      </Link>
      {card.primaryCompanyName && (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Building2 className="size-3" /> {card.primaryCompanyName}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {card.value !== null && (
          <span className="font-semibold text-foreground">{formatCurrency(card.value, card.currency)}</span>
        )}
        {card.projectCategory && <span>{PROJECT_CATEGORY_LABELS[card.projectCategory]}</span>}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <User className="size-3" /> {card.ownerName}
        </span>
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Clock className="size-3" /> {daysSince(card.stageUpdatedAt)}d
        </span>
      </div>
      <div className="pt-1">
        <MoveStageDialog projectId={card.id} currentStage={card.stage} compact />
      </div>
    </Card>
  );
}

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session.accessToken || !session.user) redirect("/login");
  if (session.user.role !== "LONDON_SALES" && session.user.role !== "ADMIN") redirect("/");

  const { view } = await searchParams;
  const mine = view === "mine";

  let board: Awaited<ReturnType<typeof getProjectBoard>> = { columns: [] };
  try {
    board = await getProjectBoard(mine ? session.user.id : undefined);
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
  }

  const byStage = new Map(board.columns.map((c) => [c.stage, c]));

  return (
    <main className="w-full max-w-[1400px] mx-auto px-4 py-6 space-y-4">
      <PageHeader title="Projects" description="Sales pipeline — from identified opportunity to won.">
        <NewProjectDialog />
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/projects?view=all"
          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold border transition-all ${
            !mine ? "bg-primary/10 border-primary text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </Link>
        <Link
          href="/projects?view=mine"
          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold border transition-all ${
            mine ? "bg-primary/10 border-primary text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          Mine
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {PROJECT_STAGES.map((stage) => {
          const col = byStage.get(stage);
          const cards = col?.cards ?? [];
          const totals = col?.totalValueByCurrency ?? [];
          return (
            <div key={stage} className="min-w-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {PROJECT_STAGE_LABELS[stage]}
                </h2>
                <span className="text-xs font-semibold text-muted-foreground">{col?.count ?? 0}</span>
              </div>
              {totals.length > 0 && (
                <p className="text-[0.7rem] text-muted-foreground mb-2 px-1">
                  {totals.map((t) => formatCurrency(t.total, t.currency)).join(" · ")}
                </p>
              )}
              <div className="space-y-2">
                {cards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Empty
                  </div>
                ) : (
                  cards.map((card) => <BoardCard key={card.id} card={card} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
