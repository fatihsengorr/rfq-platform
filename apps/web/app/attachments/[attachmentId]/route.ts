import { NextResponse } from "next/server";
import { resolveRequestOrigin } from "../../../lib/request-origin";
import { getSession } from "../../../lib/session";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const session = await getSession();

  if (!session.accessToken) {
    return NextResponse.redirect(new URL("/login", resolveRequestOrigin(request)), 303);
  }

  try {
    // Get presigned download URL from API
    const apiResponse = await fetch(
      `${API_BASE_URL}/api/rfqs/attachments/${encodeURIComponent(attachmentId)}/presign-download`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      }
    );

    if (apiResponse.status === 401) {
      return NextResponse.redirect(new URL("/login", resolveRequestOrigin(request)), 303);
    }

    if (!apiResponse.ok) {
      return NextResponse.json(
        { code: "ATTACHMENT_ERROR", message: "Could not retrieve attachment." },
        { status: apiResponse.status }
      );
    }

    const { downloadUrl } = await apiResponse.json() as { downloadUrl: string };

    // Redirect user directly to S3 presigned URL
    return NextResponse.redirect(downloadUrl, 302);
  } catch {
    return NextResponse.json(
      { code: "NETWORK_ERROR", message: "Attachment service is unreachable." },
      { status: 503 }
    );
  }
}
