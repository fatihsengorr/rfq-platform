"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IDLE_RESULT } from "../../../lib/action-result";
import { updateCompanyAction } from "./actions";
import { COMPANY_ROLES, COMPANY_ROLE_LABELS, type CompanyRole } from "@crm/shared";
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
import { Pencil, Loader2 } from "lucide-react";

const SELECT_CLASS = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

type Company = {
  id: string;
  name: string;
  sector: string | null;
  country: string | null;
  city: string | null;
  website: string | null;
  notes: string | null;
  category: CompanyRole | null;
  addressLine: string | null;
  postcode: string | null;
  phone: string | null;
};

export function CompanyEditDialog({ company }: { company: Company }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateCompanyAction, IDLE_RESULT);

  useEffect(() => {
    if (state.status === "success") {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit company</DialogTitle>
        </DialogHeader>

        <FormMessage state={state} />

        <form action={formAction} className="grid sm:grid-cols-2 gap-4">
          <input type="hidden" name="companyId" value={company.id} />

          <div className="sm:col-span-2 grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required minLength={2} defaultValue={company.name} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="category">Category</Label>
            <select id="category" name="category" defaultValue={company.category ?? ""} className={SELECT_CLASS}>
              <option value="">—</option>
              {COMPANY_ROLES.map((r) => (
                <option key={r} value={r}>
                  {COMPANY_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sector">Sector</Label>
            <Input id="sector" name="sector" defaultValue={company.sector ?? ""} />
          </div>

          <div className="sm:col-span-2 grid gap-1.5">
            <Label htmlFor="addressLine">Address</Label>
            <Input id="addressLine" name="addressLine" defaultValue={company.addressLine ?? ""} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={company.city ?? ""} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="postcode">Postcode</Label>
            <Input id="postcode" name="postcode" defaultValue={company.postcode ?? ""} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="country">Country</Label>
            <Input id="country" name="country" defaultValue={company.country ?? ""} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={company.phone ?? ""} />
          </div>

          <div className="sm:col-span-2 grid gap-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" name="website" defaultValue={company.website ?? ""} />
          </div>

          <div className="sm:col-span-2 grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={company.notes ?? ""} />
          </div>

          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save changes
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
