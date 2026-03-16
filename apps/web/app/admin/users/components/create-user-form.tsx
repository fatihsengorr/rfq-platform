"use client";

import { useActionState } from "react";
import { IDLE_RESULT } from "../../../../lib/action-result";
import { createUserAction } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/form-message";
import { UserPlus, Loader2 } from "lucide-react";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, IDLE_RESULT);

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Create User</CardTitle>
        <Badge variant="outline">Only ADMIN can create accounts</Badge>
      </CardHeader>
      <CardContent>
        <FormMessage state={state} />

        <form action={formAction} className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" name="fullName" type="text" minLength={2} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              name="role"
              defaultValue="LONDON_SALES"
              required
              className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="LONDON_SALES">London Sales</option>
              <option value="ISTANBUL_PRICING">Istanbul Pricing</option>
              <option value="ISTANBUL_MANAGER">Istanbul Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Initial Password</Label>
            <Input id="password" name="password" type="password" minLength={12} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="isActive">Active</Label>
            <select
              id="isActive"
              name="isActive"
              defaultValue="true"
              className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Create User
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
