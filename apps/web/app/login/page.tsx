import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { LoginForm } from "./login-form";

type LoginSearchParams = Promise<{ callbackUrl?: string; error?: string }>;

function resolveLoginError(error?: string) {
  if (!error) return null;
  if (error === "CredentialsSignin") return "Invalid email or password.";
  if (error === "AccessDenied") return "This account is inactive or access is denied.";
  return "Sign in failed. Please try again.";
}

export default async function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  const session = await getSession();

  if (session.accessToken) {
    redirect("/requests");
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl && params.callbackUrl.startsWith("/") ? params.callbackUrl : "/requests";
  const errorMessage = resolveLoginError(params.error);

  return (
    <main className="shell auth-page">
      <section className="auth-card-grid">
        <div className="hero auth-showcase">
          <p className="tag">RFQ Platform</p>
          <h1>Quote workflow for London and Istanbul</h1>
          <p className="sub">
            Track requests, pricing assignments, approvals, and final quotes in one clear internal workspace.
          </p>

          <div className="auth-bullets">
            <div>
              <strong>London Team</strong>
              <p>Create RFQs, upload request files, and monitor approved offers.</p>
            </div>
            <div>
              <strong>Istanbul Pricing</strong>
              <p>Work assigned requests, upload quote files, and submit revisions for approval.</p>
            </div>
            <div>
              <strong>Managers & Admin</strong>
              <p>Assign workload, approve submissions, and manage users and permissions.</p>
            </div>
          </div>
        </div>

        <section className="panel auth-form-panel">
          <div className="page-header" style={{ marginBottom: "0.9rem" }}>
            <h1>Sign In</h1>
            <p>Use your assigned company account to access the platform.</p>
          </div>

          <LoginForm callbackUrl={callbackUrl} initialError={errorMessage} />

          <p style={{ marginTop: "0.9rem" }}>
            <a href="/forgot-password" className="ghost-link">
              Forgot password?
            </a>
          </p>
        </section>
      </section>
    </main>
  );
}
