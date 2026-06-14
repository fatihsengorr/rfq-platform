"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import { IDLE_RESULT } from "../../lib/action-result";
import { createProjectAction } from "./actions";
import {
  PROJECT_CATEGORIES,
  PROJECT_CATEGORY_LABELS,
  COMPANY_ROLES,
  COMPANY_ROLE_LABELS,
} from "@crm/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import {
  CompanyCombobox,
  type CompanyOption,
  type ContactOption,
  type NewCompanyData,
} from "@/components/ui/company-combobox";
import { Plus, Loader2 } from "lucide-react";

const SELECT_CLASS = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

export function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createProjectAction, IDLE_RESULT);
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state]);

  const handleNewCompany = useCallback(async (data: NewCompanyData): Promise<CompanyOption> => {
    const res = await fetch("/api/companies-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create company");
    return res.json();
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        <FormMessage state={state} />

        {/* Company picker is a SIBLING of the form, not a child. Its internal
            <form> (the "new company" sub-form) must not nest inside ours —
            nested forms make the "Create company" button submit the project
            form instead. The selected company is bridged in via a hidden input. */}
        <div className="border-b border-border pb-3 mb-1">
          <p className="text-sm font-semibold mb-2">Primary company (optional)</p>
          <CompanyCombobox
            selectedCompany={selectedCompany}
            selectedContact={selectedContact}
            onCompanySelect={setSelectedCompany}
            onContactSelect={setSelectedContact}
            onNewCompany={handleNewCompany}
          />
        </div>

        <form action={formAction} className="grid sm:grid-cols-2 gap-4">
          <input type="hidden" name="companyId" value={selectedCompany?.id ?? ""} />
          <div className="sm:col-span-2 grid gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required minLength={3} placeholder="e.g. Hilton Bankside refurbishment" />
          </div>

          <div className="sm:col-span-2 grid gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} placeholder="Scope, packages, notes…" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="projectCategory">Category</Label>
            <select id="projectCategory" name="projectCategory" defaultValue="" className={SELECT_CLASS}>
              <option value="">—</option>
              {PROJECT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PROJECT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="unitCount">Units (rooms / keys / plots)</Label>
            <Input id="unitCount" name="unitCount" type="number" min={1} placeholder="e.g. 120" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="value">Estimated value</Label>
            <Input id="value" name="value" type="number" min={0} step="0.01" placeholder="e.g. 250000" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="currency">Currency</Label>
            <select id="currency" name="currency" defaultValue="GBP" className={SELECT_CLASS}>
              {["GBP", "EUR", "USD", "TRY"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="expectedStartDate">Expected site start</Label>
            <Input id="expectedStartDate" name="expectedStartDate" type="date" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="siteCity">Site city</Label>
            <Input id="siteCity" name="siteCity" placeholder="e.g. London" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="siteRegion">Site region / county</Label>
            <Input id="siteRegion" name="siteRegion" placeholder="e.g. Greater London" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sitePostcode">Site postcode</Label>
            <Input id="sitePostcode" name="sitePostcode" placeholder="e.g. SE1 9PG" />
          </div>

          {selectedCompany && (
            <div className="sm:col-span-2 grid gap-1.5">
              <Label htmlFor="firstCompanyRole">Role on this project</Label>
              <select id="firstCompanyRole" name="firstCompanyRole" defaultValue="CLIENT_EMPLOYER" className={SELECT_CLASS}>
                {COMPANY_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {COMPANY_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="sm:col-span-2 flex items-center gap-3 pt-1">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create Project
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
