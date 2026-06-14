"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateCompany, isApiClientError } from "../../api";
import { getSession } from "../../../lib/session";
import type { ActionResult } from "../../../lib/action-result";
import type { CompanyRole } from "@crm/shared";

export async function updateCompanyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session.accessToken || !session.user) redirect("/login");
  if (session.user.role !== "LONDON_SALES" && session.user.role !== "ADMIN") {
    return { status: "error", message: "You do not have permission to edit companies." };
  }

  const id = String(formData.get("companyId") ?? "");
  if (!id) return { status: "error", message: "Missing company ID." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { status: "error", message: "Name must be at least 2 characters." };

  const str = (key: string): string | null => {
    const raw = String(formData.get(key) ?? "").trim();
    return raw.length > 0 ? raw : null;
  };
  const categoryRaw = str("category");

  try {
    await updateCompany(id, {
      name,
      sector: str("sector"),
      country: str("country"),
      city: str("city"),
      website: str("website"),
      addressLine: str("addressLine"),
      postcode: str("postcode"),
      phone: str("phone"),
      category: (categoryRaw as CompanyRole | null) ?? null,
      notes: str("notes"),
    });
    revalidatePath(`/companies/${id}`);
    return { status: "success", message: "Company updated." };
  } catch (error) {
    if (isApiClientError(error)) {
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "FORBIDDEN") return { status: "error", message: "You do not have permission to edit companies." };
    }
    return { status: "error", message: "Company could not be updated." };
  }
}
