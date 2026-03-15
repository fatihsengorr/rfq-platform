import { redirect } from "next/navigation";
import { changeMyPassword, isApiClientError } from "../api";
import { getSession } from "../../lib/session";

type AccountSearchParams = Promise<{ status?: string }>;

function resolveNotice(status?: string) {
  if (!status) return null;
  if (status === "updated") return { tone: "notice-success", text: "Password updated successfully." };
  if (status === "confirm_mismatch") return { tone: "notice-error", text: "New password and confirmation must match." };
  if (status === "weak") {
    return {
      tone: "notice-error",
      text: "Password policy: minimum 12 chars, uppercase, lowercase, number, special char."
    };
  }
  if (status === "current_invalid") return { tone: "notice-error", text: "Current password is incorrect." };
  if (status === "same_password") return { tone: "notice-error", text: "New password must be different from current password." };
  if (status === "network") return { tone: "notice-error", text: "API is unreachable." };
  return { tone: "notice-error", text: "Password update failed." };
}

async function changePasswordAction(formData: FormData) {
  "use server";

  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  const currentPassword = String(formData.get("currentPassword") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "").trim();
  const confirmPassword = String(formData.get("confirmPassword") ?? "").trim();

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect("/account?status=failed");
  }

  if (newPassword !== confirmPassword) {
    redirect("/account?status=confirm_mismatch");
  }

  try {
    await changeMyPassword({ currentPassword, newPassword });
    redirect("/account?status=updated");
  } catch (error) {
    if (isApiClientError(error)) {
      if (error.code === "WEAK_PASSWORD") redirect("/account?status=weak");
      if (error.code === "PASSWORD_MISMATCH") redirect("/account?status=current_invalid");
      if (error.code === "INVALID_REQUEST") redirect("/account?status=same_password");
      if (error.code === "UNAUTHORIZED") redirect("/logout?next=/login");
      if (error.code === "NETWORK_ERROR") redirect("/account?status=network");
    }

    redirect("/account?status=failed");
  }
}

export default async function AccountPage({ searchParams }: { searchParams: AccountSearchParams }) {
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  const notice = resolveNotice((await searchParams).status);

  return (
    <main className="shell">
      <section className="page-header">
        <h1>Account Security</h1>
        <p>Update your own password here. This does not affect other users.</p>
      </section>

      <section className="panel" style={{ maxWidth: 720 }}>
        <h2>Change My Password</h2>
        {notice && <p className={`notice ${notice.tone}`}>{notice.text}</p>}

        <form action={changePasswordAction} className="rfq-form clean-form" style={{ marginTop: "0.8rem" }}>
          <label>
            <span>Current Password</span>
            <input name="currentPassword" type="password" minLength={1} required />
          </label>
          <label>
            <span>New Password</span>
            <input name="newPassword" type="password" minLength={12} required />
          </label>
          <label className="full">
            <span>Confirm New Password</span>
            <input name="confirmPassword" type="password" minLength={12} required />
          </label>
          <button type="submit" className="primary-btn">
            Update Password
          </button>
        </form>
      </section>
    </main>
  );
}
