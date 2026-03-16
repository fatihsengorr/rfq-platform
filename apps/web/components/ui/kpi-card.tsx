import { Card } from "./card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: number | string;
  accent?: "primary" | "accent" | "muted";
  className?: string;
}

const accentBorder: Record<string, string> = {
  primary: "border-l-4 border-l-primary",
  accent: "border-l-4 border-l-accent",
  muted: "border-l-4 border-l-muted-foreground",
};

export function KpiCard({ label, value, accent = "primary", className }: KpiCardProps) {
  return (
    <Card className={cn("p-4", accentBorder[accent], className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
    </Card>
  );
}
