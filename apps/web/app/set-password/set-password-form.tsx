"use client";

import { useActionState, useEffect } from "react";
import { IDLE_RESULT } from "../../lib/action-result";
import { setPasswordAction } from "./actions";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2 } from "lucide-react";

type SetPasswordFormProps = {
  token: string;
};

export function SetPasswordForm({ token }: SetPasswordFormProps) {
  const [state, formAction, pending] = useActionState(setPasswordAction, IDLE_RESULT);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state]);

  return (
    <>
      <FormMessage state={state} />

      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="token" value={token} />

        <div className="grid gap-2">
          <Label htmlFor="newPassword">Password</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            placeholder="Min 12 characters, mixed case, number, special char"
            minLength={12}
            required
            autoFocus
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Repeat your password"
            minLength={12}
            required
          />
          <FormMessage state={state} fieldName="confirmPassword" />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Set Password & Activate Account
        </Button>
      </form>
    </>
  );
}
