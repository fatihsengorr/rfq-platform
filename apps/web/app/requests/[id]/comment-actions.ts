"use server";

/**
 * Server actions for the CommentSection client component.
 *
 * Same pattern as revision-actions.ts: the api.ts client reads the session
 * via next/headers, which only works in a server request scope. Calling it
 * directly from a client component's useEffect/submit handler throws
 * "headers was called outside a request scope" — which is exactly the bug
 * that silently broke the chat (both polling and sending swallowed the
 * error in empty catch blocks).
 */

import { redirect } from "next/navigation";
import { addComment, getComments, isApiClientError, type CommentItem } from "../../api";

export async function fetchComments(rfqId: string): Promise<CommentItem[]> {
  try {
    return await getComments(rfqId);
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }
}

export async function submitComment(rfqId: string, body: string): Promise<CommentItem> {
  try {
    return await addComment(rfqId, body);
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }
}
