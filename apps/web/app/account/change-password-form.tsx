"use client";

import { useActionState } from "react";
import { IDLE_RESULT } from "../../lib/action-result";
import { changePasswordAction } from "./actions";
import { FormMessage } from "@/components/ui/form-message";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2 } from "lucide-react";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, IDLE_RESULT);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Change My Password</CardTitle>
      </CardHeader>
      <CardContent>
        <FormMessage state={state} />

        <form action={formAction} className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" minLength={1} required />
            <FormMessage state={state} fieldName="currentPassword" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" name="newPassword" type="password" placeholder="Min 12 characters" minLength={12} required />
          </div>
          <div className="sm:col-span-2 grid gap-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" minLength={12} required />
            <FormMessage state={state} fieldName="confirmPassword" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              <KeyRound className="size-4" />
              Update Password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
