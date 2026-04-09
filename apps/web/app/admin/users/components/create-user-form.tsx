"use client";

import { useState, useActionState } from "react";
import { IDLE_RESULT } from "../../../../lib/action-result";
import { createUserAction } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/form-message";
import { UserPlus, Loader2, ChevronDown, ChevronUp, Mail } from "lucide-react";

const selectClasses =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, IDLE_RESULT);
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mt-4">
      <CardHeader
        className="flex-row items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-5" />
          Create User
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Admin only</Badge>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          <FormMessage state={state} />

          {/* Info banner */}
          <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground flex items-start gap-2">
            <Mail className="size-4 mt-0.5 shrink-0 text-primary" />
            <span>
              New users will receive an <strong>invitation email</strong> with a link to set their own password. You don't need to create a password for them.
            </span>
          </div>

          <form action={formAction} className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" name="fullName" type="text" minLength={2} required placeholder="John Smith" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="john@company.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <select id="role" name="role" defaultValue="LONDON_SALES" required className={selectClasses}>
                <option value="LONDON_SALES">London Sales</option>
                <option value="ISTANBUL_PRICING">Istanbul Pricing</option>
                <option value="ISTANBUL_MANAGER">Istanbul Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                Create & Send Invite
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
