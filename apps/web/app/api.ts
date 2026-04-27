import type { Attachment, RfqRecord } from "./data";
import type { FollowUpActivityRecord, RevisionTimelineItem, RfqRevisionDiff } from "@crm/shared";
import { getSession, type SessionUser } from "../lib/session";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RFQ_NOT_FOUND"
  | "QUOTE_REVISION_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "USER_EMAIL_EXISTS"
  | "WEAK_PASSWORD"
  | "PASSWORD_MISMATCH"
  | "INVALID_RESET_TOKEN"
  | "ATTACHMENT_NOT_FOUND"
  | "ATTACHMENT_TOO_LARGE"
  | "ATTACHMENT_UNSUPPORTED"
  | "STORAGE_ERROR"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export type ManagedUser = {
  id: string;
  fullName: string;
  email: string;
  role: SessionUser["role"];
  isActive: boolean;
  hasPassword: boolean;
  inviteStatus: "none" | "pending" | "expired";
  createdAt: string;
  updatedAt: string;
};

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

async function parseApiError(response: Response): Promise<ApiClientError> {
  try {
    const payload = (await response.json()) as {
      code?: ApiErrorCode;
      message?: string;
      details?: unknown;
    };

    return new ApiClientError(
      payload.code ?? "UNKNOWN_ERROR",
      payload.message ?? `API request failed: ${response.status}`,
      response.status,
      payload.details
    );
  } catch {
    return new ApiClientError("UNKNOWN_ERROR", `API request failed: ${response.status}`, response.status);
  }
}

async function request<T>(path: string, options?: { allowNotFound?: boolean }): Promise<T | null> {
  let response: Response;
  const session = await getSession();

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: session.accessToken
        ? {
            Authorization: `Bearer ${session.accessToken}`
          }
        : undefined,
      cache: "no-store"
    });
  } catch {
    throw new ApiClientError("NETWORK_ERROR", "API is unreachable.", 0);
  }

  if (options?.allowNotFound && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as T;
}

async function postAuthenticated<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  const session = await getSession();

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session.accessToken
          ? {
              Authorization: `Bearer ${session.accessToken}`
            }
          : {})
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });
  } catch {
    throw new ApiClientError("NETWORK_ERROR", "API is unreachable.", 0);
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as T;
}

async function patchAuthenticated<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  const session = await getSession();

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(session.accessToken
          ? {
              Authorization: `Bearer ${session.accessToken}`
            }
          : {})
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });
  } catch {
    throw new ApiClientError("NETWORK_ERROR", "API is unreachable.", 0);
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as T;
}

async function postAnonymous<T>(path: string, body: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });
  } catch {
    throw new ApiClientError("NETWORK_ERROR", "API is unreachable.", 0);
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as T;
}

export async function getRfqs(): Promise<RfqRecord[]> {
  const result = await request<RfqRecord[]>("/api/rfqs");
  return result ?? [];
}

export async function getRfqById(id: string): Promise<RfqRecord | null> {
  return request<RfqRecord>(`/api/rfqs/${id}`, { allowNotFound: true });
}

// Faz 3 — Feature 2: revision timeline & diff
export async function getRfqRevisions(rfqId: string): Promise<RevisionTimelineItem[]> {
  const result = await request<RevisionTimelineItem[]>(`/api/rfqs/${rfqId}/revisions`);
  return result ?? [];
}

export async function compareRfqRevisions(
  rfqId: string,
  a: number,
  b: number
): Promise<RfqRevisionDiff | null> {
  return request<RfqRevisionDiff>(`/api/rfqs/${rfqId}/revisions/compare?a=${a}&b=${b}`);
}

// Faz 3 — Feature 3: follow-up activity
export async function getRfqFollowUps(rfqId: string): Promise<FollowUpActivityRecord[]> {
  const result = await request<FollowUpActivityRecord[]>(`/api/rfqs/${rfqId}/follow-ups`);
  return result ?? [];
}

export async function logRfqFollowUp(rfqId: string, note?: string): Promise<FollowUpActivityRecord> {
  return postAuthenticated<FollowUpActivityRecord>(`/api/rfqs/${rfqId}/follow-ups`, note ? { note } : {});
}

export async function createRfq(input: {
  projectName: string;
  deadline: string;
  projectDetails: string;
  requestedBy: string;
  companyId?: string;
  contactId?: string;
}): Promise<RfqRecord> {
  return postAuthenticated<RfqRecord>("/api/rfqs", input);
}

// ── Company / Contact ──

export type CompanyContact = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
};

export type CompanyItem = {
  id: string;
  name: string;
  sector: string | null;
  country: string | null;
  city: string | null;
  website: string | null;
  notes: string | null;
  rfqCount: number;
  contacts: CompanyContact[];
};

export async function searchCompanies(query?: string): Promise<CompanyItem[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";
  return (await request<CompanyItem[]>(`/api/companies${qs}`)) ?? [];
}

// Faz 3 — Feature 4: Company detail with KPI panel + filtered RFQ list.

export type CompanyKpi = {
  totalRfqs: number;
  activeRfqs: number;
  quotedRfqs: number;
  wonRfqs: number;
  lostRfqs: number;
  closedRfqs: number;
  winRate: number | null;
  lifetimeQuoteValue: Array<{ currency: string; total: number }>;
  avgResponseTimeDays: number | null;
};

export type CompanyDetail = {
  id: string;
  name: string;
  sector: string | null;
  country: string | null;
  city: string | null;
  website: string | null;
  notes: string | null;
  rfqCount: number;
  contacts: CompanyContact[];
  recentRfqs: Array<{
    id: string;
    projectName: string;
    status: string;
    createdAt: string;
    deadline: string;
  }>;
  kpi: CompanyKpi;
};

export async function getCompanyById(companyId: string): Promise<CompanyDetail | null> {
  return request<CompanyDetail>(`/api/companies/${companyId}`, { allowNotFound: true });
}

export type CompanyRfqListFilter = {
  status?: "open" | "won" | "lost" | "closed" | "all";
  from?: string; // ISO datetime
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  currency?: "GBP" | "EUR" | "USD" | "TRY";
  page?: number;
  limit?: number;
};

export type CompanyRfqRow = {
  id: string;
  projectName: string;
  status: string;
  createdAt: string;
  deadline: string;
  wonAt: string | null;
  lostAt: string | null;
  latestQuote: {
    currency: string;
    totalAmount: number;
    versionNumber: number;
    status: string;
  } | null;
};

export async function getCompanyRfqs(
  companyId: string,
  filter: CompanyRfqListFilter = {},
): Promise<{ data: CompanyRfqRow[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  if (filter.minAmount !== undefined) params.set("minAmount", String(filter.minAmount));
  if (filter.maxAmount !== undefined) params.set("maxAmount", String(filter.maxAmount));
  if (filter.currency) params.set("currency", filter.currency);
  if (filter.page) params.set("page", String(filter.page));
  if (filter.limit) params.set("limit", String(filter.limit));

  const qs = params.toString();
  const url = `/api/companies/${companyId}/rfqs${qs ? `?${qs}` : ""}`;
  return (
    (await request<{ data: CompanyRfqRow[]; total: number; page: number; limit: number }>(url)) ?? {
      data: [],
      total: 0,
      page: 1,
      limit: 25,
    }
  );
}

// ── Global search ───────────────────────────────────────────────────

export type GlobalSearchInput = {
  q?: string;
  fields?: Array<"customer" | "project" | "location" | "amount">;
  minAmount?: number;
  maxAmount?: number;
  currency?: "GBP" | "EUR" | "USD" | "TRY";
  limit?: number;
};

export type GlobalSearchResults = {
  companies: Array<{
    id: string;
    name: string;
    sector: string | null;
    country: string | null;
    city: string | null;
    rfqCount: number;
  }>;
  rfqs: Array<{
    id: string;
    projectName: string;
    status: string;
    createdAt: string;
    companyId: string | null;
    companyName: string | null;
    latestQuote: { currency: string; totalAmount: number } | null;
  }>;
  totals: { companies: number; rfqs: number };
};

export async function globalSearch(input: GlobalSearchInput): Promise<GlobalSearchResults> {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.fields && input.fields.length > 0) params.set("fields", input.fields.join(","));
  if (input.minAmount !== undefined) params.set("minAmount", String(input.minAmount));
  if (input.maxAmount !== undefined) params.set("maxAmount", String(input.maxAmount));
  if (input.currency) params.set("currency", input.currency);
  if (input.limit) params.set("limit", String(input.limit));

  return (
    (await request<GlobalSearchResults>(`/api/search?${params.toString()}`)) ?? {
      companies: [],
      rfqs: [],
      totals: { companies: 0, rfqs: 0 },
    }
  );
}

export async function createCompany(input: {
  name: string;
  sector?: string;
  country?: string;
  city?: string;
  website?: string;
  notes?: string;
  contact?: {
    fullName: string;
    email?: string;
    phone?: string;
    title?: string;
  };
}): Promise<CompanyItem> {
  return postAuthenticated<CompanyItem>("/api/companies", input);
}

export async function addContactToCompany(
  companyId: string,
  input: { fullName: string; email?: string; phone?: string; title?: string }
): Promise<CompanyContact> {
  return postAuthenticated<CompanyContact>(`/api/companies/${companyId}/contacts`, input);
}

export async function createQuoteRevision(
  rfqId: string,
  input: {
    currency: "GBP" | "EUR" | "USD" | "TRY";
    totalAmount: number;
    notes: string;
    autoSubmitForApproval: boolean;
    // Faz 3 — Feature 2: required for v2+, optional on first quote
    changeReason?: string;
    // Which RFQ revision this quote was priced against
    rfqRevisionId?: string;
  }
): Promise<{ id: string }> {
  return postAuthenticated<{ id: string }>(`/api/rfqs/${rfqId}/quotes`, input);
}

export async function reviseRfqRequest(
  rfqId: string,
  input: {
    projectName: string;
    deadline: string;
    projectDetails: string;
    requestedBy: string;
    // Faz 3 — Feature 2: required reason for this revision.
    changeReason: string;
  }
): Promise<RfqRecord> {
  return patchAuthenticated<RfqRecord>(`/api/rfqs/${rfqId}/request`, input);
}

export async function assignRfqToPricingUser(
  rfqId: string,
  input: {
    assignedPricingUserId: string;
  }
): Promise<RfqRecord> {
  return postAuthenticated<RfqRecord>(`/api/rfqs/${rfqId}/assignment`, input);
}

export async function decideQuoteApproval(
  rfqId: string,
  input: {
    quoteRevisionId: string;
    decision: "APPROVED" | "REJECTED";
    comment: string;
  }
): Promise<{ id: string }> {
  return postAuthenticated<{ id: string }>(`/api/rfqs/${rfqId}/approval`, input);
}

export async function setRfqStatus(
  rfqId: string,
  input: {
    status:
      | "NEW"
      | "IN_REVIEW"
      | "PRICING_IN_PROGRESS"
      | "PENDING_MANAGER_APPROVAL"
      | "QUOTED"
      | "REVISION_REQUESTED"
      | "WON"
      | "LOST"
      | "CLOSED";
    lostReason?: string;
  }
): Promise<RfqRecord> {
  return patchAuthenticated<RfqRecord>(`/api/rfqs/${rfqId}/status`, input);
}

export async function uploadRfqAttachment(
  rfqId: string,
  input: {
    fileName: string;
    mimeType: string;
    base64Data: string;
    quoteRevisionId?: string;
  }
): Promise<Attachment> {
  return postAuthenticated<Attachment>(`/api/rfqs/${rfqId}/attachments`, input);
}

export async function getPresignedUploadUrl(
  rfqId: string,
  input: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    quoteRevisionId?: string;
  }
): Promise<{ uploadUrl: string; storageKey: string }> {
  return postAuthenticated<{ uploadUrl: string; storageKey: string }>(`/api/rfqs/${rfqId}/attachments/presign-upload`, input);
}

export async function confirmUpload(
  rfqId: string,
  input: {
    storageKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    quoteRevisionId?: string;
  }
): Promise<Attachment> {
  return postAuthenticated<Attachment>(`/api/rfqs/${rfqId}/attachments/confirm-upload`, input);
}

export async function getPresignedDownloadUrl(
  attachmentId: string,
): Promise<{ downloadUrl: string; fileName: string; mimeType: string }> {
  return request<{ downloadUrl: string; fileName: string; mimeType: string }>(`/api/rfqs/attachments/${attachmentId}/presign-download`) as Promise<{ downloadUrl: string; fileName: string; mimeType: string }>;
}

export type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    role: string;
  };
};

export async function getComments(rfqId: string): Promise<CommentItem[]> {
  const result = await request<CommentItem[]>(`/api/rfqs/${rfqId}/comments`);
  return result ?? [];
}

export async function addComment(rfqId: string, body: string): Promise<CommentItem> {
  return postAuthenticated<CommentItem>(`/api/rfqs/${rfqId}/comments`, { body });
}

export async function getPricingUsers(): Promise<Array<{ id: string; fullName: string; email: string }>> {
  const result = await request<Array<{ id: string; fullName: string; email: string }>>("/api/rfqs/pricing-users");
  return result ?? [];
}

export async function getUsers(): Promise<ManagedUser[]> {
  const result = await request<ManagedUser[]>("/api/users");
  return result ?? [];
}

export async function createUser(input: {
  email: string;
  fullName: string;
  role: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
  password?: string;
  isActive: boolean;
}): Promise<ManagedUser> {
  return postAuthenticated<ManagedUser>("/api/users", input);
}

export async function resendInvite(userId: string): Promise<{ success: boolean }> {
  return postAuthenticated<{ success: boolean }>(`/api/users/${userId}/resend-invite`, {});
}

export async function updateUserRole(
  userId: string,
  role: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN"
): Promise<ManagedUser> {
  return patchAuthenticated<ManagedUser>(`/api/users/${userId}/role`, { role });
}

export async function updateUserActive(userId: string, isActive: boolean): Promise<ManagedUser> {
  return patchAuthenticated<ManagedUser>(`/api/users/${userId}/active`, { isActive });
}

export async function updateUserPassword(userId: string, password: string): Promise<{ success: boolean }> {
  return patchAuthenticated<{ success: boolean }>(`/api/users/${userId}/password`, { password });
}

export async function loginWithPassword(input: { email: string; password: string }): Promise<{
  accessToken: string;
  user: SessionUser;
}> {
  return postAnonymous("/api/auth/login", input);
}

export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  debugResetToken?: string;
  debugResetUrl?: string;
}> {
  return postAnonymous("/api/auth/forgot-password", { email });
}

export async function resetPasswordWithToken(input: { token: string; newPassword: string }): Promise<{ success: boolean }> {
  return postAnonymous("/api/auth/reset-password", input);
}

export async function changeMyPassword(input: { currentPassword: string; newPassword: string }): Promise<{ success: boolean }> {
  return patchAuthenticated<{ success: boolean }>("/api/auth/change-password", input);
}

export async function getMe(): Promise<{ user: SessionUser }> {
  const result = await request<{ user: SessionUser }>("/api/auth/me");

  if (!result) {
    throw new ApiClientError("UNAUTHORIZED", "Authentication is required.", 401);
  }

  return result;
}
