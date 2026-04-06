import Link from "next/link";
import { Card } from "./card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: number | string;
  accent?: "primary" | "accent" | "muted";
  href?: string;
  className?: string;
}

const accentBorder: Record<string, string> = {
  primary: "border-l-4 border-l-primary",
  accent: "border-l-4 border-l-accent",
  muted: "border-l-4 border-l-muted-foreground",
};

export function KpiCard({ label, value, accent = "primary", href, className }: KpiCardProps) {
  const content = (
    <Card className={cn("p-4", accentBorder[accent], href && "hover:shadow-md transition-shadow cursor-pointer", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
    </Card>
  );

  if (href) {
    return <Link href={href as any}>{content}</Link>;
  }

  return content;
}
