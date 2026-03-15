import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FlashNotice } from "../../components/flash-notice";
import { createUser, getUsers, isApiClientError, updateUserActive, updateUserPassword, updateUserRole } from "../../api";
import { setFlashNotice } from "../../../lib/flash";
import { getSession } from "../../../lib/session";

async function createUserAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
  const password = String(formData.get("password") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!email || !fullName || !role || !password) {
    await setFlashNotice("/admin/users", "user_create_failed");
    redirect("/admin/users");
  }

  try {
    await createUser({ email, fullName, role, password, isActive });
    revalidatePath("/admin/users");
    await setFlashNotice("/admin/users", "user_created");
  } catch (error) {
    let code = "user_create_failed";

    if (isApiClientError(error)) {
      if (error.code === "USER_EMAIL_EXISTS") code = "user_email_exists";
      if (error.code === "WEAK_PASSWORD") code = "weak_password";
      if (error.code === "FORBIDDEN") code = "admin_only";
      if (error.code === "NETWORK_ERROR") code = "api_unreachable";
      if (error.code === "UNAUTHORIZED") redirect("/logout?next=/login");
    }

    await setFlashNotice("/admin/users", code);
  }

  redirect("/admin/users");
}

async function resetPasswordAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!userId || !password) {
    await setFlashNotice("/admin/users", "password_update_failed");
    redirect("/admin/users");
  }

  try {
    await updateUserPassword(userId, password);
    await setFlashNotice("/admin/users", "password_updated");
  } catch (error) {
    let code = "password_update_failed";

    if (isApiClientError(error)) {
      if (error.code === "WEAK_PASSWORD") code = "weak_password";
      if (error.code === "FORBIDDEN") code = "admin_only";
      if (error.code === "NETWORK_ERROR") code = "api_unreachable";
      if (error.code === "UNAUTHORIZED") redirect("/logout?next=/login");
    }

    await setFlashNotice("/admin/users", code);
  }

  redirect("/admin/users");
}

async function updateRoleAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";

  if (!userId || !role) {
    await setFlashNotice("/admin/users", "user_update_failed");
    redirect("/admin/users");
  }

  try {
    await updateUserRole(userId, role);
    revalidatePath("/admin/users");
    revalidatePath("/requests");
    await setFlashNotice("/admin/users", "user_role_updated");
  } catch (error) {
    let code = "user_update_failed";

    if (isApiClientError(error)) {
      if (error.code === "FORBIDDEN") code = "admin_only";
      if (error.code === "NETWORK_ERROR") code = "api_unreachable";
      if (error.code === "UNAUTHORIZED") redirect("/logout?next=/login");
    }

    await setFlashNotice("/admin/users", code);
  }

  redirect("/admin/users");
}

async function updateActiveAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!userId) {
    await setFlashNotice("/admin/users", "user_update_failed");
    redirect("/admin/users");
  }

  try {
    await updateUserActive(userId, isActive);
    revalidatePath("/admin/users");
    revalidatePath("/requests");
    await setFlashNotice("/admin/users", "user_status_updated");
  } catch (error) {
    let code = "user_update_failed";

    if (isApiClientError(error)) {
      if (error.code === "FORBIDDEN") code = "admin_only";
      if (error.code === "NETWORK_ERROR") code = "api_unreachable";
      if (error.code === "UNAUTHORIZED") redirect("/logout?next=/login");
    }

    await setFlashNotice("/admin/users", code);
  }

  redirect("/admin/users");
}

const notices = {
  user_created: { tone: "success", text: "User created successfully." },
  user_create_failed: { tone: "error", text: "User creation failed." },
  user_email_exists: { tone: "error", text: "Email is already in use." },
  weak_password: {
    tone: "error",
    text: "Password policy: minimum 12 chars, uppercase, lowercase, number, special char."
  },
  password_updated: { tone: "success", text: "Password updated successfully." },
  password_update_failed: { tone: "error", text: "Password update failed." },
  user_role_updated: { tone: "success", text: "User role updated." },
  user_status_updated: { tone: "success", text: "User active status updated." },
  user_update_failed: { tone: "error", text: "User update failed." },
  admin_only: { tone: "error", text: "Only admin can manage users." },
  api_unreachable: { tone: "error", text: "API is unreachable." }
} as const;

export default async function AdminUsersPage() {
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/requests");
  }

  let users: Awaited<ReturnType<typeof getUsers>> = [];

  try {
    users = await getUsers();
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") {
      redirect("/logout?next=/login");
    }
  }

  return (
    <main className="shell">
      <header className="page-header">
        <h1>Admin Users</h1>
        <p>Create users, assign office roles, and control access visibility.</p>
      </header>

      <FlashNotice path="/admin/users" notices={notices} />

      <section className="panel">
        <div className="panel-title-row">
          <h2>Create User</h2>
          <span className="inline-hint">Only ADMIN can create accounts</span>
        </div>
        <form action={createUserAction} className="rfq-form clean-form">
          <label>
            <span>Full Name</span>
            <input name="fullName" type="text" minLength={2} required />
          </label>
          <label>
            <span>Email</span>
            <input name="email" type="email" required />
          </label>
          <label>
            <span>Role</span>
            <select name="role" defaultValue="LONDON_SALES" required>
              <option value="LONDON_SALES">LONDON_SALES</option>
              <option value="ISTANBUL_PRICING">ISTANBUL_PRICING</option>
              <option value="ISTANBUL_MANAGER">ISTANBUL_MANAGER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <label>
            <span>Initial Password</span>
            <input name="password" type="password" minLength={12} required />
          </label>
          <label>
            <span>Active</span>
            <select name="isActive" defaultValue="true">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <button type="submit" className="primary-btn">
            Create User
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>User Directory</h2>
          <span className="inline-hint">Role, access and password controls</span>
        </div>

        {users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <div className="data-table">
            <div className="data-head users-grid">
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {users.map((user) => (
              <div key={user.id} className="data-row users-grid">
                <span>{user.fullName}</span>
                <span>{user.email}</span>
                <span>
                  <span className="role-pill">{user.role}</span>
                </span>
                <span>
                  <span className={user.isActive ? "status-pill status-active" : "status-pill status-inactive"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </span>
                <span className="user-actions">
                  <form action={updateRoleAction} className="inline-form">
                    <input type="hidden" name="userId" value={user.id} />
                    <select name="role" defaultValue={user.role}>
                      <option value="LONDON_SALES">LONDON_SALES</option>
                      <option value="ISTANBUL_PRICING">ISTANBUL_PRICING</option>
                      <option value="ISTANBUL_MANAGER">ISTANBUL_MANAGER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button type="submit" className="secondary-btn compact-btn">
                      Save Role
                    </button>
                  </form>

                  <form action={updateActiveAction} className="inline-form">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="isActive" value={user.isActive ? "false" : "true"} />
                    <button type="submit" className="secondary-btn compact-btn">
                      {user.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </form>

                  <form action={resetPasswordAction} className="inline-form">
                    <input type="hidden" name="userId" value={user.id} />
                    <input name="password" type="password" minLength={12} placeholder="New password" required />
                    <button type="submit" className="secondary-btn compact-btn">
                      Set Password
                    </button>
                  </form>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
