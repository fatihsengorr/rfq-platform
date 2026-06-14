import { PROJECT_STAGE_LABELS, type ProjectStage } from "@crm/shared";
import { cn } from "@/lib/utils";

const STAGE_CLASSES: Record<ProjectStage, string> = {
  IDENTIFIED: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  CONTACTED: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  ENGAGED: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  TENDER: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  WON: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  LOST: "bg-rose-500/10 text-rose-600 border-rose-500/30",
};

export function StageBadge({ stage, className }: { stage: ProjectStage; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-bold",
        STAGE_CLASSES[stage],
        className
      )}
    >
      {PROJECT_STAGE_LABELS[stage]}
    </span>
  );
}
