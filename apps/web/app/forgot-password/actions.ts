"use server";

import { redirect } from "next/navigation";
import { isApiClientError, requestPasswordReset } from "../api";
import type { ActionResult } from "../../lib/action-result";

export async function forgotPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { status: "error", message: "Email is required." };
  }

  try {
    const result = await requestPasswordReset(email);

    if (result.debugResetToken) {
      return {
        status: "success",
        message: "If the account exists and is active, reset instructions have been issued.",
        redirectTo: `/forgot-password?status=sent&token=${encodeURIComponent(result.debugResetToken)}`,
      };
    }

    return {
      status: "success",
      message: "If the account exists and is active, reset instructions have been issued.",
    };
  } catch (error) {
    if (isApiClientError(error)) {
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "NETWORK_ERROR") {
        return { status: "error", message: "API is unreachable." };
      }
    }
    return { status: "error", message: "Password reset request failed." };
  }
}
