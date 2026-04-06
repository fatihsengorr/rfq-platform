"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Building2, Plus, ChevronDown, X, User } from "lucide-react";
import { Input } from "./input";
import { Label } from "./label";
import { Button } from "./button";

export type CompanyOption = {
  id: string;
  name: string;
  sector: string | null;
  country: string | null;
  city: string | null;
  contacts: ContactOption[];
};

export type ContactOption = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
};

type Props = {
  onCompanySelect: (company: CompanyOption | null) => void;
  onContactSelect: (contact: ContactOption | null) => void;
  onNewCompany: (data: NewCompanyData) => Promise<CompanyOption>;
  selectedCompany: CompanyOption | null;
  selectedContact: ContactOption | null;
};

export type NewCompanyData = {
  name: string;
  sector?: string;
  country?: string;
  city?: string;
  website?: string;
  contact?: {
    fullName: string;
    email?: string;
    phone?: string;
    title?: string;
  };
};

export function CompanyCombobox({
  onCompanySelect,
  onContactSelect,
  onNewCompany,
  selectedCompany,
  selectedContact,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Search companies
  const searchCompanies = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies-search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCompanies(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, searchCompanies]);

  // Click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(company: CompanyOption) {
    onCompanySelect(company);
    onContactSelect(null);
    setQuery("");
    setOpen(false);
    setShowNewForm(false);
  }

  function handleClear() {
    onCompanySelect(null);
    onContactSelect(null);
    setQuery("");
  }

  async function handleCreateCompany(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData(e.currentTarget);

    const data: NewCompanyData = {
      name: fd.get("companyName") as string,
      sector: (fd.get("sector") as string) || undefined,
      country: (fd.get("country") as string) || undefined,
      city: (fd.get("city") as string) || undefined,
      website: (fd.get("website") as string) || undefined,
    };

    const contactName = fd.get("contactFullName") as string;
    if (contactName) {
      data.contact = {
        fullName: contactName,
        email: (fd.get("contactEmail") as string) || undefined,
        phone: (fd.get("contactPhone") as string) || undefined,
        title: (fd.get("contactTitle") as string) || undefined,
      };
    }

    try {
      const created = await onNewCompany(data);
      handleSelect(created);
      // Auto-select the first contact if one was created
      if (created.contacts.length > 0) {
        onContactSelect(created.contacts[0]);
      }
    } catch {
      // error handled by parent
    } finally {
      setCreating(false);
    }
  }

  // Selected state
  if (selectedCompany) {
    return (
      <div className="space-y-3">
        {/* Selected company chip */}
        <div>
          <Label>Company</Label>
          <div className="mt-1 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
            <Building2 className="size-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedCompany.name}</p>
              {(selectedCompany.sector || selectedCompany.city) && (
                <p className="text-xs text-muted-foreground truncate">
                  {[selectedCompany.sector, selectedCompany.city, selectedCompany.country]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Contact selector */}
        {selectedCompany.contacts.length > 0 && (
          <div>
            <Label>Contact Person (Optional)</Label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedContact?.id ?? ""}
              onChange={(e) => {
                const ct = selectedCompany.contacts.find((c) => c.id === e.target.value);
                onContactSelect(ct ?? null);
              }}
            >
              <option value="">-- Select contact --</option>
              {selectedCompany.contacts.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.fullName}
                  {ct.title ? ` (${ct.title})` : ""}
                  {ct.email ? ` — ${ct.email}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Hidden inputs for form submission */}
        <input type="hidden" name="companyId" value={selectedCompany.id} />
        {selectedContact && <input type="hidden" name="contactId" value={selectedContact.id} />}
        <input type="hidden" name="requestedBy" value={selectedCompany.name} />
      </div>
    );
  }

  // Search state
  return (
    <div ref={wrapperRef} className="space-y-3">
      <div>
        <Label>Company</Label>
        <div className="relative mt-1">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search or add new company..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setShowNewForm(false);
            }}
            onFocus={() => query.length > 0 && setOpen(true)}
            className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>

        {/* Dropdown */}
        {open && query.length > 0 && (
          <div className="relative z-50">
            <div className="absolute top-1 left-0 right-0 rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
              {loading && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
              )}

              {!loading && results.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No companies found</div>
              )}

              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2"
                >
                  <Building2 className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.sector, c.city, c.country].filter(Boolean).join(" · ")}
                      {c.contacts.length > 0 && ` · ${c.contacts.length} contact(s)`}
                    </p>
                  </div>
                </button>
              ))}

              {/* Add new option */}
              <button
                type="button"
                onClick={() => {
                  setShowNewForm(true);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2 border-t text-primary font-medium"
              >
                <Plus className="size-4" />
                Add &quot;{query}&quot; as new company
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New company form */}
      {showNewForm && (
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Building2 className="size-4" />
            New Company Details
          </h4>
          <form onSubmit={handleCreateCompany} className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="companyName" className="text-xs">Company Name *</Label>
              <Input id="companyName" name="companyName" defaultValue={query} required minLength={2} className="h-9" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="sector" className="text-xs">Sector</Label>
              <Input id="sector" name="sector" placeholder="e.g. Aerospace" className="h-9" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="country" className="text-xs">Country</Label>
              <Input id="country" name="country" placeholder="e.g. United Kingdom" className="h-9" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="city" className="text-xs">City</Label>
              <Input id="city" name="city" placeholder="e.g. London" className="h-9" />
            </div>
            <div className="sm:col-span-2 grid gap-1">
              <Label htmlFor="website" className="text-xs">Website</Label>
              <Input id="website" name="website" placeholder="https://..." className="h-9" />
            </div>

            {/* First contact */}
            <div className="sm:col-span-2 mt-2">
              <h5 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <User className="size-3" />
                First Contact (Optional)
              </h5>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label htmlFor="contactFullName" className="text-xs">Full Name</Label>
                  <Input id="contactFullName" name="contactFullName" className="h-9" />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="contactEmail" className="text-xs">Email</Label>
                  <Input id="contactEmail" name="contactEmail" type="email" className="h-9" />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="contactPhone" className="text-xs">Phone</Label>
                  <Input id="contactPhone" name="contactPhone" className="h-9" />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="contactTitle" className="text-xs">Position</Label>
                  <Input id="contactTitle" name="contactTitle" placeholder="e.g. Procurement Manager" className="h-9" />
                </div>
              </div>
            </div>

            <div className="sm:col-span-2 flex gap-2 mt-1">
              <Button type="submit" size="sm" disabled={creating}>
                {creating ? "Creating..." : "Create Company"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewForm(false);
                  setQuery("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
