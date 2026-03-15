"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

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
      className="rfq-form clean-form"
      style={{ gridTemplateColumns: "1fr" }}
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
      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required disabled={isSubmitting} />
      </label>
      <label>
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required disabled={isSubmitting} />
      </label>

      {errorMessage && <p className="notice notice-error">{errorMessage}</p>}

      <button type="submit" className="primary-btn" disabled={isSubmitting}>
        {isSubmitting ? "Signing In..." : "Sign In"}
      </button>
    </form>
  );
}
