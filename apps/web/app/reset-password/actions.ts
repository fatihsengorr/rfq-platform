"use server";

import { redirect } from "next/navigation";
import { isApiClientError, resetPasswordWithToken } from "../api";
import type { ActionResult } from "../../lib/action-result";

export async function resetPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "").trim();
  const confirmPassword = String(formData.get("confirmPassword") ?? "").trim();

  if (!token || !newPassword || !confirmPassword) {
    return { status: "error", message: "All fields are required." };
  }

  if (newPassword !== confirmPassword) {
    return {
      status: "error",
      message: "New password and confirmation must match.",
      fieldErrors: { confirmPassword: "Passwords do not match." },
    };
  }

  try {
    await resetPasswordWithToken({ token, newPassword });
    return {
      status: "success",
      message: "Password reset successfully. Redirecting to login...",
      redirectTo: "/login?status=reset_success",
    };
  } catch (error) {
    if (isApiClientError(error)) {
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "WEAK_PASSWORD") {
        return {
          status: "error",
          message: "Password policy: minimum 12 chars, uppercase, lowercase, number, special char.",
        };
      }
      if (error.code === "INVALID_RESET_TOKEN") {
        return { status: "error", message: "Reset token is invalid or expired." };
      }
      if (error.code === "NETWORK_ERROR") {
        return { status: "error", message: "API is unreachable." };
      }
    }
    return { status: "error", message: "Password reset failed." };
  }
}
