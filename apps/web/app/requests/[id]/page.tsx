import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  assignRfqToPricingUser,
  createQuoteRevision,
  decideQuoteApproval,
  getPricingUsers,
  getRfqById,
  isApiClientError,
  reviseRfqRequest,
  uploadRfqAttachment
} from "../../api";
import { FlashNotice } from "../../components/flash-notice";
import { latestQuoteLabel, statusLabel } from "../../data";
import { setFlashNotice } from "../../../lib/flash";
import { getSession } from "../../../lib/session";

type Params = { id: string };

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_ATTACHMENT_FILES = 10;

function parseFiles(formData: FormData, key: string) {
  const files = formData.getAll(key).filter((item): item is File => item instanceof File && item.size > 0);
  return files;
}

function hasOversizedFile(files: File[]) {
  return files.some((file) => file.size > MAX_ATTACHMENT_BYTES);
}

async function reviseRequestAction(formData: FormData) {
  "use server";

  const rfqId = String(formData.get("rfqId") ?? "").trim();
  const projectName = String(formData.get("projectName") ?? "").trim();
  const requestedBy = String(formData.get("requestedBy") ?? "").trim();
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();
  const projectDetails = String(formData.get("projectDetails") ?? "").trim();

  if (!rfqId || !projectName || !requestedBy || !deadlineRaw || !projectDetails) {
    await setFlashNotice(`/requests/${rfqId}`, "request_revise_failed");
    redirect(`/requests/${rfqId}`);
  }

  try {
    const deadline = new Date(deadlineRaw).toISOString();
    await reviseRfqRequest(rfqId, {
      projectName,
      requestedBy,
      deadline,
      projectDetails
    });

    revalidatePath("/");
    revalidatePath("/requests");
    revalidatePath(`/requests/${rfqId}`);
    await setFlashNotice(`/requests/${rfqId}`, "request_revised");
  } catch (error) {
    let noticeCode = "request_revise_failed";

    if (isApiClientError(error)) {
      if (error.code === "FORBIDDEN") noticeCode = "request_revise_forbidden";
      if (error.code === "INVALID_REQUEST") noticeCode = "request_revise_invalid";
      if (error.code === "NETWORK_ERROR") noticeCode = "api_unreachable";
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "RFQ_NOT_FOUND") {
        await setFlashNotice("/requests", "rfq_not_found");
        redirect("/requests");
      }
    }

    await setFlashNotice(`/requests/${rfqId}`, noticeCode);
  }

  redirect(`/requests/${rfqId}`);
}

async function assignPricingUserAction(formData: FormData) {
  "use server";

  const rfqId = String(formData.get("rfqId") ?? "").trim();
  const assignedPricingUserId = String(formData.get("assignedPricingUserId") ?? "").trim();

  if (!rfqId || !assignedPricingUserId) {
    await setFlashNotice(`/requests/${rfqId}`, "assignment_failed");
    redirect(`/requests/${rfqId}`);
  }

  try {
    await assignRfqToPricingUser(rfqId, { assignedPricingUserId });
    revalidatePath("/");
    revalidatePath("/requests");
    revalidatePath(`/requests/${rfqId}`);
    await setFlashNotice(`/requests/${rfqId}`, "assignment_saved");
  } catch (error) {
    let noticeCode = "assignment_failed";

    if (isApiClientError(error)) {
      if (error.code === "FORBIDDEN") noticeCode = "assignment_forbidden";
      if (error.code === "INVALID_REQUEST") noticeCode = "assignment_invalid";
      if (error.code === "NETWORK_ERROR") noticeCode = "api_unreachable";
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "RFQ_NOT_FOUND") {
        await setFlashNotice("/requests", "rfq_not_found");
        redirect("/requests");
      }
    }

    await setFlashNotice(`/requests/${rfqId}`, noticeCode);
  }

  redirect(`/requests/${rfqId}`);
}

async function uploadRequestAttachmentsAction(formData: FormData) {
  "use server";

  const rfqId = String(formData.get("rfqId") ?? "").trim();
  const files = parseFiles(formData, "requestFiles");

  if (!rfqId || files.length === 0) {
    await setFlashNotice(`/requests/${rfqId}`, "attachment_failed");
    redirect(`/requests/${rfqId}`);
  }

  if (files.length > MAX_ATTACHMENT_FILES) {
    await setFlashNotice(`/requests/${rfqId}`, "attachment_too_many");
    redirect(`/requests/${rfqId}`);
  }

  if (hasOversizedFile(files)) {
    await setFlashNotice(`/requests/${rfqId}`, "attachment_too_large");
    redirect(`/requests/${rfqId}`);
  }

  try {
    for (const file of files) {
      const fileName = file.name?.trim() || "attachment.bin";
      const mimeType = file.type || "application/octet-stream";
      const bytes = Buffer.from(await file.arrayBuffer());
      const base64Data = bytes.toString("base64");

      await uploadRfqAttachment(rfqId, {
        fileName,
        mimeType,
        base64Data
      });
    }

    revalidatePath("/");
    revalidatePath("/requests");
    revalidatePath(`/requests/${rfqId}`);
    await setFlashNotice(`/requests/${rfqId}`, files.length === 1 ? "attachment_uploaded" : "attachments_uploaded");
  } catch (error) {
    let noticeCode = "attachment_failed";

    if (isApiClientError(error)) {
      if (error.code === "ATTACHMENT_TOO_LARGE") noticeCode = "attachment_too_large";
      if (error.code === "ATTACHMENT_UNSUPPORTED") noticeCode = "attachment_unsupported";
      if (error.code === "INVALID_REQUEST") noticeCode = "attachment_invalid";
      if (error.code === "FORBIDDEN") noticeCode = "attachment_forbidden";
      if (error.code === "NETWORK_ERROR" || error.code === "STORAGE_ERROR") noticeCode = "api_unreachable";
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "RFQ_NOT_FOUND") {
        await setFlashNotice("/requests", "rfq_not_found");
        redirect("/requests");
      }
    }

    await setFlashNotice(`/requests/${rfqId}`, noticeCode);
  }

  redirect(`/requests/${rfqId}`);
}

async function createQuoteRevisionAction(formData: FormData) {
  "use server";

  const rfqId = String(formData.get("rfqId") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim() as "GBP" | "EUR" | "USD" | "TRY";
  const totalAmountRaw = String(formData.get("totalAmount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const autoSubmitForApproval = formData.get("autoSubmitForApproval") === "on";
  const quoteFiles = parseFiles(formData, "quoteFiles");

  if (!rfqId || !currency || !totalAmountRaw || !notes) {
    await setFlashNotice(`/requests/${rfqId}`, "quote_create_failed");
    redirect(`/requests/${rfqId}`);
  }

  if (quoteFiles.length > MAX_ATTACHMENT_FILES) {
    await setFlashNotice(`/requests/${rfqId}`, "attachment_too_many");
    redirect(`/requests/${rfqId}`);
  }

  if (hasOversizedFile(quoteFiles)) {
    await setFlashNotice(`/requests/${rfqId}`, "attachment_too_large");
    redirect(`/requests/${rfqId}`);
  }

  const totalAmount = Number(totalAmountRaw);

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    await setFlashNotice(`/requests/${rfqId}`, "quote_create_failed");
    redirect(`/requests/${rfqId}`);
  }

  let noticeCode = "quote_created";

  try {
    const created = await createQuoteRevision(rfqId, {
      currency,
      totalAmount,
      notes,
      autoSubmitForApproval
    });

    if (quoteFiles.length > 0) {
      try {
        for (const file of quoteFiles) {
          const fileName = file.name?.trim() || "attachment.bin";
          const mimeType = file.type || "application/octet-stream";
          const bytes = Buffer.from(await file.arrayBuffer());
          const base64Data = bytes.toString("base64");

          await uploadRfqAttachment(rfqId, {
            fileName,
            mimeType,
            base64Data,
            quoteRevisionId: created.id
          });
        }

        noticeCode = "quote_created_with_files";
      } catch {
        noticeCode = "quote_created_file_upload_failed";
      }
    }

    revalidatePath("/");
    revalidatePath("/requests");
    revalidatePath(`/requests/${rfqId}`);
    await setFlashNotice(`/requests/${rfqId}`, noticeCode);
  } catch (error) {
    noticeCode = "quote_create_failed";

    if (isApiClientError(error)) {
      if (error.code === "INVALID_REQUEST") noticeCode = "quote_create_invalid";
      if (error.code === "FORBIDDEN") noticeCode = "quote_create_forbidden";
      if (error.code === "NETWORK_ERROR") noticeCode = "api_unreachable";
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "RFQ_NOT_FOUND") {
        await setFlashNotice("/requests", "rfq_not_found");
        redirect("/requests");
      }
    }

    await setFlashNotice(`/requests/${rfqId}`, noticeCode);
  }

  redirect(`/requests/${rfqId}`);
}

async function decideApprovalAction(formData: FormData) {
  "use server";

  const rfqId = String(formData.get("rfqId") ?? "").trim();
  const quoteRevisionId = String(formData.get("quoteRevisionId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim() as "APPROVED" | "REJECTED";
  const comment = String(formData.get("comment") ?? "").trim();

  if (!rfqId || !quoteRevisionId || !decision || !comment) {
    await setFlashNotice(`/requests/${rfqId}`, "approval_failed");
    redirect(`/requests/${rfqId}`);
  }

  try {
    await decideQuoteApproval(rfqId, {
      quoteRevisionId,
      decision,
      comment
    });

    revalidatePath("/");
    revalidatePath("/requests");
    revalidatePath(`/requests/${rfqId}`);
    await setFlashNotice(`/requests/${rfqId}`, decision === "APPROVED" ? "approval_approved" : "approval_rejected");
  } catch (error) {
    let noticeCode = "approval_failed";

    if (isApiClientError(error)) {
      if (error.code === "INVALID_REQUEST") noticeCode = "approval_invalid";
      if (error.code === "FORBIDDEN") noticeCode = "approval_forbidden";
      if (error.code === "QUOTE_REVISION_NOT_FOUND" || error.code === "RFQ_NOT_FOUND") noticeCode = "approval_target_missing";
      if (error.code === "NETWORK_ERROR") noticeCode = "api_unreachable";
      if (error.code === "UNAUTHORIZED") redirect("/login");
    }

    await setFlashNotice(`/requests/${rfqId}`, noticeCode);
  }

  redirect(`/requests/${rfqId}`);
}

const detailNotices = {
  rfq_created: { tone: "success", text: "RFQ request has been created." },
  rfq_created_with_files: { tone: "success", text: "RFQ request has been created with request files." },
  rfq_created_file_upload_failed: { tone: "warn", text: "RFQ created, but request file upload failed." },
  request_revised: { tone: "success", text: "RFQ request details were revised." },
  request_revise_failed: { tone: "error", text: "RFQ request revision failed." },
  request_revise_forbidden: { tone: "error", text: "Only London users can revise request details." },
  request_revise_invalid: { tone: "error", text: "Request revision input is invalid." },
  assignment_saved: { tone: "success", text: "Istanbul pricing assignment has been saved." },
  assignment_failed: { tone: "error", text: "Assignment failed." },
  assignment_forbidden: { tone: "error", text: "Only Istanbul manager can assign RFQs." },
  assignment_invalid: { tone: "error", text: "Assignment input is invalid." },
  quote_created: { tone: "success", text: "Quote revision has been created." },
  quote_created_with_files: { tone: "success", text: "Quote revision and quote files have been created." },
  quote_created_file_upload_failed: { tone: "warn", text: "Quote revision created, but quote file upload failed." },
  quote_create_failed: { tone: "error", text: "Quote revision could not be created." },
  quote_create_invalid: { tone: "error", text: "Quote revision input is invalid." },
  quote_create_forbidden: { tone: "error", text: "You are not allowed to create quote revisions for this RFQ." },
  approval_approved: { tone: "success", text: "Manager decision saved: APPROVED." },
  approval_rejected: { tone: "warn", text: "Manager decision saved: REJECTED." },
  approval_failed: { tone: "error", text: "Manager decision failed." },
  approval_invalid: { tone: "error", text: "Approval input is invalid." },
  approval_forbidden: { tone: "error", text: "Only Istanbul manager can approve quotes." },
  approval_target_missing: { tone: "error", text: "Selected RFQ or quote revision was not found." },
  attachment_uploaded: { tone: "success", text: "Attachment uploaded successfully." },
  attachments_uploaded: { tone: "success", text: "Attachments uploaded successfully." },
  attachment_failed: { tone: "error", text: "Attachment upload failed." },
  attachment_invalid: { tone: "error", text: "Attachment request is invalid." },
  attachment_forbidden: { tone: "error", text: "You are not allowed to upload these attachments." },
  attachment_too_large: { tone: "error", text: "Attachment is too large. Max size is 50 MB per file." },
  attachment_too_many: { tone: "error", text: "You can upload up to 10 files at once." },
  attachment_unsupported: { tone: "error", text: "Unsupported file type. Allowed: PDF, image, and CAD files." },
  rfq_not_found: { tone: "error", text: "RFQ record was not found." },
  api_unreachable: { tone: "error", text: "API is unreachable. Please check backend status." }
} as const;

type DetailTab = "overview" | "files" | "revisions" | "timeline";
type ActionTab = "revise" | "upload" | "quote" | "assign" | "approval";

function buildDetailHref(rfqId: string, tab: DetailTab, action?: ActionTab) {
  const query = new URLSearchParams();
  query.set("tab", tab);

  if (action) {
    query.set("action", action);
  }

  return `/requests/${rfqId}?${query.toString()}`;
}

function buildActionHref(rfqId: string, activeTab: DetailTab, action: ActionTab) {
  return buildDetailHref(rfqId, activeTab, action);
}

export default async function RequestDetailPage({
  params,
  searchParams
}: {
  params: Promise<Params>;
  searchParams: Promise<{ tab?: string; action?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  const role = session.user.role;
  const canReviseRequest = role === "LONDON_SALES" || role === "ADMIN";
  const canCreateQuote = role === "ISTANBUL_PRICING" || role === "ADMIN";
  const canManageAssignmentAndApproval = role === "ISTANBUL_MANAGER" || role === "ADMIN";

  let record = null;

  try {
    record = await getRfqById(id);
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") {
      redirect("/login");
    }

    record = null;
  }

  if (!record) {
    return (
      <main className="shell">
        <section className="panel">
          <h1>Record not found</h1>
          <Link href="/requests" className="primary-btn">
            Back to list
          </Link>
        </section>
      </main>
    );
  }

  let pricingUsers: Array<{ id: string; fullName: string; email: string }> = [];

  if (canManageAssignmentAndApproval) {
    try {
      pricingUsers = await getPricingUsers();
    } catch (error) {
      if (isApiClientError(error) && error.code === "UNAUTHORIZED") {
        redirect("/login");
      }
    }
  }

  const pendingRevisions = record.quoteRevisions.filter((revision) => revision.status === "SUBMITTED");
  const isoDeadlineLocal = new Date(record.deadline).toISOString().slice(0, 16);
  const detailTabs: DetailTab[] = ["overview", "files", "revisions", "timeline"];
  const activeTab = detailTabs.includes((query.tab ?? "") as DetailTab) ? ((query.tab as DetailTab) ?? "overview") : "overview";

  const availableActions: Array<{ key: ActionTab; label: string }> = [];

  if (canReviseRequest) {
    availableActions.push({ key: "revise", label: "Revise Request" });
    availableActions.push({ key: "upload", label: "Upload Request Files" });
  }

  if (canCreateQuote) {
    availableActions.push({ key: "quote", label: "Create Quote" });
  }

  if (canManageAssignmentAndApproval) {
    availableActions.push({ key: "assign", label: "Assign Pricing" });
    availableActions.push({ key: "approval", label: "Manager Approval" });
  }

  const activeAction =
    availableActions.some((item) => item.key === (query.action as ActionTab))
      ? ((query.action as ActionTab) ?? availableActions[0]?.key)
      : (availableActions[0]?.key ?? null);

  return (
    <main className="shell">
      <Link href="/requests" className="ghost-link">
        ← Back to list
      </Link>

      <header className="page-header">
        <h1>{record.projectName}</h1>
        <p>RFQ #{record.id}</p>
      </header>
      <FlashNotice path={`/requests/${id}`} notices={detailNotices} />

      <section className="panel request-summary">
        <div className="request-summary-grid">
          <div>
            <p className="request-summary-label">RFQ Status</p>
            <span className={`status-pill status-${record.status}`}>{statusLabel(record.status)}</span>
          </div>
          <div>
            <p className="request-summary-label">Deadline</p>
            <strong>{new Date(record.deadline).toLocaleString("en-GB")}</strong>
          </div>
          <div>
            <p className="request-summary-label">Requested By</p>
            <strong>{record.requestedBy}</strong>
          </div>
          <div>
            <p className="request-summary-label">Assigned Pricing</p>
            <strong>{record.assignedPricingUser ?? "Not assigned yet"}</strong>
          </div>
          <div>
            <p className="request-summary-label">Latest Quote Visible</p>
            <strong>{latestQuoteLabel(record) === "-" ? "None yet" : latestQuoteLabel(record)}</strong>
          </div>
          <div>
            <p className="request-summary-label">Total Files</p>
            <strong>{record.attachments.length + record.quoteRevisions.reduce((sum, revision) => sum + revision.attachments.length, 0)}</strong>
          </div>
        </div>
        <p className="request-summary-notes">{record.projectDetails}</p>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>Action Center</h2>
          <span className="inline-hint">Role-based actions</span>
        </div>

        {availableActions.length === 0 ? (
          <p>No available actions for your role.</p>
        ) : (
          <>
            <div className="request-action-tabs">
              {availableActions.map((item) => (
                <a key={item.key} href={buildActionHref(record.id, activeTab, item.key)} className={`request-action-tab${activeAction === item.key ? " is-active" : ""}`}>
                  {item.label}
                </a>
              ))}
            </div>

            {activeAction === "revise" && (
              <form action={reviseRequestAction} className="rfq-form clean-form" style={{ marginTop: "0.8rem" }}>
                <input type="hidden" name="rfqId" value={record.id} />
                <label>
                  <span>Project Name</span>
                  <input name="projectName" type="text" minLength={2} required defaultValue={record.projectName} />
                </label>
                <label>
                  <span>Requested By</span>
                  <input name="requestedBy" type="text" minLength={2} required defaultValue={record.requestedBy} />
                </label>
                <label>
                  <span>Deadline</span>
                  <input name="deadline" type="datetime-local" required defaultValue={isoDeadlineLocal} />
                </label>
                <label className="full">
                  <span>Project Details</span>
                  <textarea name="projectDetails" rows={4} minLength={10} required defaultValue={record.projectDetails} />
                </label>
                <button type="submit" className="primary-btn">
                  Save Request Revision
                </button>
              </form>
            )}

            {activeAction === "upload" && (
              <form action={uploadRequestAttachmentsAction} className="rfq-form clean-form" style={{ marginTop: "0.8rem" }}>
                <input type="hidden" name="rfqId" value={record.id} />
                <label className="full">
                  <span>Request Files</span>
                  <input
                    name="requestFiles"
                    type="file"
                    className="file-picker"
                    required
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.dwg,.dxf,.step,.stp,.igs,.iges,application/pdf,image/*"
                  />
                </label>
                <button type="submit" className="primary-btn">
                  Upload Request Files
                </button>
              </form>
            )}

            {activeAction === "quote" && (
              <form action={createQuoteRevisionAction} className="rfq-form clean-form" style={{ marginTop: "0.8rem" }}>
                <input type="hidden" name="rfqId" value={record.id} />
                <label>
                  <span>Currency</span>
                  <select name="currency" defaultValue="GBP" required>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="TRY">TRY</option>
                  </select>
                </label>
                <label>
                  <span>Total Amount</span>
                  <input name="totalAmount" type="number" step="0.01" min="0.01" required />
                </label>
                <label className="full">
                  <span>Notes</span>
                  <textarea name="notes" rows={3} minLength={2} required />
                </label>
                <label className="full">
                  <span>Quote Files (optional)</span>
                  <input
                    name="quoteFiles"
                    type="file"
                    className="file-picker"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.dwg,.dxf,.step,.stp,.igs,.iges,application/pdf,image/*"
                  />
                </label>
                <label>
                  <span>Submit For Approval</span>
                  <input name="autoSubmitForApproval" type="checkbox" defaultChecked />
                </label>
                <button type="submit" className="primary-btn">
                  Create Quote Revision
                </button>
              </form>
            )}

            {activeAction === "assign" && (
              <>
                {pricingUsers.length === 0 ? (
                  <p style={{ marginTop: "0.8rem" }}>No active Istanbul pricing users found.</p>
                ) : (
                  <form action={assignPricingUserAction} className="rfq-form clean-form" style={{ marginTop: "0.8rem" }}>
                    <input type="hidden" name="rfqId" value={record.id} />
                    <label>
                      <span>Assign To</span>
                      <select name="assignedPricingUserId" required defaultValue={record.assignedPricingUserId ?? ""}>
                        <option value="" disabled>
                          Select pricing user
                        </option>
                        {pricingUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.fullName} ({user.email})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="primary-btn">
                      Save Assignment
                    </button>
                  </form>
                )}
              </>
            )}

            {activeAction === "approval" && (
              <>
                {pendingRevisions.length === 0 ? (
                  <p style={{ marginTop: "0.8rem" }}>No submitted quote revisions waiting for approval.</p>
                ) : (
                  <form action={decideApprovalAction} className="rfq-form clean-form" style={{ marginTop: "0.8rem" }}>
                    <input type="hidden" name="rfqId" value={record.id} />
                    <label>
                      <span>Revision</span>
                      <select name="quoteRevisionId" required>
                        {pendingRevisions.map((revision) => (
                          <option key={revision.id} value={revision.id}>
                            V{revision.versionNumber} - {revision.currency} {revision.totalAmount.toLocaleString("en-GB")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Decision</span>
                      <select name="decision" defaultValue="APPROVED" required>
                        <option value="APPROVED">APPROVED</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </label>
                    <label className="full">
                      <span>Comment</span>
                      <textarea name="comment" rows={3} minLength={2} required />
                    </label>
                    <button type="submit" className="primary-btn">
                      Save Manager Decision
                    </button>
                  </form>
                )}
              </>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>Details</h2>
          <Link href="/quotes" className="ghost-link">
            Open Quotes
          </Link>
        </div>

        <div className="request-detail-tabs">
          <a href={buildDetailHref(record.id, "overview", activeAction ?? undefined)} className={`request-detail-tab${activeTab === "overview" ? " is-active" : ""}`}>
            Overview
          </a>
          <a href={buildDetailHref(record.id, "files", activeAction ?? undefined)} className={`request-detail-tab${activeTab === "files" ? " is-active" : ""}`}>
            Files
          </a>
          <a href={buildDetailHref(record.id, "revisions", activeAction ?? undefined)} className={`request-detail-tab${activeTab === "revisions" ? " is-active" : ""}`}>
            Revisions
          </a>
          <a href={buildDetailHref(record.id, "timeline", activeAction ?? undefined)} className={`request-detail-tab${activeTab === "timeline" ? " is-active" : ""}`}>
            Timeline
          </a>
        </div>

        {activeTab === "overview" && (
          <article className="request-detail-pane">
            <dl className="kv">
              <div>
                <dt>Deadline</dt>
                <dd>{new Date(record.deadline).toLocaleString("en-GB")}</dd>
              </div>
              <div>
                <dt>Requested By</dt>
                <dd>{record.requestedBy}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{statusLabel(record.status)}</dd>
              </div>
              <div>
                <dt>Assigned Pricing User</dt>
                <dd>{record.assignedPricingUser ?? "Not assigned yet"}</dd>
              </div>
              <div>
                <dt>Assigned By</dt>
                <dd>{record.assignedBy ?? "-"}</dd>
              </div>
              <div>
                <dt>Latest Quote Visible</dt>
                <dd>{latestQuoteLabel(record) === "-" ? "None yet" : latestQuoteLabel(record)}</dd>
              </div>
              <div>
                <dt>Request Attachment Count</dt>
                <dd>{record.attachments.length}</dd>
              </div>
            </dl>
          </article>
        )}

        {activeTab === "files" && (
          <article className="request-detail-pane">
            <div className="detail-grid">
              <section>
                <h3>Request Files</h3>
                {record.attachments.length === 0 ? (
                  <p>No request attachments yet.</p>
                ) : (
                  <ul className="timeline">
                    {record.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        <a href={`/attachments/${attachment.id}`} target="_blank" rel="noreferrer">
                          {attachment.fileName}
                        </a>{" "}
                        ({attachment.mimeType}) uploaded by {attachment.uploadedBy}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3>Quote Files</h3>
                {record.quoteRevisions.every((revision) => revision.attachments.length === 0) ? (
                  <p>No quote attachments visible.</p>
                ) : (
                  <ul className="timeline">
                    {record.quoteRevisions.flatMap((revision) =>
                      revision.attachments.map((attachment) => (
                        <li key={attachment.id}>
                          V{revision.versionNumber}:{" "}
                          <a href={`/attachments/${attachment.id}`} target="_blank" rel="noreferrer">
                            {attachment.fileName}
                          </a>{" "}
                          ({attachment.mimeType}) uploaded by {attachment.uploadedBy}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </section>
            </div>
          </article>
        )}

        {activeTab === "revisions" && (
          <article className="request-detail-pane">
            {record.quoteRevisions.length === 0 ? (
              <p>No quote revisions yet.</p>
            ) : (
              <div className="data-table">
                <div className="data-head quote-grid">
                  <span>Version</span>
                  <span>Amount</span>
                  <span>Status</span>
                  <span>Created By</span>
                  <span>Created At</span>
                </div>
                {record.quoteRevisions.map((revision) => (
                  <div key={revision.id} className="data-row quote-grid">
                    <span>V{revision.versionNumber}</span>
                    <span>
                      {revision.currency} {revision.totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`status-pill status-${revision.status}`}>{revision.status}</span>
                    <span>{revision.createdBy}</span>
                    <span>{new Date(revision.createdAt).toLocaleString("en-GB")}</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        )}

        {activeTab === "timeline" && (
          <article className="request-detail-pane">
            <ol className="timeline">
              <li>RFQ created: {new Date(record.createdAt).toLocaleString("en-GB")}</li>
              {record.quoteRevisions.map((revision) => (
                <li key={revision.id}>
                  Quote V{revision.versionNumber} ({revision.status}) created ({revision.currency} {revision.totalAmount.toLocaleString("en-GB")}):{" "}
                  {new Date(revision.createdAt).toLocaleString("en-GB")}
                </li>
              ))}
              {record.approvals.map((approval) => (
                <li key={approval.id}>
                  Manager decision ({approval.decision}): {new Date(approval.decidedAt).toLocaleString("en-GB")}
                </li>
              ))}
            </ol>
          </article>
        )}
      </section>
    </main>
  );
}
