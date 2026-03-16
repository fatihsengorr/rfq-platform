"use client";

import { useActionState, useEffect } from "react";
import { IDLE_RESULT } from "../../lib/action-result";
import { resetPasswordAction } from "./actions";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2 } from "lucide-react";

type ResetPasswordFormProps = {
  defaultToken?: string;
};

export function ResetPasswordForm({ defaultToken }: ResetPasswordFormProps) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, IDLE_RESULT);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state]);

  return (
    <>
      <FormMessage state={state} />

      <form action={formAction} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="token">Reset Token</Label>
          <Input
            id="token"
            name="token"
            defaultValue={defaultToken ?? ""}
            placeholder="Paste your reset token"
            required
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="Min 12 characters"
              minLength={12}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Repeat password"
              minLength={12}
              required
            />
            <FormMessage state={state} fieldName="confirmPassword" />
          </div>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Reset Password
        </Button>
      </form>
    </>
  );
}
