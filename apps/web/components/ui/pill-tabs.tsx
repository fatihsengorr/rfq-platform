import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PillTabListProps {
  children: ReactNode;
  className?: string;
}

export function PillTabList({ children, className }: PillTabListProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {children}
    </div>
  );
}

interface PillTabProps {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PillTab({ active, onClick, icon, children, className }: PillTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-all",
        active
          ? "bg-primary/10 border-primary text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}
