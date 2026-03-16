"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createUser, isApiClientError, updateUserActive, updateUserPassword, updateUserRole } from "../../api";
import type { ActionResult } from "../../../lib/action-result";

export async function createUserAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
  const password = String(formData.get("password") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!email || !fullName || !role || !password) {
    return { status: "error", message: "All fields are required." };
  }

  try {
    await createUser({ email, fullName, role, password, isActive });
    revalidatePath("/admin/users");
    return { status: "success", message: "User created successfully." };
  } catch (error) {
    if (isApiClientError(error)) {
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "USER_EMAIL_EXISTS") return { status: "error", message: "Email is already in use." };
      if (error.code === "WEAK_PASSWORD") return { status: "error", message: "Password policy: minimum 12 chars, uppercase, lowercase, number, special char." };
      if (error.code === "FORBIDDEN") return { status: "error", message: "Only admin can manage users." };
      if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable." };
    }

    return { status: "error", message: "User creation failed." };
  }
}

export async function resetPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!userId || !password) {
    return { status: "error", message: "Password is required." };
  }

  try {
    await updateUserPassword(userId, password);
    return { status: "success", message: "Password updated successfully." };
  } catch (error) {
    if (isApiClientError(error)) {
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "WEAK_PASSWORD") return { status: "error", message: "Password policy: minimum 12 chars, uppercase, lowercase, number, special char." };
      if (error.code === "FORBIDDEN") return { status: "error", message: "Only admin can manage users." };
      if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable." };
    }

    return { status: "error", message: "Password update failed." };
  }
}

export async function updateRoleAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";

  if (!userId || !role) {
    return { status: "error", message: "Role selection is required." };
  }

  try {
    await updateUserRole(userId, role);
    revalidatePath("/admin/users");
    revalidatePath("/requests");
    return { status: "success", message: "User role updated." };
  } catch (error) {
    if (isApiClientError(error)) {
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "FORBIDDEN") return { status: "error", message: "Only admin can manage users." };
      if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable." };
    }

    return { status: "error", message: "User update failed." };
  }
}

export async function updateActiveAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!userId) {
    return { status: "error", message: "User selection is required." };
  }

  try {
    await updateUserActive(userId, isActive);
    revalidatePath("/admin/users");
    revalidatePath("/requests");
    return { status: "success", message: "User active status updated." };
  } catch (error) {
    if (isApiClientError(error)) {
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "FORBIDDEN") return { status: "error", message: "Only admin can manage users." };
      if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable." };
    }

    return { status: "error", message: "User update failed." };
  }
}
