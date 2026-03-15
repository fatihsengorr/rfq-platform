import Link from "next/link";
import { redirect } from "next/navigation";
import { isApiClientError, requestPasswordReset } from "../api";
import { getSession } from "../../lib/session";

type ForgotSearchParams = Promise<{ status?: string; token?: string }>;

function resolveNotice(status?: string) {
  if (!status) return null;
  if (status === "sent") {
    return {
      tone: "notice-success",
      text: "If the account exists and is active, reset instructions have been issued."
    };
  }

  if (status === "network") return { tone: "notice-error", text: "API is unreachable." };
  return { tone: "notice-error", text: "Password reset request failed." };
}

async function forgotPasswordAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/forgot-password?status=failed");
  }

  try {
    const result = await requestPasswordReset(email);

    if (result.debugResetToken) {
      redirect(`/forgot-password?status=sent&token=${encodeURIComponent(result.debugResetToken)}`);
    }

    redirect("/forgot-password?status=sent");
  } catch (error) {
    if (isApiClientError(error) && error.code === "NETWORK_ERROR") {
      redirect("/forgot-password?status=network");
    }

    redirect("/forgot-password?status=failed");
  }
}

export default async function ForgotPasswordPage({ searchParams }: { searchParams: ForgotSearchParams }) {
  const session = await getSession();

  if (session.accessToken) {
    redirect("/account");
  }

  const params = await searchParams;
  const notice = resolveNotice(params.status);

  return (
    <main className="shell">
      <section className="panel" style={{ maxWidth: 620, margin: "3rem auto" }}>
        <h1>Forgot Password</h1>
        <p>Enter your account email. If valid, a reset token will be generated.</p>

        {notice && <p className={`notice ${notice.tone}`}>{notice.text}</p>}

        <form action={forgotPasswordAction} className="rfq-form clean-form" style={{ gridTemplateColumns: "1fr", marginTop: "0.8rem" }}>
          <label>
            <span>Email</span>
            <input name="email" type="email" required />
          </label>
          <button type="submit" className="primary-btn">
            Request Reset
          </button>
        </form>

        {params.token && (
          <div className="panel" style={{ marginTop: "1rem" }}>
            <strong>Development Token</strong>
            <p>Use this token in the reset form below.</p>
            <code>{params.token}</code>
          </div>
        )}

        <p style={{ marginTop: "1rem" }}>
          <Link href="/reset-password" className="ghost-link">
            I already have a reset token
          </Link>
        </p>
        <p>
          <Link href="/login" className="ghost-link">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
