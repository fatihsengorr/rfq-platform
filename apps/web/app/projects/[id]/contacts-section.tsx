"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProjectContactLink } from "@crm/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { addContactAction, removeContactAction } from "../actions";
import { User, Mail, Phone, Trash2, Plus, Loader2 } from "lucide-react";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export type PickableContact = {
  id: string;
  fullName: string;
  title: string | null;
  companyName: string;
};

export function ContactsSection({
  projectId,
  links,
  pickable,
}: {
  projectId: string;
  links: ProjectContactLink[];
  pickable: PickableContact[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [contactId, setContactId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Only contacts not already linked are offered.
  const linkedIds = useMemo(() => new Set(links.map((l) => l.contactId)), [links]);
  const available = useMemo(() => pickable.filter((c) => !linkedIds.has(c.id)), [pickable, linkedIds]);

  function add() {
    if (!contactId) {
      setError("Select a contact first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addContactAction({ projectId, contactId, note: note.trim() || undefined });
      if (result.status === "error") {
        setError(result.message ?? "Could not link contact.");
        return;
      }
      setContactId("");
      setNote("");
      setAdding(false);
      router.refresh();
    });
  }

  function remove(linkId: string) {
    startTransition(async () => {
      const result = await removeContactAction(projectId, linkId);
      if (result.status === "error") setError(result.message ?? "Could not remove contact.");
      else router.refresh();
    });
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">Contacts ({links.length})</h3>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add
          </Button>
        )}
      </div>

      {error && <p className="text-xs font-semibold text-rose-600 mb-2">{error}</p>}

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts linked yet.</p>
      ) : (
        <ul className="space-y-3 mb-3">
          {links.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-2 border-l-2 border-primary/30 pl-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm inline-flex items-center gap-1">
                  <User className="size-3 shrink-0" /> {l.fullName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[l.title, l.companyName].filter(Boolean).join(" · ")}
                </p>
                {l.email && (
                  <a href={`mailto:${l.email}`} className="text-xs inline-flex items-center gap-1 mt-0.5 hover:text-primary">
                    <Mail className="size-3" /> {l.email}
                  </a>
                )}
                {l.phone && (
                  <p className="text-xs inline-flex items-center gap-1 mt-0.5">
                    <Phone className="size-3" /> {l.phone}
                  </p>
                )}
                {l.note && <p className="text-xs text-muted-foreground mt-0.5 italic">{l.note}</p>}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(l.id)}
                className="text-muted-foreground hover:text-rose-600 transition-colors shrink-0"
                aria-label="Remove contact"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="space-y-3 border-t border-border pt-3">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No more contacts to add. Link a company first, then add its contacts from the company page.
            </p>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="add-contact-id">Contact</Label>
                <select id="add-contact-id" value={contactId} onChange={(e) => setContactId(e.target.value)} className={SELECT_CLASS}>
                  <option value="">Select a contact…</option>
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} — {c.companyName}
                      {c.title ? ` (${c.title})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="add-contact-note">Note (optional)</Label>
                <Input id="add-contact-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Decision maker on FF&E" />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={pending} onClick={add}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Link contact
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => { setAdding(false); setError(null); }}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
