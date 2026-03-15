import Link from "next/link";
import { redirect } from "next/navigation";
import { isApiClientError, resetPasswordWithToken } from "../api";
import { getSession } from "../../lib/session";

type ResetSearchParams = Promise<{ status?: string; token?: string }>;

function resolveNotice(status?: string) {
  if (!status) return null;
  if (status === "confirm_mismatch") return { tone: "notice-error", text: "New password and confirmation must match." };
  if (status === "weak") {
    return {
      tone: "notice-error",
      text: "Password policy: minimum 12 chars, uppercase, lowercase, number, special char."
    };
  }
  if (status === "invalid_token") return { tone: "notice-error", text: "Reset token is invalid or expired." };
  if (status === "network") return { tone: "notice-error", text: "API is unreachable." };
  return { tone: "notice-error", text: "Password reset failed." };
}

async function resetPasswordAction(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "").trim();
  const confirmPassword = String(formData.get("confirmPassword") ?? "").trim();

  if (!token || !newPassword || !confirmPassword) {
    redirect("/reset-password?status=failed");
  }

  if (newPassword !== confirmPassword) {
    redirect(`/reset-password?status=confirm_mismatch&token=${encodeURIComponent(token)}`);
  }

  try {
    await resetPasswordWithToken({ token, newPassword });
    redirect("/login?status=reset_success");
  } catch (error) {
    if (isApiClientError(error)) {
      if (error.code === "WEAK_PASSWORD") redirect(`/reset-password?status=weak&token=${encodeURIComponent(token)}`);
      if (error.code === "INVALID_RESET_TOKEN") redirect("/reset-password?status=invalid_token");
      if (error.code === "NETWORK_ERROR") redirect(`/reset-password?status=network&token=${encodeURIComponent(token)}`);
    }

    redirect(`/reset-password?status=failed&token=${encodeURIComponent(token)}`);
  }
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: ResetSearchParams }) {
  const session = await getSession();

  if (session.accessToken) {
    redirect("/account");
  }

  const params = await searchParams;
  const notice = resolveNotice(params.status);

  return (
    <main className="shell">
      <section className="panel" style={{ maxWidth: 620, margin: "3rem auto" }}>
        <h1>Reset Password</h1>
        <p>Use the reset token and set a new password.</p>

        {notice && <p className={`notice ${notice.tone}`}>{notice.text}</p>}

        <form action={resetPasswordAction} className="rfq-form clean-form" style={{ marginTop: "0.8rem" }}>
          <label className="full">
            <span>Reset Token</span>
            <input name="token" defaultValue={params.token ?? ""} required />
          </label>
          <label>
            <span>New Password</span>
            <input name="newPassword" type="password" minLength={12} required />
          </label>
          <label>
            <span>Confirm New Password</span>
            <input name="confirmPassword" type="password" minLength={12} required />
          </label>
          <button type="submit" className="primary-btn">
            Reset Password
          </button>
        </form>

        <p style={{ marginTop: "1rem" }}>
          <Link href="/forgot-password" className="ghost-link">
            I need a reset token
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
