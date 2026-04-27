"use client";

/**
 * Faz 3 — Feature 4: filtered RFQ table inside the company detail page.
 *
 * Filter state is held in the URL (status, from, to, minAmount, maxAmount,
 * currency, page) so the page is bookmarkable / shareable. Submitting the
 * filter form does a normal navigation; the parent server component re-runs
 * with the new params and re-passes the rows here as initialRows.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { CompanyRfqRow } from "../../api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Loader2, Filter } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type Props = {
  companyId: string;
  initialRows: CompanyRfqRow[];
  initialTotal: number;
  initialPage: number;
  initialFilter: {
    status?: string;
    from?: string;
    to?: string;
    minAmount?: number;
    maxAmount?: number;
    currency?: string;
    page: number;
    limit: number;
  };
};

const selectCls =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RfqsList({
  companyId,
  initialRows,
  initialTotal,
  initialPage,
  initialFilter,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function applyFilter(formData: FormData) {
    const next = new URLSearchParams();
    const set = (key: string) => {
      const value = formData.get(key);
      if (value && String(value).length > 0) next.set(key, String(value));
    };
    set("status");
    set("from");
    set("to");
    set("minAmount");
    set("maxAmount");
    set("currency");
    next.set("page", "1");
    startTransition(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router as any).push(`${pathname}?${next.toString()}`);
    });
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(page));
    startTransition(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router as any).push(`${pathname}?${next.toString()}`);
    });
  }

  const totalPages = Math.max(1, Math.ceil(initialTotal / initialFilter.limit));

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <Card className="p-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-semibold w-full text-left"
        >
          <Filter className="size-4" />
          Filter
          <span className="text-xs text-muted-foreground font-normal">
            ({initialTotal} {initialTotal === 1 ? "RFQ" : "RFQs"})
          </span>
        </button>

        {open && (
          <form
            action={applyFilter}
            className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <div className="grid gap-1">
              <Label className="text-xs">Status</Label>
              <select name="status" defaultValue={initialFilter.status ?? ""} className={selectCls}>
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Currency</Label>
              <select
                name="currency"
                defaultValue={initialFilter.currency ?? ""}
                className={selectCls}
              >
                <option value="">Any</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="TRY">TRY</option>
              </select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Min amount</Label>
              <Input
                type="number"
                name="minAmount"
                step="100"
                min="0"
                defaultValue={initialFilter.minAmount ?? ""}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Max amount</Label>
              <Input
                type="number"
                name="maxAmount"
                step="100"
                min="0"
                defaultValue={initialFilter.maxAmount ?? ""}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">From (created)</Label>
              <Input
                type="date"
                name="from"
                defaultValue={initialFilter.from ? initialFilter.from.slice(0, 10) : ""}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">To (created)</Label>
              <Input
                type="date"
                name="to"
                defaultValue={initialFilter.to ? initialFilter.to.slice(0, 10) : ""}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? <><Loader2 className="size-3 animate-spin" />Applying…</> : "Apply"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  startTransition(() => (router as any).push(pathname));
                }}
              >
                Reset
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {initialRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No RFQs match these filters.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted/40">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left font-semibold px-4 py-2">Project</th>
                <th className="text-left font-semibold px-4 py-2">Status</th>
                <th className="text-right font-semibold px-4 py-2">Latest quote</th>
                <th className="text-left font-semibold px-4 py-2 hidden md:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {initialRows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/requests/${r.id}`} className="font-semibold hover:text-primary">
                      {r.projectName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {r.latestQuote ? (
                      <span>
                        {r.latestQuote.currency} {r.latestQuote.totalAmount.toLocaleString("en-GB")}
                        <span className="text-xs text-muted-foreground ml-1">
                          v{r.latestQuote.versionNumber}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {formatDateTime(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {initialPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={initialPage <= 1 || pending}
              onClick={() => goToPage(initialPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={initialPage >= totalPages || pending}
              onClick={() => goToPage(initialPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
