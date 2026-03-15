import { NextResponse } from "next/server";
import { getSession } from "../../../lib/session";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function pickResponseHeaders(source: Headers) {
  const headers = new Headers();
  const contentType = source.get("content-type");
  const contentDisposition = source.get("content-disposition");
  const contentLength = source.get("content-length");
  const cacheControl = source.get("cache-control");

  if (contentType) headers.set("content-type", contentType);
  if (contentDisposition) headers.set("content-disposition", contentDisposition);
  if (contentLength) headers.set("content-length", contentLength);
  if (cacheControl) headers.set("cache-control", cacheControl);

  return headers;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const session = await getSession();

  if (!session.accessToken) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  try {
    const apiResponse = await fetch(`${API_BASE_URL}/api/rfqs/attachments/${encodeURIComponent(attachmentId)}/download`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.accessToken}`
      },
      cache: "no-store"
    });

    if (apiResponse.status === 401) {
      return NextResponse.redirect(new URL("/login", request.url), 303);
    }

    return new NextResponse(apiResponse.body, {
      status: apiResponse.status,
      headers: pickResponseHeaders(apiResponse.headers)
    });
  } catch {
    return NextResponse.json(
      { code: "NETWORK_ERROR", message: "Attachment service is unreachable." },
      { status: 503 }
    );
  }
}
