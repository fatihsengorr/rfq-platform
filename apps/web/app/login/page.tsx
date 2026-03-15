import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { LoginForm } from "./login-form";

function resolveError(error?: string) {
  if (!error) return null;
  if (error === "missing") return "Email and password are required.";
  if (error === "invalid") return "Invalid credentials.";
  if (error === "inactive") return "This account is inactive. Please contact admin.";
  if (error === "network") return "API is unreachable.";
  return "Login failed.";
}

function resolveStatus(status?: string) {
  if (!status) return null;
  if (status === "reset_success") return "Password reset complete. You can sign in with your new password.";
  return null;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; status?: string }> }) {
  const session = await getSession();

  if (session.accessToken) {
    redirect("/requests");
  }

  const params = await searchParams;
  const errorMessage = resolveError(params.error);
  const statusMessage = resolveStatus(params.status);

  return (
    <main className="shell">
      <section className="panel" style={{ maxWidth: 520, margin: "3rem auto" }}>
        <h1>Sign In</h1>
        <p>Sign in with your assigned company account.</p>
        {statusMessage && <p className="notice notice-success">{statusMessage}</p>}
        <LoginForm initialError={errorMessage} />

        <p style={{ marginTop: "0.7rem" }}>
          <a href="/forgot-password" className="ghost-link">
            Forgot password?
          </a>
        </p>

        <div className="panel" style={{ marginTop: "1rem" }}>
          <strong>Access</strong>
          <p>Your account is managed by system admin.</p>
          <p>If you cannot sign in, contact your administrator.</p>
        </div>
      </section>
    </main>
  );
}
