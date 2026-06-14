"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProject,
  updateProject,
  moveProjectStage,
  addProjectCompany,
  removeProjectCompany,
  addProjectContact,
  removeProjectContact,
  removeCrmAttachment,
  isApiClientError,
} from "../api";
import { getSession } from "../../lib/session";
import type { ActionResult } from "../../lib/action-result";
import type {
  ProjectStage,
  ProjectCategory,
  CompanyRole,
  LossReason,
} from "@crm/shared";

async function requireSalesSession() {
  const session = await getSession();
  if (!session.accessToken || !session.user) redirect("/login");
  const role = session.user.role;
  if (role !== "LONDON_SALES" && role !== "ADMIN") {
    return null;
  }
  return session;
}

function mapError(error: unknown, fallback: string): ActionResult {
  if (isApiClientError(error)) {
    if (error.code === "UNAUTHORIZED") redirect("/login");
    if (error.code === "FORBIDDEN") return { status: "error", message: "You do not have permission for this action." };
    if (error.code === "INVALID_REQUEST") return { status: "error", message: error.message || "Validation failed." };
    if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable. Please try again." };
  }
  return { status: "error", message: fallback };
}

// ── Create ──────────────────────────────────────────────────────────
export async function createProjectAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSalesSession();
  if (!session) return { status: "error", message: "You do not have permission to create a project." };

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3) return { status: "error", message: "Title must be at least 3 characters." };

  const num = (key: string): number | undefined => {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (key: string): string | undefined => {
    const raw = String(formData.get(key) ?? "").trim();
    return raw.length > 0 ? raw : undefined;
  };

  const expectedStartDateRaw = str("expectedStartDate");
  // CompanyCombobox emits `companyId`; pair it with the chosen role.
  const firstCompanyId = str("companyId");
  const firstCompanyRole = str("firstCompanyRole") as CompanyRole | undefined;

  try {
    const project = await createProject({
      title,
      description: str("description"),
      projectCategory: str("projectCategory") as ProjectCategory | undefined,
      unitCount: num("unitCount"),
      value: num("value"),
      currency: (str("currency") as "GBP" | "EUR" | "USD" | "TRY" | undefined) ?? "GBP",
      expectedStartDate: expectedStartDateRaw ? new Date(expectedStartDateRaw).toISOString() : undefined,
      siteCity: str("siteCity"),
      siteRegion: str("siteRegion"),
      sitePostcode: str("sitePostcode"),
      // Link the first company only when both id + role are provided.
      firstCompanyId: firstCompanyId && firstCompanyRole ? firstCompanyId : undefined,
      firstCompanyRole: firstCompanyId && firstCompanyRole ? firstCompanyRole : undefined,
    });
    revalidatePath("/projects");
    return { status: "success", message: "Project created.", redirectTo: `/projects/${project.id}` };
  } catch (error) {
    return mapError(error, "Project could not be created.");
  }
}

// ── Update fields ───────────────────────────────────────────────────
export async function updateProjectAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSalesSession();
  if (!session) return { status: "error", message: "You do not have permission." };

  const id = String(formData.get("projectId") ?? "");
  if (!id) return { status: "error", message: "Missing project ID." };

  const num = (key: string): number | null | undefined => {
    if (!formData.has(key)) return undefined;
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const str = (key: string): string | null | undefined => {
    if (!formData.has(key)) return undefined;
    const raw = String(formData.get(key) ?? "").trim();
    return raw.length > 0 ? raw : null;
  };

  const expectedStartDateRaw = str("expectedStartDate");

  try {
    await updateProject(id, {
      title: str("title") ?? undefined,
      description: str("description"),
      projectCategory: str("projectCategory") as ProjectCategory | null | undefined,
      unitCount: num("unitCount"),
      value: num("value"),
      currency: (str("currency") as "GBP" | "EUR" | "USD" | "TRY" | null | undefined) ?? undefined,
      expectedStartDate: expectedStartDateRaw ? new Date(expectedStartDateRaw).toISOString() : expectedStartDateRaw,
      siteCity: str("siteCity"),
      siteRegion: str("siteRegion"),
      sitePostcode: str("sitePostcode"),
      probability: num("probability"),
    });
    revalidatePath(`/projects/${id}`);
    revalidatePath("/projects");
    return { status: "success", message: "Project updated." };
  } catch (error) {
    return mapError(error, "Project could not be updated.");
  }
}

// ── Move stage ──────────────────────────────────────────────────────
export async function moveStageAction(input: {
  projectId: string;
  stage: ProjectStage;
  lostReasonCode?: LossReason;
  lostReason?: string;
  note?: string;
}): Promise<ActionResult> {
  const session = await requireSalesSession();
  if (!session) return { status: "error", message: "You do not have permission." };

  if (input.stage === "LOST" && !input.lostReasonCode) {
    return { status: "error", message: "A loss reason is required to mark a project as lost." };
  }

  try {
    await moveProjectStage(input.projectId, {
      stage: input.stage,
      lostReasonCode: input.lostReasonCode,
      lostReason: input.lostReason,
      note: input.note,
    });
    revalidatePath("/projects");
    revalidatePath(`/projects/${input.projectId}`);
    return { status: "success", message: "Stage updated." };
  } catch (error) {
    return mapError(error, "Stage could not be updated.");
  }
}

// ── Company links ───────────────────────────────────────────────────
export async function addCompanyAction(input: {
  projectId: string;
  companyId: string;
  role: CompanyRole;
  isPrimary: boolean;
}): Promise<ActionResult> {
  const session = await requireSalesSession();
  if (!session) return { status: "error", message: "You do not have permission." };
  try {
    await addProjectCompany(input.projectId, { companyId: input.companyId, role: input.role, isPrimary: input.isPrimary });
    revalidatePath(`/projects/${input.projectId}`);
    return { status: "success", message: "Company linked." };
  } catch (error) {
    return mapError(error, "Company could not be linked.");
  }
}

export async function removeCompanyAction(projectId: string, linkId: string): Promise<ActionResult> {
  const session = await requireSalesSession();
  if (!session) return { status: "error", message: "You do not have permission." };
  try {
    await removeProjectCompany(projectId, linkId);
    revalidatePath(`/projects/${projectId}`);
    return { status: "success", message: "Company removed." };
  } catch (error) {
    return mapError(error, "Company could not be removed.");
  }
}

// ── Contact links ───────────────────────────────────────────────────
export async function addContactAction(input: {
  projectId: string;
  contactId: string;
  note?: string;
}): Promise<ActionResult> {
  const session = await requireSalesSession();
  if (!session) return { status: "error", message: "You do not have permission." };
  try {
    await addProjectContact(input.projectId, { contactId: input.contactId, note: input.note });
    revalidatePath(`/projects/${input.projectId}`);
    return { status: "success", message: "Contact linked." };
  } catch (error) {
    return mapError(error, "Contact could not be linked.");
  }
}

export async function removeContactAction(projectId: string, linkId: string): Promise<ActionResult> {
  const session = await requireSalesSession();
  if (!session) return { status: "error", message: "You do not have permission." };
  try {
    await removeProjectContact(projectId, linkId);
    revalidatePath(`/projects/${projectId}`);
    return { status: "success", message: "Contact removed." };
  } catch (error) {
    return mapError(error, "Contact could not be removed.");
  }
}

// ── Files ───────────────────────────────────────────────────────────
export async function removeProjectFileAction(projectId: string, attachmentId: string): Promise<ActionResult> {
  const session = await requireSalesSession();
  if (!session) return { status: "error", message: "You do not have permission." };
  try {
    await removeCrmAttachment(attachmentId);
    revalidatePath(`/projects/${projectId}`);
    return { status: "success", message: "File removed." };
  } catch (error) {
    return mapError(error, "File could not be removed.");
  }
}
