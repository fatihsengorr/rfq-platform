"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

type LoginFormProps = {
  callbackUrl: string;
  initialError: string | null;
};

function mapErrorMessage(error: string | null) {
  if (!error) return null;
  if (error === "CredentialsSignin") return "Invalid email or password.";
  if (error === "AccessDenied") return "This account is inactive or access is denied.";
  return "Sign in failed. Please try again.";
}

export function LoginForm({ callbackUrl, initialError }: LoginFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setErrorMessage(null);

        const formData = new FormData(event.currentTarget);
        const email = String(formData.get("email") ?? "").trim();
        const password = String(formData.get("password") ?? "").trim();

        const result = await signIn("credentials", {
          email,
          password,
          callbackUrl,
          redirect: false
        });

        if (!result) {
          setErrorMessage("Sign in failed. Please try again.");
          setIsSubmitting(false);
          return;
        }

        if (result.error) {
          setErrorMessage(mapErrorMessage(result.error));
          setIsSubmitting(false);
          return;
        }

        window.location.assign(result.url ?? callbackUrl);
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          required
          disabled={isSubmitting}
        />
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm font-semibold text-danger">
          {errorMessage}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        <LogIn className="size-4" />
        {isSubmitting ? "Signing In..." : "Sign In"}
      </Button>
    </form>
  );
}
