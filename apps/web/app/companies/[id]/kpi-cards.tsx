import type { CompanyKpi } from "../../api";
import { Card } from "@/components/ui/card";
import { Trophy, XCircle, Clock, Activity, Receipt } from "lucide-react";

type Props = {
  kpi: CompanyKpi;
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function KpiCards({ kpi }: Props) {
  const winRatePct =
    kpi.winRate === null ? "—" : `${(kpi.winRate * 100).toFixed(0)}%`;
  const responseTime =
    kpi.avgResponseTimeDays === null
      ? "—"
      : kpi.avgResponseTimeDays < 1
        ? "< 1 day"
        : `${kpi.avgResponseTimeDays.toFixed(1)} days`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <KpiCard
        icon={<Activity className="size-4 text-[#8a5a2a]" />}
        label="Active"
        value={String(kpi.activeRfqs)}
        sub={`${kpi.totalRfqs} total`}
      />
      <KpiCard
        icon={<Receipt className="size-4 text-[#855615]" />}
        label="Quoted"
        value={String(kpi.quotedRfqs)}
        sub="awaiting outcome"
      />
      <KpiCard
        icon={<Trophy className="size-4 text-[#2d6a1e]" />}
        label="Won"
        value={String(kpi.wonRfqs)}
        sub={`${winRatePct} win rate`}
      />
      <KpiCard
        icon={<XCircle className="size-4 text-[#882f2f]" />}
        label="Lost"
        value={String(kpi.lostRfqs)}
        sub={kpi.closedRfqs > 0 ? `+ ${kpi.closedRfqs} closed (legacy)` : ""}
      />
      <KpiCard
        icon={<Clock className="size-4 text-muted-foreground" />}
        label="Avg response"
        value={responseTime}
        sub="RFQ → first approved quote"
      />
      {/* Lifetime value — full width row when present */}
      {kpi.lifetimeQuoteValue.length > 0 && (
        <Card className="col-span-2 md:col-span-3 lg:col-span-5 p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Lifetime quote value (won deals, by currency)
          </p>
          <div className="flex flex-wrap gap-4">
            {kpi.lifetimeQuoteValue.map((v) => (
              <div key={v.currency} className="font-bold text-lg">
                {formatCurrency(v.total, v.currency)}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{sub}</p>}
    </Card>
  );
}
