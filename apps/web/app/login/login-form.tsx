"use client";

import { useState } from "react";

type LoginFormProps = {
  initialError: string | null;
};

type LoginResult = {
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
  };
  code?: string;
  message?: string;
};

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
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password }),
        credentials: "include"
      });

      const payload = (await response.json().catch(() => ({}))) as LoginResult;

      if (!response.ok || !payload.user) {
        setErrorMessage(mapErrorMessage(payload.code, payload.message));
        setIsSubmitting(false);
        return;
      }

      window.location.assign("/requests");
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
