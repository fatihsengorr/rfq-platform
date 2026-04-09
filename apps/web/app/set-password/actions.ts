"use server";

import { redirect } from "next/navigation";
import { isApiClientError, resetPasswordWithToken } from "../api";
import type { ActionResult } from "../../lib/action-result";

export async function setPasswordAction(
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
      message: "Passwords do not match.",
      fieldErrors: { confirmPassword: "Passwords do not match." },
    };
  }

  try {
    // Reuses the same reset-password API endpoint — token is token
    await resetPasswordWithToken({ token, newPassword });
    return {
      status: "success",
      message: "Password set successfully! Redirecting to login...",
      redirectTo: "/login?status=account_activated",
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
        return {
          status: "error",
          message: "This invitation link is invalid or has expired. Please ask your administrator to resend the invitation.",
        };
      }
      if (error.code === "NETWORK_ERROR") {
        return { status: "error", message: "Service is temporarily unavailable. Please try again." };
      }
    }
    return { status: "error", message: "Failed to set password. Please try again." };
  }
}
