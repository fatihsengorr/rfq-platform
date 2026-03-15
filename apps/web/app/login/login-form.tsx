"use client";

import { useState } from "react";

type LoginFormProps = {
  initialError: string | null;
};

type LoginResult = {
  ok?: boolean;
  sessionValue?: string;
  redirectTo?: string;
  code?: string;
  message?: string;
};

const SESSION_COOKIE = "rfq_session";
const SESSION_MAX_AGE = 60 * 60 * 12;

function mapErrorMessage(code?: string, fallback?: string) {
  if (code === "UNAUTHORIZED") return "Invalid credentials.";
  if (code === "FORBIDDEN") return "This account is inactive. Please contact admin.";
  if (code === "NETWORK_ERROR") return "API is unreachable.";
  if (code === "INVALID_REQUEST") return "Email and password are required.";
  return fallback ?? "Login failed.";
}

export function LoginForm({ initialError }: LoginFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    try {
      const response = await fetch("/auth/login-json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin"
      });

      const payload = (await response.json()) as LoginResult;

      if (!response.ok || !payload.ok || !payload.sessionValue) {
        setErrorMessage(mapErrorMessage(payload.code, payload.message));
        setIsSubmitting(false);
        return;
      }

      document.cookie = `${SESSION_COOKIE}=${payload.sessionValue}; Max-Age=${SESSION_MAX_AGE}; Path=/; SameSite=Lax; Secure`;
      window.location.assign(payload.redirectTo ?? "/requests");
    } catch {
      setErrorMessage("API is unreachable.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rfq-form" style={{ gridTemplateColumns: "1fr" }}>
      <label>
        <span>Email</span>
        <input name="email" type="email" required disabled={isSubmitting} />
      </label>
      <label>
        <span>Password</span>
        <input name="password" type="password" required disabled={isSubmitting} />
      </label>
      {errorMessage && <p className="notice notice-error">{errorMessage}</p>}
      <button type="submit" className="primary-btn" disabled={isSubmitting}>
        {isSubmitting ? "Signing In..." : "Sign In"}
      </button>
    </form>
  );
}
