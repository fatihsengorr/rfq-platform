import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRfq, isApiClientError, uploadRfqAttachment } from "../../api";
import { FlashNotice } from "../../components/flash-notice";
import { setFlashNotice } from "../../../lib/flash";
import { getSession } from "../../../lib/session";

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_ATTACHMENT_FILES = 10;

function parseFiles(formData: FormData, key: string) {
  return formData.getAll(key).filter((item): item is File => item instanceof File && item.size > 0);
}

function hasOversizedFile(files: File[]) {
  return files.some((file) => file.size > MAX_ATTACHMENT_BYTES);
}

async function createRfqAction(formData: FormData) {
  "use server";

  const projectName = String(formData.get("projectName") ?? "").trim();
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();
  const projectDetails = String(formData.get("projectDetails") ?? "").trim();
  const requestFiles = parseFiles(formData, "requestFiles");
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  const canCreateRfq = session.user.role === "LONDON_SALES" || session.user.role === "ADMIN";
  if (!canCreateRfq) {
    await setFlashNotice("/requests", "rfq_create_forbidden");
    redirect("/requests");
  }

  const requestedBy = session.user.fullName.trim();

  if (!projectName || !requestedBy || !deadlineRaw || !projectDetails) {
    await setFlashNotice("/requests/new", "rfq_create_failed");
    redirect("/requests/new");
  }

  if (requestFiles.length > MAX_ATTACHMENT_FILES) {
    await setFlashNotice("/requests/new", "attachment_too_many");
    redirect("/requests/new");
  }

  if (hasOversizedFile(requestFiles)) {
    await setFlashNotice("/requests/new", "attachment_too_large");
    redirect("/requests/new");
  }

  let destination = "/requests/new";

  try {
    const deadline = new Date(deadlineRaw).toISOString();
    const created = await createRfq({
      projectName,
      requestedBy,
      deadline,
      projectDetails
    });

    let createdNoticeCode = "rfq_created";

    if (requestFiles.length > 0) {
      try {
        for (const file of requestFiles) {
          const fileName = file.name?.trim() || "attachment.bin";
          const mimeType = file.type || "application/octet-stream";
          const bytes = Buffer.from(await file.arrayBuffer());
          const base64Data = bytes.toString("base64");

          await uploadRfqAttachment(created.id, {
            fileName,
            mimeType,
            base64Data
          });
        }

        createdNoticeCode = "rfq_created_with_files";
      } catch (error) {
        if (isApiClientError(error)) {
          if (error.code === "UNAUTHORIZED") redirect("/logout?next=/login");
          if (error.code === "RFQ_NOT_FOUND") {
            await setFlashNotice("/requests", "rfq_not_found");
            redirect("/requests");
          }
        }

        createdNoticeCode = "rfq_created_file_upload_failed";
      }
    }

    revalidatePath("/");
    revalidatePath("/requests");
    revalidatePath(`/requests/${created.id}`);
    await setFlashNotice(`/requests/${created.id}`, createdNoticeCode);
    destination = `/requests/${created.id}`;
  } catch (error) {
    let noticeCode = "rfq_create_failed";

    if (isApiClientError(error)) {
      if (error.code === "INVALID_REQUEST") noticeCode = "rfq_create_invalid";
      if (error.code === "FORBIDDEN") noticeCode = "rfq_create_forbidden";
      if (error.code === "NETWORK_ERROR") noticeCode = "api_unreachable";
      if (error.code === "UNAUTHORIZED") redirect("/logout?next=/login");
    }

    await setFlashNotice("/requests/new", noticeCode);
    destination = "/requests/new";
  }

  redirect(destination);
}

const requestNotices = {
  rfq_create_failed: {
    tone: "error",
    text: "RFQ could not be created. Please check fields and try again."
  },
  rfq_create_invalid: {
    tone: "error",
    text: "Request validation failed. Please review the required fields."
  },
  rfq_create_forbidden: {
    tone: "error",
    text: "You do not have permission to create an RFQ."
  },
  attachment_too_large: {
    tone: "error",
    text: "Attachment is too large. Max size is 50 MB per file."
  },
  attachment_too_many: {
    tone: "error",
    text: "You can upload up to 10 files at once."
  },
  api_unreachable: {
    tone: "error",
    text: "API is unreachable. Please check if backend is running."
  }
} as const;

export default async function NewRequestPage() {
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  const canCreateRfq = session.user.role === "LONDON_SALES" || session.user.role === "ADMIN";

  if (!canCreateRfq) {
    await setFlashNotice("/requests", "rfq_create_forbidden");
    redirect("/requests");
  }

  return (
    <main className="shell">
      <header className="page-header">
        <h1>New RFQ Request</h1>
        <p>Create a request for Istanbul pricing. Required fields must be completed before submission.</p>
      </header>

      <FlashNotice path="/requests/new" notices={requestNotices} />

      <section className="panel">
        <div className="panel-title-row">
          <h2>Request Details</h2>
          <span className="inline-hint">Visible to London users and admin</span>
        </div>

        <form action={createRfqAction} className="rfq-form clean-form">
          <label>
            <span>Project Name</span>
            <input name="projectName" type="text" required minLength={2} />
          </label>
          <label>
            <span>Requested By</span>
            <input name="requestedBy" type="text" value={session.user.fullName} readOnly />
          </label>
          <label>
            <span>Deadline</span>
            <input name="deadline" type="datetime-local" required />
          </label>
          <label className="full">
            <span>Project Details</span>
            <textarea name="projectDetails" required minLength={10} rows={4} />
          </label>
          <label className="full">
            <span>Request Files (Optional)</span>
            <input
              name="requestFiles"
              type="file"
              className="file-picker"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.dwg,.dxf,.step,.stp,.igs,.iges,application/pdf,image/*"
            />
          </label>
          <p className="inline-hint">Max 10 files, 50 MB each. Supported: PDF, images, CAD files.</p>
          <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
            <button type="submit" className="primary-btn">
              Create RFQ
            </button>
            <Link href="/requests" className="ghost-link">
              Back to Requests
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
