"use client";

/**
 * Faz 3 — Feature 4: ⌘K command palette.
 *
 * Triggered by the search button in the header or by ⌘K / Ctrl+K. Lets the
 * user pick which fields to match against (customer / project / location /
 * amount), enter a query, and see grouped results (Companies, RFQs).
 *
 * Implementation notes:
 * - We hit /api/search through a thin server-action proxy because the api
 *   helper reads the session cookie via next/headers (server-only).
 * - Debounced 300ms to avoid hammering the rate-limited endpoint.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, Building2, FileText } from "lucide-react";
import type { GlobalSearchResults } from "../api";
import { runGlobalSearch } from "./global-search-action";

const fieldOptions = [
  { id: "customer" as const, label: "Customer" },
  { id: "project" as const, label: "Project" },
  { id: "location" as const, label: "Location / sector" },
  { id: "amount" as const, label: "Amount" },
];

type FieldId = (typeof fieldOptions)[number]["id"];

export function GlobalSearchTrigger() {
  const [open, setOpen] = useState(false);

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
        aria-label="Open search (Cmd+K)"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden md:inline-block rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
          ⌘K
        </kbd>
      </button>
      {open && <GlobalSearchPalette onClose={() => setOpen(false)} />}
    </>
  );
}

function GlobalSearchPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [fields, setFields] = useState<Record<FieldId, boolean>>({
    customer: true,
    project: true,
    location: false,
    amount: false,
  });
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [currency, setCurrency] = useState<"" | "GBP" | "EUR" | "USD" | "TRY">("");
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const selectedFields = fieldOptions.filter((f) => fields[f.id]).map((f) => f.id);
    const hasText = q.trim().length >= 2;
    const hasAmount =
      fields.amount && (minAmount.length > 0 || maxAmount.length > 0);

    if (!hasText && !hasAmount) {
      setResults(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await runGlobalSearch({
          q: q.trim() || undefined,
          fields: selectedFields,
          minAmount: minAmount ? Number(minAmount) : undefined,
          maxAmount: maxAmount ? Number(maxAmount) : undefined,
          currency: currency || undefined,
          limit: 8,
        });
        setResults(r);
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, fields, minAmount, maxAmount, currency]);

  function navigate(url: string) {
    onClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (router as any).push(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-card shadow-2xl overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input row */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search companies, projects, locations…"
            className="flex-1 bg-transparent border-0 outline-none text-base"
          />
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Field toggles + amount range */}
        <div className="border-b border-border px-4 py-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {fieldOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFields((f) => ({ ...f, [opt.id]: !f[opt.id] }))}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                  fields[opt.id]
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {fields.amount && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Amount:</span>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="min"
                className="w-24 rounded border border-input bg-card px-2 py-1"
              />
              <span>–</span>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="max"
                className="w-24 rounded border border-input bg-card px-2 py-1"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as typeof currency)}
                className="rounded border border-input bg-card px-2 py-1"
              >
                <option value="">Any</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="TRY">TRY</option>
              </select>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!results ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Type at least 2 characters to search
              {fields.amount ? " or set an amount range" : ""}.
            </div>
          ) : results.companies.length === 0 && results.rfqs.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No matches. Try a different term or toggle more fields.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {results.companies.length > 0 && (
                <div className="py-1">
                  <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Companies ({results.totals.companies})
                  </p>
                  {results.companies.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => navigate(`/companies/${c.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted/50 transition-colors"
                    >
                      <Building2 className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[c.sector, c.city, c.country].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {c.rfqCount} RFQs
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {results.rfqs.length > 0 && (
                <div className="py-1">
                  <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    RFQs ({results.totals.rfqs})
                  </p>
                  {results.rfqs.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => navigate(`/requests/${r.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted/50 transition-colors"
                    >
                      <FileText className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{r.projectName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.companyName ?? "No company"} · {r.status}
                          {r.latestQuote
                            ? ` · ${r.latestQuote.currency} ${r.latestQuote.totalAmount.toLocaleString("en-GB")}`
                            : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
