"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  COMPANY_ROLES,
  COMPANY_ROLE_LABELS,
  type ProjectCompanyLink,
  type CompanyRole,
} from "@crm/shared";
import {
  CompanyCombobox,
  type CompanyOption,
  type ContactOption,
  type NewCompanyData,
} from "@/components/ui/company-combobox";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addCompanyAction, removeCompanyAction } from "../actions";
import { Building2, Star, Trash2, Plus, Loader2 } from "lucide-react";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function CompaniesSection({ projectId, links }: { projectId: string; links: ProjectCompanyLink[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [, setSelectedContact] = useState<ContactOption | null>(null);
  const [role, setRole] = useState<CompanyRole>("CLIENT_EMPLOYER");
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleNewCompany = useCallback(async (data: NewCompanyData): Promise<CompanyOption> => {
    const res = await fetch("/api/companies-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create company");
    return res.json();
  }, []);

  function add() {
    if (!selectedCompany) {
      setError("Select a company first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addCompanyAction({ projectId, companyId: selectedCompany.id, role, isPrimary });
      if (result.status === "error") {
        setError(result.message ?? "Could not link company.");
        return;
      }
      setSelectedCompany(null);
      setSelectedContact(null);
      setIsPrimary(false);
      setAdding(false);
      router.refresh();
    });
  }

  function remove(linkId: string) {
    startTransition(async () => {
      const result = await removeCompanyAction(projectId, linkId);
      if (result.status === "error") setError(result.message ?? "Could not remove company.");
      else router.refresh();
    });
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">Companies ({links.length})</h3>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add
          </Button>
        )}
      </div>

      {error && <p className="text-xs font-semibold text-rose-600 mb-2">{error}</p>}

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">No companies linked yet.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 border-l-2 border-primary/30 pl-3 py-1">
              <div className="min-w-0">
                <Link href={`/companies/${l.companyId}`} className="font-semibold text-sm hover:text-primary inline-flex items-center gap-1">
                  <Building2 className="size-3 shrink-0" /> {l.companyName}
                  {l.isPrimary && <Star className="size-3 text-amber-500 fill-amber-500" />}
                </Link>
                <p className="text-xs text-muted-foreground">{COMPANY_ROLE_LABELS[l.role]}</p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(l.id)}
                className="text-muted-foreground hover:text-rose-600 transition-colors shrink-0"
                aria-label="Remove company"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="space-y-3 border-t border-border pt-3">
          <CompanyCombobox
            selectedCompany={selectedCompany}
            selectedContact={null}
            onCompanySelect={setSelectedCompany}
            onContactSelect={setSelectedContact}
            onNewCompany={handleNewCompany}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="add-company-role">Role</Label>
            <select id="add-company-role" value={role} onChange={(e) => setRole(e.target.value as CompanyRole)} className={SELECT_CLASS}>
              {COMPANY_ROLES.map((r) => (
                <option key={r} value={r}>
                  {COMPANY_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
            Primary company (the client we quote)
          </label>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={pending} onClick={add}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Link company
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => { setAdding(false); setError(null); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
