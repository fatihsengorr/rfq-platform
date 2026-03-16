"use server";

import { redirect } from "next/navigation";
import { changeMyPassword, isApiClientError } from "../api";
import { getSession } from "../../lib/session";
import type { ActionResult } from "../../lib/action-result";

export async function changePasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  const currentPassword = String(formData.get("currentPassword") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "").trim();
  const confirmPassword = String(formData.get("confirmPassword") ?? "").trim();

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { status: "error", message: "All fields are required." };
  }

  if (newPassword !== confirmPassword) {
    return { status: "error", message: "New password and confirmation must match.", fieldErrors: { confirmPassword: "Passwords do not match." } };
  }

  try {
    await changeMyPassword({ currentPassword, newPassword });
    return { status: "success", message: "Password updated successfully." };
  } catch (error) {
    if (isApiClientError(error)) {
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "WEAK_PASSWORD") {
        return { status: "error", message: "Password policy: minimum 12 chars, uppercase, lowercase, number, special char." };
      }
      if (error.code === "PASSWORD_MISMATCH") {
        return { status: "error", message: "Current password is incorrect.", fieldErrors: { currentPassword: "Incorrect password." } };
      }
      if (error.code === "INVALID_REQUEST") {
        return { status: "error", message: "New password must be different from current password." };
      }
      if (error.code === "NETWORK_ERROR") {
        return { status: "error", message: "API is unreachable." };
      }
    }

    return { status: "error", message: "Password update failed." };
  }
}
