import { cn } from "@/lib/utils";
import { getDeadlineUrgency, getDeadlineLabel } from "@/lib/deadline";

const urgencyStyles: Record<string, string> = {
  overdue:  "bg-danger/10 text-danger border-danger/30",
  critical: "bg-orange-100 text-orange-800 border-orange-300",
  warning:  "bg-amber-50 text-amber-700 border-amber-300",
  ok:       "bg-success/10 text-success border-success/30",
};

export function DeadlineBadge({ deadline, className }: { deadline: string; className?: string }) {
  const urgency = getDeadlineUrgency(deadline);
  const label = getDeadlineLabel(deadline);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold",
        urgencyStyles[urgency],
        className,
      )}
    >
      {label}
    </span>
  );
}
