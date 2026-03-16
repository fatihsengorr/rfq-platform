import { Badge } from "./badge";

const roleLabels: Record<string, string> = {
  LONDON_SALES: "London Sales",
  ISTANBUL_PRICING: "Istanbul Pricing",
  ISTANBUL_MANAGER: "Istanbul Manager",
  ADMIN: "Admin",
};

interface RoleBadgeProps {
  role: string;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <Badge variant="outline" className={className}>
      {roleLabels[role] ?? role}
    </Badge>
  );
}
